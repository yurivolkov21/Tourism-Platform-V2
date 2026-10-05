'use client';

import { type AdminPostDetail, type AdminPostTag, POST_EXCERPT_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Card, CardContent } from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { Textarea } from '@tourism/ui/components/textarea';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/kit/form-field';
import { useReportUnsaved } from '@/components/kit/unsaved-changes';
import { StepColumns } from '@/components/tours/editor/editor-form-frame';
import { isUncertainOutcome } from '@/lib/api/write-error';
import { hasFormErrors } from '@/lib/form-errors';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import {
  POST_FORM_ID,
  type PostFormValues,
  type PostTourOption,
  postFormValues,
  postPayload,
  projectedPostReadiness,
  validatePostForm,
  withStatus,
} from '@/lib/post-form';
import { POSTS_LIST_HREF } from '@/lib/posts-view';
import {
  type DeletePostAction,
  type SignCoverAction,
  type UpdatePostAction,
  type UpdatePostResult,
  updatePostErrorCopy,
} from '@/lib/posts-write';
import { useServerClock } from '@/lib/server-clock';
import { isNewerVersion, useVersionedForm } from '@/lib/use-versioned-form';
import { DeletePostZone } from './delete-post-zone';
import { MarkdownEditor } from './markdown-editor';
import { PostBanner, type PostBannerState } from './post-banner';
import { PostCoverCard } from './post-cover-card';
import { PostEditorHeader } from './post-editor-header';
import { PostPublishCard } from './post-publish-card';
import { PostTagsCard } from './post-tags-card';
import { PostToursCard } from './post-tours-card';

/**
 * Trang sửa một bài (spec P4e-4 §4.4, ADR-0051 §8) — MỘT form, MỘT nút Save gửi cả form
 * (`admin.posts.update`). Không dùng khung bước của tour (`EditorFormFrame`): một bài viết
 * không có phần nào nặng tới mức phải lưu riêng; chỉ mượn lưới hai cột `StepColumns`.
 *
 * - Giá trị đang soạn, bản gốc, phiên bản: `useVersionedForm` (lõi chung với tour).
 * - Chọn Published mà còn thiếu thì chặn TRƯỚC khi gửi bằng chính hàm server dùng
 *   (Quyết định 11); mã `POST_NOT_READY` từ server vẫn được xử, cùng một dải báo.
 * - Dải báo và câu lỗi của card chỉ sống cùng phiên bản đã sinh ra chúng — Reload nạp bản
 *   mới là chúng tự tắt.
 * - Phần đầu đọc bản ĐÃ LƯU, cột phải đọc bản ĐANG SOẠN.
 */
const t = messages.admin.posts.editor;

const STALE: PostBannerState = { kind: 'stale' };

export interface PostEditorProps {
  detail: AdminPostDetail;
  /** Giờ server lúc trang render (ISO) — mốc của "bây giờ" khi tự điền ngày đăng. */
  serverNow: string;
  update: UpdatePostAction;
  signCover: SignCoverAction;
  loadLibrary: LoadPhotoLibraryAction;
  tagOptions: AdminPostTag[];
  tourOptions: PostTourOption[];
  remove: DeletePostAction;
}

export function PostEditor({
  detail,
  serverNow,
  update,
  signCover,
  loadLibrary,
  tagOptions,
  tourOptions,
  remove,
}: PostEditorProps) {
  const router = useRouter();
  const form = useVersionedForm(detail, postFormValues);
  const clock = useServerClock(serverNow);
  const { values, version } = form;
  /** Bản server mới nhất form biết — lần lưu vừa xong, hay `detail` mới hơn sau Reload. */
  const [lastSaved, setLastSaved] = useState(detail);
  const saved = isNewerVersion(detail.version, lastSaved.version) ? detail : lastSaved;

  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<{ state: PostBannerState; version: string } | null>(null);
  /** Ảnh bìa đang tải lên — việc chưa lưu không nằm trong giá trị form (khuôn `busy` của F18). */
  const [uploading, setUploading] = useState(false);
  /**
   * Câu báo của lần lưu vừa rồi nói về MỘT card cụ thể — hiện ngay tại card ấy (spec §4.4),
   * sống cùng phiên bản đã sinh ra nó như dải báo.
   */
  const [cardError, setCardError] = useState<{
    code: 'PHOTO_NOT_ALLOWED' | 'RELATED_TOUR_NOT_FOUND';
    version: string;
    /** Câu riêng thay câu chung của mã — tour đã mất đã được gỡ (vòng review P4e-4). */
    message?: string;
  } | null>(null);

  useReportUnsaved(form.dirty || uploading);

  const errors = form.showValidation ? validatePostForm(values) : {};
  const missing = projectedPostReadiness(values);
  const shownBanner =
    banner !== null && banner.version === version
      ? banner.state
      : form.serverChanged
        ? STALE
        : null;
  const shownCardError = cardError !== null && cardError.version === version ? cardError : null;

  function patch(next: Partial<PostFormValues>) {
    form.setValues((current) => ({ ...current, ...next }));
  }

  async function save() {
    if (inFlight.current) return;
    form.setShowValidation(true);
    if (hasFormErrors(validatePostForm(values))) return;
    if (values.status === 'PUBLISHED' && missing.length > 0) {
      setBanner({ state: { kind: 'notReady', missing }, version });
      return;
    }

    inFlight.current = true;
    setPending(true);
    setBanner(null);
    setCardError(null);
    // Bản đã gửi — lưu xong chỉ thay form bằng bản server khi người dùng chưa gõ thêm.
    const sent = values;
    let result: UpdatePostResult;
    try {
      result = await update(postPayload(detail.id, version, sent));
    } catch {
      // Action ném (mạng đứt, redeploy) ⇒ không biết lệnh đã đi tới đâu — như `useSectionSave`.
      result = { ok: false, code: 'GENERIC' };
    }
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      form.settle(result.detail, sent);
      setLastSaved(result.detail);
      toast.success(t.saved);
      router.refresh();
      return;
    }
    const { code } = result;
    if (code === 'STALE_POST') {
      setBanner({ state: STALE, version });
    } else if (code === 'POST_NOT_READY') {
      // Server tính từ chính input nên hai bên luôn khớp; danh sách rỗng chỉ khi có lỗi lạ.
      setBanner({
        state:
          missing.length > 0
            ? { kind: 'notReady', missing }
            : { kind: 'error', message: updatePostErrorCopy(code), uncertain: false },
        version,
      });
    } else if (code === 'NOT_FOUND') {
      toast.error(updatePostErrorCopy(code));
      router.push(POSTS_LIST_HREF);
    } else if (code === 'RELATED_TOUR_NOT_FOUND' && (result.missingTourIds ?? []).length > 0) {
      // Xoá tour không đổi phiên bản bài nên Reload không sửa được danh sách: gỡ ĐÚNG các tour
      // đã mất khỏi form, nói tên chúng — lần lưu kế gửi phần còn lại.
      const gone = new Set(result.missingTourIds);
      const titles = values.relatedTours
        .filter((tour) => gone.has(tour.id))
        .map((tour) => tour.title);
      form.setValues((current) => ({
        ...current,
        relatedTours: current.relatedTours.filter((tour) => !gone.has(tour.id)),
      }));
      setCardError({ code, version, message: t.tours.removedGone(titles) });
    } else if (code === 'PHOTO_NOT_ALLOWED' || code === 'RELATED_TOUR_NOT_FOUND') {
      setCardError({ code, version });
    } else {
      // Mọi mã còn lại hiện ở dải đỏ, kèm Reload khi không rõ lệnh đã đi tới đâu.
      setBanner({
        state: {
          kind: 'error',
          message: updatePostErrorCopy(code),
          uncertain: isUncertainOutcome(code),
        },
        version,
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <PostEditorHeader detail={saved} />
      <StepColumns
        aside={
          <>
            <PostPublishCard
              status={values.status}
              publishAt={values.publishAt}
              missing={missing}
              publishAtError={errors.publishAt}
              pending={pending}
              dirty={form.dirty}
              blockedNote={uploading ? t.busyUploading : undefined}
              onStatusChange={(status) =>
                form.setValues((current) =>
                  withStatus(current, status, clock(), form.base.publishAt),
                )
              }
              onPublishAtChange={(publishAt) => patch({ publishAt })}
            />
            <PostCoverCard
              postId={detail.id}
              cover={values.cover}
              altError={errors.coverAlt}
              serverError={
                shownCardError?.code === 'PHOTO_NOT_ALLOWED'
                  ? updatePostErrorCopy('PHOTO_NOT_ALLOWED')
                  : null
              }
              onChange={(cover) => patch({ cover })}
              onBusyChange={setUploading}
              sign={signCover}
              loadLibrary={loadLibrary}
            />
            <PostTagsCard
              tags={values.tags}
              options={tagOptions}
              onChange={(tags) => patch({ tags })}
            />
            <PostToursCard
              tours={values.relatedTours}
              options={tourOptions}
              serverError={
                shownCardError?.code === 'RELATED_TOUR_NOT_FOUND'
                  ? (shownCardError.message ?? updatePostErrorCopy('RELATED_TOUR_NOT_FOUND'))
                  : null
              }
              onChange={(relatedTours) => patch({ relatedTours })}
            />
          </>
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          <form
            id={POST_FORM_ID}
            noValidate
            className="flex min-w-0 flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.dirty && !pending) void save();
            }}
          >
            {shownBanner ? <PostBanner banner={shownBanner} onReload={form.reload} /> : null}

            <Card>
              <CardContent className="grid gap-4">
                <FormField id="post-title" label={t.fields.title} error={errors.title}>
                  {(describedBy) => (
                    <Input
                      id="post-title"
                      value={values.title}
                      aria-invalid={errors.title !== undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => patch({ title: event.target.value })}
                    />
                  )}
                </FormField>
                <div className="grid gap-1">
                  <FormField
                    id="post-excerpt"
                    label={t.fields.excerpt}
                    hint={t.fields.excerptHint}
                    error={errors.excerpt}
                  >
                    {(describedBy) => (
                      <Textarea
                        id="post-excerpt"
                        rows={3}
                        value={values.excerpt}
                        aria-invalid={errors.excerpt !== undefined}
                        aria-describedby={describedBy}
                        onChange={(event) => patch({ excerpt: event.target.value })}
                      />
                    )}
                  </FormField>
                  <p className="text-right text-xs tabular-nums text-muted-foreground">
                    {t.fields.count(values.excerpt.length, POST_EXCERPT_MAX)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <FormField
                  id="post-content"
                  label={t.fields.content}
                  hint={t.markdown.syntax}
                  error={errors.content}
                >
                  {(describedBy) => (
                    <MarkdownEditor
                      id="post-content"
                      value={values.content}
                      invalid={errors.content !== undefined}
                      describedBy={describedBy}
                      onChange={(content) => patch({ content })}
                    />
                  )}
                </FormField>
              </CardContent>
            </Card>
          </form>
          {/* NGOÀI form (Quyết định 14): hộp xác nhận không bao giờ bắn Save của trang. */}
          <DeletePostZone detail={saved} version={version} remove={remove} />
        </div>
      </StepColumns>
    </div>
  );
}

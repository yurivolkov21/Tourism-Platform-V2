'use client';

import { type AdminPhotoLibrary, ALLOWED_IMAGE_EXTENSIONS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { Progress } from '@tourism/ui/components/progress';
import { ImagesIcon, UploadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/kit/form-field';
import { PhotoLibraryDialog } from '@/components/kit/photo-library-dialog';
import { withDeliveryTransform } from '@/lib/cloudinary-url';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import {
  coverFileProblem,
  libraryCoverDraft,
  type PostCoverDraft,
  uploadedCoverDraft,
} from '@/lib/post-form';
import { type SignCoverAction, type SignCoverResult, signCoverErrorCopy } from '@/lib/posts-write';

/**
 * Card Cover ở cột phải trang sửa bài (spec P4e-4 §4.4, ADR-0051 §7): một ảnh bìa, tải lên
 * (ký → POST thẳng Cloudinary qua `uploadPhoto` của F18) hoặc chọn từ kho địa danh (hộp
 * thư viện dùng chung). Card không tự giữ ảnh — báo lên trang qua `onChange`.
 *
 * - Đang tải thì báo "bận" lên trang (`onBusyChange`): Save khoá kèm lý do, rời trang bị
 *   hỏi lại — lưu lúc này là lưu thiếu đúng ảnh ấy.
 * - Rời trang giữa lúc tải: huỷ XHR, không đụng state của component đã gỡ.
 * - Gỡ ảnh: tiêu điểm về nút Upload (bài học 10).
 * - Ảnh catalog (bìa của bài seed) gỡ ra là không chọn lại được — nói ngay trên ảnh.
 */
const c = messages.admin.posts.editor.cover;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export interface PostCoverCardProps {
  postId: string;
  cover: PostCoverDraft | null;
  altError: string | undefined;
  /** Câu báo `PHOTO_NOT_ALLOWED` của lần lưu vừa rồi — `null` khi không có. */
  serverError: string | null;
  onChange: (cover: PostCoverDraft | null) => void;
  onBusyChange: (busy: boolean) => void;
  sign: SignCoverAction;
  loadLibrary: LoadPhotoLibraryAction;
}

export function PostCoverCard({
  postId,
  cover,
  altError,
  serverError,
  onChange,
  onBusyChange,
  sign,
  loadLibrary,
}: PostCoverCardProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  /** Phần trăm đã tải; `null` = không có lượt tải nào. */
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function setBusy(next: number | null) {
    setProgress(next);
    onBusyChange(next !== null);
  }

  async function upload(file: File) {
    setProblem(null);
    const issue = coverFileProblem(file);
    if (issue !== null) {
      setProblem(c.skipped[issue](file.name));
      return;
    }
    setBusy(0);
    let signed: SignCoverResult;
    try {
      signed = await sign({ id: postId });
    } catch {
      // Lệnh ký ném (mạng đứt, redeploy) — coi như lỗi chung, như tab Photos.
      signed = { ok: false, code: 'GENERIC' };
    }
    if (!signed.ok) {
      setBusy(null);
      setProblem(signCoverErrorCopy(signed.code));
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    try {
      const uploaded = await uploadPhoto(file, signed.params, setProgress, controller.signal);
      onChange(uploadedCoverDraft(uploaded, signed.params.cloudName));
    } catch {
      if (controller.signal.aborted) return;
      setProblem(c.uploadFailed);
    } finally {
      abort.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  const busy = progress !== null;

  return (
    <Card size="sm" id="post-cover">
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.intro}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {cover === null ? (
          <div className="grid aspect-[3/2] place-items-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
            {c.empty}
          </div>
        ) : (
          <figure className="grid gap-1.5">
            {/* biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005) */}
            <img
              src={withDeliveryTransform(cover.url, 'w_640')}
              alt=""
              className="aspect-[3/2] w-full rounded-md bg-muted object-cover"
            />
            <figcaption className="text-xs text-muted-foreground">
              {cover.source === 'CATALOG'
                ? `${c.source.CATALOG} · ${c.catalogueWarning}`
                : c.source[cover.source]}
            </figcaption>
          </figure>
        )}

        {progress !== null ? (
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">{c.uploading(progress)}</p>
            <Progress aria-label={c.uploading(progress)} value={progress} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            ref={uploadButton}
            type="button"
            variant="outline"
            size="sm"
            focusableWhenDisabled
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon aria-hidden="true" />
            {c.upload}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            focusableWhenDisabled
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            <ImagesIcon aria-hidden="true" />
            {c.library}
          </Button>
          {cover !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                onChange(null);
                uploadButton.current?.focus();
              }}
            >
              {c.remove}
            </Button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Chọn lại đúng file ấy lần nữa vẫn phải bắn `change`.
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        <p className="text-xs text-muted-foreground">{c.formats}</p>

        {problem ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {problem}
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-destructive-emphasis">
            {serverError}
          </p>
        ) : null}

        {cover !== null ? (
          <FormField id="post-cover-alt" label={c.alt} hint={c.altHint} error={altError}>
            {(describedBy) => (
              <Input
                id="post-cover-alt"
                value={cover.alt}
                aria-invalid={altError !== undefined}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ ...cover, alt: event.target.value })}
              />
            )}
          </FormField>
        ) : null}
      </CardContent>

      <PhotoLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        library={library}
        onLoaded={setLibrary}
        load={loadLibrary}
        existing={new Set(cover === null ? [] : [cover.publicId])}
        capacity={1}
        onAdd={(photos) => {
          const [photo] = photos;
          if (photo) onChange(libraryCoverDraft(photo));
          setLibraryOpen(false);
        }}
      />
    </Card>
  );
}

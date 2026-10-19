'use client';

import {
  type AdminDestinationPhotos,
  ALLOWED_IMAGE_EXTENSIONS,
  DESTINATION_PHOTOS_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@tourism/ui/components/alert-dialog';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Input } from '@tourism/ui/components/input';
import { ChevronLeftIcon, ImageIcon, Undo2Icon, UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import { PhotoUploadRows, usePhotoUploads } from '@/components/kit/photo-uploads';
import { SafeImg } from '@/components/kit/safe-img';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { isUncertainOutcome } from '@/lib/api/write-error';
import {
  type DestinationPhotoDraft,
  type DestinationPhotosErrors,
  destinationPhotoSourceLine,
  destinationPhotosFormValues,
  destinationPhotosPayload,
  destinationSkippedCopy,
  hasDestinationPhotoErrors,
  needsEmptyConfirm,
  putBack,
  removedDestinationPhotos,
  type SetDestinationPhotosAction,
  type SetDestinationPhotosResult,
  type SignDestinationUploadsAction,
  setDestinationPhotosErrorCopy,
  signDestinationUploadsErrorCopy,
  uploadedDestinationPhotoDraft,
  validateDestinationPhotos,
} from '@/lib/destination-photos';
import { tourPhotoThumb } from '@/lib/tour-editor-view';
import { makeCover } from '@/lib/tour-photos';
import type { SectionBanner } from '@/lib/use-section-save';
import { isNewerVersion, useVersionedForm } from '@/lib/use-versioned-form';

/**
 * Trang Photos của một điểm đến (spec P4f Media §7.3, ADR-0060 §8) — khuôn tab Photos của tour:
 * danh sách sắp được, ảnh đầu là ảnh bìa, Make cover, Remove, ô alt từng ảnh, Upload photos theo
 * lô (`usePhotoUploads`, kit chung). Không có Add from library: thư viện chính là trang này.
 *
 * - Ảnh gỡ khỏi bản đã lưu hiện ở khối riêng dưới danh sách, mỗi ảnh một câu hậu quả và nút Put
 *   back — gỡ ở đây là rời cả thư viện, và ảnh catalog gỡ rồi lưu thì không thêm lại được.
 * - Lưu danh sách rỗng cho điểm đến đang hiện thì hỏi lại trước (spec §7.1).
 * - Lưu: khuôn trình sửa bài viết (`inFlight`, lệnh ném coi như GENERIC, `settle` giữ chữ gõ
 *   thêm). `STALE_DESTINATION` thì dải báo kèm Reload; `NOT_FOUND` thì toast rồi về bảng.
 * - Phần đầu đọc bản ĐÃ LƯU (tên, trạng thái ẩn), cột phải đọc bản ĐANG SOẠN (ảnh bìa).
 */
const t = messages.admin.destinations.photos;
const photosCopy = messages.admin.tours.editor.photos;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const NO_ERRORS: DestinationPhotosErrors = { rows: {} };
const UPLOAD_BUTTON_ID = 'destination-photos-upload';
const LIST_HREF = '/destinations';
const altInputId = (key: string) => `photo-${key}-alt`;

export function DestinationPhotosForm({
  detail,
  save,
  sign,
}: {
  detail: AdminDestinationPhotos;
  save: SetDestinationPhotosAction;
  sign: SignDestinationUploadsAction;
}) {
  const router = useRouter();
  const form = useVersionedForm(detail, destinationPhotosFormValues);
  const { values, version, dirty, showValidation } = form;
  /** Bản server mới nhất form biết — lần lưu vừa xong, hay `detail` mới hơn sau Reload. */
  const [lastSaved, setLastSaved] = React.useState(detail);
  const saved = isNewerVersion(detail.version, lastSaved.version) ? detail : lastSaved;

  const inFlight = React.useRef(false);
  const [pending, setPending] = React.useState(false);
  /** Dải báo chỉ sống cùng phiên bản đã sinh ra nó — Reload nạp bản mới là nó tự tắt. */
  const [banner, setBanner] = React.useState<{ state: SectionBanner; version: string } | null>(
    null,
  );
  const [confirmEmpty, setConfirmEmpty] = React.useState(false);
  const uploadButton = React.useRef<HTMLButtonElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const errors = showValidation ? validateDestinationPhotos(values) : NO_ERRORS;
  const shownBanner = banner !== null && banner.version === version ? banner.state : null;
  const removed = removedDestinationPhotos(form.base, values);

  const uploader = usePhotoUploads({
    sign: (count) => sign({ id: detail.id, count }),
    pending,
    photoCount: values.photos.length,
    uploadButtonId: UPLOAD_BUTTON_ID,
    skippedCopy: destinationSkippedCopy,
    signErrorCopy: signDestinationUploadsErrorCopy,
    onUploaded: (done, cloudName) => {
      const photo = uploadedDestinationPhotoDraft(done, cloudName);
      form.setValues((current) => ({ photos: [...current.photos, photo] }));
      return altInputId(photo.key);
    },
  });
  const { uploads, notices, uploadingCount, capacity, startUploads, retry, removeUpload } =
    uploader;

  function submit() {
    form.setShowValidation(true);
    if (hasDestinationPhotoErrors(validateDestinationPhotos(values))) return;
    if (needsEmptyConfirm(saved.isActive, values)) {
      setConfirmEmpty(true);
      return;
    }
    void send();
  }

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setBanner(null);
    // Bản đã gửi — lưu xong chỉ thay form bằng bản server khi người dùng chưa gõ thêm.
    const sent = values;
    let result: SetDestinationPhotosResult;
    try {
      result = await save(destinationPhotosPayload(detail.id, version, sent));
    } catch {
      // Action ném (mạng đứt, redeploy) ⇒ không biết lệnh đã đi tới đâu — như `useSectionSave`.
      result = { ok: false, code: 'GENERIC' };
    }
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      form.settle(result.detail, sent);
      setLastSaved(result.detail);
      toast.success(t.toast.title, { description: t.toast.body(result.detail.name) });
      router.refresh();
      return;
    }
    const { code } = result;
    if (code === 'STALE_DESTINATION') {
      setBanner({ state: { kind: 'stale' }, version });
    } else if (code === 'NOT_FOUND') {
      toast.error(setDestinationPhotosErrorCopy(code));
      router.push(LIST_HREF);
    } else {
      setBanner({
        state: {
          kind: 'error',
          message: setDestinationPhotosErrorCopy(code),
          uncertain: isUncertainOutcome(code),
        },
        version,
      });
    }
  }

  function patchAlt(key: string, alt: string) {
    form.setValues((current) => ({
      photos: current.photos.map((photo) => (photo.key === key ? { ...photo, alt } : photo)),
    }));
  }

  const cover = values.photos[0];

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <div className="flex flex-col gap-3">
        <Link
          href={LIST_HREF}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            {t.title(saved.name)}
          </h2>
          {saved.isActive ? null : (
            <Badge variant="outline" className="h-7 px-2.5 text-sm">
              {t.hidden}
            </Badge>
          )}
        </div>
      </div>

      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={shownBanner}
        serverChanged={form.serverChanged}
        staleCopy={t.stale}
        blockedNote={uploadingCount > 0 ? photosCopy.waiting(uploadingCount) : undefined}
        busy={uploads.length > 0}
        note={t.saveNote}
        aside={
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t.coverTitle}</CardTitle>
              <CardDescription>{cover ? t.coverBody : t.emptyNote}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-muted">
                {cover ? (
                  <SafeImg
                    src={tourPhotoThumb(cover.url)}
                    alt=""
                    className="size-full rounded-[inherit]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    {t.noCover}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        }
        onSubmit={submit}
        onReload={form.reload}
      >
        {/* Vùng thả file là CẢ card, như tab Photos của tour: thả lên phần đầu card mà không ai
            chặn thì trình duyệt mở ảnh và rời trang. */}
        <Card
          data-testid="photo-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void startUploads([...event.dataTransfer.files]);
          }}
        >
          <CardHeader>
            <CardTitle>{messages.admin.tours.editor.tabs.photos}</CardTitle>
            <CardDescription>{t.intro}</CardDescription>
            <CardAction>
              <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {t.count(values.photos.length, DESTINATION_PHOTOS_MAX)}
              </p>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
                <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
                <Button
                  ref={uploadButton}
                  id={UPLOAD_BUTTON_ID}
                  type="button"
                  variant="outline"
                  focusableWhenDisabled
                  disabled={pending || capacity === 0}
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadIcon aria-hidden="true" />
                  {photosCopy.upload}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    // Chọn lại đúng file ấy lần nữa vẫn phải bắn `change`.
                    event.target.value = '';
                    void startUploads(files);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {messages.admin.tours.editor.aside.photos.drop} {photosCopy.formats}
                </p>
              </div>
              {notices.length > 0 ? (
                <ul role="status" className="grid gap-1 text-sm text-destructive-emphasis">
                  {notices.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              {errors.list ? (
                <p role="alert" className="text-sm text-destructive-emphasis">
                  {errors.list}
                </p>
              ) : null}
              <ListEditor<DestinationPhotoDraft>
                items={values.photos}
                onChange={(photos) => form.setValues({ photos })}
                max={DESTINATION_PHOTOS_MAX}
                labelledRows
                emptyFocus={uploadButton}
                itemName={(index) => photosCopy.photoName(index + 1)}
                disabled={pending}
                empty={t.empty}
                renderItem={(photo, index) => {
                  const altId = altInputId(photo.key);
                  return (
                    <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                      <div className="relative">
                        {/* Ảnh là phần trang trí: ô alt ngay cạnh đã mô tả nó. */}
                        <SafeImg
                          src={tourPhotoThumb(photo.url)}
                          alt=""
                          className="aspect-[3/2] w-32 bg-muted"
                        />
                        {index === 0 ? (
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            {photosCopy.cover}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid min-w-0 gap-1.5">
                        <FormField id={altId} label={photosCopy.alt} error={errors.rows[photo.key]}>
                          {(describedBy) => (
                            <Input
                              id={altId}
                              value={photo.alt}
                              disabled={pending}
                              aria-invalid={errors.rows[photo.key] !== undefined}
                              aria-describedby={describedBy}
                              onChange={(event) => patchAlt(photo.key, event.target.value)}
                            />
                          )}
                        </FormField>
                        <p className="text-xs text-muted-foreground">
                          {destinationPhotoSourceLine(photo)}
                        </p>
                        {index > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            focusableWhenDisabled
                            disabled={pending}
                            aria-label={photosCopy.makeCoverFor(photosCopy.photoName(index + 1))}
                            onClick={() => {
                              form.setValues((current) => makeCover(current, photo.key));
                              uploader.setFocusId(altId);
                            }}
                          >
                            {photosCopy.makeCover}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />

              <PhotoUploadRows
                uploads={uploads}
                onRetry={(upload) => void retry(upload)}
                onRemove={removeUpload}
              />

              {removed.length > 0 ? (
                <section aria-labelledby="destination-photos-removed" className="grid gap-2">
                  <h3 id="destination-photos-removed" className="text-sm font-medium">
                    {t.removed.title}
                  </h3>
                  <ul className="grid gap-2">
                    {removed.map(({ photo, consequence }) => {
                      // Dữ liệu cũ có thể thiếu alt — khi ấy gọi bằng tên file.
                      const name = photo.alt.trim() || (photo.publicId.split('/').at(-1) ?? '');
                      return (
                        <li
                          key={photo.publicId}
                          className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3"
                        >
                          <SafeImg
                            src={tourPhotoThumb(photo.url)}
                            alt=""
                            className="aspect-[3/2] w-20 bg-muted opacity-60"
                          />
                          <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
                            <p className="truncate text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground">{consequence}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            focusableWhenDisabled
                            disabled={pending || capacity === 0}
                            aria-label={t.removed.putBackFor(name)}
                            onClick={() => {
                              form.setValues((current) => putBack(current, photo));
                              uploader.setFocusId(altInputId(photo.key));
                            }}
                          >
                            <Undo2Icon data-icon="inline-start" aria-hidden="true" />
                            {t.removed.putBack}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </EditorFormFrame>

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.emptyConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.emptyConfirm.body(saved.name)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.emptyConfirm.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmEmpty(false);
                void send();
              }}
            >
              {t.emptyConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

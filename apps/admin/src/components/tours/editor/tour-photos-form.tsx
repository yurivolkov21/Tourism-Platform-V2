'use client';

import {
  type AdminPhotoLibrary,
  type AdminTourDetail,
  ALLOWED_IMAGE_EXTENSIONS,
  type SignedUploadParams,
  TOUR_PHOTOS_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { ImagePlusIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import { PhotoLibraryDialog } from '@/components/tours/editor/photo-library-dialog';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import { newItemKey } from '@/lib/list-editor';
import { uploadPhoto } from '@/lib/photo-upload';
import { projectedReadiness, tourPhotoThumb } from '@/lib/tour-editor-view';
import {
  acceptFiles,
  hasPhotoErrors,
  type LoadPhotoLibraryAction,
  libraryPhotoDraft,
  makeCover,
  type PhotoDraft,
  type PhotosContractCode,
  type PhotosFormErrors,
  type PhotosFormValues,
  photoSourceLine,
  photosErrorCopy,
  photosFormValues,
  photosPayload,
  remainingCapacity,
  runWithConcurrency,
  type SetPhotosAction,
  type SignPhotoUploadsAction,
  type SignPhotoUploadsResult,
  signUploadsErrorCopy,
  skippedCopy,
  UPLOAD_CONCURRENCY,
  uploadedPhotoDraft,
  validatePhotosForm,
} from '@/lib/tour-photos';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Tab Photos (spec F18 §2g, ADR-0048): một danh sách có thứ tự, ảnh đầu là ảnh bìa.
 *
 * - Ảnh vào danh sách bằng hai đường ở thanh trên (tải lên, thư viện) — kit
 *   `ListEditor` không có nút thêm; gỡ dòng cuối trả tiêu điểm về Upload photos.
 * - Tải lên: ký MỘT lần cho cả lô, tối đa `UPLOAD_CONCURRENCY` file cùng lúc,
 *   thẳng lên Cloudinary. File đang tải hay hỏng nằm ở danh sách riêng dưới các
 *   dòng ảnh — chúng chưa phải ảnh của tour cho tới khi tải xong.
 * - Save khoá khi còn file đang tải (`blockedNote`). Rời trang lúc chưa lưu thì
 *   hộp hỏi lại của F17 bật lên; ảnh đã tải mà bỏ nằm trong hàng dọn từ lúc ký.
 *
 * Vòng review F18:
 * - Dòng tải vào danh sách NGAY khi file được nhận, trước khi ký — lượt chọn kế đã
 *   thấy sức chứa trừ chúng, danh sách không vượt 30.
 * - Lệnh ký có thể NÉM (mạng đứt, redeploy): coi như GENERIC như `useSectionSave`;
 *   không dòng nào kẹt ở "đang tải".
 * - Đang lưu thì không nhận file mới: ảnh tải xong lúc ấy bị bản server vừa lưu đè.
 * - Còn file đang tải (hay tải hỏng chưa gỡ) thì rời trang bị hỏi lại (`busy`); rời
 *   hẳn thì huỷ lượt đang tải và không khởi động file xếp hàng.
 * - Nút biến mất sau khi bấm (Retry, Remove) thì tiêu điểm được chuyển đi chủ động.
 */
const t = messages.admin.tours.editor.photos;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const NO_ERRORS: PhotosFormErrors = { rows: {} };
const UPLOAD_BUTTON_ID = 'tour-photos-upload';
const altInputId = (key: string) => `photo-${key}-alt`;
const progressId = (key: string) => `upload-${key}-progress`;
const retryId = (key: string) => `upload-${key}-retry`;
const removeId = (key: string) => `upload-${key}-remove`;

interface UploadDraft {
  key: string;
  file: File;
  preview: string;
  status: 'uploading' | 'failed';
  percent: number;
}

export function TourPhotosForm({
  detail,
  save: saveAction,
  sign,
  loadLibrary,
}: {
  detail: AdminTourDetail;
  save: SetPhotosAction;
  sign: SignPhotoUploadsAction;
  loadLibrary: LoadPhotoLibraryAction;
}) {
  const publishSaved = usePublishSavedDetail();
  const form = useTourFormState<PhotosFormValues>(detail, photosFormValues);
  const { values, version, dirty, showValidation } = form;
  const [uploads, setUploads] = React.useState<UploadDraft[]>([]);
  const [notices, setNotices] = React.useState<string[]>([]);
  /** `id` của phần tử nhận tiêu điểm sau lượt render kế — nút vừa bấm có thể đã biến mất. */
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  /** Kho ảnh địa danh — tải ở lần mở hộp đầu, giữ cho các lần sau. */
  const [library, setLibrary] = React.useState<AdminPhotoLibrary | null>(null);
  const uploadButton = React.useRef<HTMLButtonElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  /** URL xem trước còn sống — thu hồi hết khi rời tab. */
  const previews = React.useRef(new Set<string>());
  /** Huỷ mọi lượt tải khi rời tab. Dựng lại trong effect: StrictMode gỡ rồi gắn lại. */
  const aborter = React.useRef(new AbortController());

  const errors = showValidation ? validatePhotosForm(values, detail) : NO_ERRORS;
  const uploadingCount = uploads.filter((upload) => upload.status === 'uploading').length;
  const capacity = remainingCapacity(values.photos.length, uploads.length);

  const { pending, banner, save } = useSectionSave<PhotosContractCode>({
    copy: photosErrorCopy,
    slug: detail.slug,
    version,
    projected: () => projectedReadiness(detail, { photoCount: values.photos.length }),
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu (readiness, công tắc) theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
  });

  React.useEffect(() => {
    const controller = new AbortController();
    aborter.current = controller;
    const live = previews.current;
    return () => {
      controller.abort();
      for (const url of live) URL.revokeObjectURL(url);
    };
  }, []);

  // Make cover, Retry, Remove làm nút vừa bấm biến mất (quyết định 7 của plan, vòng review F18).
  React.useEffect(() => {
    if (focusId === null) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  function patchUpload(key: string, next: Partial<UploadDraft>) {
    setUploads((current) =>
      current.map((upload) => (upload.key === key ? { ...upload, ...next } : upload)),
    );
  }

  function dropUpload(draft: UploadDraft) {
    URL.revokeObjectURL(draft.preview);
    previews.current.delete(draft.preview);
    setUploads((current) => current.filter((upload) => upload.key !== draft.key));
  }

  /** Server action có thể NÉM (mạng đứt, redeploy) — coi như GENERIC, như `useSectionSave`. */
  async function signSafely(count: number): Promise<SignPhotoUploadsResult> {
    try {
      return await sign({ id: detail.id, count });
    } catch {
      return { ok: false, code: 'GENERIC' };
    }
  }

  async function uploadOne(draft: UploadDraft, params: SignedUploadParams, signal: AbortSignal) {
    // Tiêu điểm đang ở thanh tiến độ của dòng (vừa bấm Retry) thì đi theo kết cục của nó.
    const followsRow = () => document.activeElement?.id === progressId(draft.key);
    try {
      const done = await uploadPhoto(
        draft.file,
        params,
        (percent) => patchUpload(draft.key, { percent }),
        signal,
      );
      const photo = uploadedPhotoDraft(done, params.cloudName);
      const refocus = followsRow();
      dropUpload(draft);
      form.setValues((current) => ({ photos: [...current.photos, photo] }));
      if (refocus) setFocusId(altInputId(photo.key));
    } catch {
      if (signal.aborted) return;
      const refocus = followsRow();
      patchUpload(draft.key, { status: 'failed' });
      if (refocus) setFocusId(retryId(draft.key));
    }
  }

  async function startUploads(files: readonly File[]) {
    if (pending) {
      setNotices([t.busySaving]);
      return;
    }
    const { accepted, skipped } = acceptFiles(files, capacity);
    const skippedNotes = skipped.map(skippedCopy);
    setNotices(skippedNotes);
    if (accepted.length === 0) return;

    // Giữ chỗ NGAY, trước khi ký: lượt chọn kế đã thấy sức chứa trừ các dòng này.
    const drafts: UploadDraft[] = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: newItemKey(), file, preview, status: 'uploading', percent: 0 };
    });
    setUploads((current) => [...current, ...drafts]);
    const signal = aborter.current.signal;
    const signed = await signSafely(accepted.length);
    if (signal.aborted) return;
    if (!signed.ok) {
      for (const draft of drafts) dropUpload(draft);
      setNotices([...skippedNotes, signUploadsErrorCopy(signed.code)]);
      return;
    }
    await runWithConcurrency(
      drafts.flatMap((draft, index) => {
        const params = signed.params[index];
        return params ? [() => uploadOne(draft, params, signal)] : [];
      }),
      UPLOAD_CONCURRENCY,
      signal,
    );
  }

  /** Chữ ký cũ có thể đã hết hạn — Retry luôn ký lại MỘT chữ ký mới. */
  async function retry(draft: UploadDraft) {
    if (pending) {
      setNotices([t.busySaving]);
      return;
    }
    patchUpload(draft.key, { status: 'uploading', percent: 0 });
    setFocusId(progressId(draft.key));
    const signal = aborter.current.signal;
    const signed = await signSafely(1);
    if (signal.aborted) return;
    const params = signed.ok ? signed.params[0] : undefined;
    if (params === undefined) {
      patchUpload(draft.key, { status: 'failed' });
      setFocusId(retryId(draft.key));
      setNotices([signUploadsErrorCopy(signed.ok ? 'GENERIC' : signed.code)]);
      return;
    }
    await uploadOne(draft, params, signal);
  }

  /** Gỡ một dòng tải hỏng; tiêu điểm sang dòng hỏng kế, hết thì về nút Upload photos. */
  function removeUpload(draft: UploadDraft) {
    const index = uploads.findIndex((upload) => upload.key === draft.key);
    const next = [...uploads.slice(index + 1), ...uploads.slice(0, Math.max(0, index))].find(
      (upload) => upload.status === 'failed',
    );
    dropUpload(draft);
    setFocusId(next ? removeId(next.key) : UPLOAD_BUTTON_ID);
  }

  function submit() {
    form.setShowValidation(true);
    if (hasPhotoErrors(validatePhotosForm(values, detail))) return;
    void save(() => saveAction(photosPayload(detail.id, version, values)));
  }

  function patchAlt(key: string, alt: string) {
    form.setValues((current) => ({
      photos: current.photos.map((photo) => (photo.key === key ? { ...photo, alt } : photo)),
    }));
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        blockedNote={uploadingCount > 0 ? t.waiting(uploadingCount) : undefined}
        busy={uploads.length > 0}
        onSubmit={submit}
        onReload={form.reload}
      >
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
              {t.upload}
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
            <Button
              type="button"
              variant="outline"
              focusableWhenDisabled
              disabled={pending || capacity === 0}
              onClick={() => setLibraryOpen(true)}
            >
              <ImagePlusIcon aria-hidden="true" />
              {t.library}
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t.count(values.photos.length, TOUR_PHOTOS_MAX)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.intro} {t.formats}
          </p>
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

          {/* biome-ignore lint/a11y/noStaticElementInteractions: vùng thả file chỉ là đường tắt cho chuột — bàn phím và trình đọc màn hình dùng nút Upload photos */}
          <div
            data-testid="photo-drop-zone"
            className="grid gap-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void startUploads([...event.dataTransfer.files]);
            }}
          >
            <ListEditor<PhotoDraft>
              items={values.photos}
              onChange={(photos) => form.setValues({ photos })}
              max={TOUR_PHOTOS_MAX}
              labelledRows
              emptyFocus={uploadButton}
              itemName={(index) => t.photoName(index + 1)}
              disabled={pending}
              empty={t.empty}
              renderItem={(photo, index) => {
                const altId = `photo-${photo.key}-alt`;
                return (
                  <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                    <div className="relative">
                      {/* Ảnh là phần trang trí: ô alt ngay cạnh đã mô tả nó. `<img>` thường
                          như cả admin — `next/image` NÉM khi host nằm ngoài `remotePatterns`. */}
                      {/* biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005) */}
                      <img
                        src={tourPhotoThumb(photo.url)}
                        alt=""
                        className="aspect-[3/2] w-32 rounded-md bg-muted object-cover"
                      />
                      {index === 0 ? (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {t.cover}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-1.5">
                      <FormField id={altId} label={t.alt} error={errors.rows[photo.key]}>
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
                      <p className="text-xs text-muted-foreground">{photoSourceLine(photo)}</p>
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          focusableWhenDisabled
                          disabled={pending}
                          aria-label={t.makeCoverFor(t.photoName(index + 1))}
                          onClick={() => {
                            form.setValues((current) => makeCover(current, photo.key));
                            setFocusId(altInputId(photo.key));
                          }}
                        >
                          {t.makeCover}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />

            {uploads.map((upload) => (
              <div
                key={upload.key}
                className="flex items-center gap-3 rounded-md border border-dashed p-3"
              >
                {/* biome-ignore lint/performance/noImgElement: ảnh xem trước là blob: cục bộ, next/image không nhận */}
                <img
                  src={upload.preview}
                  alt=""
                  className="aspect-[3/2] w-32 rounded-md bg-muted object-cover"
                />
                <div className="grid flex-1 gap-1.5">
                  {upload.status === 'uploading' ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t.uploading(upload.file.name, upload.percent)}
                      </p>
                      <div
                        id={progressId(upload.key)}
                        // Nhận tiêu điểm khi Retry làm nút vừa bấm biến mất (vòng review F18).
                        tabIndex={-1}
                        role="progressbar"
                        aria-label={t.uploadingLabel(upload.file.name)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={upload.percent}
                        className="h-1 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-1 bg-primary" style={{ width: `${upload.percent}%` }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p role="alert" className="text-sm text-destructive-emphasis">
                        {t.uploadFailed(upload.file.name)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          id={retryId(upload.key)}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void retry(upload)}
                        >
                          {t.retry}
                        </Button>
                        <Button
                          id={removeId(upload.key)}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUpload(upload)}
                        >
                          {t.remove}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </EditorFormFrame>
      <PhotoLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        library={library}
        onLoaded={setLibrary}
        load={loadLibrary}
        tourDestinationIds={detail.destinations.map((link) => link.destinationId)}
        existing={new Set(values.photos.map((photo) => photo.publicId))}
        capacity={capacity}
        onAdd={(photos) => {
          form.setValues((current) => ({
            photos: [...current.photos, ...photos.map(libraryPhotoDraft)],
          }));
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

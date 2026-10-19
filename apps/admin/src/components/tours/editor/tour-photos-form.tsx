'use client';

import {
  type AdminPhotoLibrary,
  type AdminTourDetail,
  ALLOWED_IMAGE_EXTENSIONS,
  TOUR_PHOTOS_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
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
import { ImageIcon, ImagePlusIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';
import { FormField } from '@/components/kit/form-field';
import { ListEditor } from '@/components/kit/list-editor';
import { PhotoLibraryDialog } from '@/components/kit/photo-library-dialog';
import { PhotoUploadRows, usePhotoUploads } from '@/components/kit/photo-uploads';
import { SafeImg } from '@/components/kit/safe-img';
import { EditorFormFrame } from '@/components/tours/editor/editor-form-frame';
import {
  type ChecklistItem,
  CoverPreviewCard,
  StepChecklist,
  StepTips,
} from '@/components/tours/editor/step-aside';
import { usePublishSavedDetail } from '@/components/tours/editor/tour-detail-context';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { nextTourStep, projectedReadiness, tourPhotoThumb } from '@/lib/tour-editor-view';
import {
  hasPhotoErrors,
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
  type SetPhotosAction,
  type SignPhotoUploadsAction,
  signUploadsErrorCopy,
  skippedCopy,
  uploadedPhotoDraft,
  validatePhotosForm,
} from '@/lib/tour-photos';
import { useSectionSave } from '@/lib/use-section-save';
import { useTourFormState } from '@/lib/use-tour-form-state';

/**
 * Bước Photos (spec F18 §2g, F19 §2d.2): một danh sách có thứ tự, ảnh đầu là ảnh bìa.
 *
 * - Ảnh vào danh sách bằng hai đường ở ô tải lên đầu card (tải lên, thư viện) — kit
 *   `ListEditor` không có nút thêm; gỡ dòng cuối trả tiêu điểm về Upload photos.
 * - Tải lên: `usePhotoUploads` (kit, dùng chung với trang Photos của điểm đến). File đang
 *   tải hay hỏng nằm ở danh sách riêng dưới các dòng ảnh — chúng chưa phải ảnh của tour
 *   cho tới khi tải xong.
 * - Save khoá khi còn file đang tải (`blockedNote`). Còn file đang tải (hay tải hỏng chưa
 *   gỡ) thì rời trang bị hỏi lại (`busy`); ảnh đã tải mà bỏ nằm trong hàng dọn từ lúc ký.
 */
const e = messages.admin.tours.editor;
const a = e.aside;
const t = e.photos;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
const NO_ERRORS: PhotosFormErrors = { rows: {} };
const UPLOAD_BUTTON_ID = 'tour-photos-upload';
const altInputId = (key: string) => `photo-${key}-alt`;

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
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  /** Kho ảnh địa danh — tải ở lần mở hộp đầu, giữ cho các lần sau. */
  const [library, setLibrary] = React.useState<AdminPhotoLibrary | null>(null);
  const uploadButton = React.useRef<HTMLButtonElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const errors = showValidation ? validatePhotosForm(values, detail) : NO_ERRORS;

  const { pending, banner, save } = useSectionSave<PhotosContractCode>({
    copy: photosErrorCopy,
    slug: detail.slug,
    version,
    projected: () => projectedReadiness(detail, { photoCount: values.photos.length }),
    // Một ảnh thư viện vừa thêm đã không còn (vòng review F18): bản kho ảnh đang giữ đã
    // sai — lần mở hộp sau tải lại. Dải báo vẫn hiện (trả `false`).
    onFieldError: (code) => {
      if (code === 'PHOTO_NOT_ALLOWED') setLibrary(null);
      return false;
    },
    onSaved: (next) => {
      form.adopt(next);
      // Phần đầu và thanh bước theo kịp ngay, không chờ lượt refresh.
      publishSaved(next);
    },
  });

  const uploader = usePhotoUploads({
    sign: (count) => sign({ id: detail.id, count }),
    pending,
    photoCount: values.photos.length,
    uploadButtonId: UPLOAD_BUTTON_ID,
    skippedCopy,
    signErrorCopy: signUploadsErrorCopy,
    onUploaded: (done, cloudName) => {
      const photo = uploadedPhotoDraft(done, cloudName);
      form.setValues((current) => ({ photos: [...current.photos, photo] }));
      return altInputId(photo.key);
    },
  });

  const { uploads, notices, uploadingCount, capacity, startUploads, retry, removeUpload } =
    uploader;

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

  // Cột phải đọc danh sách ĐANG SOẠN (ADR-0049 §6): ảnh đầu là ảnh bìa, alt bắt buộc
  // để lưu (`validatePhotosForm`). Dòng alt chỉ có khi đã có ảnh — không ảnh nào thì
  // "alt trên mọi ảnh" đúng rỗng, không đáng một dấu ✓ (vòng review F19).
  const hasPhotos = values.photos.length > 0;
  const altMissing = values.photos.filter((photo) => photo.alt.trim() === '').length;
  const checklist: ChecklistItem[] = [
    {
      key: 'cover',
      label: e.readiness.cover,
      detail: hasPhotos ? a.required : a.requiredMissing,
      state: hasPhotos ? 'ok' : 'warn',
    },
    ...(hasPhotos
      ? [
          {
            key: 'alt',
            label: a.photos.altAll,
            detail: altMissing === 0 ? a.photos.altDone : a.photos.altMissing(altMissing),
            state: altMissing === 0 ? ('ok' as const) : ('warn' as const),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 px-4 pb-8 lg:px-6">
      <EditorFormFrame
        dirty={dirty}
        pending={pending}
        banner={banner}
        serverChanged={form.serverChanged}
        blockedNote={uploadingCount > 0 ? t.waiting(uploadingCount) : undefined}
        busy={uploads.length > 0}
        note={a.photos.saveNote}
        aside={
          <>
            <StepChecklist items={checklist} description={a.photos.checklistBody} />
            <CoverPreviewCard url={values.photos[0]?.url ?? null} />
            <StepTips items={a.photos.tips} />
          </>
        }
        next={nextTourStep(detail.slug, 'photos')}
        onSubmit={submit}
        onReload={form.reload}
      >
        {/* Vùng thả file là CẢ card (spec F19 §2d.2): thả lên phần đầu card mà không ai
            chặn thì trình duyệt mở ảnh và rời trang. Chỉ là đường tắt cho chuột — bàn phím
            và trình đọc màn hình dùng nút Upload photos. */}
        <Card
          data-testid="photo-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void startUploads([...event.dataTransfer.files]);
          }}
        >
          <CardHeader>
            <CardTitle>{e.tabs.photos}</CardTitle>
            <CardDescription>{t.intro}</CardDescription>
            <CardAction>
              <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {t.count(values.photos.length, TOUR_PHOTOS_MAX)}
              </p>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
                <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
                <div className="flex flex-wrap items-center justify-center gap-2">
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
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.photos.drop} {t.formats}
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
                        {/* Ảnh là phần trang trí: ô alt ngay cạnh đã mô tả nó. Kit `SafeImg`
                            (review AL4): ảnh hỏng thành ô cùng khung mang tên "Photo
                            unavailable" — chỗ quản lý ảnh là nơi cần nhận ra ảnh hỏng nhất. */}
                        <SafeImg
                          src={tourPhotoThumb(photo.url)}
                          alt=""
                          className="aspect-[3/2] w-32 bg-muted"
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
                              uploader.setFocusId(altInputId(photo.key));
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

              <PhotoUploadRows
                uploads={uploads}
                onRetry={(upload) => void retry(upload)}
                onRemove={removeUpload}
              />
            </div>
          </CardContent>
        </Card>
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

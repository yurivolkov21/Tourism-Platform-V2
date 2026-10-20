'use client';

import {
  type AdminPhotoLibrary,
  ALLOWED_IMAGE_EXTENSIONS,
  SITE_SLOT_ALT_MAX,
  type SiteImageSlotKey,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { Input } from '@tourism/ui/components/input';
import { Progress } from '@tourism/ui/components/progress';
import { cn } from '@tourism/ui/lib/utils';
import { ImagesIcon, UploadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FramedImage } from '@/components/appearance/framed-image';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { PhotoLibraryDialog } from '@/components/kit/photo-library-dialog';
import { DIALOG_PREVIEW_BOX, fitFrame, narrowFrameWidth, type SlotVM } from '@/lib/appearance-view';
import {
  currentSlotDraft,
  isSetSlotStale,
  isUnchangedSlotDraft,
  librarySlotDraft,
  type SetSlotAction,
  type SetSlotContractCode,
  type SignSlotAction,
  type SignSlotResult,
  type SlotDraft,
  setSlotErrorCopy,
  setSlotPayload,
  signSlotErrorCopy,
  uploadedSlotDraft,
} from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import { coverFileProblem } from '@/lib/post-form';
import { useConfirmWrite } from '@/lib/use-confirm-write';

/**
 * Hộp Replace của một khe (spec P4f Appearance §6.2, ADR-0059). Mở sẵn ảnh đang dùng — lưu ngay là
 * đổi alt (nguồn thứ nhất của ADR §2). Hai cách lấy ảnh khác: tải lên (ký vào thư mục của khe →
 * POST thẳng Cloudinary qua `uploadPhoto`, khuôn ảnh bìa bài viết) và chọn từ thư viện địa danh
 * (kit `PhotoLibraryDialog`, lồng TRONG hộp này để Base UI coi là hộp con: Esc chỉ đóng hộp con).
 *
 * - Hai khung xem trước đúng tỉ lệ khe; khổ nào không hiện khe thì nói thẳng.
 * - Cảnh báo không chặn: ảnh hẹp hơn khung lớn nhất; ảnh mới cho khe có câu chú thích.
 * - Vòng đời lệnh lưu là của kit (`useConfirmWrite`): `STALE_SLOT` hay kết cục không rõ thì đóng
 *   hộp, toast, tải lại thẻ; `PHOTO_NOT_ALLOWED` ở lại hộp để chọn ảnh khác.
 * - Đang tải thì Save khoá; đóng hộp giữa lúc tải là huỷ XHR.
 * - Chưa có gì để lưu (chưa có ảnh, hay ảnh đang dùng mà alt chưa đổi) thì Save chỉ nhắc, không
 *   gửi lệnh.
 */
const t = messages.admin.appearance;
const d = t.replaceDialog;
const ACCEPT = ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export interface ReplaceSlotDialogProps {
  slot: SlotVM;
  imageKey: SiteImageSlotKey;
  setSlot: SetSlotAction;
  signUpload: SignSlotAction;
  library: AdminPhotoLibrary | null;
  onLibraryChange: (library: AdminPhotoLibrary | null) => void;
  loadLibrary: LoadPhotoLibraryAction;
  onClose: () => void;
  onSettled: () => void;
}

export function ReplaceSlotDialog({
  slot,
  imageKey,
  setSlot,
  signUpload,
  library,
  onLibraryChange,
  loadLibrary,
  onClose,
  onSettled,
}: ReplaceSlotDialogProps) {
  const [draft, setDraft] = useState<SlotDraft | null>(() => currentSlotDraft(slot.image));
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  /** Phần trăm đã tải; `null` = không có lượt tải nào. */
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /**
   * Bấm Save khi chưa có gì để lưu — chưa có ảnh nào, hay ảnh đang dùng mà alt chưa đổi. Chỉ nhắc
   * SAU lần bấm ấy; giá trị là khoá câu nhắc trong `replaceDialog`.
   */
  const [nudge, setNudge] = useState<'pickFirst' | 'unchanged' | null>(null);

  const { pending, failure, onOpenChange, run, clearFailure } =
    useConfirmWrite<SetSlotContractCode>({
      isStale: isSetSlotStale,
      errorCopy: setSlotErrorCopy,
      onClose,
      onSettled,
    });

  // Lần lưu vừa rồi bị từ chối ảnh (PHOTO_NOT_ALLOWED): ảnh thư viện vừa chọn có thể đã rời kho,
  // nên bỏ kho đã tải để lần mở sau tải lại — chỉnh ngay trong render, khuôn card ảnh bìa.
  const [seenFailure, setSeenFailure] = useState(failure);
  if (failure !== seenFailure) {
    setSeenFailure(failure);
    if (failure === 'PHOTO_NOT_ALLOWED') onLibraryChange(null);
  }

  useEffect(() => () => abort.current?.abort(), []);

  const busy = progress !== null;
  const locked = busy || pending;

  function choose(next: SlotDraft) {
    setDraft(next);
    setNudge(null);
    clearFailure();
  }

  async function upload(file: File) {
    setProblem(null);
    const issue = coverFileProblem(file);
    if (issue !== null) {
      setProblem(d.skipped[issue](file.name));
      return;
    }
    setProgress(0);
    // Dựng bộ huỷ TRƯỚC khi ký: đóng hộp lúc đang ký cũng phải chặn được lượt tải sắp tới.
    const controller = new AbortController();
    abort.current = controller;
    let signed: SignSlotResult;
    try {
      signed = await signUpload({ key: imageKey });
    } catch {
      // Lệnh ký ném (mạng đứt, redeploy) — coi như lỗi chung.
      signed = { ok: false, code: 'GENERIC' };
    }
    if (controller.signal.aborted) return;
    if (!signed.ok) {
      abort.current = null;
      setProgress(null);
      setProblem(signSlotErrorCopy(signed.code));
      return;
    }
    try {
      const uploaded = await uploadPhoto(file, signed.params, setProgress, controller.signal);
      choose(uploadedSlotDraft(uploaded, signed.params.cloudName));
    } catch {
      if (controller.signal.aborted) return;
      setProblem(d.uploadFailed);
    } finally {
      abort.current = null;
      if (!controller.signal.aborted) setProgress(null);
    }
  }

  function submit() {
    if (busy) return;
    if (draft === null) {
      setNudge('pickFirst');
      return;
    }
    if (isUnchangedSlotDraft(draft, slot.image)) {
      setNudge('unchanged');
      return;
    }
    void run(async () => {
      const result = await setSlot(setSlotPayload(imageKey, slot.version, draft));
      if (!result.ok) return { ok: false, code: result.code };
      return {
        ok: true,
        toast: { title: t.toast.saved, description: t.toast.savedBody(slot.name) },
      };
    });
  }

  const narrow = draft === null ? null : narrowFrameWidth(draft.width, slot.frames);
  const isNew = draft !== null && draft.origin !== 'CURRENT';
  const altId = `appearance-${slot.key}-alt`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-2xl')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{d.title(slot.name)}</DialogTitle>
          <DialogDescription>{d.body}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <section aria-labelledby={`${altId}-previews`} className="grid gap-2">
            <h3 id={`${altId}-previews`} className="text-sm font-medium">
              {draft === null ? d.none : draft.origin === 'CURRENT' ? d.current : d.chosen}
              <span className="font-normal text-muted-foreground"> · {d.previews}</span>
            </h3>
            <div className="flex flex-wrap items-end gap-4">
              <SlotPreview
                frame={slot.frames.desktop}
                box={DIALOG_PREVIEW_BOX.desktop}
                label={(w, h) => t.frames.desktop(w, h)}
                src={draft?.previewUrl ?? null}
              />
              <SlotPreview
                frame={slot.frames.phone}
                box={DIALOG_PREVIEW_BOX.phone}
                label={(w, h) => t.frames.phone(w, h)}
                src={draft?.previewUrl ?? null}
              />
            </div>
            {narrow !== null && draft?.width ? (
              <p className="text-sm text-warning-emphasis">{d.narrow(draft.width, narrow)}</p>
            ) : null}
            {isNew && slot.caption !== null ? (
              <p className="text-sm text-muted-foreground">
                {t.caption(slot.caption)}. {d.captionCheck}
              </p>
            ) : null}
          </section>

          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                focusableWhenDisabled
                disabled={locked}
                onClick={() => fileInput.current?.click()}
              >
                <UploadIcon aria-hidden="true" />
                {d.upload}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                focusableWhenDisabled
                disabled={locked}
                onClick={() => setLibraryOpen(true)}
              >
                <ImagesIcon aria-hidden="true" />
                {d.library}
              </Button>
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
            <p className="text-xs text-muted-foreground">{d.formats}</p>
            {progress !== null ? (
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">{d.uploading(progress)}</p>
                <Progress aria-label={d.uploading(progress)} value={progress} />
              </div>
            ) : null}
            {problem ? (
              <p role="alert" className="text-sm text-destructive-emphasis">
                {problem}
              </p>
            ) : null}
          </div>

          {slot.image?.source === 'UPLOAD' ? (
            <p className="text-sm text-muted-foreground">{d.uploadedGone}</p>
          ) : null}

          {draft !== null ? (
            <>
              <FormField id={altId} label={d.alt} hint={d.altHint}>
                {(describedBy) => (
                  <Input
                    id={altId}
                    value={draft.alt}
                    maxLength={SITE_SLOT_ALT_MAX}
                    disabled={pending}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                      setDraft({ ...draft, alt: event.target.value });
                      setNudge(null);
                      clearFailure();
                    }}
                  />
                )}
              </FormField>
              <dl className="grid gap-1 text-sm">
                <dt className="font-medium">{d.credit}</dt>
                <dd className="text-muted-foreground">{draft.credit ?? d.creditNone}</dd>
              </dl>
            </>
          ) : null}

          {nudge ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {d[nudge]}
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="text-sm text-destructive-emphasis">
              {setSlotErrorCopy(failure)}
            </p>
          ) : null}

          {/* Khoá lúc chờ bằng `aria-disabled` (`focusableWhenDisabled`): nút `disabled` thật làm
              Chromium đẩy focus về <body> ngay giữa hộp đang mở (đo 13/10). */}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              focusableWhenDisabled
              onClick={() => onOpenChange(false)}
            >
              {d.cancel}
            </Button>
            <Button type="submit" disabled={locked} focusableWhenDisabled>
              {pending ? d.saving : d.save}
            </Button>
          </DialogFooter>
        </form>

        <PhotoLibraryDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          library={library}
          onLoaded={onLibraryChange}
          load={loadLibrary}
          existing={new Set(draft === null ? [] : [draft.publicId])}
          capacity={1}
          copy={{
            title: d.libraryDialog.title,
            added: d.libraryDialog.current,
            add: () => d.libraryDialog.use,
            left: () => (draft === null ? d.libraryDialog.pickOne : d.libraryDialog.replaces),
          }}
          onAdd={(photos) => {
            const [photo] = photos;
            if (photo) choose(librarySlotDraft(photo));
            setLibraryOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Một khung xem trước có nhãn khổ và cỡ khung thật; khổ không hiện khe thì một câu thay khung. */
function SlotPreview({
  frame,
  box,
  label,
  src,
}: {
  frame: readonly [number, number] | null;
  box: readonly [number, number];
  label: (width: number, height: number) => string;
  src: string | null;
}) {
  if (frame === null) {
    return <p className="max-w-40 text-xs text-muted-foreground">{t.frames.phoneHidden}</p>;
  }
  return (
    <figure className="grid gap-1">
      <FramedImage src={src} size={fitFrame(frame, box)} placeholder={d.none} />
      <figcaption className="text-xs text-muted-foreground">{label(frame[0], frame[1])}</figcaption>
    </figure>
  );
}

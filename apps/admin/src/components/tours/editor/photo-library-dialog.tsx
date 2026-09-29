'use client';

import type { AdminLibraryPhoto, AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Checkbox } from '@tourism/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tourism/ui/components/dialog';
import { cn } from '@tourism/ui/lib/utils';
import * as React from 'react';
import { DIALOG_FRAME } from '@/components/kit/confirm-write-dialog';
import { FormField } from '@/components/kit/form-field';
import { FormSelect } from '@/components/kit/form-select';
import type { TransportFailureCode } from '@/lib/api/write-error';
import { tourPhotoThumb } from '@/lib/tour-editor-view';
import { type LoadPhotoLibraryAction, libraryLoadErrorCopy } from '@/lib/tour-photos';

/**
 * Hộp Add from library (spec F18 §2g, ADR-0048 §9): kho ảnh địa danh.
 *
 * - Thư viện tải MỘT lần khi hộp mở lần đầu; form giữ nó (`library`/`onLoaded`)
 *   cho các lần mở sau.
 * - Mặc định bày ảnh các địa danh tour đi qua; ô chọn đổi sang từng địa danh.
 * - Ảnh đã có trong tour hiện "Added" và khoá; không cho tích quá sức chứa.
 *
 * Vòng review F18:
 * - Lựa chọn thuộc về MỘT lần mở: hộp luôn mount (form giữ nó) nên đóng bằng Cancel
 *   hay Esc là xoá lựa chọn — lần mở sau sức chứa có thể đã khác.
 * - Add chỉ gửi ảnh chưa có trong tour và không vượt sức chứa — form có thể vừa nạp
 *   bản server mới giữa lúc hộp mở.
 * - Tải hỏng nói đúng mã (hết phiên, mất quyền, lỗi chung); lệnh tải NÉM coi như lỗi
 *   chung. Try again chỉ cho lỗi chung — hai mã kia thử lại vẫn hỏng.
 */
const t = messages.admin.tours.editor.photos.dialog;
const THIS_TOUR = 'tour';

export function PhotoLibraryDialog({
  open,
  onOpenChange,
  library,
  onLoaded,
  load,
  tourDestinationIds,
  existing,
  capacity,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: AdminPhotoLibrary | null;
  onLoaded: (library: AdminPhotoLibrary) => void;
  load: LoadPhotoLibraryAction;
  tourDestinationIds: readonly string[];
  existing: ReadonlySet<string>;
  capacity: number;
  onAdd: (photos: AdminLibraryPhoto[]) => void;
}) {
  const [failure, setFailure] = React.useState<TransportFailureCode | null>(null);
  const [filter, setFilter] = React.useState(THIS_TOUR);
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(new Set());
  /** Cổng một lượt tải — effect và nút Try again không được bắn hai lượt chồng nhau. */
  const loading = React.useRef(false);

  const fetchLibrary = React.useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    setFailure(null);
    try {
      const result = await load();
      if (result.ok) onLoaded(result.library);
      else setFailure(result.code);
    } catch {
      // Server action ném (mạng đứt, redeploy) — coi như lỗi chung, như `useSectionSave`.
      setFailure('GENERIC');
    } finally {
      loading.current = false;
    }
  }, [load, onLoaded]);

  // Tải MỘT lần, lúc hộp mở lần đầu; form giữ kết quả cho các lần mở sau.
  React.useEffect(() => {
    if (open && library === null) void fetchLibrary();
  }, [open, library, fetchLibrary]);

  const hasTourPhotos =
    library?.some((group) => tourDestinationIds.includes(group.destination.id)) ?? false;
  const shownFilter =
    filter === THIS_TOUR && !hasTourPhotos ? (library?.[0]?.destination.id ?? THIS_TOUR) : filter;
  const photos = dedupe(
    (library ?? [])
      .filter((group) =>
        shownFilter === THIS_TOUR
          ? tourDestinationIds.includes(group.destination.id)
          : group.destination.id === shownFilter,
      )
      .flatMap((group) => group.photos),
  );
  const options = [
    ...(hasTourPhotos ? [{ value: THIS_TOUR, label: t.thisTour }] : []),
    ...(library ?? []).map((group) => ({
      value: group.destination.id,
      label: group.destination.name,
    })),
  ];

  function toggle(publicId: string, checked: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      if (checked) next.add(publicId);
      else next.delete(publicId);
      return next;
    });
  }

  /** Ảnh đã tích mà chưa có trong tour — `existing` có thể vừa đổi giữa lúc hộp mở. */
  const chosen = [...picked].filter((publicId) => !existing.has(publicId));
  const addCount = Math.min(chosen.length, capacity);

  function changeOpen(next: boolean) {
    if (!next) setPicked(new Set());
    onOpenChange(next);
  }

  function add() {
    const all = dedupe((library ?? []).flatMap((group) => group.photos));
    onAdd(
      all
        .filter((photo) => picked.has(photo.publicId) && !existing.has(photo.publicId))
        .slice(0, capacity),
    );
    setPicked(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className={cn(DIALOG_FRAME, 'sm:max-w-3xl')} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.body}</DialogDescription>
        </DialogHeader>

        {library === null ? (
          failure !== null ? (
            <div className="grid gap-3">
              <p role="alert" className="text-sm text-destructive-emphasis">
                {libraryLoadErrorCopy(failure)}
              </p>
              {failure === 'GENERIC' || failure === 'INVALID_INPUT' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => void fetchLibrary()}
                >
                  {t.retry}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t.loading}
            </p>
          )
        ) : (
          <div className="grid gap-4">
            <FormField id="photo-library-destination" label={t.destination}>
              {(describedBy) => (
                <FormSelect
                  id="photo-library-destination"
                  value={shownFilter}
                  options={options}
                  placeholder={t.destination}
                  describedBy={describedBy}
                  onValueChange={setFilter}
                />
              )}
            </FormField>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => {
                  const added = existing.has(photo.publicId);
                  const checked = added || picked.has(photo.publicId);
                  const full = !checked && picked.size >= capacity;
                  const name = photo.alt ?? photo.publicId;
                  return (
                    <li key={photo.publicId} className="grid gap-1.5">
                      <div className="relative">
                        {/* biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005) */}
                        <img
                          src={tourPhotoThumb(photo.url)}
                          alt=""
                          className="aspect-[3/2] w-full rounded-md bg-muted object-cover"
                        />
                        {/* Nhãn đứng trên ảnh, ngoài chú thích bị cắt hai dòng: alt thật dài cả
                            câu từng nuốt mất chữ "Added" (thử tay F18). */}
                        {added ? (
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            {t.added}
                          </span>
                        ) : null}
                      </div>
                      <span className="flex items-start gap-2 text-sm">
                        <Checkbox
                          aria-label={name}
                          checked={checked}
                          disabled={added || full}
                          onCheckedChange={(value) => toggle(photo.publicId, value === true)}
                        />
                        <span className="line-clamp-2">{name}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 items-center">
          <p className="mr-auto text-xs text-muted-foreground">
            {t.left(Math.max(0, capacity - addCount))}
          </p>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={addCount === 0} onClick={add}>
            {t.add(addCount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Một ảnh có thể nằm ở hai địa danh — bày và gửi MỘT lần. */
function dedupe(photos: readonly AdminLibraryPhoto[]): AdminLibraryPhoto[] {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (seen.has(photo.publicId)) return false;
    seen.add(photo.publicId);
    return true;
  });
}

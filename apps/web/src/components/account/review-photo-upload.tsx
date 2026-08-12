'use client';

import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent } from '@tourism/ui/components/card';
import { Progress } from '@tourism/ui/components/progress';
import { Sortable, SortableItem, SortableItemHandle } from '@tourism/ui/components/reui/sortable';
import {
  CircleAlertIcon,
  CircleXIcon,
  CloudUploadIcon,
  GripVerticalIcon,
  ImageIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';
import { imageExtensionOf, uploadToCloudinary } from '@/lib/media-upload';
import { formatBytes, MAX_PHOTO_BYTES, MAX_PHOTOS, validatePhoto } from '@/lib/review-photos';

/**
 * KHỐI UPLOAD ẢNH CHUYẾN ĐI — mảnh 1 của cụm review-ảnh (12/08 UI, nối thật
 * Task 9 — ADR-0021):
 *
 * - Dropzone viền đứt (kéo-thả hoặc Browse) → validate qua `lib/review-photos`
 *   (logic thuần, TDD): đúng loại → trần 10MB → trần 5 ảnh; lỗi gom vào Alert.
 * - Lưới preview KÉO-THẢ SẮP XẾP được (ReUI Sortable — ảnh đầu là ảnh đại
 *   diện), mỗi ô có tay nắm + nút xoá hiện khi hover.
 * - Progress card từng file trong lúc upload; upload thật đi thẳng browser →
 *   Cloudinary (`api.media.signUpload` ký theo `bookingCode` rồi
 *   `uploadToCloudinary`, bytes không qua Nest).
 *
 * Không tự giữ danh sách publicId cho cha — báo ra ngoài qua `onPhotosChange`
 * (một `useEffect` theo `photos`), composer (`review-composer.tsx`) là nơi
 * giữ state và truyền tiếp cho `ReviewForm`.
 */

/** Mã lỗi thuần từ `validatePhoto` → copy i18n — bảng tĩnh, sống ngoài
 *  component để không dây vào deps của hook. */
function errorText(code: 'notImage' | 'tooLarge' | 'tooMany'): string {
  const t = messages.reviews.photos;
  return code === 'notImage'
    ? t.errNotImage
    : code === 'tooLarge'
      ? t.errTooLarge(formatBytes(MAX_PHOTO_BYTES))
      : t.errTooMany(MAX_PHOTOS);
}

interface PendingPhoto {
  id: string;
  name: string;
  size: number;
  /** Object URL cho preview — revoke khi xoá, tránh rò bộ nhớ. */
  preview: string;
  progress: number;
  status: 'uploading' | 'completed';
  /** publicId Cloudinary — chỉ có khi status đã 'completed'. */
  publicId?: string;
}

export function ReviewPhotoUpload({
  bookingCode,
  onPhotosChange,
}: {
  bookingCode: string;
  /** publicIds theo ĐÚNG thứ tự Sortable hiện tại (ảnh đầu = đại diện) +
   *  cờ busy khi còn ảnh đang upload — composer chảy thẳng xuống ReviewForm. */
  onPhotosChange: (s: { publicIds: string[]; busy: boolean }) => void;
}) {
  const t = messages.reviews.photos;
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload THẬT thay mô phỏng (ADR-0021): ký theo booking rồi POST thẳng
  // Cloudinary — lỗi ở bất kỳ bước nào thì gỡ ảnh khỏi hàng chờ + báo Alert.
  const startUpload = useCallback(
    async (id: string, file: File) => {
      try {
        const ext = imageExtensionOf(file.name);
        if (!ext) throw new Error('ext');
        const params = await api.media.signUpload(
          { purpose: 'REVIEW_PHOTO', ext, bookingCode },
          { context: withBrowserAuth() },
        );
        const publicId = await uploadToCloudinary(file, params, (pct) =>
          setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, progress: pct } : p))),
        );
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, publicId, progress: 100, status: 'completed' } : p,
          ),
        );
      } catch {
        setPhotos((prev) => {
          const target = prev.find((p) => p.id === id);
          if (target) URL.revokeObjectURL(target.preview);
          return prev.filter((p) => p.id !== id);
        });
        setErrors((prev) => [...prev, `${file.name}: ${t.errUpload}`]);
      }
    },
    [bookingCode, t.errUpload],
  );

  // Báo cha: publicIds theo ĐÚNG thứ tự sortable + cờ busy khi còn ảnh dang dở.
  useEffect(() => {
    onPhotosChange({
      publicIds: photos.flatMap((p) => (p.publicId ? [p.publicId] : [])),
      busy: photos.some((p) => p.status === 'uploading'),
    });
  }, [photos, onPhotosChange]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted: Array<{ photo: PendingPhoto; file: File }> = [];
      const rejected: string[] = [];
      let count = photos.length;
      for (const file of Array.from(files)) {
        const error = validatePhoto(file, count);
        if (error) {
          rejected.push(`${file.name}: ${errorText(error)}`);
          continue;
        }
        // validatePhoto chỉ soi MIME type — file không có đuôi hợp lệ (vd
        // thiếu phần mở rộng) vẫn lọt qua đó nhưng signUpload sẽ từ chối; bắt
        // ngay ở đây để khách thấy lỗi tức thì thay vì đợi round-trip mạng.
        if (!imageExtensionOf(file.name)) {
          rejected.push(`${file.name}: ${errorText('notImage')}`);
          continue;
        }
        count += 1;
        accepted.push({
          photo: {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            preview: URL.createObjectURL(file),
            progress: 0,
            status: 'uploading',
          },
          file,
        });
      }
      if (rejected.length > 0) setErrors((prev) => [...prev, ...rejected]);
      if (accepted.length > 0) {
        setPhotos((prev) => [...prev, ...accepted.map((a) => a.photo)]);
        for (const { photo, file } of accepted) startUpload(photo.id, file);
      }
    },
    [photos.length, startUpload],
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {t.hint(MAX_PHOTOS, formatBytes(MAX_PHOTO_BYTES))}
        {photos.length > 0 ? ` ${t.counter(photos.length, MAX_PHOTOS)}` : ''}
      </p>

      {/* ── Lưới preview kéo-thả sắp xếp ── */}
      {photos.length > 0 ? (
        <div className="mt-4">
          <Sortable
            value={photos}
            onValueChange={setPhotos}
            getItemValue={(p) => p.id}
            strategy="grid"
            className="grid auto-rows-fr grid-cols-3 gap-2.5 sm:grid-cols-5"
          >
            {photos.map((photo) => (
              <SortableItem key={photo.id} value={photo.id}>
                <div className="group/item relative flex shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 transition-all duration-200 hover:z-10 data-[dragging=true]:z-50">
                  {/* biome-ignore lint/performance/noImgElement: preview là Object URL cục bộ — next/image không áp dụng. */}
                  <img
                    src={photo.preview}
                    alt={photo.name}
                    className="pointer-events-none h-24 w-full rounded-md object-cover"
                  />
                  <SortableItemHandle className="absolute top-2 left-2 cursor-grab opacity-0 group-hover/item:opacity-100 active:cursor-grabbing">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 rounded-full"
                      aria-label={t.reorderHandle}
                    >
                      <GripVerticalIcon className="size-3.5" />
                    </Button>
                  </SortableItemHandle>
                  <Button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    variant="outline"
                    size="icon"
                    className="absolute top-2 right-2 size-6 rounded-full opacity-0 shadow-sm group-hover/item:opacity-100"
                    aria-label={t.removePhoto}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              </SortableItem>
            ))}
          </Sortable>
        </div>
      ) : null}

      {/* ── Dropzone ── */}
      <Card
        className={`mt-4 rounded-md border-dashed shadow-none transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <CardContent className="py-6 text-center">
          <div className="mx-auto mb-3 flex size-8 items-center justify-center rounded-full border border-border">
            <CloudUploadIcon className="size-4" />
          </div>
          <h3 className="mb-0.5 text-sm font-medium text-foreground">{t.dropTitle}</h3>
          <span className="mb-3 block text-xs text-muted-foreground">
            {t.dropHint(formatBytes(MAX_PHOTO_BYTES))}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
            {t.browse}
          </Button>
        </CardContent>
      </Card>

      {/* ── Progress từng file đang "upload" ── */}
      {photos.some((p) => p.status === 'uploading') ? (
        <div className="mt-4 space-y-2.5">
          {photos
            .filter((p) => p.status === 'uploading')
            .map((photo) => (
              <Card key={photo.id} className="rounded-md py-0 shadow-none">
                <CardContent className="flex items-center gap-2.5 p-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
                    <ImageIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    <div className="flex w-full items-center justify-between gap-2.5">
                      <div className="flex min-w-0 items-baseline gap-2.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {photo.name}
                        </span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          {formatBytes(photo.size)}
                        </span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          {t.uploading(Math.round(photo.progress))}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={t.removePhoto}
                      >
                        <CircleXIcon className="size-3.5" />
                      </Button>
                    </div>
                    <Progress value={photo.progress} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : null}

      {/* ── Lỗi gom một chỗ ── */}
      {errors.length > 0 ? (
        <Alert variant="destructive" className="mt-4">
          <CircleAlertIcon />
          <AlertTitle>{t.errorsTitle}</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

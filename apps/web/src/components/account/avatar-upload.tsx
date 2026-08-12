'use client';

import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { Button } from '@tourism/ui/components/button';
import { CircleAlertIcon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { MAX_AVATAR_BYTES, validateAvatar } from '@/lib/avatar';
import { formatBytes } from '@/lib/review-photos';

/**
 * KHỐI UPLOAD AVATAR trong Settings (mảnh 12/08 — UI theo mẫu avatar-upload
 * user chọn, thuần hoá về đồ nhà, KHÔNG cần hook ngoài):
 *
 * - Vòng tròn avatar viền đứt: bấm hoặc kéo-thả ảnh vào; có ảnh → preview
 *   phủ tròn + nút X gỡ; chưa có → chữ cái đầu (đồng bộ ngôn ngữ initial
 *   của khung hộ chiếu, thay UserIcon của mẫu).
 * - Validate qua `lib/avatar` (thuần, TDD): đúng loại → trần 2MB; lỗi vào
 *   Alert.
 *
 * STATIC-FIRST: preview là Object URL cục bộ, CHƯA gửi server — mảnh backend
 * (ADR bề mặt ghi media + Cloudinary signed upload, chung với ảnh review) sẽ
 * nối `authClient.updateUser({ image })` tại đúng chỗ `onPick`.
 */
export function AvatarUpload({ initial }: { initial: string }) {
  const t = messages.accountProfile.avatar;
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const error = validateAvatar(file);
    if (error) {
      setErrors([
        `${file.name}: ${error === 'notImage' ? t.errNotImage : t.errTooLarge(formatBytes(MAX_AVATAR_BYTES))}`,
      ]);
      return;
    }
    setErrors([]);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function removeAvatar() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  return (
    <div className="flex items-center gap-4 py-4">
      <div className="relative">
        <button
          type="button"
          aria-label={t.upload}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            onPick(e.dataTransfer.files);
          }}
          className={`group/avatar relative size-20 cursor-pointer overflow-hidden rounded-full border transition-colors ${
            preview
              ? 'border-solid border-border'
              : isDragging
                ? 'border-dashed border-primary bg-primary/5'
                : 'border-dashed border-muted-foreground/25 bg-muted hover:border-muted-foreground/50'
          }`}
        >
          {preview ? (
            // biome-ignore lint/performance/noImgElement: preview là Object URL cục bộ — next/image không áp dụng.
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-heading text-3xl font-semibold text-ink/70">
              {initial.toUpperCase()}
            </span>
          )}
        </button>
        {preview ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={removeAvatar}
            aria-label={t.remove}
            className="absolute -top-0.5 -right-0.5 z-10 size-6 rounded-full shadow-sm"
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{preview ? t.selected : t.upload}</p>
        <p className="text-xs text-muted-foreground">{t.hint(formatBytes(MAX_AVATAR_BYTES))}</p>
        {errors.length > 0 ? (
          <Alert variant="destructive" className="mt-3">
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
    </div>
  );
}

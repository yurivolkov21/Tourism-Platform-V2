'use client';

import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { Button } from '@tourism/ui/components/button';
import { CircleAlertIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';
import { MAX_AVATAR_BYTES, validateAvatar } from '@/lib/avatar';
import { imageExtensionOf, uploadToCloudinary } from '@/lib/media-upload';
import { formatBytes } from '@/lib/review-photos';

/**
 * KHỐI UPLOAD AVATAR trong Settings (mảnh 12/08, nối thật 12/08 — ADR-0021):
 *
 * - Vòng tròn avatar viền đứt: bấm hoặc kéo-thả ảnh vào; có ảnh → preview
 *   phủ tròn + nút X gỡ; chưa có → chữ cái đầu (đồng bộ ngôn ngữ initial
 *   của khung hộ chiếu, thay UserIcon của mẫu).
 * - Validate qua `lib/avatar` (thuần, TDD): đúng loại → trần 2MB; lỗi vào
 *   Alert.
 *
 * Luồng ghi thật (ADR-0021 §3 — đường setAvatar ĐÓNG, KHÔNG dùng
 * `authClient.updateUser({ image })` của Better Auth): `onPick` ký chữ ký
 * upload qua `api.media.signUpload` → POST thẳng file lên Cloudinary
 * (`uploadToCloudinary`, browser → Cloudinary, bytes không qua Nest) →
 * `api.account.setAvatar({ publicId })` ghi vào DB → `router.refresh()` để
 * Server Component đọc lại `image` mới từ session/`/api/account/me`. Ưu
 * tiên hiển thị: `preview` (Object URL cục bộ, đang/vừa upload) → `image`
 * (đã lưu, prop từ server) → chữ cái đầu — preview được GIỮ NGUYÊN tới khi
 * `router.refresh()` mang `image` mới về (không tự xoá ngay sau khi
 * `setAvatar` resolve), tránh nháy về chữ cái đầu trong lúc chờ RSC render
 * lại.
 */
export function AvatarUpload({
  initial,
  image,
}: {
  initial: string;
  /** Avatar đã lưu (URL Cloudinary) — `null` = chưa có, tạm hiện chữ cái đầu. */
  image: string | null;
}) {
  const t = messages.accountProfile.avatar;
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Thu hồi Object URL còn sống khi unmount (điều hướng SPA không unload
  // document nên URL không tự chết) — ref bám giá trị mới nhất để cleanup
  // không phụ thuộc closure cũ.
  const previewRef = useRef<string | null>(null);
  previewRef.current = preview;
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const displaySrc = preview ?? image;

  async function onPick(files: FileList | null) {
    // Chặn mọi cửa vào khi đang bận — `disabled` của button chỉ chắc chắn
    // chặn click, còn drop thứ hai giữa lúc upload là tuỳ trình duyệt; hai
    // onPick chạy đua sẽ revoke preview của nhau và setAvatar chồng lệnh
    // (finding review Task 8).
    if (busy) return;
    const file = files?.[0];
    if (!file) return;
    const error = validateAvatar(file);
    if (error) {
      setErrors([
        `${file.name}: ${error === 'notImage' ? t.errNotImage : t.errTooLarge(formatBytes(MAX_AVATAR_BYTES))}`,
      ]);
      return;
    }
    const ext = imageExtensionOf(file.name);
    if (!ext) {
      setErrors([`${file.name}: ${t.errNotImage}`]);
      return;
    }
    setErrors([]);
    const objectUrl = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setBusy(true);
    setPct(0);
    try {
      const params = await api.media.signUpload(
        { purpose: 'AVATAR', ext },
        { context: withBrowserAuth() },
      );
      const publicId = await uploadToCloudinary(file, params, setPct);
      await api.account.setAvatar({ publicId }, { context: withBrowserAuth() });
      router.refresh();
      // Giữ nguyên preview — không revoke ở đây: `image` mới chỉ về sau khi
      // `refresh()` render lại từ server, xoá ngay sẽ nháy về chữ cái đầu.
    } catch (error) {
      // Mọi lỗi (ORPCError của signUpload/setAvatar, hay lỗi mạng của
      // uploadToCloudinary) đều gộp về một thông báo chung — bảng mã lỗi chi
      // tiết (AVATAR_PUBLIC_ID_INVALID…) không đáng phơi ra người dùng cuối.
      // Trừ 429: "chờ một phút" là hành động khác hẳn "thử lại".
      setErrors([
        error instanceof ORPCError && error.status === 429
          ? messages.accountActionErrors.throttle
          : t.errUpload,
      ]);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setErrors([]);
    setBusy(true);
    try {
      await api.account.setAvatar({ publicId: null }, { context: withBrowserAuth() });
      router.refresh();
    } catch {
      setErrors([t.errUpload]);
    } finally {
      setBusy(false);
    }
    // Thu hồi preview cục bộ nếu có — cả khi gỡ avatar đã lưu lẫn khi đang
    // kẹt giữa chừng một lần chọn lỗi (preview mồ côi, chưa kịp lưu).
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
          disabled={busy}
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
          className={`group/avatar relative size-20 cursor-pointer overflow-hidden rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
            displaySrc
              ? 'border-solid border-border'
              : isDragging
                ? 'border-dashed border-primary bg-primary/5'
                : 'border-dashed border-muted-foreground/25 bg-muted hover:border-muted-foreground/50'
          }`}
        >
          {displaySrc ? (
            // biome-ignore lint/performance/noImgElement: preview là Object URL cục bộ hoặc URL Cloudinary ngoài — next/image chưa khai remotePatterns (nợ ADR-0020).
            <img src={displaySrc} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-heading text-3xl font-semibold text-ink/70">
              {initial.toUpperCase()}
            </span>
          )}
        </button>
        {displaySrc ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={removeAvatar}
            disabled={busy}
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
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{displaySrc ? t.selected : t.upload}</p>
        <p className="text-xs text-muted-foreground">
          {busy ? t.uploading(pct) : t.hint(formatBytes(MAX_AVATAR_BYTES))}
        </p>
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

'use client';

import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { Alert, AlertDescription, AlertTitle } from '@tourism/ui/components/alert';
import { Button } from '@tourism/ui/components/button';
import { CircleAlertIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api, withBrowserAuth } from '@/lib/api/client';
import { MAX_AVATAR_BYTES, validateAvatar } from '@/lib/avatar';
import { imageExtensionOf, uploadToCloudinary } from '@/lib/media-upload';
import { formatBytes } from '@/lib/review-photos';

/**
 * KHỐI UPLOAD AVATAR trong Settings (mảnh 12/08, nối thật 12/08 — ADR-0021):
 *
 * - Vòng tròn avatar 96px viền đứt, dựng DỌC và căn giữa (thẻ danh tính, spec
 *   09/10 §2): ảnh → `children` (tên, email do thẻ truyền vào) → nút viền
 *   "Upload avatar" → dòng gợi ý hay tiến độ → khối lỗi. Bấm hoặc kéo-thả ảnh
 *   vào; có ảnh → preview phủ tròn + nút X gỡ; chưa có → chữ cái đầu (đồng bộ
 *   ngôn ngữ initial của khung hộ chiếu). Nút viền mở CÙNG ô chọn file với ảnh
 *   (bản vẽ C user duyệt có nút này, và điện thoại không có hover để lộ rằng
 *   ảnh bấm được); ảnh vẫn bấm và thả được bằng chuột. Không còn dòng chữ
 *   "Upload avatar / Avatar selected" làm nhãn phụ.
 * - Nút viền là điểm dừng "Upload avatar" DUY NHẤT cho bàn phím và trình đọc
 *   màn hình (review 09/10): ảnh tròn và ô file `sr-only` đều `aria-hidden` +
 *   `tabIndex={-1}`; nút gỡ ảnh (khi có ảnh) vẫn là điểm dừng riêng.
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
  children,
}: {
  initial: string;
  /** Avatar đã lưu (URL Cloudinary) — `null` = chưa có, tạm hiện chữ cái đầu. */
  image: string | null;
  /** Nội dung chèn GIỮA ảnh và nút "Upload avatar" — thẻ danh tính đặt tên và email ở đây. */
  children?: ReactNode;
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

  /** Cả ảnh tròn lẫn nút viền mở chung MỘT ô chọn file. */
  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Ảnh tròn chỉ để chuột bấm hoặc thả ảnh vào: nút viền "Upload avatar" bên dưới là điểm dừng
            DUY NHẤT của bàn phím và trình đọc màn hình, nên nó ẩn khỏi cây trợ năng và khỏi thứ tự
            Tab — hai nút trùng tên thì trình đọc màn hình đọc đôi, Tab dừng hai lần. */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          disabled={busy}
          onClick={openPicker}
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
          className={`group/avatar relative size-24 cursor-pointer overflow-hidden rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
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
            <span className="flex size-full items-center justify-center font-heading text-4xl font-semibold text-ink/70">
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
            // Vòng 96px: tâm nút gỡ ở 2px trong góc hộp thì nằm đúng trên mép tròn.
            className="absolute top-0.5 right-0.5 z-10 size-6 rounded-full shadow-sm"
          >
            <XIcon className="size-3.5" />
          </Button>
        ) : null}
        {/* Ô file chỉ là ô được mở hộ bằng `openPicker`: `sr-only` vẫn focus được nên phải tắt khỏi
            cây trợ năng và thứ tự Tab, kẻo thành điểm dừng thứ ba không tên. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-hidden="true"
          tabIndex={-1}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {children}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={openPicker}
        className="mt-3.5"
      >
        {/* Chỉ chữ, không icon — cùng giọng các nút khác của trang (user duyệt 09/10). */}
        {t.upload}
      </Button>

      {/* Gợi ý cỡ ảnh, hay tiến độ lúc đang tải — cùng một dòng như trước. */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {busy ? t.uploading(pct) : t.hint(formatBytes(MAX_AVATAR_BYTES))}
      </p>
      {errors.length > 0 ? (
        <Alert variant="destructive" className="mt-3 text-left">
          <CircleAlertIcon />
          <AlertTitle>{t.errorsTitle}</AlertTitle>
          <AlertDescription>
            {/* `wrap-anywhere`: câu lỗi mang tên tệp — tên dài liền một chuỗi từng đẩy trang 320px
                tràn ngang 240px (review 09/10). */}
            {errors.map((error) => (
              <p key={error} className="last:mb-0 wrap-anywhere">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

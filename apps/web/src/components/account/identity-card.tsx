import { messages } from '@tourism/i18n';
import { Separator } from '@tourism/ui/components/separator';
import { cn } from '@tourism/ui/lib/utils';
import { MailIcon } from 'lucide-react';
import { AvatarUpload } from '@/components/account/avatar-upload';
import type { SessionUser } from '@/lib/api/session';

/**
 * Thẻ danh tính — cột trái của Settings (spec 09/10 §2, phương án C): ảnh đại diện 96px dùng lại
 * `AvatarUpload` (bấm hoặc kéo thả, nút "Upload avatar", tiến độ, lỗi, nút gỡ — hành vi không đổi),
 * tên chữ serif, email muted, dòng gợi ý cỡ ảnh; dưới vạch ngăn là Connected accounts (mục riêng cũ
 * gộp vào đây): nhãn nhỏ và dòng "Email & password" có icon thư.
 *
 * Dính khi cuộn chỉ từ `lg` — trang truyền `className` (`lg:sticky lg:top-28`), thẻ không tự quyết
 * vị trí của mình.
 *
 * Tên và email có thể dài và không dấu cách (email 47 ký tự), nên cả hai mang `wrap-anywhere`
 * (`overflow-wrap: anywhere`, nếp `EmailText` của admin). `break-words` KHÔNG đủ: nó không hạ
 * min-content của ô flex, nên thẻ phình theo email — đẩy cả trang cuộn ngang ở 320px, và từ `lg`
 * (cột trái cố định 320px) email thò ra khỏi viền thẻ.
 */
export function IdentityCard({ profile, className }: { profile: SessionUser; className?: string }) {
  const t = messages.accountProfile;
  return (
    <section
      data-slot="identity-card"
      className={cn('rounded-2xl border bg-card px-6 py-6.5 text-center', className)}
    >
      <AvatarUpload initial={(profile.name || profile.email).charAt(0)} image={profile.image}>
        {/* Tài khoản không khai tên thì không dựng h2 trống: trình đọc màn hình đọc ra một đề mục rỗng. */}
        {profile.name ? (
          <h2 className="mt-3 font-heading text-xl leading-tight font-semibold wrap-anywhere text-foreground">
            {profile.name}
          </h2>
        ) : null}
        <p
          className={cn(
            'text-sm wrap-anywhere text-muted-foreground',
            // Có tên thì email đứng sát dưới tên; không có thì email nhận luôn khoảng cách của tên.
            profile.name ? 'mt-0.5' : 'mt-3',
          )}
        >
          {profile.email}
        </p>
      </AvatarUpload>
      <Separator className="my-4.5" />
      <div className="text-left">
        <h3 className="text-[0.625rem] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {t.connected.heading}
        </h3>
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-muted text-ink">
            <MailIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">{t.connected.emailPassword}</span>
        </div>
      </div>
    </section>
  );
}

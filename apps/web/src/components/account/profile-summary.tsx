'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';
import { type AuthErrorKey, mapAuthError } from '@/lib/auth-errors';

type EditableField = 'name' | 'phone' | 'password';
type ProfileErrorKind = 'sessionExpired' | AuthErrorKey;

/**
 * Một dòng của danh sách tóm tắt: nhãn · giá trị · hành động.
 *
 * `action` là ReactNode chứ không phải chuỗi vì ba dòng có ba loại hành động
 * khác nhau — nút mở, chữ giải thích vì sao không đổi được, và không gì cả.
 */
function SummaryRow({
  label,
  value,
  action,
  editing,
  children,
}: {
  label: string;
  value: ReactNode;
  action: ReactNode;
  editing?: boolean;
  /** Phần THAY THẾ giá trị khi đang sửa dòng này. */
  children?: ReactNode;
}) {
  return (
    <li className="py-4">
      {/* Đang sửa thì form THAY THẾ giá trị, không xếp chồng dưới nó. Bản đầu
          tiên xếp chồng và nhìn ảnh thật mới thấy: nhãn trường hiện hai lần, và
          có hai nút Cancel cạnh nhau — người dùng không biết cái nào là cái nào. */}
      {editing ? (
        <>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {children}
        </>
      ) : (
        // Khuôn Airbnb "Personal info": nhãn ĐẬM trên, giá trị mờ dưới, hành
        // động bám mép phải. Bản trước cho nhãn một cột cứng `w-24` rồi thả
        // giá trị `flex-1` — nên ở cột rộng, hành động bị đẩy cách giá trị tới
        // ~790px trống, và người đọc không nối được hai thứ với nhau.
        <div className="flex items-baseline justify-between gap-6">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{value}</div>
          </div>
          <div className="shrink-0">{action}</div>
        </div>
      )}
    </li>
  );
}

/**
 * Trang hồ sơ dạng danh sách tóm tắt đọc-trước (kiểu GOV.UK), thay hai form
 * luôn mở của bản dựng tạm.
 *
 * Vì sao đổi: đa số lần vào trang này người ta chỉ muốn XEM lại thông tin của
 * mình. Mở sẵn sáu ô nhập bắt họ đọc một cái form thay vì đọc dữ liệu, và
 * cũng làm mọi thứ trông như đang chờ được sửa.
 *
 * Mỗi lần chỉ MỘT dòng mở: mở nhiều dòng cùng lúc thì không rõ nút "Save"
 * nào thuộc về đâu, và người dùng dễ tưởng một nút lưu tất cả.
 *
 * Email không có nút đổi — đó là email đăng nhập, tính năng đổi chưa làm
 * (PARK ở spec §4). Nói thẳng "chưa đổi được" tử tế hơn là dựng một nút rồi
 * báo lỗi khi bấm.
 */
export function ProfileSummary({ profile }: { profile: SessionUser }) {
  const t = messages.accountProfile;
  const s = t.summary;
  const router = useRouter();

  const [open, setOpen] = useState<EditableField | null>(null);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [pending, setPending] = useState(false);
  const [errorKind, setErrorKind] = useState<ProfileErrorKind | null>(null);

  function close() {
    setOpen(null);
    setErrorKind(null);
    // Trả ô nhập về giá trị đã lưu — bấm Cancel rồi mở lại mà vẫn thấy chữ
    // vừa gõ dở thì người dùng tưởng nó đã được lưu.
    setName(profile.name);
    setPhone(profile.phone ?? '');
  }

  async function save(event: FormEvent<HTMLFormElement>, patch: { name?: string; phone?: string }) {
    event.preventDefault();
    setErrorKind(null);
    setPending(true);
    // @better-fetch reject promise khi fetch throw thật (API sập/offline) —
    // KHÁC error envelope ({error}) ở nhánh dưới.
    try {
      const { error } = await authClient.updateUser(patch);
      if (error) {
        setErrorKind(error.status === 401 ? 'sessionExpired' : mapAuthError(error));
        return;
      }
      toast.success(t.toast.profileSavedTitle);
      setOpen(null);
      router.refresh();
    } catch {
      setErrorKind('generic');
    } finally {
      setPending(false);
    }
  }

  const editButton = (field: EditableField, label: string) => (
    <Button
      type="button"
      variant="link"
      size="sm"
      // `px-0`: variant link vẫn mang padding ngang của size, và 10px đó đẩy
      // chữ lệch khỏi mép phải container — mất đúng toạ độ thứ ba của lưới.
      className="h-auto px-0"
      aria-expanded={open === field}
      aria-label={s.editAria(label)}
      onClick={() => setOpen(field)}
    >
      {s.edit}
    </Button>
  );

  const errorNode = errorKind ? (
    <AccountActionError
      expired={errorKind === 'sessionExpired'}
      redirectTo="/account/profile"
      className="mt-2"
      // Nhánh null không bao giờ chạy (component đã hiện UI riêng khi
      // `expired`) nhưng cần để TypeScript thu hẹp `errorKind`.
      fallback={errorKind === 'sessionExpired' ? null : messages.authForms.errors[errorKind]}
    />
  ) : null;

  return (
    <ul className="divide-y">
      <SummaryRow
        label={t.details.nameLabel}
        value={profile.name}
        editing={open === 'name'}
        action={editButton('name', t.details.nameLabel)}
      >
        {open === 'name' ? (
          /* `noValidate`: nếu sau này thêm `required`/`type=email` mà quên cái
             này thì validate GỐC của trình duyệt chặn submit trước khi
             `onSubmit` kịp chạy — đúng bug đã dính ở form đặt chỗ (4959455). */
          <form noValidate className="mt-3 flex flex-col gap-3" onSubmit={(e) => save(e, { name })}>
            <div className="flex flex-col gap-1.5">
              {/* Nhãn nhìn thấy đã nằm ở cột trái của dòng; giữ <Label> cho
                  trình đọc màn hình nhưng ẩn khỏi thị giác để khỏi lặp. */}
              <Label htmlFor="profile-name" className="sr-only">
                {t.details.nameLabel}
              </Label>
              <Input
                id="profile-name"
                value={name}
                autoComplete="name"
                className="max-w-80"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {errorNode}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {s.saveName}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                {s.cancelEdit}
              </Button>
            </div>
          </form>
        ) : null}
      </SummaryRow>

      <SummaryRow
        label={t.details.phoneLabel}
        value={
          profile.phone ? (
            <span className="tabular-nums">{profile.phone}</span>
          ) : (
            <span className="text-muted-foreground">{s.notSet}</span>
          )
        }
        editing={open === 'phone'}
        action={editButton('phone', t.details.phoneLabel)}
      >
        {open === 'phone' ? (
          <form
            noValidate
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => save(e, { phone })}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-phone" className="sr-only">
                {t.details.phoneLabel}
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                autoComplete="tel"
                className="max-w-80"
                onChange={(event) => setPhone(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">{s.phoneHint}</p>
            </div>
            {errorNode}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {s.savePhone}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                {s.cancelEdit}
              </Button>
            </div>
          </form>
        ) : null}
      </SummaryRow>

      <SummaryRow
        label={t.details.emailLabel}
        value={profile.email}
        action={<span className="text-sm text-muted-foreground">{s.emailLocked}</span>}
      />

      <SummaryRow
        label={s.passwordLabel}
        // Chấm tròn cố định, KHÔNG theo độ dài thật — hiện đúng số ký tự là
        // rò rỉ một mẩu thông tin về mật khẩu.
        value={<span className="font-mono text-muted-foreground">{s.passwordMask}</span>}
        editing={open === 'password'}
        action={editButton('password', s.passwordLabel)}
      >
        {open === 'password' ? (
          <div className="mt-3">
            <ChangePasswordForm onDone={close} />
          </div>
        ) : null}
      </SummaryRow>
    </ul>
  );
}

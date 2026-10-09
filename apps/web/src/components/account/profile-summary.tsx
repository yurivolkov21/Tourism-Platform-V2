'use client';

import {
  type AuthErrorKey,
  mapAuthError,
  validateProfileName,
  validateProfilePhone,
} from '@tourism/core';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { LockIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AccountActionError } from '@/components/account/account-action-error';
import { EditButton, SettingsCard, SettingsRow } from '@/components/account/settings-card';
import { FieldError, invalidProps } from '@/components/auth/field-error';
import type { SessionUser } from '@/lib/api/session';
import { authClient } from '@/lib/auth-client';

type EditableField = 'name' | 'phone';
type ProfileErrorKind = 'sessionExpired' | AuthErrorKey;

/**
 * Thẻ Personal information của Settings (spec 09/10 §2, phương án C): Full name, Phone, Email
 * dạng đọc-trước (kiểu GOV.UK, redesign 10/08) — đa số lần vào trang này người ta chỉ muốn XEM
 * lại thông tin; mở sẵn ô nhập là bắt họ đọc form thay vì đọc dữ liệu.
 *
 * Mật khẩu đã tách sang thẻ riêng (`PasswordCard`): mỗi thẻ giữ trạng thái mở của riêng nó, nên
 * một dòng ở đây và dòng mật khẩu mở cùng lúc được. TRONG thẻ này mỗi lần chỉ MỘT dòng mở — mở
 * nhiều dòng thì không rõ nút "Save" nào thuộc về đâu, và người dùng dễ tưởng một nút lưu tất cả.
 *
 * Email không có nút sửa — đó là email đăng nhập, tính năng đổi chưa làm (PARK). Nói thẳng "chưa
 * đổi được" kèm icon khoá tử tế hơn là dựng một nút rồi báo lỗi khi bấm.
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
  // Sweep 19/08: lỗi của ô đang mở (tên trống/quá dài, phone 6–30) — kiểm ở
  // client trước khi gọi `updateUser`; mỗi lần chỉ MỘT dòng mở nên một slot đủ.
  const [fieldError, setFieldError] = useState<string | undefined>();

  function startEdit(field: EditableField) {
    setFieldError(undefined);
    setOpen(field);
  }

  function close() {
    setOpen(null);
    setErrorKind(null);
    setFieldError(undefined);
    // Trả ô nhập về giá trị đã lưu — bấm Cancel rồi mở lại mà vẫn thấy chữ
    // vừa gõ dở thì người dùng tưởng nó đã được lưu.
    setName(profile.name);
    setPhone(profile.phone ?? '');
  }

  async function save(event: FormEvent<HTMLFormElement>, patch: { name?: string; phone?: string }) {
    event.preventDefault();
    setErrorKind(null);
    const found =
      patch.name !== undefined
        ? validateProfileName(patch.name)
        : patch.phone !== undefined
          ? validateProfilePhone(patch.phone)
          : undefined;
    setFieldError(found);
    if (found) return;
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
    <SettingsCard title={t.details.heading} description={t.details.blurb}>
      <SettingsRow
        label={t.details.nameLabel}
        value={profile.name}
        editing={open === 'name'}
        action={<EditButton field={t.details.nameLabel} onClick={() => startEdit('name')} />}
      >
        {open === 'name' ? (
          /* `noValidate`: nếu sau này thêm `required`/`type=email` mà quên cái
             này thì validate GỐC của trình duyệt chặn submit trước khi
             `onSubmit` kịp chạy — đúng bug đã dính ở form đặt chỗ (4959455). */
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => save(e, { name: name.trim() })}
          >
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
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldError(undefined);
                }}
                {...invalidProps('profile-name-error', fieldError)}
              />
              <FieldError id="profile-name-error">{fieldError}</FieldError>
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
      </SettingsRow>

      <SettingsRow
        label={t.details.phoneLabel}
        hint={s.phoneHint}
        value={
          profile.phone ? (
            <span className="tabular-nums">{profile.phone}</span>
          ) : (
            <span className="text-muted-foreground">{s.notSet}</span>
          )
        }
        editing={open === 'phone'}
        action={<EditButton field={t.details.phoneLabel} onClick={() => startEdit('phone')} />}
      >
        {open === 'phone' ? (
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => save(e, { phone: phone.trim() })}
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
                onChange={(event) => {
                  setPhone(event.target.value);
                  setFieldError(undefined);
                }}
                {...invalidProps('profile-phone-error', fieldError)}
              />
              <FieldError id="profile-phone-error">{fieldError}</FieldError>
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
      </SettingsRow>

      <SettingsRow
        label={t.details.emailLabel}
        value={profile.email}
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon aria-hidden="true" className="size-3.5" />
            {s.emailLocked}
          </span>
        }
      />
    </SettingsCard>
  );
}

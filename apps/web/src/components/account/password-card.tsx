'use client';

import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { EditButton, SettingsCard, SettingsRow } from '@/components/account/settings-card';

/**
 * Thẻ Password của Settings (spec 09/10 §2): tách khỏi Personal information thành thẻ riêng.
 * Một dòng mật khẩu che bằng chấm tròn CỐ ĐỊNH (hiện đúng số ký tự là rò rỉ một mẩu thông tin về
 * mật khẩu) và nút Edit; mở thì `ChangePasswordForm` (ba ô; đổi xong hay Cancel thì đóng) nằm
 * ngay trong dòng. Trạng thái mở là của riêng thẻ này — mở cùng lúc với một dòng của Personal
 * information được.
 */
export function PasswordCard() {
  const t = messages.accountProfile;
  const s = t.summary;
  const [open, setOpen] = useState(false);

  return (
    <SettingsCard title={s.passwordLabel} description={t.password.blurb}>
      <SettingsRow
        label={s.passwordLabel}
        value={<span className="font-mono text-muted-foreground">{s.passwordMask}</span>}
        editing={open}
        action={<EditButton field={s.passwordLabel} onClick={() => setOpen(true)} />}
      >
        {open ? (
          // Ba ô xếp dọc rộng tối đa 360px như bản vẽ C — trải hết cột giá trị thì ô dài lê thê.
          <div className="max-w-90">
            <ChangePasswordForm onDone={() => setOpen(false)} />
          </div>
        ) : null}
      </SettingsRow>
    </SettingsCard>
  );
}

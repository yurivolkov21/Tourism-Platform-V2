import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { DeleteAccountSheet } from '@/features/account/delete-account-sheet';
import { PersonalDetailsScreen } from '@/features/account/personal-details-screen';
import { getAuthClient } from '@/lib/auth-client';

/**
 * Route "Personal details" (mockup A1 dòng cùng tên) — mở từ A1, KHÔNG mở tấm
 * A3 trực tiếp (đó là việc riêng của bút chì cạnh tên ở A1).
 *
 * "Delete account" (A7): CHỈ dựng khung UI (chốt 27/09 — "UI trước nhé"),
 * `onConfirm` CỐ Ý no-op. ADR-0021/plan P5b-4 §5 đánh cờ đỏ: `deleteUser`
 * chưa tồn tại kể cả phía web, cần một vòng brainstorm/ADR riêng cho luật
 * cascade phía server (booking đã trả tiền giữ lại, review/wishlist xoá thế
 * nào) trước khi wire thật.
 */
export default function PersonalDetailsRoute() {
  const { data: session } = getAuthClient().useSession();
  const { personalDetails } = messages.mobile.account;
  const { showPassword, hidePassword } = messages.mobile.auth;

  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [password, setPassword] = useState('');

  return (
    <>
      <PersonalDetailsScreen
        name={session?.user.name ?? ''}
        email={session?.user.email ?? ''}
        nameLabel={personalDetails.nameLabel}
        emailLabel={personalDetails.emailLabel}
        passwordLabel={messages.mobile.account.menuPassword}
        onPasswordPress={() => router.push('/change-password')}
        deleteAccountLabel={personalDetails.deleteAccount}
        onDeleteAccountPress={() => setDeleteSheetOpen(true)}
      />
      <DeleteAccountSheet
        visible={deleteSheetOpen}
        onClose={() => {
          setDeleteSheetOpen(false);
          setPassword('');
        }}
        title={personalDetails.deleteSheetTitle}
        body={personalDetails.deleteSheetBody}
        passwordLabel={messages.mobile.account.password.currentLabel}
        password={password}
        revealLabel={showPassword}
        hideLabel={hidePassword}
        confirmLabel={personalDetails.deleteAccount}
        cancelLabel={personalDetails.keepAccount}
        onChangePassword={setPassword}
        onConfirm={() => {}}
      />
    </>
  );
}

import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { submitDeleteAccount } from '@/features/account/delete-account-flow';
import { DeleteAccountSheet } from '@/features/account/delete-account-sheet';
import { PersonalDetailsScreen } from '@/features/account/personal-details-screen';
import { deleteAccountRequest } from '@/lib/account-api';
import { getAuthClient } from '@/lib/auth-client';
import { env } from '@/lib/env';

/**
 * Route "Personal details" (mockup A1 dòng cùng tên) — mở từ A1, KHÔNG mở tấm
 * A3 trực tiếp (đó là việc riêng của bút chì cạnh tên ở A1).
 *
 * "Delete account" (A7): gọi `DELETE /api/account` có sẵn (ADR-0017 §7b —
 * tombstone + gate booking đã trả tiền, web dùng từ trước). Bản 27/09 để
 * `onConfirm` no-op vì tưởng server chưa có endpoint; review 06/10 (F6) xác
 * nhận đã có nên nối thật.
 */
export default function PersonalDetailsRoute() {
  const { data: session } = getAuthClient().useSession();
  const { personalDetails } = messages.mobile.account;
  const { showPassword, hidePassword } = messages.mobile.auth;

  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function closeSheet() {
    // Đang gọi API thì không cho đóng — đóng giữa chừng là mất kết cục lỗi.
    if (pending) return;
    setDeleteSheetOpen(false);
    setPassword('');
    setPasswordError(undefined);
    setFormError(null);
  }

  async function handleConfirm() {
    if (pending) return;
    setPasswordError(undefined);
    setFormError(null);
    setPending(true);
    const outcome = await submitDeleteAccount(password, (value) =>
      deleteAccountRequest(value, { apiUrl: env().apiUrl, cookie: getAuthClient().getCookie() }),
    );
    setPending(false);

    if (outcome.kind === 'fieldError') {
      setPasswordError(outcome.text);
      return;
    }
    if (outcome.kind === 'formError') {
      setFormError(outcome.text);
      return;
    }

    setDeleteSheetOpen(false);
    try {
      // Server đã thu hồi mọi phiên khi tombstone — `signOut()` ở đây chủ yếu
      // để dọn phiên trong expo-secure-store; server trả lỗi cũng kệ.
      await getAuthClient().signOut();
    } catch {
      // Cùng lý do `handleSignOut` ở (tabs)/account.tsx: phần cục bộ đã xoá.
    }
    router.replace('/');
  }

  return (
    <>
      <PersonalDetailsScreen
        name={session?.user.name ?? ''}
        email={session?.user.email ?? ''}
        nameLabel={personalDetails.nameLabel}
        emailLabel={personalDetails.emailLabel}
        deleteAccountLabel={personalDetails.deleteAccount}
        onDeleteAccountPress={() => setDeleteSheetOpen(true)}
      />
      <DeleteAccountSheet
        visible={deleteSheetOpen}
        onClose={closeSheet}
        title={personalDetails.deleteSheetTitle}
        body={personalDetails.deleteSheetBody}
        passwordLabel={messages.mobile.account.password.currentLabel}
        password={password}
        passwordError={passwordError}
        formError={formError}
        pending={pending}
        revealLabel={showPassword}
        hideLabel={hidePassword}
        confirmLabel={personalDetails.deleteAccount}
        deletingLabel={personalDetails.deleting}
        cancelLabel={personalDetails.keepAccount}
        onChangePassword={(value) => {
          setPassword(value);
          if (passwordError !== undefined) setPasswordError(undefined);
        }}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}

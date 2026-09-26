import { validateProfileName } from '@tourism/core';
import { messages } from '@tourism/i18n';
import { AppText } from '@tourism/mobile-ui';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { type AccountMenuItem, AccountScreen } from '@/features/account/account-screen';
import { EditNameSheet } from '@/features/account/edit-name-sheet';
import { SignOutSheet } from '@/features/account/sign-out-sheet';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { reviewAuthorInitials } from '@/features/tour-detail/reviews';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { isDevBuild } from '@/lib/dev-only';
import { openExternalPath } from '@/lib/open-external-path';

/**
 * Route Account (A1-A3-A5, mục 3 spec P5b-4). Chưa đăng nhập → `AuthGateScreen`
 * (A2) kèm `legalLinks` — BA dòng pháp lý vẫn mở được, không cần phiên.
 */
export default function AccountRoute() {
  const { data: session } = getAuthClient().useSession();

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [nameFormError, setNameFormError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const { account } = messages.mobile;

  // Guard trực tiếp trên `session?.user` (không qua biến `boolean` trung
  // gian) — TS mới thu hẹp được `session` khỏi `null` ở nhánh dưới.
  if (session?.user === undefined) {
    return (
      <AuthGateScreen
        icon="user"
        title={messages.mobile.authPrompts.accountGateTitle}
        body={messages.mobile.authPrompts.accountGateBody}
        signInLabel={messages.mobile.authPrompts.signIn}
        createAccountLabel={messages.mobile.authPrompts.createAccount}
        onSignIn={() => {
          setPendingReturn({ path: '/(tabs)/account' });
          router.navigate('/login');
        }}
        onCreateAccount={() => {
          setPendingReturn({ path: '/(tabs)/account' });
          router.navigate('/register');
        }}
        legalLinks={[
          {
            label: account.menuCancellation,
            icon: 'file-text',
            onPress: () => openExternalPath('/cancellation-policy'),
          },
          {
            label: account.menuPrivacy,
            icon: 'file-text',
            onPress: () => openExternalPath('/privacy'),
          },
          {
            label: account.menuTerms,
            icon: 'file-text',
            onPress: () => openExternalPath('/terms'),
          },
        ]}
      />
    );
  }

  const user = session.user;
  const name = user.name;
  const email = user.email;

  function openEditName() {
    setNameValue(name);
    setNameError(undefined);
    setNameFormError(null);
    setEditNameOpen(true);
  }

  async function saveName() {
    const error = validateProfileName(nameValue);
    if (error !== undefined) {
      setNameError(error);
      return;
    }
    setNameError(undefined);
    setNameFormError(null);
    setNameSaving(true);
    try {
      const { error: apiError } = await getAuthClient().updateUser({ name: nameValue.trim() });
      setNameSaving(false);
      if (apiError) {
        setNameFormError(account.editNameError);
        return;
      }
      setEditNameOpen(false);
    } catch {
      setNameSaving(false);
      setNameFormError(account.editNameError);
    }
  }

  async function handleSignOut() {
    setSignOutOpen(false);
    try {
      await getAuthClient().signOut();
    } catch {
      // Mất mạng lúc đăng xuất: phiên client-side (expo-secure-store) vẫn bị
      // `signOut()` xoá cục bộ trước khi gọi server — không có gì để báo lại,
      // khách coi như đã đăng xuất.
    }
    router.replace('/');
  }

  const menuItems: AccountMenuItem[] = [
    { key: 'personal', icon: 'user', label: account.menuPersonalDetails, onPress: openEditName },
    {
      key: 'saved',
      icon: 'heart',
      label: account.menuSaved,
      onPress: () => router.push('/saved'),
    },
    // My reviews (R4, P5b-5) và Travel stories (G1, mục 6 spec) CHƯA dựng —
    // dòng menu chỉ cần TỒN TẠI ở đợt này (spec §"Không thuộc phạm vi").
    { key: 'reviews', icon: 'star', label: account.menuMyReviews, onPress: () => {} },
    { key: 'stories', icon: 'book-open', label: account.menuTravelStories, onPress: () => {} },
    {
      key: 'password',
      icon: 'lock',
      label: account.menuPassword,
      onPress: () => router.push('/change-password'),
    },
    {
      key: 'help',
      icon: 'help-circle',
      label: account.menuHelp,
      external: true,
      onPress: () => openExternalPath('/faq'),
    },
    {
      key: 'about',
      icon: 'info',
      label: account.menuAbout,
      external: true,
      onPress: () => openExternalPath('/about'),
    },
    {
      key: 'cancellation',
      icon: 'file-text',
      label: account.menuCancellation,
      external: true,
      onPress: () => openExternalPath('/cancellation-policy'),
    },
    {
      key: 'privacy',
      icon: 'file-text',
      label: account.menuPrivacy,
      external: true,
      onPress: () => openExternalPath('/privacy'),
    },
    {
      key: 'terms',
      icon: 'file-text',
      label: account.menuTerms,
      external: true,
      onPress: () => openExternalPath('/terms'),
    },
  ];

  return (
    <>
      <AccountScreen
        name={name}
        email={email}
        avatarUrl={user.image ?? null}
        initials={reviewAuthorInitials(name)}
        editNameLabel={account.editNameAria}
        onEditName={openEditName}
        menuItems={menuItems}
        signOutLabel={account.signOut}
        onSignOutPress={() => setSignOutOpen(true)}
        transformUrl={cloudinaryUrl}
        footer={
          // PHẢI nằm trong `footer` (bên trong ScrollView của AccountScreen) —
          // `Screen` bên trong đó chiếm `flex:1` toàn màn, đặt sibling ở NGOÀI
          // `<AccountScreen>` như route.cũ làm sẽ mất tích, không lỗi gì báo.
          isDevBuild() ? (
            <>
              <Link href="/dev/gallery" style={{ alignSelf: 'center' }}>
                <AppText variant="caption" tone="link">
                  Gallery (dev)
                </AppText>
              </Link>
              <Link href="/dev/tour-gallery" style={{ alignSelf: 'center' }}>
                <AppText variant="caption" tone="link">
                  Tour gallery (dev)
                </AppText>
              </Link>
            </>
          ) : undefined
        }
      />
      <EditNameSheet
        visible={editNameOpen}
        onClose={() => setEditNameOpen(false)}
        label={account.editNameLabel}
        value={nameValue}
        error={nameError}
        formError={nameFormError}
        pending={nameSaving}
        saveLabel={account.editNameSave}
        savingLabel={account.editNameSaving}
        onChangeText={(next) => {
          setNameValue(next);
          setNameError(undefined);
        }}
        onSave={() => void saveName()}
      />
      <SignOutSheet
        visible={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title={account.signOutTitle}
        body={account.signOutBody}
        confirmLabel={account.signOut}
        cancelLabel={account.signOutCancel}
        onConfirm={() => void handleSignOut()}
      />
    </>
  );
}

import { useMutation } from '@tanstack/react-query';
import { validateProfileName } from '@tourism/core';
import { messages } from '@tourism/i18n';
import { AppText, type FeatherIconName } from '@tourism/mobile-ui';
import * as ImagePicker from 'expo-image-picker';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { type AccountMenuItem, AccountScreen } from '@/features/account/account-screen';
import { applyAvatarPick, removeAvatar as removeAvatarFlow } from '@/features/account/avatar-flow';
import { EditAvatarSheet } from '@/features/account/edit-avatar-sheet';
import { EditNameSheet } from '@/features/account/edit-name-sheet';
import { SignOutSheet } from '@/features/account/sign-out-sheet';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { reviewAuthorInitials } from '@/features/tour-detail/reviews';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { isDevBuild } from '@/lib/dev-only';
import { uploadToCloudinary } from '@/lib/media-upload';
import { openExternalPath } from '@/lib/open-external-path';

/**
 * NĂM dòng mở trình duyệt ngoài — dùng CHUNG cho A1 (cuối menu, đã đăng nhập)
 * và A2 (khối chặn tab, chưa đăng nhập): mockup vẽ y hệt nhau ở cả hai, KHÔNG
 * phải "ba dòng pháp lý" như spec tóm tắt — Help & FAQ và About Nexora cũng mở
 * được không cần phiên (phản hồi 26/09, đối chiếu trực tiếp ảnh mockup).
 */
function externalLinks(
  account: (typeof messages.mobile)['account'],
): readonly { key: string; icon: FeatherIconName; label: string; path: string }[] {
  return [
    { key: 'help', icon: 'help-circle', label: account.menuHelp, path: '/faq' },
    { key: 'about', icon: 'info', label: account.menuAbout, path: '/about' },
    {
      key: 'cancellation',
      icon: 'file-text',
      label: account.menuCancellation,
      path: '/cancellation-policy',
    },
    { key: 'privacy', icon: 'file-text', label: account.menuPrivacy, path: '/privacy' },
    { key: 'terms', icon: 'file-text', label: account.menuTerms, path: '/terms' },
  ];
}

/**
 * Route Account (A1-A3-A5, mục 3 spec P5b-4). Chưa đăng nhập → `AuthGateScreen`
 * (A2) kèm `legalLinks` — năm dòng mở trình duyệt ngoài vẫn mở được, không cần phiên.
 */
export default function AccountRoute() {
  const { data: session, refetch: refetchSession } = getAuthClient().useSession();

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [nameFormError, setNameFormError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const { account } = messages.mobile;

  const signUploadMutation = useMutation(
    orpc.media.signUpload.mutationOptions({ context: withMobileAuth() }),
  );
  const setAvatarMutation = useMutation(
    orpc.account.setAvatar.mutationOptions({ context: withMobileAuth() }),
  );

  // Guard trực tiếp trên `session?.user` (không qua biến `boolean` trung
  // gian) — TS mới thu hẹp được `session` khỏi `null` ở nhánh dưới.
  if (session?.user === undefined) {
    return (
      <AuthGateScreen
        pageTitle={messages.mobile.appShell.titles.account}
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
        legalLinks={externalLinks(account).map((link) => ({
          label: link.label,
          icon: link.icon,
          onPress: () => openExternalPath(link.path),
        }))}
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

  function openAvatarSheet() {
    setAvatarError(null);
    setAvatarSheetOpen(true);
  }

  /** Sign→upload→setAvatar (avatar-flow.ts) rồi refetch session — mobile
   * không có `router.refresh()` của web, `refetch()` là tương đương (ADR-0040
   * AMEND 5 §5). */
  async function applyAvatarAsset(asset: ImagePicker.ImagePickerAsset) {
    setAvatarError(null);
    setAvatarBusy(true);
    const outcome = await applyAvatarPick(asset, {
      signUpload: (input) => signUploadMutation.mutateAsync(input),
      uploadFile: (uri, ext, params) => uploadToCloudinary(uri, ext, params),
      setAvatar: (publicId) => setAvatarMutation.mutateAsync({ publicId }),
    });
    setAvatarBusy(false);
    if (outcome.kind === 'error') {
      setAvatarError(outcome.text);
      return;
    }
    await refetchSession();
    setAvatarSheetOpen(false);
  }

  /**
   * Xin quyền + mở camera/thư viện. Bọc try/catch TRỌN hàm — thiếu nó thì
   * `requestXPermissionsAsync`/`launchXAsync` ném (máy không có camera, quyền
   * bị OS chặn cứng, v.v.) là promise reject không ai bắt (`void pickAvatar(...)`
   * ở JSX chỉ vứt promise, không catch) → sheet đứng im, không lỗi, không mở
   * được gì — đúng triệu chứng phản hồi 27/09 "không thể đổi avatar". Mọi lỗi
   * PHẢI hiện trong sheet (spec A4), kể cả lỗi ở bước xin quyền/mở picker.
   *
   * `quality: 0.5` (JPEG nén, không phải kích thước pixel) — avatar hiện tối
   * đa ~72dp × PixelRatio (`AppImage`, xem app-image.tsx), ảnh gốc camera hiện
   * đại vài chục MP nén 0.9 vẫn ra file vài MB, upload chậm thấy rõ trên
   * mạng LAN/di động (phản hồi 27/09). 0.5 đủ nét ở kích thước hiển thị, giảm
   * đáng kể dung lượng và thời gian upload.
   */
  async function pickAvatar(source: 'camera' | 'library') {
    setAvatarError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setAvatarError(account.avatar.errPermission);
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset === undefined) return;
      await applyAvatarAsset(asset);
    } catch {
      setAvatarError(account.avatar.errUpload);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setAvatarBusy(true);
    const outcome = await removeAvatarFlow({
      setAvatar: (publicId) => setAvatarMutation.mutateAsync({ publicId }),
    });
    setAvatarBusy(false);
    if (outcome.kind === 'error') {
      setAvatarError(outcome.text);
      return;
    }
    await refetchSession();
    setAvatarSheetOpen(false);
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
    {
      key: 'personal',
      icon: 'user',
      label: account.menuPersonalDetails,
      onPress: () => router.push('/personal-details'),
    },
    {
      key: 'saved',
      icon: 'heart',
      label: account.menuSaved,
      onPress: () => router.push('/saved'),
    },
    // My reviews (R4, P5b-5) và Travel stories (G1, mục 6 spec) CHƯA dựng —
    // dòng menu chỉ cần TỒN TẠI ở đợt này (spec §"Không thuộc phạm vi").
    { key: 'reviews', icon: 'star', label: account.menuMyReviews, onPress: () => {} },
    {
      key: 'stories',
      icon: 'book-open',
      label: account.menuTravelStories,
      onPress: () => router.push('/posts'),
    },
    {
      key: 'password',
      icon: 'lock',
      label: account.menuPassword,
      onPress: () => router.push('/change-password'),
    },
    ...externalLinks(account).map((link) => ({
      key: link.key,
      icon: link.icon,
      label: link.label,
      external: true,
      onPress: () => openExternalPath(link.path),
    })),
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
        avatarEditLabel={account.avatar.editLabel}
        onEditAvatar={openAvatarSheet}
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
        description={account.editNameDescription}
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
      <EditAvatarSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        title={account.avatar.sheetTitle}
        takePhotoLabel={account.avatar.takePhoto}
        chooseLibraryLabel={account.avatar.chooseLibrary}
        removePhotoLabel={account.avatar.removePhoto}
        cancelLabel={account.avatar.cancel}
        showRemove={user.image !== null && user.image !== undefined}
        pending={avatarBusy}
        errorText={avatarError}
        onTakePhoto={() => void pickAvatar('camera')}
        onChooseLibrary={() => void pickAvatar('library')}
        onRemove={() => void handleRemoveAvatar()}
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

import { messages } from '@tourism/i18n';
import { AppText, useTheme } from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BrandMark } from '@/features/auth/brand-mark';
import { ForgotPasswordScreen } from '@/features/auth/forgot-password-screen';
import { RegisterScreen } from '@/features/auth/register-screen';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';
import { ResultScreen } from '@/features/auth/result-screen';
import { SignInScreen } from '@/features/auth/sign-in-screen';
import { VerifyEmailScreen } from '@/features/auth/verify-email-screen';
import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';

export interface GalleryEntry {
  /** Mã khung đúng như spec P5b-1 §4 — để soi tay đối chiếu với bản mockup. */
  id: string;
  title: string;
  render: () => ReactNode;
}

const auth = messages.mobile.auth;
const errors = messages.authForms.errors;
const formErrors = messages.formErrors;

const noop = () => {};
const EMAIL = 'lan.nguyen@example.com';

/** Màn splash thật là màn NATIVE do app.json dựng; đây chỉ là bản dựng lại để soi. */
function SplashPreview() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(4),
        backgroundColor: theme.colors.background,
      }}
    >
      <BrandMark size="lg" />
      <AppText variant="caption" tone="muted">
        {auth.splashTagline}
      </AppText>
    </View>
  );
}

const signInBase = {
  values: { email: '', password: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  onChange: noop,
  onSubmit: noop,
  onGoogle: noop,
  onForgot: noop,
  onCreateAccount: noop,
  onClose: noop,
};

const registerBase = {
  values: { name: '', email: '', password: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  agreedToTerms: false,
  onChange: noop,
  onAgreeChange: noop,
  onSubmit: noop,
  onGoogle: noop,
  onSignIn: noop,
  onBack: noop,
};

const verifyBase = {
  email: EMAIL,
  reason: 'signup' as const,
  otp: '',
  fieldErrors: {},
  formMessage: null,
  pending: false,
  remaining: 42,
  onChangeOtp: noop,
  onSubmit: noop,
  onResend: noop,
  onBack: noop,
};

const forgotBase = {
  email: '',
  fieldErrors: {},
  formMessage: null,
  pending: false,
  sent: false,
  onChangeEmail: noop,
  onSubmit: noop,
  onBackToSignIn: noop,
  onBack: noop,
};

const resetBase = {
  values: { password: '', confirm: '' },
  fieldErrors: {},
  formMessage: null,
  pending: false,
  invalidLink: false,
  onChange: noop,
  onSubmit: noop,
  onRequestNewLink: noop,
  onClose: noop,
};

const onboardingBase = { onNext: noop, onSkip: noop, onStart: noop, onSignIn: noop };

/**
 * Mười bảy khung của spec P5b-1 §4, dựng bằng props CỨNG — không đi qua
 * `AuthActions`, không đụng router. Mục đích là soi từng trạng thái trên máy
 * thật, kể cả những trạng thái chỉ hiện ra sau một chuỗi thao tác.
 */
export const GALLERY_ENTRIES: GalleryEntry[] = [
  { id: '1a', title: 'Splash', render: () => <SplashPreview /> },
  {
    id: '1b',
    title: 'Onboarding 1/3',
    render: () => <OnboardingScreen {...onboardingBase} index={0} />,
  },
  {
    id: '1c',
    title: 'Onboarding 2/3',
    render: () => <OnboardingScreen {...onboardingBase} index={1} />,
  },
  {
    id: '1d',
    title: 'Onboarding 3/3',
    render: () => <OnboardingScreen {...onboardingBase} index={2} />,
  },
  { id: '2a', title: 'Sign in — trống', render: () => <SignInScreen {...signInBase} /> },
  {
    id: '2b',
    title: 'Sign in — lỗi cấp form',
    render: () => (
      <SignInScreen
        {...signInBase}
        values={{ email: EMAIL, password: 'correct-horse' }}
        formMessage={{ tone: 'error', text: errors.invalidCredentials }}
      />
    ),
  },
  { id: '3a', title: 'Create account — trống', render: () => <RegisterScreen {...registerBase} /> },
  {
    id: '3b',
    title: 'Create account — lỗi từng ô',
    render: () => (
      <RegisterScreen
        {...registerBase}
        agreedToTerms
        values={{ name: 'Lan Nguyen', email: 'lan.nguyen@', password: 'abc' }}
        fieldErrors={{ email: formErrors.email.invalid, password: formErrors.password.tooShort }}
      />
    ),
  },
  {
    id: '4a',
    title: 'Verify email — sau đăng ký',
    render: () => <VerifyEmailScreen {...verifyBase} otp="48" />,
  },
  {
    id: '4b',
    title: 'Verify email — vào từ Sign in, mã sai',
    render: () => (
      <VerifyEmailScreen
        {...verifyBase}
        reason="blocked"
        otp="482190"
        remaining={0}
        fieldErrors={{ otp: errors.invalidOtp }}
      />
    ),
  },
  {
    id: '4c',
    title: 'Verify email — vừa gửi lại mã',
    render: () => (
      <VerifyEmailScreen
        {...verifyBase}
        remaining={59}
        formMessage={{ tone: 'info', text: auth.verifyEmail.resent }}
      />
    ),
  },
  { id: '5a', title: 'Forgot password', render: () => <ForgotPasswordScreen {...forgotBase} /> },
  {
    id: '5b',
    title: 'Forgot password — đã gửi',
    render: () => <ForgotPasswordScreen {...forgotBase} sent email={EMAIL} />,
  },
  {
    id: '5c',
    title: 'Reset password — lệch xác nhận',
    render: () => (
      <ResetPasswordScreen
        {...resetBase}
        values={{ password: 'correct-horse', confirm: 'correct-house' }}
        fieldErrors={{ confirm: formErrors.confirmPassword.mismatch }}
      />
    ),
  },
  {
    id: '5d',
    title: 'Reset password — link hỏng',
    render: () => <ResetPasswordScreen {...resetBase} invalidLink />,
  },
  {
    id: '6a',
    title: 'Kết quả — đã xác minh',
    render: () => (
      <ResultScreen
        icon="check"
        title={messages.authForms.verifyEmail.toast.title}
        body={messages.authForms.verifyEmail.toast.body}
        actionLabel={auth.success.signIn}
        onAction={noop}
      />
    ),
  },
  {
    id: '6b',
    title: 'Kết quả — đã đổi mật khẩu',
    render: () => (
      <ResultScreen
        icon="key"
        title={messages.authForms.resetPassword.toast.title}
        body={messages.authForms.resetPassword.toast.body}
        actionLabel={auth.success.signIn}
        onAction={noop}
      />
    ),
  },
];

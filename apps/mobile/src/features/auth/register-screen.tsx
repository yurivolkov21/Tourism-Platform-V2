import AntDesign from '@expo/vector-icons/AntDesign';
import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  Checkbox,
  FormMessage,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  TextField,
  useTheme,
} from '@tourism/mobile-ui';
import { useEffect, useRef } from 'react';
import { Pressable, type TextInput, useWindowDimensions, View } from 'react-native';
import { openExternalPath } from '@/lib/open-external-path';
import { AuthHero } from './auth-hero';
import { AUTH_PHOTOS } from './auth-media';
import { fromMockup } from './auth-metrics';
import { firstInvalidField } from './first-invalid-field';
import { OrDivider } from './or-divider';
import { REGISTER_FIELDS } from './register-flow';

export type RegisterField = (typeof REGISTER_FIELDS)[number];

export interface RegisterScreenProps {
  values: Record<RegisterField, string>;
  fieldErrors: Partial<Record<RegisterField, string>>;
  formMessage: { tone: 'error' | 'info'; text: string } | null;
  pending: boolean;
  agreedToTerms: boolean;
  onChange: (field: RegisterField, value: string) => void;
  onAgreeChange: (next: boolean) => void;
  onSubmit: () => void;
  onGoogle: () => void;
  onSignIn: () => void;
  onBack: () => void;
}

/**
 * Màn Create account (khung 3a, 3b). Nút chính KHOÁ tới khi tick Terms — cùng
 * luật với web, để không ai tạo tài khoản mà chưa từng thấy điều khoản.
 *
 * Link Terms và Privacy mở trang web bằng trình duyệt ngoài: màn pháp lý trong
 * app thuộc cụm Account, chưa dựng ở đợt này.
 */
export function RegisterScreen({
  values,
  fieldErrors,
  formMessage,
  pending,
  agreedToTerms,
  onChange,
  onAgreeChange,
  onSubmit,
  onGoogle,
  onSignIn,
  onBack,
}: RegisterScreenProps) {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const copy = messages.mobile.auth.register;
  const auth = messages.mobile.auth;
  const legal = messages.mobile.legal;
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const field = firstInvalidField(fieldErrors, REGISTER_FIELDS);
    if (field === 'name') nameRef.current?.focus();
    if (field === 'email') emailRef.current?.focus();
    if (field === 'password') passwordRef.current?.focus();
  }, [fieldErrors]);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
      <AuthHero
        image={AUTH_PHOTOS.register}
        place={copy.photoPlace}
        exit={{ icon: 'arrow-left', label: auth.back, onPress: onBack }}
        height="short"
      />

      <View
        style={{
          marginTop: fromMockup(164, screenHeight),
          paddingHorizontal: theme.spacing(6),
          paddingBottom: theme.spacing(8),
        }}
      >
        <AppText variant="display">{copy.title}</AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {copy.body}
        </AppText>

        <TextField
          ref={nameRef}
          label={copy.name}
          icon="user"
          value={values.name}
          error={fieldErrors.name}
          onChangeText={(next) => onChange('name', next)}
          autoComplete="name"
          textContentType="name"
        />
        <TextField
          ref={emailRef}
          label={messages.mobile.auth.signIn.email}
          icon="mail"
          value={values.email}
          error={fieldErrors.email}
          onChangeText={(next) => onChange('email', next)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          ref={passwordRef}
          label={messages.mobile.auth.signIn.password}
          icon="lock"
          secure
          revealLabel={auth.showPassword}
          hideLabel={auth.hidePassword}
          value={values.password}
          error={fieldErrors.password}
          onChangeText={(next) => onChange('password', next)}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Checkbox
          checked={agreedToTerms}
          accessibilityLabel={`${legal.agreePrefix}${legal.agreeTerms}`}
          onValueChange={onAgreeChange}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <AppText variant="caption" tone="muted">
              {legal.agreePrefix}
            </AppText>
            <Pressable onPress={() => openExternalPath('/terms')}>
              <AppText variant="caption" tone="link">
                {legal.agreeTerms}
              </AppText>
            </Pressable>
            <AppText variant="caption" tone="muted">
              {legal.agreeAnd}
            </AppText>
            <Pressable onPress={() => openExternalPath('/privacy')}>
              <AppText variant="caption" tone="link">
                {legal.agreePrivacy}
              </AppText>
            </Pressable>
          </View>
        </Checkbox>

        {formMessage === null ? null : (
          <View style={{ marginBottom: theme.spacing(2.5) }}>
            <FormMessage tone={formMessage.tone}>{formMessage.text}</FormMessage>
          </View>
        )}

        <Button
          shape="pill"
          label={pending ? messages.authForms.register.submitting : copy.submit}
          disabled={pending || !agreedToTerms}
          onPress={onSubmit}
        />

        <OrDivider label={messages.mobile.auth.signIn.or} />

        <Button
          shape="pill"
          variant="ghost"
          label={messages.mobile.auth.signIn.google}
          leading={<AntDesign name="google" size={16} color={theme.colors.foreground} />}
          onPress={onGoogle}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: theme.spacing(1.5),
            marginTop: theme.spacing(3),
          }}
        >
          <AppText variant="caption" tone="muted">
            {copy.footer}
          </AppText>
          <Pressable onPress={onSignIn}>
            <AppText variant="caption" tone="link">
              {copy.footerAction}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

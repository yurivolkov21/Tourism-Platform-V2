import { AppText, Screen, TextField, useTheme } from '@tourism/mobile-ui';
import { useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';
import { ScrollView } from 'react-native';
import { firstInvalidField } from '@/features/auth/first-invalid-field';
import type { ContactFormErrors, ContactFormState } from './booking-form';
import { BookingBottomBar, BookingStepProgress } from './booking-parts';

export interface BookingContactScreenProps {
  step: number;
  totalSteps: number;
  stepLabel: string;
  heading: string;
  subtitle: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  notesLabel: string;
  values: ContactFormState;
  errors: ContactFormErrors;
  onChange: <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) => void;
  totalLabel: string;
  totalAmount: string;
  continueLabel: string;
  onContinue: () => void;
}

const FIELD_ORDER: readonly (keyof ContactFormState)[] = [
  'contactName',
  'contactEmail',
  'contactPhone',
  'specialRequests',
];

/** B3 — bước 2: liên hệ. Ô icon boxed (`TextField iconVariant="boxed"`), BIẾN
 *  THỂ mới, không đụng cụm auth (mockup B3 caption). */
export function BookingContactScreen({
  step,
  totalSteps,
  stepLabel,
  heading,
  subtitle,
  nameLabel,
  emailLabel,
  phoneLabel,
  notesLabel,
  values,
  errors,
  onChange,
  totalLabel,
  totalAmount,
  continueLabel,
  onContinue,
}: BookingContactScreenProps) {
  const theme = useTheme();
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Focus ô sai đầu tiên (thứ tự hiển thị) mỗi khi `errors` đổi sau một lần
  // bấm Continue — cùng khuôn `change-password-screen.tsx`.
  useEffect(() => {
    const field = firstInvalidField(errors, FIELD_ORDER);
    if (field === 'contactName') nameRef.current?.focus();
    if (field === 'contactEmail') emailRef.current?.focus();
    if (field === 'contactPhone') phoneRef.current?.focus();
    if (field === 'specialRequests') notesRef.current?.focus();
  }, [errors]);

  return (
    // `edges={[]}`: header native lo đỉnh, `BookingBottomBar` tự lo vùng an
    // toàn đáy bằng đúng màu nền `card` của nó (xem JSDoc `booking-parts.tsx`).
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <BookingStepProgress step={step} total={totalSteps} label={stepLabel} />

        <AppText variant="heading" style={{ marginTop: theme.spacing(4) }}>
          {heading}
        </AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1) }}>
          {subtitle}
        </AppText>

        <TextField
          ref={nameRef}
          label={nameLabel}
          icon="user"
          iconVariant="boxed"
          value={values.contactName}
          error={errors.contactName}
          onChangeText={(next) => onChange('contactName', next)}
          autoCapitalize="words"
          autoComplete="name"
        />
        <TextField
          ref={emailRef}
          label={emailLabel}
          icon="mail"
          iconVariant="boxed"
          value={values.contactEmail}
          error={errors.contactEmail}
          onChangeText={(next) => onChange('contactEmail', next)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          ref={phoneRef}
          label={phoneLabel}
          icon="phone"
          iconVariant="boxed"
          value={values.contactPhone}
          error={errors.contactPhone}
          onChangeText={(next) => onChange('contactPhone', next)}
          autoComplete="tel"
          keyboardType="phone-pad"
        />
        <TextField
          ref={notesRef}
          label={notesLabel}
          icon="message-square"
          iconVariant="boxed"
          multiline
          tall
          value={values.specialRequests}
          error={errors.specialRequests}
          onChangeText={(next) => onChange('specialRequests', next)}
        />
      </ScrollView>

      <BookingBottomBar
        totalLabel={totalLabel}
        totalAmount={totalAmount}
        ctaLabel={continueLabel}
        onPress={onContinue}
      />
    </Screen>
  );
}

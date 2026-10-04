import Feather from '@expo/vector-icons/Feather';
import { AppText, Button, FormMessage, Screen, TextField, useTheme } from '@tourism/mobile-ui';
import { useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firstInvalidField } from '@/features/auth/first-invalid-field';
import { BookingTripCard } from './booking-parts';
import type { EnquiryFormErrors, EnquiryFormField, EnquiryFormState } from './enquiry-form';

export interface EnquiryScreenProps {
  /** Ba prop này VẮNG CẢ BA (không mở từ booking/tour nào) thì không vẽ thẻ chuyến. */
  tripTitle?: string;
  /** Đã format sẵn phía route (vd khoảng ngày) — màn chỉ in, không tự ghép chữ. */
  tripSubtitle?: string;
  tripImageUrl?: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  messageLabel: string;
  messagePlaceholder: string;
  values: EnquiryFormState;
  errors: EnquiryFormErrors;
  onChange: (field: EnquiryFormField, value: string) => void;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  /** Lỗi cấp form (mạng/server/rate-limit) — khác lỗi từng ô ở `errors`. */
  formError: string | null;
  sent: boolean;
  successTitle: string;
  successBody: string;
  backToTourLabel: string;
  onClose: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const FIELD_ORDER: readonly EnquiryFormField[] = ['name', 'email', 'phone', 'message'];

/**
 * E1 (form) + E2 (thành công) — mockup `mobile-booking-screens.src.html` mục
 * 5. Header NATIVE (khai ở `_layout.tsx`, khác `AskAboutDateSheet` D3 vốn là
 * bottom sheet) — mở từ ba lối (đợt đã đóng, tour hết đợt, hộp huỷ quá hạn).
 */
export function EnquiryScreen({
  tripTitle,
  tripSubtitle,
  tripImageUrl,
  nameLabel,
  emailLabel,
  phoneLabel,
  messageLabel,
  messagePlaceholder,
  values,
  errors,
  onChange,
  submitLabel,
  submitting,
  onSubmit,
  formError,
  sent,
  successTitle,
  successBody,
  backToTourLabel,
  onClose,
  transformUrl,
}: EnquiryScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  useEffect(() => {
    const field = firstInvalidField(errors, FIELD_ORDER);
    if (field === 'name') nameRef.current?.focus();
    if (field === 'email') emailRef.current?.focus();
    if (field === 'phone') phoneRef.current?.focus();
    if (field === 'message') messageRef.current?.focus();
  }, [errors]);

  if (sent) {
    return (
      <Screen edges={[]} padded={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing(4),
            paddingHorizontal: theme.spacing(6),
          }}
        >
          <View
            style={{
              width: theme.spacing(16),
              height: theme.spacing(16),
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check-circle" size={28} color={theme.colors['primary-emphasis']} />
          </View>
          <AppText variant="heading" style={{ textAlign: 'center' }}>
            {successTitle}
          </AppText>
          <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
            {successBody}
          </AppText>
          <View style={{ width: 200 }}>
            <Button shape="pill" label={backToTourLabel} onPress={onClose} />
          </View>
        </View>
      </Screen>
    );
  }

  const showTripCard =
    tripTitle !== undefined || tripSubtitle !== undefined || tripImageUrl !== undefined;

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {showTripCard ? (
          <View style={{ marginBottom: theme.spacing(4) }}>
            <BookingTripCard
              imageUrl={tripImageUrl ?? null}
              title={tripTitle ?? ''}
              dateRangeLabel={tripSubtitle ?? ''}
              transformUrl={transformUrl}
            />
          </View>
        ) : null}

        <TextField
          ref={nameRef}
          label={nameLabel}
          icon="user"
          iconVariant="boxed"
          value={values.name}
          error={errors.name}
          onChangeText={(next) => onChange('name', next)}
          autoCapitalize="words"
          autoComplete="name"
        />
        <TextField
          ref={emailRef}
          label={emailLabel}
          icon="mail"
          iconVariant="boxed"
          value={values.email}
          error={errors.email}
          onChangeText={(next) => onChange('email', next)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          ref={phoneRef}
          label={phoneLabel}
          icon="phone"
          iconVariant="boxed"
          value={values.phone}
          error={errors.phone}
          onChangeText={(next) => onChange('phone', next)}
          autoComplete="tel"
          keyboardType="phone-pad"
          maxLength={30}
        />
        <TextField
          ref={messageRef}
          label={messageLabel}
          placeholder={messagePlaceholder}
          alwaysShowLabel
          icon="message-square"
          iconVariant="boxed"
          multiline
          tall
          value={values.message}
          error={errors.message}
          onChangeText={(next) => onChange('message', next)}
        />

        {formError === null ? null : (
          <View style={{ marginTop: theme.spacing(3) }}>
            <FormMessage tone="error">{formError}</FormMessage>
          </View>
        )}
      </ScrollView>

      {/* `.bottom-bar` của mockup (mục 5) chỉ có một nút trần, không có khối
       *  tổng tiền bên trái — khác `BookingBottomBar` của cụm đặt tour, nên
       *  vẽ riêng ở đây (khuôn padding/viền/nền giống nhau). */}
      <View
        style={{
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
          paddingBottom: Math.max(insets.bottom, theme.spacing(3)),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      >
        <Button shape="pill" label={submitLabel} disabled={submitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}

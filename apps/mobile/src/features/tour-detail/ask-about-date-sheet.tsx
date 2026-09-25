import { AppText, BottomSheet, Button, FormMessage, TextField, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';
import type { AskAboutDateErrors, AskAboutDateField, AskAboutDateState } from './ask-about-date';

export interface AskAboutDateSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Câu mô tả đã ghép sẵn nhãn đợt (vd "Sat 26 Sep – Tue 29 Sep"). */
  description: string;
  nameLabel: string;
  emailLabel: string;
  messageLabel: string;
  values: AskAboutDateState;
  errors: AskAboutDateErrors;
  onChange: (field: AskAboutDateField, value: string) => void;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  /** Lỗi cấp form (mạng/server) — khác lỗi từng ô ở `errors`. */
  formError: string | null;
  sent: boolean;
  successTitle: string;
  successBody: string;
  closeLabel: string;
}

/**
 * Tấm form "Ask about this date" (D3, đợt đã đóng) — bấm từ hàng đợt ở tab
 * Dates. Gửi `enquiries.create` (route quyết, cùng khuôn `AuthGateSheet` D6:
 * component này chỉ vẽ, không tự gọi API). Ba ô DUY NHẤT khách gõ — tourId/
 * travelDate của đợt đọc từ context, không có ô ngày ở đây (khác web
 * `PrivateTripForm` cho khách TỰ chọn ngày mong muốn).
 */
export function AskAboutDateSheet({
  visible,
  onClose,
  title,
  description,
  nameLabel,
  emailLabel,
  messageLabel,
  values,
  errors,
  onChange,
  submitLabel,
  submittingLabel,
  submitting,
  onSubmit,
  formError,
  sent,
  successTitle,
  successBody,
  closeLabel,
}: AskAboutDateSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(4) }}>
        {sent ? (
          <View
            style={{
              alignItems: 'center',
              gap: theme.spacing(2),
              paddingVertical: theme.spacing(4),
            }}
          >
            <AppText variant="heading" style={{ textAlign: 'center' }}>
              {successTitle}
            </AppText>
            <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
              {successBody}
            </AppText>
            <Button shape="pill" label={closeLabel} onPress={onClose} />
          </View>
        ) : (
          <>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1) }}>
              {description}
            </AppText>

            <TextField
              label={nameLabel}
              value={values.name}
              error={errors.name}
              onChangeText={(next) => onChange('name', next)}
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label={emailLabel}
              value={values.email}
              error={errors.email}
              onChangeText={(next) => onChange('email', next)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label={messageLabel}
              value={values.message}
              error={errors.message}
              onChangeText={(next) => onChange('message', next)}
              multiline
              numberOfLines={3}
            />

            {formError === null ? null : (
              <View style={{ marginTop: theme.spacing(3) }}>
                <FormMessage tone="error">{formError}</FormMessage>
              </View>
            )}

            <View style={{ marginTop: theme.spacing(5) }}>
              <Button
                shape="pill"
                label={submitting ? submittingLabel : submitLabel}
                disabled={submitting}
                onPress={onSubmit}
              />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

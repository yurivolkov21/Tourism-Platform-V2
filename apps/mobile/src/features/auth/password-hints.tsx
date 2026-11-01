import { PASSWORD_REQUIREMENTS } from '@tourism/core';
import { messages } from '@tourism/i18n';
import {
  AppText,
  Icon,
  Presence,
  TextField,
  type TextFieldProps,
  useTheme,
} from '@tourism/mobile-ui';
import { forwardRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

const copy = messages.authForms.passwordStrength;

/**
 * Checklist yêu cầu mật khẩu đặt ngay dưới ô mật khẩu MỚI (register, đặt lại, đổi mật khẩu) —
 * bản mobile của hàng pill trong `password-strength-field.tsx` web, cùng danh sách
 * `PASSWORD_REQUIREMENTS`. Tick dần khi gõ. Chỉ là chỉ báo: ràng buộc thật khi lưu vẫn là
 * `validate*` của `@tourism/core`. Màn dùng qua `NewPasswordField`, không gọi trực tiếp.
 */
export function PasswordRequirements({ password }: { password: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: theme.spacing(3),
        rowGap: theme.spacing(1),
        marginTop: theme.spacing(2),
        // Nhãn nổi của ô kế tiếp nằm trên viền — chừa khoảng để không dính vào hàng tick.
        marginBottom: theme.spacing(1.5),
      }}
    >
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.regex.test(password);
        return (
          <View
            key={req.text}
            accessible
            accessibilityLabel={copy.requirementState(req.text, met)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}
          >
            <Icon
              name={met ? 'check' : 'x'}
              size={14}
              color={theme.colors[met ? 'primary-emphasis' : 'muted-foreground']}
            />
            <AppText variant="caption" tone={met ? 'link' : 'muted'}>
              {req.text}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Ô mật khẩu MỚI kèm checklist yêu cầu. Checklist chỉ hiện khi khách đang ở trong ô (user chốt
 * 01/11: hiện sẵn lúc vào màn thì rối); đã gõ rồi rời ô vẫn giữ để còn thấy yêu cầu nào thiếu.
 */
export const NewPasswordField = forwardRef<TextInput, TextFieldProps>(function NewPasswordField(
  { onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <TextField
        ref={ref}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {/* Hiện dần + trượt xuống; ô phía dưới tự trượt theo nhờ `layout` của `TextField`. */}
      <Presence show={focused || props.value.length > 0} distance={-8}>
        <PasswordRequirements password={props.value} />
      </Presence>
    </>
  );
});

/**
 * Dòng dưới ô xác nhận: báo khớp/chưa khớp ngay khi gõ. Ô trống hoặc đang có lỗi (lỗi đã nói
 * điều cần nói) thì không hiện gì.
 */
export function ConfirmMatchHint({
  password,
  confirm,
  error,
}: {
  password: string;
  confirm: string;
  error?: string;
}) {
  const theme = useTheme();
  const match = confirm === password;
  return (
    <Presence show={confirm.length > 0 && error === undefined} distance={-8}>
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(1),
          marginTop: theme.spacing(2),
        }}
      >
        <Icon
          name={match ? 'check' : 'x'}
          size={14}
          color={theme.colors[match ? 'primary-emphasis' : 'muted-foreground']}
        />
        <AppText variant="caption" tone={match ? 'link' : 'muted'}>
          {match ? copy.confirmMatch : copy.confirmNoMatch}
        </AppText>
      </View>
    </Presence>
  );
}

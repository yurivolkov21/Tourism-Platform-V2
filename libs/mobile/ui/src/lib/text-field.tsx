import Feather from '@expo/vector-icons/Feather';
import { type ComponentProps, forwardRef, useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { AppText } from './app-text';
import { useTheme } from './theme-provider';

/** Tên icon của bộ Feather — bộ mà lucide bên web mọc ra, nên hình gần như trùng. */
export type FeatherIconName = ComponentProps<typeof Feather>['name'];

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholder'> {
  /** Tên ô: làm placeholder khi rỗng, thu nhỏ lên trên khi đã có giá trị. */
  label: string;
  value: string;
  icon?: FeatherIconName;
  /** Câu lỗi của ô (kênh 1). Có nó thì gạch chân đổi màu và ô bị đánh dấu sai. */
  error?: string;
  /** Ô mật khẩu: che chữ và mọc thêm nút hiện/ẩn. */
  secure?: boolean;
  revealLabel?: string;
  hideLabel?: string;
}

/**
 * Ô nhập gạch chân của cụm auth (bản thiết kế duyệt 16/09). Nhãn thu nhỏ khi ô
 * đã có chữ — nếu chỉ dùng placeholder thì lúc gõ xong người ta không còn biết
 * ô nào là ô nào, nhất là hai ô mật khẩu ở màn đặt lại.
 *
 * `forwardRef` để màn gọi được `focus()` cho ô sai đầu tiên sau khi kiểm ở máy.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, value, icon, error, secure = false, revealLabel, hideLabel, ...rest },
  ref,
) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const filled = value.length > 0;
  const invalid = error !== undefined;

  return (
    <View>
      <View
        testID="text-field-line"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(2.5),
          minHeight: theme.touchTargetMin,
          marginTop: theme.spacing(2.5),
          borderBottomWidth: 1,
          borderBottomColor: invalid ? theme.colors['destructive-emphasis'] : theme.colors.border,
        }}
      >
        {icon === undefined ? null : (
          <Feather name={icon} size={18} color={theme.colors['muted-foreground']} />
        )}
        <View style={{ flex: 1 }}>
          {filled ? (
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
          ) : null}
          <TextInput
            ref={ref}
            value={value}
            placeholder={filled ? undefined : label}
            placeholderTextColor={theme.colors['muted-foreground']}
            secureTextEntry={secure && !revealed}
            aria-invalid={invalid}
            accessibilityLabel={label}
            style={{
              color: theme.colors.foreground,
              fontFamily: theme.fonts.normal,
              fontSize: theme.type.base.fontSize,
              padding: 0,
            }}
            {...rest}
          />
        </View>
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? hideLabel : revealLabel}
            hitSlop={theme.spacing(2)}
            onPress={() => setRevealed((shown) => !shown)}
          >
            <Feather
              name={revealed ? 'eye-off' : 'eye'}
              size={18}
              color={theme.colors['muted-foreground']}
            />
          </Pressable>
        ) : null}
      </View>
      {invalid ? (
        <AppText
          variant="caption"
          tone="danger"
          accessibilityRole="alert"
          style={{ marginTop: theme.spacing(1.25) }}
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

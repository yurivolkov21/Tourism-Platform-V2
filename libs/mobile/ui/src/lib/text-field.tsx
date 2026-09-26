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
  /**
   * Cách vẽ `icon`. `plain` (mặc định) — icon trần, cùng khuôn cụm auth (bản
   * duyệt 16/09: login/register/reset). `boxed` — icon trong khung vuông bo
   * `secondary`+`primary-emphasis`, khuôn `.field` của cụm Account (A3/A6,
   * mockup 21/09) — HAI mockup khác nhau nên KHÔNG đổi mặc định, chỉ thêm lựa
   * chọn (phản hồi 26/09, đổi mặc định sẽ vỡ 4 màn auth đã duyệt).
   */
  iconVariant?: 'plain' | 'boxed';
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
  {
    label,
    value,
    icon,
    iconVariant = 'plain',
    error,
    secure = false,
    revealLabel,
    hideLabel,
    ...rest
  },
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
          // `boxed` (Account, A3/A6): khớp `.field` mockup — `minHeight`
          // spacing(15)=60dp KÈM `paddingVertical` riêng, không chỉ dựa vào
          // `alignItems:'center'` để chừa khoảng cách. Icon 40dp giờ cao hơn
          // chữ nhãn+giá trị cộng lại; canh giữa thuần làm chữ như dán sát
          // gạch chân (phản hồi 26/09) vì khối chữ không có padding riêng để
          // "nở" theo icon — `paddingVertical` đảm bảo khoảng trống LUÔN có,
          // bất kể icon cao bao nhiêu.
          minHeight: iconVariant === 'boxed' ? theme.spacing(15) : theme.touchTargetMin,
          paddingVertical: iconVariant === 'boxed' ? theme.spacing(2.5) : 0,
          marginTop: theme.spacing(2.5),
          borderBottomWidth: 1,
          borderBottomColor: invalid ? theme.colors['destructive-emphasis'] : theme.colors.border,
        }}
      >
        {icon === undefined ? null : iconVariant === 'boxed' ? (
          <View
            testID="text-field-icon-box"
            style={{
              width: theme.spacing(10),
              height: theme.spacing(10),
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name={icon} size={20} color={theme.colors['primary-emphasis']} />
          </View>
        ) : (
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

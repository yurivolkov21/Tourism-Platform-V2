import type Feather from '@expo/vector-icons/Feather';
import { type ComponentProps, forwardRef, useEffect, useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './app-text';
import { Icon } from './icon';
import { Shake } from './motion';
import { useTheme } from './theme-provider';

/** Tên icon của bộ Feather — bộ mà lucide bên web mọc ra, nên hình gần như trùng. */
export type FeatherIconName = ComponentProps<typeof Feather>['name'];

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholder'> {
  /** Tên ô: thu nhỏ lên trên khi đã có giá trị. Mặc định cũng làm placeholder
   *  lúc rỗng — truyền `placeholder` riêng khi câu placeholder dài hơn/khác
   *  nhãn (mockup `.field.ph` của cụm huỷ booking: nhãn "Reason (optional)",
   *  placeholder "Tell us what changed…"). */
  label: string;
  placeholder?: string;
  /** Ép hiện nhãn NGAY CẢ lúc ô rỗng — mặc định `false` (nhãn chỉ nổi lên khi
   *  đã có chữ, khuôn gốc 16/09). Mockup `.field.ph` (cụm huỷ booking) hiện
   *  CẢ nhãn ("Reason (optional)") lẫn placeholder ("Tell us what changed…")
   *  cùng lúc — khác khuôn nổi gốc, không đổi mặc định vì vỡ 4 màn auth. */
  alwaysShowLabel?: boolean;
  value: string;
  icon?: FeatherIconName;
  /**
   * Màu nền che đường viền sau nhãn nổi. PHẢI trùng màu mặt phía sau ô: mặc định là
   * `background`; ô nằm trên nền khác (bottom sheet = `surfaces.container`, màn danh
   * sách thẻ rời = `surfaces.grouped`) thì truyền màu đó, không thì nhãn hiện một mảng
   * màu lệch trên đường viền.
   */
  labelBackground?: string;
  /** Cho phép gõ xuống dòng (`TextInput multiline`) — THUẦN hành vi nhập, không
   *  tự kéo cao ô. Ô huỷ booking (`.field.ph`, KHÔNG `.tall`) vẫn `multiline`
   *  để chữ lý do dài tự xuống dòng, nhưng cao y hệt ô một dòng (phát hiện
   *  02/10: gộp chung với `tall` làm ô cao hẳn ra dù chữ chỉ một dòng, gạch
   *  chân trôi xa khỏi chữ — soi ảnh chụp máy). */
  multiline?: boolean;
  /**
   * Ô CAO (B3 "Anything we should know?", E1 "Message"): cao 96, icon neo lên đầu.
   * ĐỘC LẬP với `multiline` — ô huỷ booking multiline mà KHÔNG tall: chữ lý do dài
   * tự xuống dòng nhưng ô vẫn cao 56 như ô một dòng.
   */
  tall?: boolean;
  /** Câu lỗi của ô (kênh 1). Có nó thì gạch chân đổi màu và ô bị đánh dấu sai. */
  error?: string;
  /** Ô mật khẩu: che chữ và mọc thêm nút hiện/ẩn. */
  secure?: boolean;
  revealLabel?: string;
  hideLabel?: string;
}

/**
 * Ô nhập outlined của Material 3 (N3): cao 56, bo 4, viền 1 `input`; đang gõ viền 2
 * `primary-emphasis`, lỗi viền 2 `destructive-emphasis`. Nhãn nổi lên NẰM TRÊN đường
 * viền khi ô đã có chữ hoặc đang gõ — nếu chỉ dùng placeholder thì gõ xong người ta
 * không còn biết ô nào là ô nào, nhất là hai ô mật khẩu ở màn đặt lại.
 *
 * `forwardRef` để màn gọi được `focus()` cho ô sai đầu tiên sau khi kiểm ở máy.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    placeholder,
    alwaysShowLabel = false,
    value,
    icon,
    labelBackground,
    multiline = false,
    tall = false,
    error,
    secure = false,
    revealLabel,
    hideLabel,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  const invalid = error !== undefined;

  // Viền đổi màu mượt giữa ba trạng thái (thường 0, đang gõ 1, lỗi 2) thay vì nhảy.
  const toneIndex = invalid ? 2 : focused ? 1 : 0;
  const tone = useSharedValue(toneIndex);
  const colors = [
    theme.colors.input,
    theme.colors['primary-emphasis'],
    theme.colors['destructive-emphasis'],
  ];
  useEffect(() => {
    tone.value = withTiming(toneIndex, { duration: 160 });
  }, [toneIndex, tone]);
  // Màu viền chạy thẳng trên luồng UI.
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(tone.value, [0, 1, 2], colors),
  }));
  const showLabel = filled || alwaysShowLabel || focused;

  return (
    <Shake active={invalid}>
      <Reanimated.View
        testID="text-field-outline"
        style={[
          {
            flexDirection: 'row',
            // `tall`: icon neo lên đầu — vài dòng chữ cao hơn icon thì canh giữa sẽ kéo
            // icon trôi xuống lệch với dòng đầu tiên.
            alignItems: tall ? 'flex-start' : 'center',
            gap: theme.spacing(3),
            minHeight: tall ? 96 : 56,
            paddingHorizontal: theme.spacing(4),
            paddingVertical: tall ? theme.spacing(3.5) : 0,
            marginTop: theme.spacing(2.5),
            borderRadius: 4,
            borderWidth: invalid || focused ? 2 : 1,
          },
          borderStyle,
        ]}
      >
        {showLabel ? (
          <AppText
            testID="text-field-label"
            variant="caption"
            tone={invalid ? 'danger' : focused ? 'link' : 'muted'}
            style={{
              position: 'absolute',
              top: -8,
              left: theme.spacing(3),
              paddingHorizontal: theme.spacing(1),
              backgroundColor: labelBackground ?? theme.colors.background,
            }}
          >
            {label}
          </AppText>
        ) : null}
        {icon === undefined ? null : (
          <Icon name={icon} size={24} color={theme.colors['muted-foreground']} />
        )}
        <View style={{ flex: 1 }}>
          <TextInput
            ref={ref}
            value={value}
            // Nhãn đã nổi lên viền (đang gõ hoặc ép hiện) thì không in lại chính nó làm
            // placeholder — chỉ còn placeholder riêng nếu nơi gọi truyền.
            placeholder={filled ? undefined : showLabel ? placeholder : (placeholder ?? label)}
            placeholderTextColor={theme.colors['muted-foreground']}
            secureTextEntry={secure && !revealed}
            multiline={multiline}
            aria-invalid={invalid}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            accessibilityLabel={label}
            style={{
              color: theme.colors.foreground,
              fontWeight: theme.weight.normal,
              fontSize: theme.type.base.fontSize,
              // Ô tall: chữ bắt đầu từ trên, không canh giữa theo chiều dọc.
              textAlignVertical: tall ? 'top' : 'center',
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
            <Icon
              name={revealed ? 'eye-off' : 'eye'}
              size={24}
              color={theme.colors['muted-foreground']}
            />
          </Pressable>
        ) : null}
      </Reanimated.View>
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
    </Shake>
  );
});

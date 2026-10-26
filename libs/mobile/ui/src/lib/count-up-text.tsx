import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText, type AppTextProps, useAppTextStyle } from './app-text';

// Tiền tố, phần nguyên (có dấu phẩy ngăn nghìn), phần thập phân, hậu tố — "$1,377", "1,377.50 USD".
const AMOUNT = /^(\D*)(\d[\d,]*)(\.\d+)?(\D*)$/;
const DURATION_MS = 900;

const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

/**
 * Định dạng số tiền trên luồng UI. Không dùng `toLocaleString`: runtime worklet không bảo đảm có
 * `Intl`, nên ngăn nghìn bằng dấu phẩy được ghép tay.
 */
function formatAmount(n: number, decimals: number, prefix: string, suffix: string): string {
  'worklet';
  const [whole = '0', fraction] = n.toFixed(decimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${prefix}${grouped}${fraction === undefined ? '' : `.${fraction}`}${suffix}`;
}

export interface CountUpTextProps extends AppTextProps {
  /** Chuỗi tiền ĐÃ định dạng ("$1,377"); không có số ở dạng trên thì hiện nguyên văn, không chạy. */
  text: string;
}

/**
 * Số tiền chạy từ giá trị cũ (0 lúc mới mount) lên giá trị thật. Bản chữ thật luôn nằm trong cây
 * (chỉ mờ đi lúc đang chạy) — bố cục không giãn theo độ dài số, trình đọc màn hình và test luôn
 * thấy số cuối. Lớp chữ đang chạy là một `TextInput` chỉ đọc mà Reanimated ghi chữ thẳng từ luồng UI
 * (không `setState` mỗi khung hình), ẩn khỏi a11y. Máy bật "giảm chuyển động" thì không chạy.
 */
export function CountUpText({ text, style, variant, tone, ...rest }: CountUpTextProps) {
  const [running, setRunning] = useState(false);
  const previous = useRef(0);
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);
  // Định dạng của lượt đang chạy — shared value để worklet đọc được.
  const decimals = useSharedValue(0);
  const prefix = useSharedValue('');
  const suffix = useSharedValue('');
  const textStyle = useAppTextStyle(variant, tone);

  useEffect(() => {
    const match = AMOUNT.exec(text);
    if (match === null) return;
    const [, pre = '', whole = '', fraction = '', suf = ''] = match;
    const target = Number(`${whole.replace(/,/g, '')}${fraction}`);
    const from = previous.current;
    previous.current = target;
    if (from === target || reduceMotion) return;

    decimals.value = fraction === '' ? 0 : fraction.length - 1;
    prefix.value = pre;
    suffix.value = suf;
    value.value = from;
    setRunning(true);
    value.value = withTiming(
      target,
      { duration: DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setRunning)(false);
      },
    );

    return () => setRunning(false);
  }, [text, reduceMotion, value, decimals, prefix, suffix]);

  // `text` là prop của `TextInput` ghi được từ luồng UI; `defaultValue` giữ chữ khi cây dựng lại.
  const animatedProps = useAnimatedProps(() => {
    const shown = formatAmount(value.value, decimals.value, prefix.value, suffix.value);
    return { text: shown, defaultValue: shown } as Record<string, string>;
  });

  return (
    <View>
      <AppText
        {...rest}
        variant={variant}
        tone={tone}
        style={[style, running ? { opacity: 0 } : null]}
      >
        {text}
      </AppText>
      {running ? (
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          animatedProps={animatedProps}
          style={[
            textStyle,
            style,
            { position: 'absolute', top: 0, left: 0, right: 0, padding: 0, margin: 0 },
          ]}
        />
      ) : null}
    </View>
  );
}

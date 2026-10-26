import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  Keyframe,
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ENTER_MS = 550;
const COLLAPSE_MS = 260;
const STAGGER_MS = 110;
/** Chỉ vài phần tử đầu so le nhau — danh sách dài mà trễ cộng dồn thì mục cuối hiện quá chậm. */
const STAGGER_CAP = 6;

/**
 * Token "chạy lại hiệu ứng vào màn": tăng lên thì mọi `FadeIn`/`PopIn` bên dưới phát lại từ đầu. Dùng cho
 * tab dưới (không bị dựng lại khi chuyển tab); mặc định 0 = không bao giờ phát lại.
 */
const MotionReplayContext = createContext(0);

export function MotionReplay({ token, children }: { token: number; children: ReactNode }) {
  return <MotionReplayContext.Provider value={token}>{children}</MotionReplayContext.Provider>;
}

/**
 * Chạy `play` trừ khi máy bật "giảm chuyển động" — khi đó gọi `skip` để phần tử
 * nhảy thẳng tới trạng thái cuối, không bao giờ kẹt ở trạng thái ẩn.
 */
function useEnterAnimation(
  play: () => Animated.CompositeAnimation,
  skip: () => void,
  reset: () => void,
) {
  const replayToken = useContext(MotionReplayContext);
  // Chạy lúc mount và mỗi lần `replayToken` đổi — hiệu ứng "xuất hiện", không phải phản ứng theo props khác.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cố ý chỉ phụ thuộc token
  useEffect(() => {
    reset();
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        skip();
        return;
      }
      animation = play();
      animation.start();
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [replayToken]);
}

export interface FadeInProps {
  children: ReactNode;
  /** Vị trí trong danh sách — phần tử sau trễ hơn một nhịp (tối đa `STAGGER_CAP` nhịp). */
  index?: number;
  /** Trễ cộng thêm, ms (cho khối đứng riêng, không nằm trong danh sách). */
  delay?: number;
  /** Quãng trượt dp lúc bắt đầu: dương = trượt LÊN từ dưới, âm = trượt XUỐNG từ trên. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Hiện dần và trượt nhẹ (mặc định lên 24dp) khi vừa xuất hiện. */
export function FadeIn({ children, index = 0, delay = 0, distance = 24, style }: FadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEnterAnimation(
    () =>
      Animated.timing(progress, {
        toValue: 1,
        duration: ENTER_MS,
        delay: delay + Math.min(index, STAGGER_CAP) * STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    () => progress.setValue(1),
    () => progress.setValue(0),
  );

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export interface PopInProps {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Phóng từ nhỏ lên kích cỡ thật có nảy nhẹ — cho icon "thành công". */
export function PopIn({ children, delay = 0, style }: PopInProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEnterAnimation(
    () =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.spring(progress, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
    () => progress.setValue(1),
    () => progress.setValue(0),
  );

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export interface PressableScaleProps extends PressableProps {
  /** Tỉ lệ khi ngón đang đặt trên phần tử. */
  scaleTo?: number;
  /**
   * Số đo cho lớp bao ngoài. Cần khi `style` của `Pressable` dùng kích thước theo phần trăm
   * (vd `height: '100%'`): lớp bao không có chiều cao thì phần trăm đó co về 0.
   */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * `Pressable` co nhẹ khi nhấn rồi bật lại — cho thẻ và hàng danh sách (nút đã có
 * phản hồi mờ riêng). `style` vẫn áp lên `Pressable` bên trong như thường; lớp
 * `Animated.View` bao ngoài chỉ mang `transform`, nên số đo của phần tử không đổi.
 */
export function PressableScale({
  scaleTo = 0.97,
  containerStyle,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: 4, useNativeDriver: true }).start();

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        onPressIn={(event) => {
          spring(scaleTo);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          spring(1);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}

/**
 * Hệ số chuyển động 1 (bình thường) hoặc 0 (máy bật "giảm chuyển động"), dạng `Animated.Value`
 * để NHÂN thẳng vào giá trị parallax — không dùng state nên đổi hệ số không dựng lại màn.
 */
export function useMotionScale(): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!cancelled) scale.setValue(reduced ? 0 : 1);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduced) =>
      scale.setValue(reduced ? 0 : 1),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [scale]);

  return scale;
}

export interface ShakeProps {
  /** Lắc MỘT lần mỗi khi chuyển từ `false` sang `true` (vd ô nhập vừa báo lỗi). */
  active: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Lắc ngang nhẹ (~0.3 giây) báo "sai rồi" — bỏ qua khi máy bật "giảm chuyển động". */
export function Shake({ active, children, style }: ShakeProps) {
  const x = useRef(new Animated.Value(0)).current;
  const was = useRef(active);

  useEffect(() => {
    const rising = active && !was.current;
    was.current = active;
    if (!rising) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      animation = Animated.sequence(
        [8, -8, 6, -6, 3, 0].map((toValue) =>
          Animated.timing(x, { toValue, duration: 55, useNativeDriver: true }),
        ),
      );
      animation.start();
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [active, x]);

  return (
    <Animated.View style={[style, { transform: [{ translateX: x }] }]}>{children}</Animated.View>
  );
}

/**
 * Hệ số `scale` nảy từ nhỏ về 1 mỗi khi `flag` chuyển từ `false` sang `true` (chọn checkbox, radio).
 * Lúc mount với `flag` đã bật thì không nảy.
 */
export function usePop(flag: boolean, from = 0.6): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;
  const was = useRef(flag);

  useEffect(() => {
    if (flag && !was.current) {
      scale.setValue(from);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();
    }
    was.current = flag;
  }, [flag, from, scale]);

  return scale;
}

/**
 * Khối mở/thu có chiều cao chạy mượt. Chiều cao + độ mờ do Reanimated chạy thẳng trên luồng UI,
 * không đi qua luồng JS nên danh sách nhiều khối vẫn không rớt khung. Chiều cao thật đo bằng
 * `onLayout` (không cần biết trước). Nội dung chỉ được dựng khi đang mở hoặc đang thu dở — thu
 * xong thì gỡ khỏi cây, nên nội dung đang đóng không chiếm cây a11y hay bộ nhớ.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [measured, setMeasured] = useState(0);
  const progress = useSharedValue(open ? 1 : 0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    height.value = measured;
  }, [measured, height]);

  useEffect(() => {
    if (!mounted) return;
    // Mở lần đầu: chờ đo xong chiều cao rồi mới chạy, tránh nhảy từ 0.
    if (open && measured === 0) return;
    progress.value = withTiming(
      open ? 1 : 0,
      { duration: COLLAPSE_MS, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) },
      (finished) => {
        if (finished && !open) runOnJS(setMounted)(false);
      },
    );
  }, [open, mounted, measured, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Chưa đo xong thì để chiều cao tự nhiên (đang ẩn vì opacity 0), đo xong mới chạy theo `progress`.
    ...(height.value > 0 ? { height: height.value * progress.value } : null),
  }));

  if (!mounted) return null;

  return (
    <Reanimated.View style={[{ overflow: 'hidden' }, style]}>
      <View
        onLayout={(event: LayoutChangeEvent) => {
          const next = event.nativeEvent.layout.height;
          if (next > 0 && next !== measured) setMeasured(next);
        }}
        style={measured === 0 ? undefined : { position: 'absolute', top: 0, left: 0, right: 0 }}
      >
        {children}
      </View>
    </Reanimated.View>
  );
}

const EXIT_MS = 260;

export interface ExitCollapseProps {
  /** Bật lên `true` thì khối mờ đi và co chiều cao về 0, xong gọi `onExited` MỘT lần. */
  exiting: boolean;
  onExited: () => void;
  /** Khoảng cách dưới khối (thay cho `gap` của cha) — co cùng khối để không còn "nhảy" lúc gỡ. */
  gap?: number;
  children: ReactNode;
}

/**
 * Khối "đi ra" mượt cho phần tử trong danh sách (bỏ tim khỏi Saved): mờ dần, co lại, rồi
 * các phần tử bên dưới dịch lên. Việc gỡ thật khỏi dữ liệu là của cha, làm trong `onExited`.
 * Máy bật "giảm chuyển động" thì gọi `onExited` ngay.
 */
export function ExitCollapse({ exiting, onExited, gap = 0, children }: ExitCollapseProps) {
  const [measured, setMeasured] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const height = useSharedValue(0);
  const collapsing = useSharedValue(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  const notifyExited = useCallback(() => onExitedRef.current(), []);

  useEffect(() => {
    height.value = measured ?? 0;
  }, [measured, height]);

  useEffect(() => {
    if (!exiting) return;
    if (reduceMotion) {
      notifyExited();
      return;
    }
    // Co chiều cao + mờ dần chạy trên luồng UI; xong mới báo cha gỡ dữ liệu.
    collapsing.value = true;
    progress.value = withTiming(
      0,
      { duration: EXIT_MS, easing: ReanimatedEasing.in(ReanimatedEasing.cubic) },
      (finished) => {
        if (finished) runOnJS(notifyExited)();
      },
    );
  }, [exiting, reduceMotion, progress, collapsing, notifyExited]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    ...(collapsing.value && height.value > 0 ? { height: height.value * progress.value } : null),
  }));

  return (
    <Reanimated.View style={[{ overflow: 'hidden' }, style]}>
      <View
        onLayout={(event: LayoutChangeEvent) => {
          if (!exiting) setMeasured(event.nativeEvent.layout.height);
        }}
        style={{ paddingBottom: gap }}
      >
        {children}
      </View>
    </Reanimated.View>
  );
}

/** Nhấp nháy opacity chậm (1 ↔ 0.55) để gây chú ý — vd nhãn "Almost full". Tắt khi `active` false hoặc giảm chuyển động. */
export function Pulse({ active = true, children }: { active?: boolean; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      const step = (toValue: number) =>
        Animated.timing(opacity, {
          toValue,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        });
      loop = Animated.loop(Animated.sequence([step(0.55), step(1)]));
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
      opacity.setValue(1);
    };
  }, [active, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

export interface PresenceProps {
  show: boolean;
  /** Quãng trượt dp khi vào (âm = từ trên xuống, dương = từ dưới lên); ra thì trượt ngược lại. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Hiện/ẩn có hiệu ứng cho banner: vào thì trượt + hiện dần, ra thì trượt + mờ dần RỒI MỚI gỡ khỏi
 * cây. Dùng `entering`/`exiting` của Reanimated nên chuyển động ra vẫn chạy trên bản chụp của view cũ
 * dù cha đã xoá chữ báo lỗi về `null`. Máy bật "giảm chuyển động" thì hiện/ẩn thẳng.
 */
export function Presence({ show, distance = -12, style, children }: PresenceProps) {
  const reduceMotion = useReducedMotion();
  if (!show) return null;

  const enter = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: distance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  }).duration(380);
  const exit = new Keyframe({
    0: { opacity: 1, transform: [{ translateY: 0 }] },
    100: { opacity: 0, transform: [{ translateY: distance }] },
  }).duration(300);

  return (
    <Reanimated.View
      entering={reduceMotion ? undefined : enter}
      exiting={reduceMotion ? undefined : exit}
      style={style}
    >
      {children}
    </Reanimated.View>
  );
}

/** Dữ liệu để một thẻ tính parallax ảnh theo vị trí cuộn của danh sách chứa nó. */
export interface CardParallax {
  scrollY: Animated.Value;
  /** Vị trí trên của thẻ trong nội dung cuộn. */
  cellY: number;
  /** Chiều cao vùng nhìn thấy của danh sách. */
  viewport: number;
}

/** Bọc một thẻ trong danh sách cuộn: đo vị trí `y` của nó rồi đưa cho thẻ qua render-prop. */
export function ParallaxCell({
  scrollY,
  viewport,
  children,
}: {
  scrollY: Animated.Value;
  viewport: number;
  children: (parallax: CardParallax) => ReactNode;
}) {
  const [cellY, setCellY] = useState(0);

  return (
    <View onLayout={(event: LayoutChangeEvent) => setCellY(event.nativeEvent.layout.y)}>
      {children({ scrollY, cellY, viewport })}
    </View>
  );
}

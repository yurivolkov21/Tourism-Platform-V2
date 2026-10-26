// Bản thay thế tối giản cho `react-native-reanimated` trong Jest: worklet chạy trên luồng UI
// native nên bản thật (và `react-native-worklets`) không nạp được ở Node. Mock này đủ cho các
// API `Collapsible` dùng: giá trị tới đích ngay, callback hoàn tất gọi tức thì.
const { useRef, useState } = require('react');
const { FlatList, ScrollView, Text, View } = require('react-native');

module.exports = {
  __esModule: true,
  default: { View, ScrollView, FlatList, Text, createAnimatedComponent: (component) => component },
  Easing: { out: (fn) => fn, in: (fn) => fn, inOut: (fn) => fn, cubic: (t) => t, sin: (t) => t },
  // `react-native-gesture-handler` thấy Reanimated là nối vào, nên cần thêm vài API này.
  useEvent: () => () => {},
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  // Nội suy tuyến tính từng đoạn, kẹp hai đầu — đủ cho các giá trị parallax/thanh tiến độ.
  interpolate: (value, input, output) => {
    if (value <= input[0]) return output[0];
    const last = input.length - 1;
    if (value >= input[last]) return output[last];
    let i = 0;
    while (value > input[i + 1]) i += 1;
    const t = (value - input[i]) / (input[i + 1] - input[i]);
    return output[i] + t * (output[i + 1] - output[i]);
  },
  // Màu: lấy mốc gần nhất (test không đo màu giữa chừng).
  interpolateColor: (value, input, output) => {
    let nearest = 0;
    input.forEach((stop, i) => {
      if (Math.abs(stop - value) < Math.abs(input[nearest] - value)) nearest = i;
    });
    return output[nearest];
  },
  withDelay: (_delay, animation) => animation,
  withRepeat: (animation) => animation,
  withSpring: (toValue, _config, callback) => {
    if (callback) callback(true);
    return toValue;
  },
  // Trả về hàm dùng được làm `onScroll` (nhận sự kiện RN, đưa `nativeEvent` cho bộ xử lý).
  useAnimatedScrollHandler: (config) => {
    const onScroll = typeof config === 'function' ? config : config.onScroll;
    return (event) => onScroll?.(event.nativeEvent);
  },
  // Chuyển động bố cục: test không cần chạy, chỉ cần gọi chuỗi `duration()` được.
  LinearTransition: { duration: () => ({}) },
  useReducedMotion: () => false,
  useAnimatedProps: (factory) => factory(),
  // Chuỗi gọi `new Keyframe({...}).duration(n)` của `Presence`.
  Keyframe: class {
    duration() {
      return this;
    }
  },
  useAnimatedKeyboard: () => ({ height: { value: 0 } }),
  runOnJS: (fn) => fn,
  useAnimatedStyle: (factory) => factory(),
  // Giữ nguyên một đối tượng giữa các lần render, như shared value thật. Gán `.value` thì dựng lại
  // component để `useAnimatedStyle` tính lại — bản thật cập nhật style thẳng trên luồng UI.
  useSharedValue: (initial) => {
    const [, setTick] = useState(0);
    const ref = useRef(null);
    if (ref.current === null) {
      let current = initial;
      ref.current = {
        get value() {
          return current;
        },
        set value(next) {
          if (next === current) return;
          current = next;
          setTick((tick) => tick + 1);
        },
      };
    }
    return ref.current;
  },
  withTiming: (toValue, _config, callback) => {
    if (callback) callback(true);
    return toValue;
  },
};

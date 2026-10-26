import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Nhãn của backdrop cho trình đọc màn hình (N10, rà 07/10) — backdrop là một nút "đóng tấm". Bắt
   * buộc, và không chọn cách ẩn backdrop khỏi trình đọc màn hình: tấm không có nút huỷ (mời đăng
   * nhập, sửa tên) chỉ đóng được bằng chạm backdrop, ẩn đi thì trên iOS khách hết đường đóng.
   */
  closeLabel: string;
  children: ReactNode;
}

/**
 * Kéo xuống quá 100dp HOẶC vẩy đủ nhanh (>0.5dp/ms dù kéo chưa xa) thì đóng —
 * cùng ngưỡng sheet gốc iOS/Android. Tách hàm thuần để test được mà không cần
 * mô phỏng PanResponder (RNTL không có API bắn gesture responder thật).
 */
export function shouldDismissDrag(dy: number, vy: number): boolean {
  'worklet';
  return dy > 100 || vy > 0.5;
}

/**
 * Tấm trượt từ đáy (`.sheet` bản vẽ 18/09 — ADR-0055 T0). Trượt lên khi mở,
 * trượt xuống khi đóng — dù đóng bằng cách nào (nút bên trong `children`,
 * backdrop, kéo tay nắm, hay phím back) đều tự trượt như nhau, vì component
 * theo dõi CHÍNH prop `visible`, không phải từng đường gọi `onClose` riêng lẻ.
 *
 * `Modal animationType="none"` CỐ Ý — tự animate bằng `translateY` của chính
 * mình thay vì để `Modal` trượt cả cây bằng transform nguyên sinh của nó. Hai
 * transform lồng nhau (transform của `Modal` + `translateY` JS riêng) là nghi
 * phạm chính gây mảng đen render sai vị trí lúc mở (phản hồi 24/09).
 *
 * Bàn phím (F3, review 06/10): `Modal` iOS không tự co khi bàn phím mở (khác
 * Android `adjustResize`), nên tấm có ô nhập bị che. Lớp bọc đệm đáy theo chiều cao bàn phím
 * từ `useAnimatedKeyboard` (CHỈ iOS, xem `KeyboardAvoider`) và để tấm
 * nằm trong LUỒNG bố cục dưới backdrop `flex:1` thay vì `position:absolute`:
 * padding đáy của lớp bọc đẩy tấm lên đúng bằng chiều cao bàn phím, còn phần
 * tử absolute thì Yoga không bảo đảm đi theo padding của cha.
 */
/** Phần đáy tấm nối dài ra ngoài màn để lò xo nảy không lộ khe hở. */
const OVERSHOOT_EXTENSION = 56;

/**
 * Lớp bọc đẩy tấm lên theo bàn phím. CHỈ iOS dùng `useAnimatedKeyboard`: Android đã tự co
 * (`adjustResize`), và hook này trên Android chiếm quyền xử lý inset của cửa sổ — để nó chạy ở mọi
 * màn có sheet từng làm vùng an toàn đỉnh/đáy đổi thành trắng. Hook nằm trong component riêng, chỉ
 * dựng khi tấm đang mở (`Modal` chỉ có con lúc `mounted`), nên không chạm tới các màn bên dưới.
 */
function KeyboardAvoider({ children }: { children: ReactNode }) {
  return Platform.OS === 'ios' ? (
    <IosKeyboardAvoider>{children}</IosKeyboardAvoider>
  ) : (
    <View testID="bottom-sheet-keyboard-avoider" style={{ flex: 1 }}>
      {children}
    </View>
  );
}

function IosKeyboardAvoider({ children }: { children: ReactNode }) {
  const keyboard = useAnimatedKeyboard();
  // Đệm đáy chạy ĐÚNG nhịp trượt của bàn phím (Reanimated đọc chiều cao từng khung hình) thay vì
  // nhảy một lần như `KeyboardAvoidingView`.
  const style = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));
  return (
    <Reanimated.View testID="bottom-sheet-keyboard-avoider" style={[{ flex: 1 }, style]}>
      {children}
    </Reanimated.View>
  );
}

export function BottomSheet({ visible, onClose, closeLabel, children }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  // `Modal` thật sự có mặt trễ hơn `visible` lúc ĐÓNG — chờ animation trượt
  // xuống chạy xong rồi mới gỡ, không thì tấm "biến mất" khô khốc giữa chừng.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(windowHeight);
      // Mở bằng lò xo: sheet vọt lên quá vị trí cuối một chút (~4%) rồi lắng lại — cảm giác "nảy". Máy bật
      // "giảm chuyển động" thì trượt thẳng, không nảy.
      AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (reduced) {
          Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          stiffness: 200,
          damping: 20,
          mass: 1,
          useNativeDriver: true,
        }).start();
      });
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: windowHeight,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // `mounted` cố ý nằm trong dep: lượt chạy NGAY SAU `setMounted(false)` ở
    // trên có `visible=false, mounted=false` — cả hai nhánh đều không khớp,
    // effect là no-op, không lặp animation.
  }, [visible, mounted, windowHeight, translateY]);

  // N2 (rà 07/10): PanResponder dựng MỘT lần (useRef) nên closure của nó đóng
  // băng `onClose` của lần render đầu — cha có guard kiểu `if (pending) return`
  // thì kéo tay nắm luôn thấy `pending=false` cũ và đóng tấm giữa chừng. Đọc
  // qua ref cập nhật mỗi render để kéo tay nắm gọi đúng `onClose` hiện tại.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Chỉ nhận cử chỉ dọc rõ ràng — cử chỉ ngang hoặc quá nhỏ nhường lại
      // cho tay nắm (không có hành vi riêng nhưng tránh nuốt tap nhầm).
      onMoveShouldSetPanResponder: (_e, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_e, gesture) => {
        // Chỉ kéo được XUỐNG — kéo lên thì giữ nguyên 0, không "vượt trần".
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_e, gesture) => {
        if (shouldDismissDrag(gesture.dy, gesture.vy)) {
          // Chỉ báo cha đóng — hiệu ứng trượt tiếp (từ vị trí đang kéo dở, giữ
          // đà ngón tay) do effect ở trên lo, cùng đường với mọi cách đóng khác.
          onCloseRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoider>
        {/* Nền overlay mờ dần theo vị trí tấm (kéo xuống / đóng càng xa càng trong); đứng sau tấm nên góc bo
            của tấm vẫn lộ ra đúng màu overlay. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.overlay,
              opacity: translateY.interpolate({
                inputRange: [0, windowHeight * 0.6],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
        <Pressable
          testID="bottom-sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <Animated.View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: theme.spacing(7),
            borderTopRightRadius: theme.spacing(7),
            // Android: view mang `transform` không tự cắt theo `borderRadius`
            // khi có elevation/shadow — viền bo tràn ra thành khối vuông tối đè
            // lên nội dung phía sau (phản hồi 24/09). Ép cắt đúng góc bo.
            overflow: 'hidden',
            zIndex: 1,
            elevation: 8,
            paddingTop: theme.spacing(4),
            // Cộng vùng an toàn đáy: thiếu nó nút cuối tấm dính sát/chui dưới
            // thanh cử chỉ (bản vẽ đặt nút trên `inset-bottom`).
            // Nối dài đáy xuống ngoài màn (OVERSHOOT_EXTENSION) — lúc lò xo vọt lên quá vị trí cuối, phần dư này
            // lấp khe hở dưới tấm; đệm đáy cộng thêm đúng bằng đó để nội dung không bị dịch.
            paddingBottom: insets.bottom + theme.spacing(8) + OVERSHOOT_EXTENSION,
            marginBottom: -OVERSHOOT_EXTENSION,
            // Đệm ngang spacing(6)=24dp khớp `.sheet` bản vẽ 18/09 (trước là
            // spacing(4)=16dp → chip lọc tràn sát mép hơn mẫu).
            paddingHorizontal: theme.spacing(6),
            transform: [{ translateY }],
          }}
        >
          {/* Vùng kéo: full-width + `alignItems:'center'` để canh tay nắm — KHÔNG
            dùng `left:'50%'`+`marginLeft` âm (từng lệch tâm khi đổi
            `paddingHorizontal` của tấm cha, phản hồi 24/09). */}
          <View
            {...panResponder.panHandlers}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: theme.spacing(8),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                backgroundColor: withAlpha(theme.colors['muted-foreground'], 0.5),
              }}
            />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoider>
    </Modal>
  );
}

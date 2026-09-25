import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Kéo xuống quá 100dp HOẶC vẩy đủ nhanh (>0.5dp/ms dù kéo chưa xa) thì đóng —
 * cùng ngưỡng sheet gốc iOS/Android. Tách hàm thuần để test được mà không cần
 * mô phỏng PanResponder (RNTL không có API bắn gesture responder thật).
 */
export function shouldDismissDrag(dy: number, vy: number): boolean {
  return dy > 100 || vy > 0.5;
}

/**
 * Tấm trượt từ đáy (`.sheet` bản vẽ 18/09 — ADR-0047 T0). Trượt lên khi mở,
 * trượt xuống khi đóng — dù đóng bằng cách nào (nút bên trong `children`,
 * backdrop, kéo tay nắm, hay phím back) đều tự trượt như nhau, vì component
 * theo dõi CHÍNH prop `visible`, không phải từng đường gọi `onClose` riêng lẻ.
 *
 * `Modal animationType="none"` CỐ Ý — tự animate bằng `translateY` của chính
 * mình thay vì để `Modal` trượt cả cây bằng transform nguyên sinh của nó. Hai
 * transform lồng nhau (transform của `Modal` + `translateY` JS riêng) là nghi
 * phạm chính gây mảng đen render sai vị trí lúc mở (phản hồi 24/09).
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
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
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }).start();
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
          onClose();
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
      <Pressable
        testID="bottom-sheet-backdrop"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
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
          paddingBottom: insets.bottom + theme.spacing(8),
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
    </Modal>
  );
}

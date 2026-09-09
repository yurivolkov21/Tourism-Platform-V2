import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme-provider';

/** Cạnh mà MÀN tự lo vùng an toàn — cạnh nào navigator đã lo thì đừng kể vào. */
export type ScreenEdge = 'top' | 'bottom';

/**
 * Hai khung chuẩn của app, đặt tên thay vì để mỗi màn tự nhớ mảng — viết ngược
 * `['top']`/`['bottom']` là lỗi im lặng (dải trắng chết, hoặc chữ chui xuống
 * thanh cử chỉ) mà không test nào của màn bắt được.
 */
/** Màn trong `(tabs)` — `headerShown: false`, thanh tab đã lo đáy. */
export const SCREEN_EDGES_UNDER_TABS = ['top'] as const satisfies readonly ScreenEdge[];
/** Màn có header (stack thường, modal auth) — header đã lo đỉnh. */
export const SCREEN_EDGES_UNDER_HEADER = ['bottom'] as const satisfies readonly ScreenEdge[];

export interface ScreenProps extends ViewProps {
  children?: ReactNode;
  /**
   * Đệm mép mặc định. Đặt `false` cho màn có nội dung tràn mép (ảnh bìa,
   * carousel) — khi đó màn tự lo đệm cho từng khối bên trong.
   */
  padded?: boolean;
  /**
   * Cạnh cần cộng vùng an toàn. **Phải khai đúng theo khung của màn**, vì
   * `SafeAreaView` chạy ở chế độ `additive`: nó CỘNG THÊM inset chứ không biết
   * navigator đã trừ phần nào.
   *
   * - Màn trong `(tabs)` (`headerShown: false`): `['top']` — thanh tab đã lo đáy.
   * - Màn có header (stack, modal auth): `['bottom']` — header đã lo đỉnh.
   * - Màn không header cũng không tab: để mặc định.
   *
   * Khai sai ở đây là ~63dp dải trắng chết dưới header, hoặc chữ chui xuống
   * dưới thanh cử chỉ — cả hai đều không có test nào bắt được vì spec dựng
   * component ngoài navigator.
   */
  edges?: readonly ScreenEdge[];
  /**
   * Cuộn được và tự tránh bàn phím. Mặc định BẬT: phần lớn màn có nội dung dài
   * hơn màn hình, và màn có ô nhập mà không đẩy lên thì nút gửi nằm dưới bàn
   * phím — không chạm tới được. Đặt `false` cho màn tự quản vùng cuộn bên trong
   * (danh sách ảo hoá, bản đồ).
   */
  scrollable?: boolean;
}

/**
 * Khung nền của mọi màn hình: nền theo token, vùng an toàn, cuộn và tránh bàn
 * phím. Dùng `SafeAreaView` của `react-native-safe-area-context` chứ không phải
 * bản của React Native — bản RN chỉ có tác dụng trên iOS.
 *
 * Khi `scrollable`, đệm nằm ở `contentContainerStyle` chứ KHÔNG ở khung ngoài:
 * đệm ngoài vùng cuộn thì nội dung bị cắt ở mép và thanh cuộn thụt vào.
 */
export function Screen({
  children,
  padded = true,
  edges = ['top', 'bottom'],
  scrollable = true,
  style,
  testID,
  ...rest
}: ScreenProps) {
  const theme = useTheme();

  const padding = padded
    ? { paddingHorizontal: theme.spacing(5), paddingVertical: theme.spacing(4) }
    : null;
  // `testID` gắn ở khung NGOÀI (nó mới là "màn"), vùng nội dung mang hậu tố —
  // hai tầng có vai trò khác nhau nên test phải chỉ được đúng tầng.
  const contentTestID = testID === undefined ? undefined : `${testID}-content`;

  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android tự resize cửa sổ theo bàn phím; thêm `padding` ở đó là đẩy
        // nội dung lên hai lần.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scrollable ? (
          <ScrollView
            // `flexGrow: 1` để nội dung ngắn vẫn phủ hết màn — không có nó thì
            // mọi layout dựa trên `flex` bên trong co lại bằng chiều cao chữ.
            contentContainerStyle={[{ flexGrow: 1 }, padding, style]}
            keyboardShouldPersistTaps="handled"
            testID={contentTestID}
            {...rest}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, padding, style]} testID={contentTestID} {...rest}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme-provider';

export interface ScreenProps extends ViewProps {
  children?: ReactNode;
  /**
   * Đệm mép mặc định. Đặt `false` cho màn có nội dung tràn mép (ảnh bìa,
   * carousel) — khi đó màn tự lo đệm cho từng khối bên trong.
   */
  padded?: boolean;
}

/**
 * Khung nền của mọi màn hình: nền theo token, tránh tai thỏ và thanh cử chỉ.
 * Dùng `SafeAreaView` của `react-native-safe-area-context` chứ không phải bản
 * của React Native — bản RN chỉ có tác dụng trên iOS.
 */
export function Screen({ children, padded = true, style, ...rest }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[
        { flex: 1, backgroundColor: theme.colors.background },
        padded && {
          paddingHorizontal: theme.spacing(5),
          paddingVertical: theme.spacing(4),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

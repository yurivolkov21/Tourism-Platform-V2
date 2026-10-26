import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from './theme-provider';

export interface CardProps extends ViewProps {
  children?: ReactNode;
}

/** Bề mặt nổi lên khỏi nền màn — thẻ tour, khối tóm tắt, ô trạng thái. */
export function Card({ children, style, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          // Thẻ Material 3: không viền, không bóng — nền `card` đặt trên nền màn
          // (`surfaces.grouped`) là đủ tách lớp.
          borderRadius: 16,
          padding: theme.spacing(4),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

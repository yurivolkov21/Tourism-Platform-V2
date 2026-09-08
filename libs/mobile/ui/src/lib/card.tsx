import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
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
          borderColor: theme.colors.border,
          // `hairlineWidth` là đường mảnh nhất mà màn hình vẽ được — 1dp trên
          // màn @3x sẽ dày gấp ba lần cần thiết.
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: theme.radius.base,
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

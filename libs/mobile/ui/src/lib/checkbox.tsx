import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface CheckboxProps {
  checked: boolean;
  onValueChange: (next: boolean) => void;
  /** Nhãn cho trình đọc màn hình — nội dung hiển thị đi ở `children`. */
  accessibilityLabel: string;
  children: ReactNode;
}

/**
 * Ô tick kèm nhãn. Cả hàng là vùng chạm chứ không riêng ô vuông 18dp — ô vuông
 * một mình nhỏ hơn ngưỡng chạm của token, và người dùng vẫn quen bấm vào chữ.
 */
export function Checkbox({ checked, onValueChange, accessibilityLabel, children }: CheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => onValueChange(!checked)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing(2.5),
        minHeight: theme.touchTargetMin,
        paddingVertical: theme.spacing(3),
      }}
    >
      <View
        style={{
          width: theme.spacing(4.5),
          height: theme.spacing(4.5),
          borderRadius: theme.radius.base,
          borderWidth: 1.5,
          borderColor: checked ? theme.colors.primary : theme.colors.input,
          backgroundColor: checked ? theme.colors.primary : undefined,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Feather name="check" size={12} color={theme.colors['primary-foreground']} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

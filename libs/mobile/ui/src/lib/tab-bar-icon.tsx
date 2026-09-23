import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from './theme-provider';

export interface TabBarIconProps {
  name: ComponentProps<typeof Feather>['name'];
  focused: boolean;
}

/** Icon tab với viên nền `primary` khi đang chọn (handoff §T0 — 5 tab). */
export function TabBarIcon({ name, focused }: TabBarIconProps) {
  const theme = useTheme();

  return (
    <View
      testID="tab-bar-icon-pill"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: theme.spacing(9),
        height: theme.spacing(9),
        borderRadius: 999,
        backgroundColor: focused ? theme.colors.primary : 'transparent',
      }}
    >
      <Feather
        name={name}
        size={20}
        color={focused ? theme.colors['primary-foreground'] : theme.colors['muted-foreground']}
      />
    </View>
  );
}

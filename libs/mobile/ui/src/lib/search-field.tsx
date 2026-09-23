import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'onFocus' | 'onBlur'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Nhãn a11y cho nút xoá — mặc định "Clear search". */
  clearLabel?: string;
}

/** Ô tìm pill (bản vẽ 18/09, `.search` — ADR-0047 T3). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel = 'Clear search',
  ...rest
}: SearchFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      testID="search-field-shell"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: theme.touchTargetMin,
        borderRadius: 999,
        backgroundColor: theme.colors.card,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? theme.colors['primary-emphasis'] : theme.colors.border,
        gap: theme.spacing(2.5),
        paddingHorizontal: theme.spacing(4),
      }}
    >
      <Feather name="search" size={18} color={theme.colors['muted-foreground']} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors['muted-foreground']}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          color: focused ? theme.colors.foreground : theme.colors['muted-foreground'],
          fontFamily: theme.fonts.normal,
          fontSize: theme.type.base.fontSize,
          padding: 0,
        }}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={theme.spacing(2)}
          onPress={() => onChangeText('')}
        >
          <Feather name="x" size={16} color={theme.colors['muted-foreground']} />
        </Pressable>
      ) : null}
    </View>
  );
}

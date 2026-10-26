import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { Icon } from './icon';
import { PopIn } from './motion';
import { useTheme } from './theme-provider';

export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'onFocus' | 'onBlur'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /**
   * Nhãn a11y cho nút xoá — BẮT BUỘC, nơi gọi lấy từ `@tourism/i18n` (luật 7).
   * Trước đây mặc định là chuỗi tiếng Anh viết cứng nên Explore quên truyền
   * mà vẫn chạy, đọc chữ không qua i18n (L4, review 05/10).
   */
  clearLabel: string;
}

/** Thanh tìm Material 3 (N8, khung B2): cao 56, bo 28, nền `containerHigh`, không viền. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel,
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
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.surfaces.containerHigh,
        gap: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
      }}
    >
      <Icon name="search" size={24} color={theme.colors['muted-foreground']} />
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
          fontWeight: theme.weight.normal,
          fontSize: theme.type.base.fontSize,
          padding: 0,
        }}
        {...rest}
      />
      {value.length > 0 ? (
        <PopIn>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            hitSlop={theme.spacing(2)}
            onPress={() => onChangeText('')}
          >
            <Icon name="x" size={24} color={theme.colors['muted-foreground']} />
          </Pressable>
        </PopIn>
      ) : null}
    </View>
  );
}

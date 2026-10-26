import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from './icon';
import { useTheme } from './theme-provider';

export interface SearchViewHeaderProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Nhãn đọc màn hình của nút xoá — nơi gọi lấy từ `@tourism/i18n` (luật 7). */
  clearLabel: string;
  /** Nhãn đọc màn hình của mũi tên lùi. */
  backLabel: string;
  /** Rời search view: nơi gọi xoá chữ và đóng chế độ tìm. */
  onBack: () => void;
}

/**
 * Đầu màn search view của Material 3 (N8, khung B4): cao 72, nền `containerHigh`, mũi tên
 * lùi, ô gõ tự focus, nút xoá và đường kẻ dưới. Thay cho tiêu đề lớn và thanh tìm khi
 * người dùng chạm vào thanh tìm.
 */
export function SearchViewHeader({
  value,
  onChangeText,
  placeholder,
  clearLabel,
  backLabel,
  onBack,
}: SearchViewHeaderProps) {
  const theme = useTheme();

  return (
    <View
      testID="search-view-header"
      style={{
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1),
        paddingHorizontal: theme.spacing(1),
        backgroundColor: theme.surfaces.containerHigh,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="arrow-left" size={24} color={theme.colors.foreground} />
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors['muted-foreground']}
        autoFocus
        returnKeyType="search"
        style={{
          flex: 1,
          color: theme.colors.foreground,
          fontSize: theme.type.base.fontSize,
          fontWeight: theme.weight.normal,
          padding: 0,
        }}
      />
      {value.length === 0 ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={24} color={theme.colors['muted-foreground']} />
        </Pressable>
      )}
    </View>
  );
}

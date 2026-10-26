import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { Icon } from './icon';
import type { FeatherIconName } from './text-field';
import { useTheme } from './theme-provider';

export interface LargeTitleAction {
  icon: FeatherIconName;
  /** Nút chỉ có icon nên nhãn đọc màn hình là bắt buộc. */
  label: string;
  onPress: () => void;
  /** Số hiện trên góc nút (vd số bộ lọc đang bật); 0 hoặc bỏ trống thì ẩn. */
  badge?: number;
}

export interface LargeTitleHeaderProps {
  title: string;
  /** Dòng phụ nhỏ dưới tiêu đề (vd "3 tours"). */
  subtitle?: string | null;
  /** Nút icon nằm bên phải hàng trên, từ trái sang phải. */
  actions?: readonly LargeTitleAction[];
}

/**
 * Tiêu đề lớn của bốn tab Explore, Saved, Trips, Account (N4, khung B2/B9/B10/F1):
 * tiêu đề `display` canh trái lề 16, nút icon (24 trong vùng chạm 48) cùng hàng bên phải.
 * Đệm đỉnh cố định 16 để mọi tab có tiêu đề cùng độ cao.
 * Home giữ header cũ nên không dùng component này.
 */
export function LargeTitleHeader({ title, subtitle = null, actions = [] }: LargeTitleHeaderProps) {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: theme.spacing(4) }}>
      {/* Khoảng đệm đỉnh cố định — mọi tab có tiêu đề cùng độ cao, có nút hay không. */}
      <View testID="large-title-bar" style={{ height: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}>
        <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            // Bù lề của vùng chạm 48 để icon thẳng hàng mép phải với lề 16 của màn.
            marginRight: -theme.spacing(2),
          }}
        >
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={action.icon} size={24} color={theme.colors.foreground} />
              {action.badge !== undefined && action.badge > 0 ? (
                <View
                  testID="large-title-badge"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    backgroundColor: theme.colors['destructive-emphasis'],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: theme.colors.background,
                      fontSize: 11,
                      lineHeight: 14,
                      fontWeight: theme.weight.medium,
                    }}
                  >
                    {action.badge}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
      {subtitle === null ? null : (
        <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(0.5) }}>
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

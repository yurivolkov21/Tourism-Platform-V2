import { Pressable, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface RegionRailItem {
  key: string;
  label: string;
  /** Tên đầy đủ cho trình đọc màn hình — chữ hiển thị đã rút gọn và xoay dọc. */
  accessibilityLabel?: string;
}

export interface RegionRailProps {
  items: RegionRailItem[];
  selected: string;
  onSelect: (key: string) => void;
}

/**
 * Rail vùng dọc của Home — bố cục bê từ bản v1 (Nexora `RegionTabs`): cột hẹp
 * `alignSelf: stretch`, các đoạn chia `space-evenly`, mỗi đoạn là một hàng
 * XOAY -90° gồm vạch chỉ báo + nhãn. Vì cả hàng xoay cùng lúc nên vạch nằm
 * DƯỚI chữ sau khi xoay, và nó luôn được vẽ (trong suốt khi không chọn) để
 * nhãn không nhảy chỗ lúc đổi vùng.
 *
 * Nhãn ngắn ("North") giữ cho chữ xoay còn đọc được; a11y đọc tên vùng ĐẦY ĐỦ
 * và không xoay.
 */
export function RegionRail({ items, selected, onSelect }: RegionRailProps) {
  const theme = useTheme();

  return (
    <View
      style={{ width: theme.spacing(13), alignSelf: 'stretch', justifyContent: 'space-evenly' }}
    >
      {items.map((item) => {
        const on = item.key === selected;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: on }}
            hitSlop={10}
            onPress={() => {
              if (!on) onSelect(item.key);
            }}
            style={{ height: theme.spacing(30), alignItems: 'center', justifyContent: 'center' }}
          >
            {/* Vạch chỉ báo nằm NGOÀI phần xoay: nó phải dựng đứng ở BÊN TRÁI
                chữ trên màn. Để trong khung xoay thì sau khi quay -90° nó rơi
                xuống DƯỚI chữ. Chiều dài suy từ thang chữ nên đổi cỡ chữ là
                vạch dài theo. */}
            {on ? (
              <View
                testID="region-rail-indicator"
                style={{
                  position: 'absolute',
                  left: 0,
                  width: 3,
                  height: theme.type.base.fontSize * 3.5,
                  borderRadius: theme.radius.base / 2,
                  backgroundColor: theme.colors['primary-emphasis'],
                }}
              />
            ) : null}
            {/* `transform` chỉ đổi lúc VẼ chứ không đổi khung layout — khung
                phải đủ rộng cho nhãn nằm ngang TRƯỚC khi xoay, nếu không chữ
                bị bẻ dòng rồi mới xoay. */}
            <View
              style={{
                width: theme.spacing(30),
                transform: [{ rotate: '-90deg' }],
                alignItems: 'center',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: on ? theme.fonts.semibold : theme.fonts.normal,
                  fontSize: theme.type.base.fontSize,
                  letterSpacing: 0.4,
                  color: on ? theme.colors['primary-emphasis'] : theme.colors['muted-foreground'],
                }}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

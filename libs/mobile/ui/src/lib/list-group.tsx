import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from './app-text';
import { Icon } from './icon';
import { PressableScale } from './motion';
import type { FeatherIconName } from './text-field';
import { useTheme } from './theme-provider';

export interface ListRowProps {
  icon?: FeatherIconName;
  title: string;
  subtitle?: string;
  /** Giá trị cuối hàng (vd "English", "Off"). */
  value?: string;
  /** `true` = dòng mở trình duyệt ngoài: icon `external-link` thay `chevron-right`. */
  external?: boolean;
  /** Hàng phá huỷ (Sign out, Cancel this booking, Delete account). */
  destructive?: boolean;
  /** Không có mũi tên cuối hàng (hàng chỉ để đọc hoặc có điều khiển riêng). */
  hideChevron?: boolean;
  /** Bỏ trống = hàng chỉ để đọc (vd Name, Email): không bấm được, không có mũi tên. */
  onPress?: () => void;
  /** Do `ListGroup` truyền xuống để chọn bo góc; nơi gọi không tự đặt. */
  position?: 'first' | 'middle' | 'last' | 'only';
}

const BIG = 20;
const SMALL = 4;

/** Một hàng của danh sách thẻ rời (N6) — hàng đầu bo trên 20, cuối bo dưới 20, còn lại bo 4. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  external = false,
  destructive = false,
  hideChevron = false,
  onPress,
  position = 'only',
}: ListRowProps) {
  const theme = useTheme();
  const top = position === 'first' || position === 'only' ? BIG : SMALL;
  const bottom = position === 'last' || position === 'only' ? BIG : SMALL;
  const danger = theme.colors['destructive-emphasis'];
  const readOnly = onPress === undefined;
  const Row = readOnly ? View : PressableScale;

  return (
    <Row
      accessibilityRole={readOnly ? undefined : 'button'}
      accessible={readOnly ? true : undefined}
      accessibilityLabel={[title, subtitle, readOnly ? value : undefined]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(4),
        minHeight: 56,
        paddingVertical: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: top,
        borderTopRightRadius: top,
        borderBottomLeftRadius: bottom,
        borderBottomRightRadius: bottom,
      }}
    >
      {icon === undefined ? null : (
        <Icon
          name={icon}
          size={24}
          color={destructive ? danger : theme.colors['muted-foreground']}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" style={destructive ? { color: danger } : undefined}>
          {title}
        </AppText>
        {subtitle === undefined ? null : (
          <AppText variant="label" tone="muted" style={{ fontWeight: theme.weight.normal }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {value === undefined ? null : (
        <AppText variant="label" tone="muted" style={{ fontWeight: theme.weight.normal }}>
          {value}
        </AppText>
      )}
      {hideChevron || destructive || readOnly ? null : (
        <Icon
          name={external ? 'external-link' : 'chevron-right'}
          size={24}
          color={theme.colors['muted-foreground']}
        />
      )}
    </Row>
  );
}

export interface ListGroupProps {
  /** Nhãn nhóm 14/20 medium `primary-emphasis`. */
  label?: string;
  /** Chân nhóm 12/16. */
  footer?: string;
  children: ReactNode;
}

/** Nhóm các `ListRow` như Cài đặt Android 16: mỗi hàng là một thẻ rời cách nhau 2dp. */
export function ListGroup({ label, footer, children }: ListGroupProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<ListRowProps>[];

  return (
    <View>
      {label === undefined ? null : (
        <AppText
          variant="label"
          style={{
            color: theme.colors['primary-emphasis'],
            paddingHorizontal: theme.spacing(4),
            paddingBottom: theme.spacing(2),
          }}
        >
          {label}
        </AppText>
      )}
      <View testID="list-group-rows" style={{ gap: 2 }}>
        {rows.map((row, index) => {
          const position =
            rows.length === 1
              ? 'only'
              : index === 0
                ? 'first'
                : index === rows.length - 1
                  ? 'last'
                  : 'middle';
          return <ListRow key={row.key ?? index} {...row.props} position={position} />;
        })}
      </View>
      {footer === undefined ? null : (
        <AppText
          variant="caption"
          tone="muted"
          style={{ paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(2) }}
        >
          {footer}
        </AppText>
      )}
    </View>
  );
}

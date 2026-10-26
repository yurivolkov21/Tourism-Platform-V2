import { AppText, AuroraGradient, type FeatherIconName, Icon, useTheme } from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

/**
 * Mảnh dùng chung giữa các màn cụm P (P1/P2/P3/P4/P5, mockup mục 4) — cùng lý
 * do tách `booking-parts.tsx`: lặp lại giống nhau giữa nhiều màn của một cụm.
 */

/** ".sec-label" — nhãn đầu mục hoa, Archivo 600, giãn chữ nhẹ. Bọc một `View`
 *  có `marginTop` riêng ở chỗ gọi khi cần cách dòng trên (khuôn mockup mỗi
 *  đầu mục cách nhau khác nhau, không có một hằng số chung). */
export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <AppText
      variant="caption"
      tone="muted"
      style={{
        fontWeight: theme.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </AppText>
  );
}

/** ".count" — khung thẻ bọc khối đếm ngược/tiến trình (P1/P2/P5). */
export function TripCountCard({
  children,
  glow,
}: {
  children: ReactNode;
  /** Độ đậm (0–1) của màu giao thoa phía sau; bỏ trống thì thẻ phẳng như cũ. */
  glow?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        // Thẻ Material 3 (N3): bo 16, không viền.
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: theme.spacing(4),
        overflow: 'hidden',
      }}
    >
      {glow === undefined ? null : <AuroraGradient intensity={glow} />}
      {children}
    </View>
  );
}

/** ".meter" — thanh tiến trình mảnh, không nhãn %  (mockup chỉ vẽ độ dài). */
export function TripMeter({ percent }: { percent: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 8,
        borderRadius: 99,
        backgroundColor: theme.colors.muted,
        overflow: 'hidden',
        marginTop: theme.spacing(3),
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, percent))}%`,
          borderRadius: 99,
          backgroundColor: theme.colors['primary-emphasis'],
        }}
      />
    </View>
  );
}

export interface RowLinkProps {
  icon: FeatherIconName;
  label: string;
  caption: string;
  onPress: () => void;
  /** Hàng đầu nhóm — bo trên 20. */
  first?: boolean;
  /** Hàng cuối nhóm — bo dưới 20, không chừa khe 2dp phía dưới. */
  last?: boolean;
}

/**
 * Hàng điều hướng tiếp của cụm P (D1–D3, N6): mỗi hàng là một thẻ rời nền `card`, cách
 * nhau 2dp — hàng đầu bo trên 20, hàng cuối bo dưới 20, còn lại bo 4; icon trần 24.
 */
export function RowLink({
  icon,
  label,
  caption,
  onPress,
  first = false,
  last = false,
}: RowLinkProps) {
  const theme = useTheme();
  const top = first ? 20 : 4;
  const bottom = last ? 20 : 4;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(4),
        minHeight: 56,
        paddingVertical: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
        marginBottom: last ? 0 : 2,
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: top,
        borderTopRightRadius: top,
        borderBottomLeftRadius: bottom,
        borderBottomRightRadius: bottom,
      }}
    >
      <Icon name={icon} size={24} color={theme.colors['muted-foreground']} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="body">{label}</AppText>
        <AppText
          variant="label"
          tone="muted"
          numberOfLines={1}
          style={{ fontWeight: theme.weight.normal }}
        >
          {caption}
        </AppText>
      </View>
      <Icon name="chevron-right" size={24} color={theme.colors['muted-foreground']} />
    </Pressable>
  );
}

/** ".tick" tĩnh (P3) — icon check/x + chữ, KHÔNG bấm được (khác checklist P2). */
export function StaticTick({
  text,
  tone = 'included',
}: {
  text: string;
  tone?: 'included' | 'excluded';
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing(3),
        alignItems: 'flex-start',
        paddingVertical: theme.spacing(2),
      }}
    >
      <Icon
        name={tone === 'included' ? 'check' : 'x'}
        size={18}
        color={
          tone === 'included' ? theme.colors['primary-emphasis'] : theme.colors['muted-foreground']
        }
        style={{ marginTop: 3 }}
      />
      <AppText
        variant="subtitle"
        tone={tone === 'included' ? 'default' : 'muted'}
        style={{ flex: 1 }}
      >
        {text}
      </AppText>
    </View>
  );
}

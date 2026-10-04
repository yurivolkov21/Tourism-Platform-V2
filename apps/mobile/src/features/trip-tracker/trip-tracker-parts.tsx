import Feather from '@expo/vector-icons/Feather';
import { AppText, type FeatherIconName, useTheme } from '@tourism/mobile-ui';
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
        fontFamily: theme.fonts.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </AppText>
  );
}

/** ".count" — khung thẻ bọc khối đếm ngược/tiến trình (P1/P2/P5). */
export function TripCountCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 3,
        padding: theme.spacing(4),
      }}
    >
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
  /** Hàng cuối không vẽ gạch dưới (mockup `border-bottom:none`). */
  last?: boolean;
}

/** ".row-link" — hàng icon-vuông + hai dòng chữ + chevron, điều hướng tiếp. */
export function RowLink({ icon, label, caption, onPress, last = false }: RowLinkProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        paddingVertical: theme.spacing(3),
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: theme.spacing(10),
          height: theme.spacing(10),
          borderRadius: theme.radius.base * 2,
          backgroundColor: theme.colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={20} color={theme.colors['primary-emphasis']} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {caption}
        </AppText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors['muted-foreground']} />
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
      <Feather
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

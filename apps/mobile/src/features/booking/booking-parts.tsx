import Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppText,
  Button,
  type ButtonProps,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Mảnh dùng chung giữa các màn đặt tour (B1/B3/B4, mockup P5b-3) — tách ra vì
 * cả ba đều lặp lại đúng ba khối này: dải bước, thẻ chuyến, thanh đáy tổng
 * tiền + nút chính.
 */

export interface BookingStepProgressProps {
  /** 1-based — B1/B2 = 1, B3 = 2, B4 = 3. */
  step: number;
  total: number;
  label: string;
}

/** ".progress" — dải chấm bước, chấm đã qua VÀ chấm hiện tại đều tô đậm. */
export function BookingStepProgress({ step, total, label }: BookingStepProgressProps) {
  const theme = useTheme();

  return (
    <View>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: theme.spacing(1.5), marginTop: theme.spacing(2) }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: mảng tĩnh, không bao giờ chèn/xoá giữa chừng.
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              backgroundColor: index < step ? theme.colors['primary-emphasis'] : theme.colors.muted,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export interface BookingTripCardProps {
  imageUrl: string | null;
  title: string;
  dateRangeLabel: string;
  /** Vắng cả hai (T4/T5/T8, chi tiết booking) thì không vẽ link "Edit" —
   *  booking đã tạo xong rồi thì không còn gì để sửa ở bước đặt chỗ. */
  editLabel?: string;
  onEdit?: () => void;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * ".trip-card" — khối THẺ RIÊNG (viền + bo góc + nền `card`, mockup: `padding:
 * 12px; border:1px solid var(--border); border-radius: r*3; background:
 * var(--card)`), KHÔNG phải hàng trần trên nền màn — bỏ sót lớp thẻ này là
 * lệch mockup rõ nhất (B1/B4).
 */
export function BookingTripCard({
  imageUrl,
  title,
  dateRangeLabel,
  editLabel,
  onEdit,
  transformUrl,
}: BookingTripCardProps) {
  const theme = useTheme();
  const thumbSize = theme.spacing(18);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing(3),
        padding: theme.spacing(3),
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 3,
        backgroundColor: theme.colors.card,
      }}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: theme.radius.base * 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        {imageUrl === null ? null : (
          <AppImage
            source={imageUrl}
            width={thumbSize}
            height={thumbSize}
            alt=""
            transformUrl={transformUrl}
            fill
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="label" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(1) }}>
          {dateRangeLabel}
        </AppText>
        {editLabel === undefined || onEdit === undefined ? null : (
          <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={theme.spacing(2)}>
            <AppText variant="caption" tone="link" style={{ marginTop: theme.spacing(1) }}>
              {editLabel}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export interface BookingBottomBarProps {
  totalLabel: string;
  totalAmount: string;
  ctaLabel: string;
  onPress: () => void;
  ctaDisabled?: boolean;
  ctaVariant?: ButtonProps['variant'];
}

/**
 * ".bottom-bar" — khối "N travellers × giá / Total" bên trái, nút chính bên
 * phải. LUÔN đặt làm SIBLING của `ScrollView` nội dung (không phải phần tử
 * cuộn được, khuôn `tour-detail-screen.tsx` dòng ~1205: nền `card`, viền trên,
 * đệm riêng) — nhét vào trong nội dung cuộn thì mất nền/viền tách bạch với
 * mockup VÀ trôi mất khỏi màn khi nội dung dài hơn viewport.
 *
 * Vùng an toàn đáy TỰ đọc `useSafeAreaInsets()` ở ĐÂY (không nhờ `Screen`,
 * màn gọi component này phải để `edges={[]}`) — mockup `.bottom-bar` có
 * `padding: spacing(4) spacing(6) inset-bottom` (đo `getComputedStyle`: 16px
 * 24px 34px) và nền `card` tràn hết xuống đó. Để `Screen` lo vùng an toàn thì
 * phần đệm đó mang màu `background` của khung ngoài chứ không phải `card` của
 * thanh — ra một vệt màu lệch ngay phía trên vạch cử chỉ.
 *
 * `paddingBottom` lấy CẬN DƯỚI `spacing(3)` thay vì đúng y `insets.bottom`:
 * mockup đo trên máy tham chiếu có `inset-bottom` 34px (luôn > 0); máy Android
 * không có vạch cử chỉ thì `insets.bottom = 0`, và bám sát tuyệt đối mockup sẽ
 * làm nút dính thẳng mép màn trên máy đó.
 */
export function BookingBottomBar({
  totalLabel,
  totalAmount,
  ctaLabel,
  onPress,
  ctaDisabled = false,
  ctaVariant,
}: BookingBottomBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(4),
        paddingHorizontal: theme.spacing(6),
        paddingTop: theme.spacing(4),
        paddingBottom: Math.max(insets.bottom, theme.spacing(3)),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.card,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="caption" tone="muted">
          {totalLabel}
        </AppText>
        <AppText variant="title">{totalAmount}</AppText>
      </View>
      {/* mockup: nút chính `min-width:150-160px` — Button không nhận `style` nên
          bọc một View, mặc định `alignItems:'stretch'` của View kéo nó rộng
          bằng `minWidth` này thay vì co theo đúng độ dài chữ "Continue"/"Pay". */}
      <View style={{ minWidth: theme.spacing(38) }}>
        <Button
          label={ctaLabel}
          onPress={onPress}
          disabled={ctaDisabled}
          variant={ctaVariant}
          shape="pill"
        />
      </View>
    </View>
  );
}

export interface BookingFloatNoteProps {
  message: string;
  /** Chiều cao ĐÃ ĐO của `BookingBottomBar` (từ `onLayout` của màn gọi) —
   *  dải nhắc neo NGAY TRÊN thanh đáy, không phải một hằng số đoán chừng. */
  barHeight: number;
  /** B9 — đường đi tiếp tuỳ mã lỗi ("Choose another date"). `undefined` = B2
   *  (chạm trần), chỉ một dòng, không có link. */
  action?: { label: string; onPress: () => void };
}

/**
 * ".float-note" (B2/B9) — dải nhắc/lỗi NỔI ngay trên thanh đáy, không nằm
 * trong dòng chảy nội dung cuộn. Mockup neo `bottom: 76 + insets.bottom +
 * spacing(3)`; ở đây thay 76+inset bằng `barHeight` đo thật vì padding đáy
 * của `BookingBottomBar` đã tự cộng `insets.bottom` (đo được luôn phần đó).
 *
 * Màu: đo `getComputedStyle` trực tiếp trên mockup (`.note.warn`) ra nền
 * `warning` pha 16% + chữ/icon màu `foreground` — KHÔNG phải khối vàng đặc,
 * và icon KHÔNG tô màu warning (khác huy hiệu "Almost full").
 */
export function BookingFloatNote({ message, barHeight, action }: BookingFloatNoteProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        left: theme.spacing(6),
        right: theme.spacing(6),
        bottom: barHeight + theme.spacing(3),
        flexDirection: 'row',
        gap: theme.spacing(2.5),
        alignItems: action === undefined ? 'center' : 'flex-start',
        padding: theme.spacing(3.5),
        borderRadius: theme.radius.base * 2,
        backgroundColor: withAlpha(theme.colors.warning, 0.16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <Feather
        name="alert-circle"
        size={18}
        color={theme.colors.foreground}
        style={action === undefined ? undefined : { marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <AppText variant="subtitle">{message}</AppText>
        {action === undefined ? null : (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={theme.spacing(2)}>
            <AppText variant="caption" tone="link" style={{ marginTop: theme.spacing(0.5) }}>
              {action.label}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

import Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppText,
  Button,
  type ButtonVariant,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Một hàng mã/nhãn — khuôn `.kv` của mockup. Hàng cuối (Total paid) KHÔNG có
 *  gạch dưới — khép khối bằng chính biên dưới của danh sách, không phải một
 *  đường kẻ thừa (soi lại ảnh mẫu 01/10). */
function KvRow({
  label,
  value,
  emphasis = false,
  isLast = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  isLast?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing(2.5),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      {/* Mockup: hàng thường dùng `.t-subtitle.muted` cho nhãn; hàng Total paid
       *  đổi hẳn sang `.t-label` (không muted) — ĐÚNG class `label`/`subtitle`
       *  AppText đã có sẵn, không cần tự chế style (soi lại ảnh mẫu 01/10). */}
      <AppText variant={emphasis ? 'label' : 'subtitle'} tone={emphasis ? 'default' : 'muted'}>
        {label}
      </AppText>
      {/* Giá trị nhấn mạnh dùng `.t-title` — serif Literata, cùng khuôn số
       *  tiền mọi nơi khác trong app (giá tour, tổng đơn), KHÔNG phải Archivo
       *  đậm tự chế. */}
      <AppText variant={emphasis ? 'title' : 'label'}>{value}</AppText>
    </View>
  );
}

/**
 * ".trip-card" compact riêng cho màn chi tiết booking (T4/T5/T8) — KHÔNG dùng
 * chung `BookingTripCard` của `booking-parts.tsx`: component đó đã khớp pixel
 * với khung B1/B4 của wizard đặt tour (thumbnail 72dp theo mockup đo được),
 * còn khung chi tiết booking (mockup riêng, soi lại 01/10) dùng thumbnail nhỏ
 * hơn nhiều. Đổi kích thước `BookingTripCard` sẽ làm lệch mockup của B1/B4.
 */
function CompactTripCard({
  imageUrl,
  title,
  dateRangeLabel,
  pillLabel,
  pillTone,
  transformUrl,
}: {
  imageUrl: string | null;
  title: string;
  dateRangeLabel: string;
  pillLabel: string;
  pillTone: BookingDetailPill;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();
  const thumbSize = theme.spacing(20);

  return (
    <View
      style={{
        flexDirection: 'row',
        // `flex-start`, KHÔNG `center` — ảnh phải ngang đỉnh với badge Paid
        // (phản hồi 01/10), không canh giữa theo chiều cao cả khối chữ.
        alignItems: 'flex-start',
        gap: theme.spacing(3),
        padding: theme.spacing(3),
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 2,
        backgroundColor: theme.colors.card,
      }}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: theme.radius.base * 1.5,
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
        <StatusPill label={pillLabel} tone={pillTone} />
        <AppText variant="heading" numberOfLines={2} style={{ marginTop: theme.spacing(1) }}>
          {title}
        </AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(1) }}>
          {dateRangeLabel}
        </AppText>
      </View>
    </View>
  );
}

/** Khối nổi bật màu nền (mockup `.note.good`/`.note.warn`) — icon + tiêu đề +
 *  câu phụ, dùng cho hạn huỷ (T4), payment chưa xong (T5), đã hoàn tiền (T8). */
function Note({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'success' | 'warning';
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing(2),
        padding: theme.spacing(2.5),
        borderRadius: theme.radius.base * 1.5,
        backgroundColor: withAlpha(theme.colors[tone], 0.16),
        marginTop: theme.spacing(3),
      }}
    >
      {/* Icon "shield" của mockup là PHIÊN BẢN GHÉP (khiên + dấu tick trong lòng
       *  — path riêng, khác icon "shield" trần của lucide, xem
       *  `mobile-booking-screens.src.html` định nghĩa icon tuỳ biến `shield`).
       *  Feather chỉ có khiên trơn, không có "shield-check" — ghép thêm
       *  `check` đè giữa thay vì đổi sang bộ icon khác chỉ cho một chỗ. */}
      {icon === 'shield' ? (
        <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Feather
            name="shield"
            size={16}
            color={theme.colors.foreground}
            style={{ position: 'absolute' }}
          />
          <Feather name="check" size={8} color={theme.colors.foreground} />
        </View>
      ) : (
        <Feather name={icon} size={16} color={theme.colors.foreground} />
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="caption" style={{ fontFamily: theme.fonts.semibold }}>
          {title}
        </AppText>
        {body === undefined ? null : (
          <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(0.5) }}>
            {body}
          </AppText>
        )}
      </View>
    </View>
  );
}

export type BookingDetailPill = 'paid' | 'pending' | 'muted';

const PILL_TONE: Record<
  BookingDetailPill,
  { bg: 'success' | 'warning' | 'muted'; fg: 'success' | 'foreground' | 'muted-foreground' }
> = {
  paid: { bg: 'success', fg: 'success' },
  pending: { bg: 'warning', fg: 'foreground' },
  muted: { bg: 'muted', fg: 'muted-foreground' },
};

function StatusPill({ label, tone }: { label: string; tone: BookingDetailPill }) {
  const theme = useTheme();
  const t = PILL_TONE[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing(2),
        paddingVertical: theme.spacing(0.75),
        borderRadius: 999,
        backgroundColor: withAlpha(theme.colors[t.bg], 0.16),
      }}
    >
      <AppText
        variant="caption"
        style={{ color: theme.colors[t.fg], fontFamily: theme.fonts.semibold }}
      >
        {label}
      </AppText>
    </View>
  );
}

export interface BookingDetailTrip {
  imageUrl: string | null;
  title: string;
  dateRangeLabel: string;
}

export interface BookingDetailRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface BookingDetailScreenProps {
  trip: BookingDetailTrip;
  pillLabel: string;
  pillTone: BookingDetailPill;
  /** Khối nổi bật ngay dưới thẻ chuyến — `null` khi không có gì để nói (hiếm). */
  note: {
    tone: 'success' | 'warning';
    icon: keyof typeof Feather.glyphMap;
    title: string;
    body?: string;
  } | null;
  rows: BookingDetailRow[];
  /** Nút chính dưới đáy — `null` khi không có hành động nào (terminal, T8 giữ
   *  "Browse tours" nên đây hiếm khi null, nhưng khung chừa sẵn). */
  primaryAction: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant?: ButtonVariant;
  } | null;
  /** Nút phụ (viền) — "Cancel booking"/"Cancel this booking". */
  secondaryAction: { label: string; onPress: () => void; disabled?: boolean } | null;
  /** Dòng "Questions about this trip? Contact us" (chỉ T4). */
  contactLine?: { prompt: string; actionLabel: string; onPress: () => void };
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Chi tiết booking (T4/T5/T8, W4) — MỘT khung dùng chung cho cả bốn trạng
 * thái cuối (`bookingDetailKind`), route quyết nội dung đổ vào các slot
 * (`note`/`rows`/hai nút) qua logic thuần `booking-detail.ts`. Không
 * if/else theo status trong component này — cùng nguyên tắc `BookingActions`
 * bên web (chỉ render theo view, không tự quyết).
 */
export function BookingDetailScreen({
  trip,
  pillLabel,
  pillTone,
  note,
  rows,
  primaryAction,
  secondaryAction,
  contactLine,
  transformUrl,
}: BookingDetailScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false} scrollable={false}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(5) }}>
        <CompactTripCard
          imageUrl={trip.imageUrl}
          title={trip.title}
          dateRangeLabel={trip.dateRangeLabel}
          pillLabel={pillLabel}
          pillTone={pillTone}
          transformUrl={transformUrl}
        />

        {note === null ? null : (
          <Note tone={note.tone} icon={note.icon} title={note.title} body={note.body} />
        )}

        <View style={{ marginTop: theme.spacing(2.5) }}>
          {rows.map((row, index) => (
            <KvRow
              key={row.label}
              label={row.label}
              value={row.value}
              emphasis={row.emphasis}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      {primaryAction === null && secondaryAction === null ? null : (
        <View
          style={{
            gap: theme.spacing(4),
            paddingHorizontal: theme.spacing(5),
            paddingTop: theme.spacing(8),
            paddingBottom: Math.max(insets.bottom, theme.spacing(8)),
            backgroundColor: theme.colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
          }}
        >
          {primaryAction === null ? null : (
            <Button
              shape="pill"
              label={primaryAction.label}
              onPress={primaryAction.onPress}
              disabled={primaryAction.disabled}
              variant={primaryAction.variant}
            />
          )}
          {secondaryAction === null ? null : (
            <Button
              shape="pill"
              variant="ghost"
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              disabled={secondaryAction.disabled}
            />
          )}
          {contactLine === undefined ? null : (
            // `Text` lồng `Text` để trôi đúng dòng (baseline canh theo chữ) —
            // `Pressable` (View) lồng trong `Text` trước đó làm "Contact us"
            // lệch dòng so với câu trước nó (phản hồi 01/10).
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              {contactLine.prompt}{' '}
              <AppText
                variant="caption"
                tone="link"
                accessibilityRole="button"
                onPress={contactLine.onPress}
              >
                {contactLine.actionLabel}
              </AppText>
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}

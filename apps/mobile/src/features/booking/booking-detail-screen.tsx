import type Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppRefreshControl,
  AppText,
  Button,
  type ButtonVariant,
  Icon,
  ListGroup,
  ListRow,
  PopIn,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Một hàng mã/nhãn của danh sách thẻ rời (C6, N6): mỗi hàng là một thẻ nền `card`, cách
 *  nhau 2dp; hàng đầu bo trên 20, hàng cuối bo dưới 20, còn lại bo 4. */
function KvRow({
  label,
  value,
  emphasis = false,
  isFirst = false,
  isLast = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const top = isFirst ? 20 : 4;
  const bottom = isLast ? 20 : 4;
  return (
    <View
      testID="booking-kv-row"
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
      <AppText variant={emphasis ? 'label' : 'body'} tone={emphasis ? 'default' : 'muted'}>
        {label}
      </AppText>
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
        <PopIn delay={150} style={{ alignSelf: 'flex-start' }}>
          <StatusPill label={pillLabel} tone={pillTone} />
        </PopIn>
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
          <Icon
            name="shield"
            size={16}
            color={theme.colors.foreground}
            style={{ position: 'absolute' }}
          />
          <Icon name="check" size={8} color={theme.colors.foreground} />
        </View>
      ) : (
        <Icon name={icon} size={16} color={theme.colors.foreground} />
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="caption" style={{ fontWeight: theme.weight.semibold }}>
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

/**
 * Khối nguyên văn lý do công ty huỷ chuyến (ADR-0041 AMEND 2) — ĐÚNG câu khách đã nhận ở khối
 * "WHY" của email báo huỷ, cùng dáng khối "Why" trên trang đơn của web (nền muted mờ, viền mảnh):
 * nhãn nhỏ rồi chữ admin gõ. Chữ tự do tới 500 ký tự nên đứng riêng dưới khối nổi bật, không nhét
 * vào cột chữ hẹp cạnh icon của `Note`.
 */
function ReasonQuote({ label, text }: { label: string; text: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing(1),
        padding: theme.spacing(2.5),
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 1.5,
        backgroundColor: withAlpha(theme.colors.muted, 0.4),
        marginTop: theme.spacing(2),
      }}
    >
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="subtitle">{text}</AppText>
    </View>
  );
}

export type BookingDetailPill = 'paid' | 'pending' | 'muted';

/** Chữ "Paid" dùng token vai mực `success-emphasis` (G47, ADR-0019 AMEND 4): `success` trần
 *  trên lớp tô 16% của chính nó chỉ 2,83:1 ở theme sáng. Lớp tô giữ token bề mặt. */
const PILL_TONE: Record<
  BookingDetailPill,
  {
    bg: 'success' | 'warning' | 'muted';
    fg: 'success-emphasis' | 'foreground' | 'muted-foreground';
  }
> = {
  paid: { bg: 'success', fg: 'success-emphasis' },
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
        style={{ color: theme.colors[t.fg], fontWeight: theme.weight.semibold }}
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
  /** Kéo xuống để làm mới — route giữ trạng thái và gọi refetch; vắng thì không có. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
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
  /** Nguyên văn lý do công ty huỷ chuyến, ngay dưới khối nổi bật (ADR-0041 AMEND 2) — chỉ khung
   *  `departureCancelled` có, và chỉ khi admin đã gõ lý do. */
  reason?: { label: string; text: string };
  rows: BookingDetailRow[];
  /** Nút chính dưới đáy — `null` khi không có hành động nào (terminal, T8 giữ
   *  "Browse tours" nên đây hiếm khi null, nhưng khung chừa sẵn). */
  primaryAction: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant?: ButtonVariant;
  } | null;
  /** Hàng chữ đỏ ở khối riêng cuối nội dung cuộn (C6) — "Cancel this booking". */
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
  refresh,
  trip,
  pillLabel,
  pillTone,
  note,
  reason,
  rows,
  primaryAction,
  secondaryAction,
  contactLine,
  transformUrl,
}: BookingDetailScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen
      edges={SCREEN_EDGES_UNDER_HEADER}
      padded={false}
      scrollable={false}
      style={{ backgroundColor: theme.surfaces.grouped }}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing(5) }}
        style={{ flex: 1 }}
        refreshControl={refresh === undefined ? undefined : <AppRefreshControl {...refresh} />}
      >
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

        {reason === undefined ? null : <ReasonQuote label={reason.label} text={reason.text} />}

        <View style={{ marginTop: theme.spacing(4), gap: 2 }}>
          {rows.map((row, index) => (
            <KvRow
              key={row.label}
              label={row.label}
              value={row.value}
              emphasis={row.emphasis}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>

        {/* C6 — "Contact us" là một hàng có icon thay cho link nằm trong câu. */}
        {contactLine === undefined ? null : (
          <View style={{ marginTop: theme.spacing(5) }}>
            <ListGroup>
              <ListRow
                icon="message-square"
                title={contactLine.actionLabel}
                subtitle={contactLine.prompt}
                onPress={contactLine.onPress}
              />
            </ListGroup>
          </View>
        )}
        {secondaryAction === null ? null : (
          <View style={{ marginTop: theme.spacing(5) }}>
            <ListGroup>
              <ListRow
                title={secondaryAction.label}
                destructive
                onPress={secondaryAction.disabled ? undefined : secondaryAction.onPress}
              />
            </ListGroup>
          </View>
        )}
      </ScrollView>

      {primaryAction === null ? null : (
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
          <Button
            shape="pill"
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
            variant={primaryAction.variant}
          />
        </View>
      )}
    </Screen>
  );
}

import {
  AppImage,
  AppText,
  type FeatherIconName,
  Icon,
  Presence,
  PressableScale,
  useTheme,
} from '@tourism/mobile-ui';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

/**
 * Các khối nội dung web có mà tab Overview mobile từng thiếu (rà web → mobile 01/11): dải lộ
 * trình, cam kết cạnh nút đặt, điểm nổi bật, "Good to know" (gồm/không gồm, chính sách, FAQ) và
 * tour liên quan. Tách khỏi `tour-detail-screen.tsx` để màn đó khỏi phình; chỉ vẽ, dữ liệu do
 * route dựng sẵn.
 */

/**
 * Dải lộ trình dưới tên tour — bản mobile của `route-ribbon.tsx` web: chấm nối bằng gạch, tên dưới
 * mỗi chấm. Gạch rộng CỐ ĐỊNH (như web): chia đều khoảng trống là ngụ ý các chặng cách đều nhau.
 * Một địa danh thì không vẽ sơ đồ (một chấm đơn độc trông như lỗi) — chỉ ghim + tên.
 */
export function RouteRibbon({ stops }: { stops: readonly string[] }) {
  const theme = useTheme();
  const first = stops[0];
  if (first === undefined) return null;
  if (stops.length === 1) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
        <Icon name="map-pin" size={12} color={theme.colors['muted-foreground']} />
        <AppText variant="caption" tone="muted">
          {first}
        </AppText>
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {stops.map((stop, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: chặng tĩnh, tên có thể trùng.
        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {index === 0 ? null : (
            <View
              style={{ width: 28, height: 1, marginTop: 4.5, backgroundColor: theme.colors.border }}
            />
          )}
          <View style={{ alignItems: 'center', gap: theme.spacing(1), paddingHorizontal: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: index === 0 ? theme.colors['primary-emphasis'] : 'transparent',
                borderWidth: 1.5,
                borderColor: theme.colors['primary-emphasis'],
              }}
            />
            <AppText
              variant="caption"
              tone="muted"
              style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
            >
              {stop}
            </AppText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <AppText variant="heading">{children}</AppText>;
}

/** Cam kết ngắn (huỷ miễn phí, chính sách theo loại) — như hàng `.trust` cạnh nút đặt của web. */
export function TrustList({
  items,
}: {
  items: readonly { icon: FeatherIconName; label: string }[];
}) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing(2) }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2.5) }}
        >
          <Icon name={item.icon} size={16} color={theme.colors['primary-emphasis']} />
          <AppText variant="label" style={{ flex: 1 }}>
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function Highlights({ title, items }: { title: string; items: readonly string[] }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing(2.5) }}>
      <SectionTitle>{title}</SectionTitle>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh do admin nhập, có thể trùng chữ.
        <View key={index} style={{ flexDirection: 'row', gap: theme.spacing(2.5) }}>
          <Icon
            name="check-circle"
            size={16}
            color={theme.colors['primary-emphasis']}
            style={{ marginTop: 2 }}
          />
          <AppText variant="subtitle" style={{ flex: 1 }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export interface GoodToKnowRow {
  id: string;
  icon: FeatherIconName;
  title: string;
  /** Danh sách gạch đầu dòng (gồm / không gồm). */
  bullets?: { icon: FeatherIconName; items: readonly string[] };
  /** Các đoạn chữ (chính sách: tiêu đề nhỏ + nội dung; FAQ: câu trả lời). */
  paragraphs?: readonly { heading?: string | null; text: string }[];
}

/**
 * Khối "Good to know": các dòng xổ được trong một khung thẻ. Gom gồm/không gồm, chính sách và FAQ
 * vào Overview thay vì thêm tab thứ năm như web (user 01/11: "gộp vào Overview cho gọn").
 */
export function GoodToKnow({
  title,
  rows,
  faqTitle,
  faqs,
  showAllFaqsLabel,
  faqPreviewCount = 3,
}: {
  title: string;
  rows: readonly GoodToKnowRow[];
  faqTitle: string;
  faqs: readonly GoodToKnowRow[];
  showAllFaqsLabel: (n: number) => string;
  faqPreviewCount?: number;
}) {
  const theme = useTheme();
  const [allFaqs, setAllFaqs] = useState(false);
  if (rows.length === 0 && faqs.length === 0) return null;
  const shownFaqs = allFaqs ? faqs : faqs.slice(0, faqPreviewCount);
  return (
    <View style={{ gap: theme.spacing(2.5) }}>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? null : <AccordionGroup rows={rows} />}
      {faqs.length === 0 ? null : (
        <>
          <AppText variant="label" tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
            {faqTitle}
          </AppText>
          <AccordionGroup rows={shownFaqs} />
          {allFaqs || faqs.length <= faqPreviewCount ? null : (
            <AppText
              variant="label"
              tone="link"
              accessibilityRole="button"
              onPress={() => setAllFaqs(true)}
              style={{ alignSelf: 'flex-start', paddingVertical: theme.spacing(1) }}
            >
              {showAllFaqsLabel(faqs.length)}
            </AppText>
          )}
        </>
      )}
    </View>
  );
}

function AccordionGroup({ rows }: { rows: readonly GoodToKnowRow[] }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 2,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => (
        <Fragment key={row.id}>
          {index === 0 ? null : (
            <View
              style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }}
            />
          )}
          <AccordionRow row={row} />
        </Fragment>
      ))}
    </View>
  );
}

function AccordionRow({ row }: { row: GoodToKnowRow }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <Reanimated.View layout={reduceMotion ? undefined : LinearTransition.duration(200)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(3),
          paddingHorizontal: theme.spacing(3.5),
          paddingVertical: theme.spacing(3),
        }}
      >
        <Icon name={row.icon} size={18} color={theme.colors['primary-emphasis']} />
        <AppText variant="label" style={{ flex: 1 }}>
          {row.title}
        </AppText>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors['muted-foreground']}
        />
      </Pressable>
      <Presence show={open} distance={-6}>
        <View
          style={{
            gap: theme.spacing(2),
            paddingHorizontal: theme.spacing(3.5),
            paddingBottom: theme.spacing(3.5),
            // Canh chữ thẳng hàng tiêu đề (bỏ qua cột icon 18 + khoảng cách).
            paddingLeft: theme.spacing(3.5) + 18 + theme.spacing(3),
          }}
        >
          {row.bullets?.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: danh sách tĩnh do admin nhập, có thể trùng chữ.
            <View key={index} style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
              <Icon
                name={row.bullets?.icon ?? 'check'}
                size={14}
                color={theme.colors['muted-foreground']}
                style={{ marginTop: 3 }}
              />
              <AppText variant="subtitle" tone="muted" style={{ flex: 1 }}>
                {item}
              </AppText>
            </View>
          ))}
          {row.paragraphs?.map((paragraph, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: đoạn tĩnh, thứ tự cố định trong một lần vẽ.
            <View key={index} style={{ gap: 2 }}>
              {paragraph.heading ? <AppText variant="label">{paragraph.heading}</AppText> : null}
              <AppText variant="subtitle" tone="muted">
                {paragraph.text}
              </AppText>
            </View>
          ))}
        </View>
      </Presence>
    </Reanimated.View>
  );
}

export interface RelatedTourVM {
  slug: string;
  title: string;
  imageUrl: string | null;
  durationLabel: string;
  priceLabel: string;
}

/** "You might also like" — dải thẻ cuộn ngang cuối Overview (web: 3 thẻ dưới trang tour). */
export function RelatedToursRail({
  title,
  tours,
  onPress,
  transformUrl,
}: {
  title: string;
  tours: readonly RelatedTourVM[];
  onPress: (slug: string) => void;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();
  if (tours.length === 0) return null;
  const cardWidth = 200;
  return (
    <View style={{ gap: theme.spacing(2.5) }}>
      <SectionTitle>{title}</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Tràn ra mép màn (Overview có đệm ngang spacing(4)) để thẻ cuối lộ một phần, báo còn nữa.
        style={{ marginHorizontal: -theme.spacing(4) }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}
      >
        {tours.map((tour) => (
          <PressableScale
            key={tour.slug}
            accessibilityRole="button"
            accessibilityLabel={tour.title}
            onPress={() => onPress(tour.slug)}
            containerStyle={{ width: cardWidth }}
          >
            <View
              style={{
                height: 120,
                borderRadius: theme.radius.base * 2,
                overflow: 'hidden',
                backgroundColor: theme.colors.muted,
              }}
            >
              {tour.imageUrl === null ? null : (
                <AppImage
                  source={tour.imageUrl}
                  width={cardWidth}
                  alt={tour.title}
                  transformUrl={transformUrl}
                  fill
                />
              )}
            </View>
            <AppText variant="label" numberOfLines={2} style={{ marginTop: theme.spacing(2) }}>
              {tour.title}
            </AppText>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: theme.spacing(1),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
                <Icon name="clock" size={12} color={theme.colors['muted-foreground']} />
                <AppText variant="caption" tone="muted">
                  {tour.durationLabel}
                </AppText>
              </View>
              <AppText variant="label">{tour.priceLabel}</AppText>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

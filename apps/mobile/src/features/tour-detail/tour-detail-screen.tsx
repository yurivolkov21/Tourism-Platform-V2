import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppImage,
  AppText,
  Button,
  Chip,
  EmptyState,
  IconButton,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGateSheet } from '@/features/auth/auth-gate-sheet';
import type { AskAboutDateErrors, AskAboutDateField, AskAboutDateState } from './ask-about-date';
import { AskAboutDateSheet } from './ask-about-date-sheet';
import type { ItineraryLine } from './itinerary';
import { PhotoViewer, type TourDetailPhoto } from './photo-viewer';
import { reviewBreakdownPercent } from './reviews';

export type TourDetailStatus = 'loading' | 'error' | 'notFound' | 'content';
export type TourDetailTab = 'overview' | 'itinerary' | 'dates' | 'reviews';

export interface TourDetailItineraryDay {
  dayNumber: number;
  title: string;
  lines: readonly ItineraryLine[];
}

export interface TourDetailFact {
  icon: 'clock' | 'users' | 'activity' | 'smile';
  label: string;
  value: string;
}

export interface TourDetailDepartureRow {
  id: string;
  rangeLabel: string;
  seatsLabel: string;
  priceLabel: string;
  /** `null` khi đợt không có giá gạch (không giảm giá). */
  compareAtPriceLabel: string | null;
  bookable: boolean;
  almostFull: boolean;
  /** "Free cancellation until Sat 26 Sep" của RIÊNG đợt này — đáy màn đọc từ
      đợt đang chọn, không phải câu luật chung `cancellationBanner`. */
  cancellationCaption: string;
}

export interface TourDetailDepartureGroup {
  monthLabel: string;
  rows: readonly TourDetailDepartureRow[];
}

export type TourDetailReviewSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export interface TourDetailReview {
  id: string;
  initials: string;
  authorLabel: string;
  dateLabel: string;
  rating: number;
  ratingLabel: string;
  /** `null` — không phải mọi review có tiêu đề. */
  title: string | null;
  body: string;
  photos: readonly TourDetailPhoto[];
}

export interface TourDetailScreenProps {
  status: TourDetailStatus;
  onBack: () => void;
  backLabel: string;
  onRetry: () => void;
  errorTitle: string;
  retryLabel: string;
  notFoundTitle: string;
  goBackLabel: string;
  exploreOtherLabel: string;
  onExploreOther: () => void;

  /** Đã lọc/sắp sẵn (`tourGallery()`) — ảnh đầu là ảnh bìa mặc định. Rỗng hợp lệ. */
  galleryImages: readonly { url: string; alt: string }[];
  /** Cùng bộ ảnh với `galleryImages`, CÙNG THỨ TỰ — thêm `creditLine` cho D5
      (trình xem toàn màn). Tách prop riêng thay vì thêm field vào
      `galleryImages` để không phải sửa mọi chỗ đã dùng field cũ. */
  galleryPhotos: readonly TourDetailPhoto[];
  /** Ảnh chưa lọt 3 ô thumb — `Math.max(0, galleryImages.length - 3)`. */
  moreImagesCount: number;
  /** D5 — nhãn a11y nút "+N" mở trình xem toàn màn. */
  openGalleryLabel: string;
  title: string;
  /** `null` = chưa ai đánh giá (`ratingAvg` của contract, KHÔNG phải 0 điểm). */
  rating: number | null;
  /** Đã format sẵn (`tourDetail.reviewCount`), vd "3 reviews" — chỉ đọc khi `rating !== null`. */
  reviewCountLabel: string;
  notRatedLabel: string;
  /** Tên các địa danh nối bằng " · ", đã ghép sẵn. */
  destinationsLine: string;
  summary: string | null;
  /** Chỉ chứa fact CÓ dữ liệu — route lọc trước (difficulty/suitableFor có thể rỗng). */
  facts: readonly TourDetailFact[];
  fromLabel: string;
  priceLabel: string;
  perPersonLabel: string;
  chooseDateLabel: string;
  onChooseDate: () => void;
  favorited: boolean;
  favoriteLabel: string;
  onFavoritePress: () => void;
  /** D6 — tấm mời đăng nhập khi bấm tim lúc chưa có phiên. */
  authGateOpen: boolean;
  onCloseAuthGate: () => void;
  authGateTitle: string;
  authGateBody: string;
  signInLabel: string;
  createAccountLabel: string;
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** D6 — lỗi ngắn khi lưu/bỏ wishlist thất bại (đã lạc quan rồi trả lại
      trạng thái cũ ở route); `null` = không có gì để báo. Route tự hẹn giờ
      xoá, màn chỉ vẽ hoặc không vẽ theo giá trị hiện tại. */
  wishlistErrorLabel: string | null;

  activeTab: TourDetailTab;
  onChangeTab: (tab: TourDetailTab) => void;
  tabLabels: Record<TourDetailTab, string>;

  /** D2 — rỗng hợp lệ (tour chưa soạn lịch trình chi tiết). */
  itineraryDays: readonly TourDetailItineraryDay[];
  meetingPoint: string | null;
  meetingPointTitle: string;

  // D3 — tab Dates.
  /** Câu luật chung ("Free cancellation until N days before departure"), KHÁC
      `cancellationCaption` của từng đợt (đáy màn, đọc theo đợt đang chọn). */
  cancellationBanner: string;
  departureGroups: readonly TourDetailDepartureGroup[];
  noDeparturesLabel: string;
  selectedDepartureId: string | null;
  onSelectDeparture: (id: string) => void;
  bookingClosedLabel: string;
  almostFullLabel: string;
  askAboutDateLabel: string;
  onAskAboutDate: (departureId: string) => void;
  /** Tấm form D3 mở từ link trên (route quyết `askAboutDateSheetOpen`, đọc
      `tourId`/`travelDate` của đợt qua `onAskAboutDate` ở trên). */
  askAboutDateSheetOpen: boolean;
  onCloseAskAboutDateSheet: () => void;
  askAboutDateSheetTitle: string;
  askAboutDateSheetDescription: string;
  askAboutDateNameLabel: string;
  askAboutDateEmailLabel: string;
  askAboutDateMessageLabel: string;
  askAboutDateValues: AskAboutDateState;
  askAboutDateErrors: AskAboutDateErrors;
  onChangeAskAboutDate: (field: AskAboutDateField, value: string) => void;
  askAboutDateSubmitLabel: string;
  askAboutDateSubmittingLabel: string;
  askAboutDateSubmitting: boolean;
  onSubmitAskAboutDate: () => void;
  askAboutDateFormError: string | null;
  askAboutDateSent: boolean;
  askAboutDateSuccessTitle: string;
  askAboutDateSuccessBody: string;
  askAboutDateCloseLabel: string;
  bookCtaLabel: string;
  /** Chưa nối flow đặt chỗ thật (cụm P5b-3, cùng tình trạng `onFavoritePress` D6). */
  onBook: () => void;

  // D4 — tab Reviews. `rating`/`reviewCountLabel`/`notRatedLabel` dùng LẠI ba
  // prop đã có ở trên (hero) — cùng một con số, không khai trùng.
  reviewBreakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  reviewSort: TourDetailReviewSort;
  reviewSortLabels: Record<TourDetailReviewSort, string>;
  onChangeReviewSort: (sort: TourDetailReviewSort) => void;
  reviews: readonly TourDetailReview[];
  noReviewsTitle: string;
  noReviewsBody: string;
  /** Còn trang sau (server trả `page < totalPages`) — route tự gộp các trang đã tải. */
  hasMoreReviews: boolean;
  /** Đang tải trang kế — vô hiệu nút, tránh bấm chồng. */
  loadingMoreReviews: boolean;
  onLoadMoreReviews: () => void;
  loadMoreReviewsLabel: string;

  // D5 — trình xem ảnh toàn màn, mở từ ảnh bìa/thumb (D1) hoặc ảnh review (D4).
  closePhotosLabel: string;
  photoCounterFor: (index: number, total: number) => string;

  transformUrl?: (source: string, width: number) => string;
}

const TAB_ORDER: readonly TourDetailTab[] = ['overview', 'itinerary', 'dates', 'reviews'];
const HERO_HEIGHT = 420;

/** Chia mảng thành từng cặp liên tiếp — lưới 2 cột của `.facts` (D1). */
export function chunkPairs<T>(items: readonly T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2));
  return pairs;
}

/**
 * Chi tiết tour — bố cục bê từ bản vẽ 18/09 (D1/D2/D7 — ADR-0047 T5). Màn
 * STACK, không thanh tab. Ảnh bìa + tiêu đề + hàng tab, dưới là nội dung tab
 * đang chọn, đáy là thanh giá + CTA.
 *
 * Header gọn (lùi · tiêu đề một dòng · tim) hiện đè lên trên khi ảnh bìa cuộn
 * qua khỏi (phản hồi 24/09, đối chiếu bản vẽ D2).
 *
 * SIMPLIFICATION có chủ ý (chưa làm hết D1–D7): hàng tab KHÔNG dính khi cuộn —
 * thử `stickyHeaderIndices` của `ScrollView` thì hàng tab bị RN giãn full
 * chiều cao còn lại (bug thấy trên máy thật 24/09, không phải lỗi style ở
 * đây), nên bỏ, chỉ giữ header gọn. Muốn tab dính thật phải đo layout tay +
 * overlay riêng, chưa làm. Header gọn CHUYỂN TỨC THÌ, không mờ dần (lý do ở
 * khai báo `compactHeaderVisible`). "Ask about this date" (D3) mở
 * `AskAboutDateSheet` — route đọc `tourId`/`travelDate` của đợt đã bấm rồi
 * gửi `enquiries.create`.
 * Bấm ảnh bìa/thumb "+N" (D1) hoặc ảnh review (D4) mở `PhotoViewer` toàn màn
 * (D5) — component đó tự bỏ chụm-để-phóng-to (xem doc comment của nó). Bấm
 * tim (D1/D2 header gọn): chưa đăng nhập → `AuthGateSheet` (D6, route quyết
 * `authGateOpen`); đã đăng nhập → route tự lạc quan đổi `favorited` rồi gọi
 * `wishlist.set`, hỏng thì trả lại + `wishlistErrorLabel`. "Sign in"/"Create
 * account" của D6 điều hướng sang `/login`/`/register`, route tự ghi lại ý định
 * "quay lại đúng tour + tự lưu" qua `setPendingReturn` (P5b-4 mục 1c) trước khi
 * điều hướng — đăng nhập xong quay đúng tour, tim tự lưu nếu khách đã bấm.
 * Reviews (D4) phân trang bằng nút "Load more" —
 * route gộp các trang đã tải, `hasMoreReviews` tắt nút khi hết trang.
 */
export function TourDetailScreen({
  status,
  onBack,
  backLabel,
  onRetry,
  errorTitle,
  retryLabel,
  notFoundTitle,
  goBackLabel,
  exploreOtherLabel,
  onExploreOther,
  galleryImages,
  galleryPhotos,
  moreImagesCount,
  openGalleryLabel,
  title,
  rating,
  reviewCountLabel,
  notRatedLabel,
  destinationsLine,
  summary,
  facts,
  fromLabel,
  priceLabel,
  perPersonLabel,
  chooseDateLabel,
  onChooseDate,
  favorited,
  favoriteLabel,
  onFavoritePress,
  authGateOpen,
  onCloseAuthGate,
  authGateTitle,
  authGateBody,
  signInLabel,
  createAccountLabel,
  onSignIn,
  onCreateAccount,
  wishlistErrorLabel,
  activeTab,
  onChangeTab,
  tabLabels,
  itineraryDays,
  meetingPoint,
  meetingPointTitle,
  cancellationBanner,
  departureGroups,
  noDeparturesLabel,
  selectedDepartureId,
  onSelectDeparture,
  bookingClosedLabel,
  almostFullLabel,
  askAboutDateLabel,
  onAskAboutDate,
  askAboutDateSheetOpen,
  onCloseAskAboutDateSheet,
  askAboutDateSheetTitle,
  askAboutDateSheetDescription,
  askAboutDateNameLabel,
  askAboutDateEmailLabel,
  askAboutDateMessageLabel,
  askAboutDateValues,
  askAboutDateErrors,
  onChangeAskAboutDate,
  askAboutDateSubmitLabel,
  askAboutDateSubmittingLabel,
  askAboutDateSubmitting,
  onSubmitAskAboutDate,
  askAboutDateFormError,
  askAboutDateSent,
  askAboutDateSuccessTitle,
  askAboutDateSuccessBody,
  askAboutDateCloseLabel,
  bookCtaLabel,
  onBook,
  reviewBreakdown,
  reviewSort,
  reviewSortLabels,
  onChangeReviewSort,
  reviews,
  noReviewsTitle,
  noReviewsBody,
  hasMoreReviews,
  loadingMoreReviews,
  onLoadMoreReviews,
  loadMoreReviewsLabel,
  closePhotosLabel,
  photoCounterFor,
  transformUrl,
}: TourDetailScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Ảnh bìa đang xem — bấm một ô thumb đổi ảnh này (thuần UI hiển thị, không
  // chạm dữ liệu, cùng tiền lệ `readMoreOpen` của DestinationHeaderBlock).
  const [selectedIndex, setSelectedIndex] = useState(0);
  const heroImage = galleryImages[selectedIndex] ?? galleryImages[0] ?? null;
  // Ngày đầu mở sẵn (D2) — `null` gấp lại HẾT (bấm ngày đang mở để thu gọn).
  const [expandedDay, setExpandedDay] = useState<number | null>(
    itineraryDays[0]?.dayNumber ?? null,
  );
  // Header gọn (D2 bản vẽ 24/09): hiện khi ảnh bìa đã cuộn qua khỏi màn hình —
  // NGƯỠNG cố định thay vì đo layout thật (`onLayout`), vì hero có chiều cao
  // CỐ ĐỊNH `HERO_HEIGHT`, không phụ thuộc nội dung. Bật/tắt bằng state thay vì
  // animate opacity: opacity không gỡ node khỏi cây a11y, còn tiêu đề/nút lùi
  // trùng chữ với khối hero phía trên sẽ đụng `getByText`/`getByLabelText` đơn
  // của RNTL nếu cả hai cùng mount. Đánh đổi: chuyển trạng thái tức thì, không
  // mờ dần.
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  // Đợt đang chọn (D3) — tìm trong TẤT CẢ nhóm tháng, không riêng tab đang mở:
  // chọn ở tab Dates rồi qua tab Reviews thì đáy màn vẫn phải giữ "Book now".
  const selectedDeparture =
    departureGroups.flatMap((group) => group.rows).find((row) => row.id === selectedDepartureId) ??
    null;
  // D4 — mẫu số % thanh phân bố sao, tính MỘT LẦN thay vì lặp lại trong map.
  const reviewTotal = Object.values(reviewBreakdown).reduce((a, b) => a + b, 0);
  // D5 — bộ ảnh + vị trí đang mở trong trình xem toàn màn; `null` = đang đóng.
  // State THUẦN UI cục bộ (cùng tiền lệ `selectedIndex`/`expandedDay`), không
  // phải state route: route không cần biết đang xem ảnh nào.
  const [viewer, setViewer] = useState<{
    photos: readonly TourDetailPhoto[];
    initialIndex: number;
  } | null>(null);
  const openPhotoViewer = (photos: readonly TourDetailPhoto[], initialIndex: number) =>
    setViewer({ photos, initialIndex });

  if (status === 'loading') {
    // Không header (D1-D7 không có) — `edges:['bottom']` để khung xám bleed
    // hết mép trên, cùng cách trạng thái content xử lý vùng an toàn.
    return (
      <Screen edges={['bottom']} padded={false} scrollable={false}>
        <View style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.muted }} />
      </Screen>
    );
  }

  if (status === 'error' || status === 'notFound') {
    const isError = status === 'error';
    // Không header + không ảnh bìa ở đây — dùng edges mặc định (top+bottom)
    // để `Screen` tự cộng vùng an toàn đỉnh, nút lùi không chui dưới tai thỏ.
    return (
      <Screen scrollable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={{ alignSelf: 'flex-start', padding: theme.spacing(2) }}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
          <EmptyState
            icon={<SquareIcon name={isError ? 'wifi-off' : 'map'} />}
            title={isError ? errorTitle : notFoundTitle}
            surface={false}
          >
            <View style={{ gap: theme.spacing(3), alignItems: 'center' }}>
              <Button
                label={isError ? retryLabel : goBackLabel}
                onPress={isError ? onRetry : onBack}
                shape="pill"
              />
              {isError ? null : (
                <AppText
                  variant="label"
                  tone="link"
                  accessibilityRole="button"
                  onPress={onExploreOther}
                >
                  {exploreOtherLabel}
                </AppText>
              )}
            </View>
          </EmptyState>
        </View>
      </Screen>
    );
  }

  return (
    // `edges:['bottom']`: ảnh bìa bleed hết mép trên, tràn ra sau status bar
    // (đúng mockup) — nút lùi/tim tự cộng `insets.top` (như `AuthHero`) thay
    // vì để `Screen` đệm cả khối, cái sẽ để lại dải nền trống phía trên ảnh.
    <Screen edges={['bottom']} padded={false} scrollable={false}>
      <ScrollView
        testID="tour-detail-scroll"
        contentContainerStyle={{ paddingBottom: theme.spacing(24) }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const next = e.nativeEvent.contentOffset.y > HERO_HEIGHT - 140;
          setCompactHeaderVisible((prev) => (prev === next ? prev : next));
        }}
      >
        <View style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.muted }}>
          {heroImage === null ? null : (
            // D5 — bấm ảnh bìa mở trình xem toàn màn tại đúng ảnh đang xem
            // (`selectedIndex`). Nằm DƯỚI gradient/nút/thumb trong cây (render
            // trước) nên không tranh chạm với chúng — cùng tiền lệ các
            // `Pressable` thumb bên dưới đã nổi trên ảnh này từ trước.
            <Pressable
              testID="tour-detail-hero-image"
              accessibilityRole="button"
              accessibilityLabel={galleryPhotos[selectedIndex]?.alt ?? title}
              onPress={() => openPhotoViewer(galleryPhotos, selectedIndex)}
              style={StyleSheet.absoluteFill}
            >
              <AppImage
                key={heroImage.url}
                source={heroImage.url}
                width={780}
                alt={heroImage.alt}
                transformUrl={transformUrl}
                fill
              />
            </Pressable>
          )}
          {/* Mờ dần về màu nền (cùng kỹ thuật `AuthHero`) — tiêu đề/rating/vị
              trí neo ĐÁY ẢNH, không nằm dưới ảnh như một khối tách biệt. */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              withAlpha(theme.colors.scrim, 0.45),
              withAlpha(theme.colors.background, 0),
              withAlpha(theme.colors.background, 0.7),
              theme.colors.background,
            ]}
            locations={[0, 0.35, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: 'absolute',
              // Vùng an toàn đỉnh + nhịp thở — `Screen` không đệm phần này
              // (`edges:['bottom']`, ảnh bleed hết mép trên), cùng cách `AuthHero`.
              top: insets.top + theme.spacing(1.5),
              left: theme.spacing(3),
              right: theme.spacing(3),
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <IconButton
              icon="arrow-left"
              accessibilityLabel={backLabel}
              variant="glass"
              onPress={onBack}
            />
            <FavoriteButton favorited={favorited} label={favoriteLabel} onPress={onFavoritePress} />
          </View>

          {/* Dải thumb (`.thumbs` bản vẽ 18/09) — bấm đổi ảnh bìa đang xem.
              "+N" mở trình xem ảnh đầy đủ (D5), tại ảnh thứ 4 (đầu tiên
              chưa lọt 3 ô thumb). */}
          {galleryImages.length <= 1 ? null : (
            <View
              style={{
                position: 'absolute',
                top: 150,
                right: theme.spacing(4),
                gap: 10,
              }}
            >
              {galleryImages.slice(0, 3).map((image, index) => (
                <Pressable
                  key={image.url}
                  accessibilityRole="button"
                  accessibilityLabel={image.alt}
                  accessibilityState={{ selected: index === selectedIndex }}
                  onPress={() => setSelectedIndex(index)}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: index === selectedIndex ? theme.colors['on-media'] : 'transparent',
                  }}
                >
                  <AppImage
                    source={image.url}
                    width={52}
                    alt={image.alt}
                    transformUrl={transformUrl}
                    fill
                  />
                </Pressable>
              ))}
              {moreImagesCount <= 0 ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={openGalleryLabel}
                  onPress={() => openPhotoViewer(galleryPhotos, 3)}
                  style={{
                    width: 52,
                    height: 28,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: withAlpha(theme.colors.scrim, 0.6),
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: theme.colors['on-media'], fontFamily: theme.fonts.semibold }}
                  >
                    +{moreImagesCount}
                  </AppText>
                </Pressable>
              )}
            </View>
          )}

          <View
            style={{
              position: 'absolute',
              left: theme.spacing(6),
              right: theme.spacing(6),
              bottom: theme.spacing(4),
              gap: theme.spacing(1),
            }}
          >
            {rating === null ? (
              <AppText variant="caption" tone="media">
                {notRatedLabel}
              </AppText>
            ) : (
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: theme.spacing(7),
                  paddingHorizontal: theme.spacing(2.5),
                  borderRadius: 999,
                  gap: theme.spacing(1),
                  backgroundColor: theme.colors.secondary,
                }}
              >
                {/* Feather chỉ có sao viền — mockup muốn sao ĐẶC (data-fill="1"),
                    đổi sang Ionicons (cùng gói @expo/vector-icons, không thêm phụ thuộc). */}
                <Ionicons name="star" size={12} color={theme.colors.rating} />
                <AppText
                  variant="caption"
                  style={{
                    color: theme.colors['secondary-foreground'],
                    fontFamily: theme.fonts.semibold,
                  }}
                >
                  {rating.toFixed(1)} · {reviewCountLabel}
                </AppText>
              </View>
            )}
            <AppText variant="display" tone="media">
              {title}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
              <Feather name="map-pin" size={12} color={theme.colors['on-media']} />
              <AppText variant="caption" tone="media" style={{ opacity: 0.9 }}>
                {destinationsLine}
              </AppText>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginTop: theme.spacing(4),
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          }}
        >
          {TAB_ORDER.map((tab) => {
            const on = tab === activeTab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => onChangeTab(tab)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: theme.spacing(3),
                  borderBottomWidth: 2,
                  borderBottomColor: on ? theme.colors['primary-emphasis'] : 'transparent',
                }}
              >
                <AppText
                  variant="label"
                  style={{
                    color: on ? theme.colors.foreground : theme.colors['muted-foreground'],
                    fontFamily: on ? theme.fonts.semibold : theme.fonts.medium,
                  }}
                >
                  {tabLabels[tab]}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <View
            style={{
              paddingHorizontal: theme.spacing(4),
              paddingTop: theme.spacing(4),
              gap: theme.spacing(4),
            }}
          >
            {summary === null ? null : (
              <AppText variant="subtitle" tone="muted" numberOfLines={3}>
                {summary}
              </AppText>
            )}
            {facts.length === 0 ? null : (
              // Lưới 2 cột đúng `.facts`/`.fact` bản vẽ (grid 1fr 1fr) — ghép
              // theo CẶP thành từng hàng thay vì flexWrap tự do, để luôn ra
              // đúng 2 cột bất kể độ rộng máy (flexWrap + minWidth% không đảm
              // bảo điều đó, đã lệch — phản hồi 24/09).
              <View style={{ gap: theme.spacing(3) }}>
                {chunkPairs(facts).map((pair, rowIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cặp tĩnh, thứ tự facts không đổi trong một lần render.
                  <View key={rowIndex} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
                    {pair.map((fact) => (
                      <View
                        key={fact.label}
                        style={{
                          flex: 1,
                          gap: 2,
                          backgroundColor: theme.colors.card,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radius.base * 2,
                          padding: theme.spacing(3),
                        }}
                      >
                        <Feather
                          name={fact.icon}
                          size={16}
                          color={theme.colors['primary-emphasis']}
                          style={{ marginBottom: 4 }}
                        />
                        <AppText variant="caption" tone="muted">
                          {fact.label}
                        </AppText>
                        <AppText variant="label">{fact.value}</AppText>
                      </View>
                    ))}
                    {/* Số fact lẻ (3) — ô trống giữ chỗ để cột thứ hai không giãn full-width. */}
                    {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : activeTab === 'itinerary' ? (
          <View
            style={{
              paddingHorizontal: theme.spacing(4),
              paddingTop: theme.spacing(4),
              gap: 14,
            }}
          >
            {itineraryDays.map((day, index) => {
              const isLast = index === itineraryDays.length - 1;
              const open = day.dayNumber === expandedDay;

              return (
                <View key={day.dayNumber} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 99,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: open ? theme.colors.primary : theme.colors.secondary,
                      }}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: open
                            ? theme.colors['primary-foreground']
                            : theme.colors['primary-emphasis'],
                          fontFamily: theme.fonts.semibold,
                        }}
                      >
                        {day.dayNumber}
                      </AppText>
                    </View>
                    {isLast ? null : (
                      <View
                        style={{
                          flex: 1,
                          width: 2,
                          backgroundColor: theme.colors.border,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() => setExpandedDay(open ? null : day.dayNumber)}
                    style={{ flex: 1, paddingBottom: theme.spacing(1.5) }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <AppText variant="label" style={{ flex: 1 }}>
                        {day.title}
                      </AppText>
                      <Feather
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors['muted-foreground']}
                      />
                    </View>
                    {!open || day.lines.length === 0 ? null : (
                      <View style={{ marginTop: theme.spacing(2), gap: 6 }}>
                        {day.lines.map((line) =>
                          line.kind === 'timed' ? (
                            <View
                              key={`${line.time}-${line.text}`}
                              style={{ flexDirection: 'row', gap: theme.spacing(2) }}
                            >
                              <AppText
                                variant="caption"
                                style={{ width: 44, fontFamily: theme.fonts.semibold }}
                              >
                                {line.time}
                              </AppText>
                              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                                {line.text}
                              </AppText>
                            </View>
                          ) : (
                            <AppText key={line.text} variant="caption" tone="muted">
                              {line.text}
                            </AppText>
                          ),
                        )}
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
            {meetingPoint === null ? null : (
              // Cùng khung `.fact` với 4 thẻ dữ kiện Overview (nền/viền/bo góc/đệm),
              // chỉ đổi flex-direction sang hàng ngang — bản đầu thiếu khung này (phản hồi 24/09).
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing(3),
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.base * 2,
                  padding: theme.spacing(3),
                }}
              >
                <Feather name="flag" size={18} color={theme.colors['primary-emphasis']} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" tone="muted">
                    {meetingPointTitle}
                  </AppText>
                  <AppText variant="subtitle">{meetingPoint}</AppText>
                </View>
              </View>
            )}
          </View>
        ) : activeTab === 'dates' ? (
          <View
            style={{
              paddingHorizontal: theme.spacing(4),
              paddingTop: theme.spacing(4),
              gap: theme.spacing(3),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing(2.5),
                alignItems: 'center',
                backgroundColor: theme.colors.secondary,
                borderRadius: theme.radius.base * 2,
                padding: theme.spacing(3),
              }}
            >
              <Feather name="shield" size={18} color={theme.colors['secondary-foreground']} />
              <AppText
                variant="subtitle"
                style={{ flex: 1, color: theme.colors['secondary-foreground'] }}
              >
                {cancellationBanner}
              </AppText>
            </View>

            {departureGroups.length === 0 ? (
              <AppText variant="subtitle" tone="muted">
                {noDeparturesLabel}
              </AppText>
            ) : (
              departureGroups.map((group) => (
                <View key={group.monthLabel} style={{ gap: theme.spacing(2) }}>
                  <AppText variant="caption" tone="muted">
                    {group.monthLabel}
                  </AppText>
                  {group.rows.map((row) => {
                    const selected = row.id === selectedDepartureId;
                    return (
                      <Pressable
                        key={row.id}
                        disabled={!row.bookable}
                        accessibilityRole="radio"
                        accessibilityLabel={`${row.rangeLabel} · ${row.priceLabel}`}
                        accessibilityState={{ selected, disabled: !row.bookable }}
                        onPress={() => onSelectDeparture(row.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.spacing(3),
                          padding: theme.spacing(3),
                          borderRadius: theme.radius.base * 2,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected
                            ? theme.colors['primary-emphasis']
                            : theme.colors.border,
                          opacity: row.bookable ? 1 : 0.6,
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            borderWidth: 2,
                            borderColor: selected
                              ? theme.colors['primary-emphasis']
                              : theme.colors['muted-foreground'],
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {selected ? (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: theme.colors['primary-emphasis'],
                              }}
                            />
                          ) : null}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText
                            variant="label"
                            style={{
                              fontFamily: selected ? theme.fonts.semibold : theme.fonts.medium,
                            }}
                          >
                            {row.rangeLabel}
                          </AppText>
                          {!row.bookable ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: theme.spacing(2),
                              }}
                            >
                              <DepartureTag label={bookingClosedLabel} />
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => onAskAboutDate(row.id)}
                                hitSlop={theme.spacing(2)}
                              >
                                <AppText variant="caption" tone="link">
                                  {askAboutDateLabel}
                                </AppText>
                              </Pressable>
                            </View>
                          ) : row.almostFull ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: theme.spacing(2),
                              }}
                            >
                              <DepartureTag label={almostFullLabel} />
                              <AppText variant="caption" tone="muted">
                                {row.seatsLabel}
                              </AppText>
                            </View>
                          ) : (
                            <AppText variant="caption" tone="muted">
                              {row.seatsLabel}
                            </AppText>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {row.compareAtPriceLabel === null ? null : (
                            <AppText
                              variant="caption"
                              style={{
                                color: theme.colors['price-compare'],
                                textDecorationLine: 'line-through',
                              }}
                            >
                              {row.compareAtPriceLabel}
                            </AppText>
                          )}
                          <AppText
                            variant="label"
                            style={{
                              fontFamily: selected ? theme.fonts.semibold : theme.fonts.medium,
                            }}
                          >
                            {row.priceLabel}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        ) : activeTab === 'reviews' ? (
          <View
            style={{
              paddingHorizontal: theme.spacing(4),
              paddingTop: theme.spacing(4),
              gap: theme.spacing(4),
            }}
          >
            <View style={{ flexDirection: 'row', gap: theme.spacing(5), alignItems: 'center' }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <AppText variant="display">{rating === null ? '—' : rating.toFixed(1)}</AppText>
                <View
                  style={{ flexDirection: 'row', gap: 2 }}
                  accessibilityLabel={rating === null ? notRatedLabel : reviewCountLabel}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name="star"
                      size={14}
                      color={
                        rating !== null && n <= Math.round(rating)
                          ? theme.colors.rating
                          : theme.colors['rating-muted']
                      }
                    />
                  ))}
                </View>
                <AppText variant="caption" tone="muted">
                  {rating === null ? notRatedLabel : reviewCountLabel}
                </AppText>
              </View>
              <View style={{ flex: 1, gap: theme.spacing(1.5) }}>
                {(['5', '4', '3', '2', '1'] as const).map((star) => {
                  const percent = reviewBreakdownPercent(reviewBreakdown[star], reviewTotal);
                  return (
                    <View
                      key={star}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }}
                    >
                      <AppText variant="caption" tone="muted" style={{ width: 10 }}>
                        {star}
                      </AppText>
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.colors.secondary,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: theme.colors.rating,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
              {(Object.keys(reviewSortLabels) as TourDetailReviewSort[]).map((sort) => (
                <Chip
                  key={sort}
                  label={reviewSortLabels[sort]}
                  variant={sort === reviewSort ? 'selected' : 'default'}
                  onPress={() => onChangeReviewSort(sort)}
                />
              ))}
            </View>

            {reviews.length === 0 ? (
              <View
                style={{
                  alignItems: 'center',
                  gap: theme.spacing(1),
                  paddingVertical: theme.spacing(6),
                }}
              >
                <AppText variant="heading">{noReviewsTitle}</AppText>
                <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
                  {noReviewsBody}
                </AppText>
              </View>
            ) : (
              <View style={{ gap: theme.spacing(4) }}>
                {reviews.map((review) => (
                  <View key={review.id} style={{ gap: theme.spacing(2) }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing(2.5),
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: theme.colors.secondary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppText
                          variant="caption"
                          style={{
                            color: theme.colors['secondary-foreground'],
                            fontFamily: theme.fonts.semibold,
                          }}
                        >
                          {review.initials}
                        </AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label">{review.authorLabel}</AppText>
                        <AppText variant="caption" tone="muted">
                          {review.dateLabel}
                        </AppText>
                      </View>
                      <View
                        style={{ flexDirection: 'row', gap: 2 }}
                        accessibilityLabel={review.ratingLabel}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Ionicons
                            key={n}
                            name="star"
                            size={12}
                            color={
                              n <= review.rating
                                ? theme.colors.rating
                                : theme.colors['rating-muted']
                            }
                          />
                        ))}
                      </View>
                    </View>
                    {review.title === null ? null : (
                      <AppText variant="label">{review.title}</AppText>
                    )}
                    <AppText variant="subtitle" tone="muted">
                      {review.body}
                    </AppText>
                    {review.photos.length === 0 ? null : (
                      <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
                        {review.photos.map((photo, photoIndex) => (
                          <Pressable
                            key={photo.url}
                            accessibilityRole="button"
                            accessibilityLabel={photo.alt ?? undefined}
                            // D5 — mở trình xem SCOPE theo ảnh của review này,
                            // không phải cả gallery tour (khác nút "+N"/ảnh bìa).
                            onPress={() => openPhotoViewer(review.photos, photoIndex)}
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: theme.radius.base,
                              overflow: 'hidden',
                            }}
                          >
                            <AppImage
                              source={photo.url}
                              width={64}
                              alt={photo.alt ?? ''}
                              transformUrl={transformUrl}
                              fill
                            />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {hasMoreReviews ? (
                  <Button
                    shape="pill"
                    variant="ghost"
                    label={loadMoreReviewsLabel}
                    disabled={loadingMoreReviews}
                    onPress={onLoadMoreReviews}
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Header gọn (D2 bản vẽ 24/09) — chỉ mount khi đã cuộn qua khỏi ảnh
          bìa, đứng TRÊN hàng tab đang dính. Không mount lúc đầu để tránh
          trùng chữ tiêu đề/nhãn nút lùi-tim với khối hero (RNTL `getByText`/
          `getByLabelText` đơn sẽ vỡ nếu cả hai cùng có mặt). */}
      {compactHeaderVisible ? (
        <View
          testID="tour-detail-compact-header"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + theme.spacing(1),
            paddingBottom: theme.spacing(2),
            paddingHorizontal: theme.spacing(3),
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            backgroundColor: theme.colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.colors.border,
          }}
        >
          <IconButton icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} />
          <AppText
            variant="label"
            numberOfLines={1}
            style={{ flex: 1, fontFamily: theme.fonts.semibold }}
          >
            {title}
          </AppText>
          <FavoriteButton favorited={favorited} label={favoriteLabel} onPress={onFavoritePress} />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing(5),
          paddingVertical: theme.spacing(3),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      >
        {selectedDeparture === null ? (
          <>
            <View>
              <AppText variant="caption" tone="muted">
                {fromLabel}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing(1) }}>
                <AppText variant="title">{priceLabel}</AppText>
                <AppText variant="caption" tone="muted">
                  {perPersonLabel}
                </AppText>
              </View>
            </View>
            <Button label={chooseDateLabel} onPress={onChooseDate} shape="pill" />
          </>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0, marginRight: theme.spacing(3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing(1) }}>
                <AppText variant="title">{selectedDeparture.priceLabel}</AppText>
                <AppText variant="caption" tone="muted">
                  {perPersonLabel}
                </AppText>
              </View>
              <AppText variant="caption" tone="link" numberOfLines={1}>
                {selectedDeparture.cancellationCaption}
              </AppText>
            </View>
            <Button label={bookCtaLabel} onPress={onBook} shape="pill" />
          </>
        )}
      </View>

      {viewer === null ? null : (
        <PhotoViewer
          photos={viewer.photos}
          initialIndex={viewer.initialIndex}
          onClose={() => setViewer(null)}
          closeLabel={closePhotosLabel}
          counterFor={photoCounterFor}
          transformUrl={transformUrl}
        />
      )}

      {wishlistErrorLabel === null ? null : (
        <View
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing(1),
            left: theme.spacing(4),
            right: theme.spacing(4),
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors['destructive-emphasis'],
            borderRadius: theme.radius.base * 2,
            paddingVertical: theme.spacing(2.5),
            paddingHorizontal: theme.spacing(3),
          }}
        >
          <AppText variant="label" style={{ textAlign: 'center' }}>
            {wishlistErrorLabel}
          </AppText>
        </View>
      )}

      {/* Luôn mount (khác `PhotoViewer`/header gọn ở trên) — `AuthGateSheet`
          bọc `BottomSheet`, thứ TỰ THEO DÕI prop `visible` để tự trượt vào/ra
          (xem doc comment `BottomSheet`); mount-theo-điều-kiện sẽ mất animation
          lúc đóng. Không trùng chữ với phần còn lại của màn nên không ngại
          `getByText`/`getByLabelText` đơn như lo ngại ở `PhotoViewer`. */}
      <AuthGateSheet
        visible={authGateOpen}
        onClose={onCloseAuthGate}
        title={authGateTitle}
        body={authGateBody}
        signInLabel={signInLabel}
        createAccountLabel={createAccountLabel}
        onSignIn={onSignIn}
        onCreateAccount={onCreateAccount}
      />
      <AskAboutDateSheet
        visible={askAboutDateSheetOpen}
        onClose={onCloseAskAboutDateSheet}
        title={askAboutDateSheetTitle}
        description={askAboutDateSheetDescription}
        nameLabel={askAboutDateNameLabel}
        emailLabel={askAboutDateEmailLabel}
        messageLabel={askAboutDateMessageLabel}
        values={askAboutDateValues}
        errors={askAboutDateErrors}
        onChange={onChangeAskAboutDate}
        submitLabel={askAboutDateSubmitLabel}
        submittingLabel={askAboutDateSubmittingLabel}
        submitting={askAboutDateSubmitting}
        onSubmit={onSubmitAskAboutDate}
        formError={askAboutDateFormError}
        sent={askAboutDateSent}
        successTitle={askAboutDateSuccessTitle}
        successBody={askAboutDateSuccessBody}
        closeLabel={askAboutDateCloseLabel}
      />
    </Screen>
  );
}

/** Huy hiệu "Booking closed"/"Almost full" (D3) — nền `warning` pha 20%. */
function DepartureTag({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing(2),
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: withAlpha(theme.colors.warning, 0.2),
      }}
    >
      <AppText variant="caption" style={{ color: theme.colors.warning }}>
        {label}
      </AppText>
    </View>
  );
}

/** Tim đổi MÀU khi đã lưu (Feather không có biến thể đặc) — cùng khuôn `TourListCard`. */
function FavoriteButton({
  favorited,
  label,
  onPress,
}: {
  favorited: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: favorited }}
      onPress={onPress}
      style={{
        width: theme.touchTargetMin,
        height: theme.touchTargetMin,
        borderRadius: theme.touchTargetMin / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(theme.colors.scrim, 0.45),
      }}
    >
      {/* Feather không có biến thể "đặc" — Ionicons lúc đã lưu, cùng luật
          `tour-list-card.tsx` (E1/E4). */}
      {favorited ? (
        <Ionicons name="heart" size={20} color={theme.colors['destructive-emphasis']} />
      ) : (
        <Feather name="heart" size={20} color={theme.colors['on-media']} />
      )}
    </Pressable>
  );
}

function SquareIcon({ name }: { name: 'wifi-off' | 'map' }) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: theme.spacing(16),
        height: theme.spacing(16),
        borderRadius: theme.radius.base * 2,
        backgroundColor: theme.colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

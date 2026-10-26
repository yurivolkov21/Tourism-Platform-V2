import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  AppImage,
  AppRefreshControl,
  AppText,
  Button,
  Chip,
  EmptyState,
  FadeIn,
  Icon,
  IconButton,
  PopIn,
  Pulse,
  Screen,
  Skeleton,
  usePop,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  interpolate,
  Easing as ReanimatedEasing,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGateSheet } from '@/features/auth/auth-gate-sheet';
import type { AskAboutDateErrors, AskAboutDateField, AskAboutDateState } from './ask-about-date';
import { AskAboutDateSheet } from './ask-about-date-sheet';
import { HeroDots } from './hero-dots';
import type { ItineraryLine } from './itinerary';
import { ItineraryDays } from './itinerary-days';
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
  /** Kéo xuống để làm mới — route giữ trạng thái và gọi refetch; vắng thì không có. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
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
/** Phần ảnh bìa vẽ dư phía trên để có chỗ trôi khi cuộn (parallax) mà không lộ nền. */
const HERO_PARALLAX_EXTRA = 120;
/** Vuốt ngang đổi tab: ngưỡng kích hoạt/huỷ, quãng và vận tốc đủ để đổi, vùng mép trái bị bỏ qua. */
const TAB_SWIPE_ACTIVE_X = 24;
const TAB_SWIPE_FAIL_Y = 14;
const TAB_SWIPE_DISTANCE = 60;
const TAB_SWIPE_VELOCITY = 600;
const TAB_SWIPE_EDGE = 24;

/** Chia mảng thành từng cặp liên tiếp — lưới 2 cột của `.facts` (D1). */
export function chunkPairs<T>(items: readonly T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2));
  return pairs;
}

/**
 * Chi tiết tour — bố cục bê từ bản vẽ 18/09 (D1/D2/D7 — ADR-0055 T5). Màn
 * STACK, không thanh tab. Ảnh bìa + tiêu đề + hàng tab, dưới là nội dung tab
 * đang chọn, đáy là thanh giá + CTA.
 *
 * Header gọn (lùi · tiêu đề một dòng · tim) hiện đè lên trên khi ảnh bìa cuộn
 * qua khỏi (phản hồi 24/09, đối chiếu bản vẽ D2).
 *
 * Hàng tab dính khi cuộn: thử `stickyHeaderIndices` của `ScrollView` thì hàng tab bị RN giãn full
 * chiều cao còn lại (bug thấy trên máy thật 24/09, không phải lỗi style ở
 * đây), nên vẽ bản sao hàng tab dưới header gọn khi hàng thật cuộn tới sát mép
 * (`tabsSticky`). Header gọn CHUYỂN TỨC THÌ, không mờ dần (lý do ở
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
/**
 * Thanh tab của tour detail. Vạch chỉ báo là MỘT khối trượt ngang tới tab đang chọn
 * (các tab bằng nhau nên vị trí = chỉ số × bề ngang một tab) thay vì mỗi tab tự vẽ viền.
 */
function TabStrip({
  activeTab,
  onChangeTab,
  tabLabels,
  flush = false,
  drag,
}: {
  activeTab: TourDetailTab;
  onChangeTab: (tab: TourDetailTab) => void;
  tabLabels: Record<TourDetailTab, string>;
  /** Bản dính trong header: không chừa lề trên như bản nằm trong luồng. */
  flush?: boolean;
  /** Quãng ngón đang vuốt ngang (px, âm = sang trái): gạch dưới nhích theo ngón trước khi đổi tab. */
  drag?: SharedValue<number>;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const ownDrag = useSharedValue(0);
  const dragValue = drag ?? ownDrag;
  const placed = useRef(false);
  const tabWidth = width / TAB_ORDER.length;
  const index = TAB_ORDER.indexOf(activeTab);

  useEffect(() => {
    if (width === 0) return;
    const toValue = index * tabWidth;
    if (!placed.current) {
      x.value = toValue;
      placed.current = true;
      return;
    }
    // Lò xo: bấm qua lại liên tục vẫn nối mượt từ vị trí đang chạy dở, damping đủ lớn để không nảy.
    x.value = withSpring(toValue, { stiffness: 320, damping: 30, mass: 1 });
  }, [index, tabWidth, width, x]);

  // Gạch dưới trượt tới tab mới, và lúc đang vuốt thì nhích theo ngón (tối đa nửa ô).
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          x.value +
          interpolate(
            dragValue.value,
            [-200, 0, 200],
            [tabWidth * 0.5, 0, -tabWidth * 0.5],
            Extrapolation.CLAMP,
          ),
      },
    ],
  }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        marginTop: flush ? 0 : theme.spacing(4),
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
            }}
          >
            <AppText
              variant="label"
              style={{
                color: on ? theme.colors.foreground : theme.colors['muted-foreground'],
                fontWeight: on ? theme.weight.semibold : theme.weight.medium,
              }}
            >
              {tabLabels[tab]}
            </AppText>
          </Pressable>
        );
      })}
      {width === 0 ? null : (
        <Reanimated.View
          testID="tour-tab-indicator"
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: 2,
              width: tabWidth,
              backgroundColor: theme.colors['primary-emphasis'],
            },
            indicatorStyle,
          ]}
        />
      )}
    </View>
  );
}

export function TourDetailScreen({
  refresh,
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
  const { width: windowWidth } = useWindowDimensions();
  // Ảnh bìa đang xem — bấm một ô thumb đổi ảnh này (thuần UI hiển thị, không
  // chạm dữ liệu, cùng tiền lệ `readMoreOpen` của DestinationHeaderBlock).
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Parallax ảnh bìa: nội dung cuộn lên bao nhiêu thì ảnh trôi theo NỬA đó (chậm hơn → có chiều
  // sâu). Nhân hệ số chuyển động để máy bật "giảm chuyển động" thì ảnh đứng yên.
  const scrollY = useSharedValue(0);
  // Vị trí cuộn ngang của dải ảnh bìa — nuôi chấm báo ảnh co giãn theo ngón tay.
  const heroScrollX = useSharedValue(0);
  const heroPagerHandler = useAnimatedScrollHandler((event) => {
    heroScrollX.value = event.contentOffset.x;
  });
  const reduceMotion = useReducedMotion();
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: reduceMotion
          ? 0
          : interpolate(
              scrollY.value,
              [0, HERO_PARALLAX_EXTRA * 2],
              [0, HERO_PARALLAX_EXTRA],
              Extrapolation.CLAMP,
            ),
      },
    ],
  }));
  // Header gọn (D2 bản vẽ 24/09): hiện khi ảnh bìa đã cuộn qua khỏi màn hình —
  // NGƯỠNG cố định thay vì đo layout thật (`onLayout`), vì hero có chiều cao
  // CỐ ĐỊNH `HERO_HEIGHT`, không phụ thuộc nội dung. Bật/tắt bằng state thay vì
  // animate opacity: opacity không gỡ node khỏi cây a11y, còn tiêu đề/nút lùi
  // trùng chữ với khối hero phía trên sẽ đụng `getByText`/`getByLabelText` đơn
  // của RNTL nếu cả hai cùng mount. Đánh đổi: chuyển trạng thái tức thì, không
  // mờ dần.
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  // Đổi tab thay cả nội dung bên dưới nên trang có thể bị kéo về đầu; nhớ vị trí cuộn
  // trước khi đổi rồi trả lại sau khi nội dung mới đã vẽ.
  const scrollRef = useRef<ScrollView>(null);
  // Hàng tab dính: RN giãn full chiều cao khi dùng `stickyHeaderIndices`, nên vẽ BẢN SAO hàng
  // tab bên dưới header gọn khi hàng tab thật cuộn tới sát mép. Hàng tab thật nằm ngay sau ảnh
  // bìa (cao cố định) nên vị trí của nó tính được, không cần đo layout.
  const [tabsSticky, setTabsSticky] = useState(false);
  const stripTop = HERO_HEIGHT + theme.spacing(4);
  // Chiều cao hàng chính của header gọn (không tính hàng tab), đo khi header hiện. Là shared value
  // vì bộ xử lý cuộn chạy trên luồng UI và đọc nó mỗi khung hình.
  const headerRowHeight = useSharedValue(0);
  // Cuộn xử lý thẳng trên luồng UI (không qua JS mỗi khung hình); chỉ gọi về JS khi cờ đổi.
  const compactShared = useSharedValue(false);
  const stickyShared = useSharedValue(false);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    scrollY.value = y;
    const compact = y > HERO_HEIGHT - 140;
    if (compact !== compactShared.value) {
      compactShared.value = compact;
      runOnJS(setCompactHeaderVisible)(compact);
    }
    const sticky = headerRowHeight.value > 0 && y >= stripTop - headerRowHeight.value;
    if (sticky !== stickyShared.value) {
      stickyShared.value = sticky;
      runOnJS(setTabsSticky)(sticky);
    }
  });
  const handleChangeTab = (tab: TourDetailTab) => {
    // Đang dính thì đổi tab đưa nội dung mới về ngay dưới hàng tab dính; chưa dính thì giữ chỗ.
    const y = tabsSticky ? stripTop - headerRowHeight.value : scrollY.value;
    onChangeTab(tab);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
  };
  // Vuốt ngang trên nội dung để đổi tab. Chỉ nhận khi lệch ngang rõ (24dp) và chưa lệch dọc (14dp)
  // nên cuộn dọc vẫn thắng cử chỉ chéo; bỏ qua cử chỉ bắt đầu sát mép trái (cử chỉ quay lại của
  // iOS/Android). Nội dung vẫn đổi bằng fade như bấm tab; chỉ gạch dưới nhích theo ngón.
  const tabDrag = useSharedValue(0);
  const swipeStartX = useSharedValue(0);
  function swipeTab(direction: 1 | -1) {
    const next = TAB_ORDER[TAB_ORDER.indexOf(activeTab) + direction];
    if (next !== undefined) handleChangeTab(next);
  }
  const tabSwipe = Gesture.Pan()
    .withTestId('tour-tab-swipe')
    .activeOffsetX([-TAB_SWIPE_ACTIVE_X, TAB_SWIPE_ACTIVE_X])
    .failOffsetY([-TAB_SWIPE_FAIL_Y, TAB_SWIPE_FAIL_Y])
    .onBegin((e) => {
      swipeStartX.value = e.x;
    })
    .onUpdate((e) => {
      if (swipeStartX.value >= TAB_SWIPE_EDGE) tabDrag.value = e.translationX;
    })
    .onEnd((e) => {
      tabDrag.value = withSpring(0, { stiffness: 220, damping: 22 });
      if (swipeStartX.value < TAB_SWIPE_EDGE) return;
      if (e.translationX < -TAB_SWIPE_DISTANCE || e.velocityX < -TAB_SWIPE_VELOCITY) {
        runOnJS(swipeTab)(1);
      } else if (e.translationX > TAB_SWIPE_DISTANCE || e.velocityX > TAB_SWIPE_VELOCITY) {
        runOnJS(swipeTab)(-1);
      }
    });
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
        <Skeleton style={{ height: HERO_HEIGHT }} />
        <View style={{ padding: theme.spacing(4), gap: theme.spacing(3) }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ flex: 1, height: 32, borderRadius: 8 }} />
            ))}
          </View>
          <Skeleton style={{ height: 16, width: '92%', borderRadius: 8 }} />
          <Skeleton style={{ height: 16, width: '78%', borderRadius: 8 }} />
          <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
            {[0, 1].map((i) => (
              <Skeleton
                key={i}
                style={{ flex: 1, height: 88, borderRadius: theme.radius.base * 2 }}
              />
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  if (status === 'error' || status === 'notFound') {
    const isError = status === 'error';
    // Không header + không ảnh bìa ở đây — dùng edges mặc định (top+bottom)
    // để `Screen` tự cộng vùng an toàn đỉnh, nút lùi không chui dưới tai thỏ.
    return (
      <Screen scrollable={false}>
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton icon="arrow-left" size={22} accessibilityLabel={backLabel} onPress={onBack} />
        </View>
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
      <Reanimated.ScrollView
        testID="tour-detail-scroll"
        ref={scrollRef}
        style={{ flex: 1 }}
        refreshControl={refresh === undefined ? undefined : <AppRefreshControl {...refresh} />}
        contentContainerStyle={{ paddingBottom: theme.spacing(24) }}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <View
          style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.muted, overflow: 'hidden' }}
        >
          {galleryImages.length === 0 ? null : (
            // B3 — pager ngang qua `galleryImages`. D5: bấm ảnh mở trình xem toàn màn
            // tại đúng ảnh đang xem. Chỉ dựng ảnh đang xem và hai ảnh kề để khỏi tải cả
            // bộ ảnh cùng lúc.
            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  top: -HERO_PARALLAX_EXTRA,
                  left: 0,
                  right: 0,
                  height: HERO_HEIGHT + HERO_PARALLAX_EXTRA,
                },
                heroStyle,
              ]}
            >
              <Reanimated.ScrollView
                testID="tour-detail-hero-pager"
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={heroPagerHandler}
                style={StyleSheet.absoluteFill}
                onMomentumScrollEnd={(e) => {
                  const next = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
                  setSelectedIndex(Math.min(galleryImages.length - 1, Math.max(0, next)));
                }}
              >
                {galleryImages.map((image, index) => (
                  <Pressable
                    key={image.url}
                    testID={index === selectedIndex ? 'tour-detail-hero-image' : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={galleryPhotos[index]?.alt ?? image.alt}
                    onPress={() => openPhotoViewer(galleryPhotos, index)}
                    style={{ width: windowWidth, height: HERO_HEIGHT + HERO_PARALLAX_EXTRA }}
                  >
                    {Math.abs(index - selectedIndex) <= 1 ? (
                      <AppImage
                        source={image.url}
                        // Bề rộng dp thật của khung (tràn ngang màn) — `AppImage` tự nhân mật độ.
                        width={windowWidth}
                        alt={image.alt}
                        transformUrl={transformUrl}
                        fill
                      />
                    ) : null}
                  </Pressable>
                ))}
              </Reanimated.ScrollView>
            </Reanimated.View>
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

          {galleryImages.length <= 1 ? null : (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: theme.spacing(1.5),
                alignItems: 'center',
              }}
            >
              <HeroDots
                count={galleryImages.length}
                scrollX={heroScrollX}
                pageWidth={windowWidth}
              />
            </View>
          )}

          {galleryImages.length <= 1 ? null : (
            <View
              testID="tour-detail-photo-counter"
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: theme.spacing(4),
                bottom: theme.spacing(4),
                height: theme.spacing(7),
                paddingHorizontal: theme.spacing(2.5),
                borderRadius: 999,
                justifyContent: 'center',
                backgroundColor: withAlpha(theme.colors.scrim, 0.55),
              }}
            >
              <AppText
                variant="caption"
                tone="media"
                style={{ fontWeight: theme.weight.medium }}
                accessibilityLabel={photoCounterFor(selectedIndex + 1, galleryImages.length)}
              >
                {photoCounterFor(selectedIndex + 1, galleryImages.length)}
              </AppText>
            </View>
          )}

          <View
            style={{
              position: 'absolute',
              left: theme.spacing(6),
              right: galleryImages.length > 1 ? 96 : theme.spacing(6),
              bottom: theme.spacing(4),
              gap: theme.spacing(1),
            }}
          >
            {rating === null ? (
              <AppText variant="caption" tone="muted">
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
                    đổi sang MaterialCommunityIcons (cùng gói @expo/vector-icons, không thêm phụ thuộc). */}
                <MaterialCommunityIcons name="star" size={12} color={theme.colors.rating} />
                <AppText
                  variant="caption"
                  style={{
                    color: theme.colors['secondary-foreground'],
                    fontWeight: theme.weight.semibold,
                  }}
                >
                  {rating.toFixed(1)} · {reviewCountLabel}
                </AppText>
              </View>
            )}
            {/* Khối tên neo ở ĐÁY ảnh, nơi dải mờ đã chuyển hẳn sang màu `background` — nên chữ
                dùng màu chữ của nền (`foreground`), không dùng `on-media` (trắng): ở nền sáng
                chữ trắng trên dải trắng thì mất hẳn. */}
            <AppText variant="brand">{title}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
              <Icon name="map-pin" size={12} color={theme.colors['muted-foreground']} />
              <AppText variant="caption" tone="muted">
                {destinationsLine}
              </AppText>
            </View>
          </View>
        </View>

        <TabStrip
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          tabLabels={tabLabels}
          drag={tabDrag}
        />

        <GestureDetector gesture={tabSwipe}>
          <View collapsable={false}>
            <FadeIn key={activeTab}>
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
                        <View
                          // biome-ignore lint/suspicious/noArrayIndexKey: cặp tĩnh, thứ tự facts không đổi trong một lần render.
                          key={rowIndex}
                          style={{ flexDirection: 'row', gap: theme.spacing(3) }}
                        >
                          {pair.map((fact, colIndex) => (
                            <FadeIn
                              key={fact.label}
                              index={rowIndex * 2 + colIndex}
                              style={{ flex: 1 }}
                            >
                              <View
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
                                <Icon
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
                            </FadeIn>
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
                  <ItineraryDays days={itineraryDays} />
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
                      <Icon name="flag" size={18} color={theme.colors['primary-emphasis']} />
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
                    <Icon name="shield" size={18} color={theme.colors['secondary-foreground']} />
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
                                  <PopIn>
                                    <View
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: 5,
                                        backgroundColor: theme.colors['primary-emphasis'],
                                      }}
                                    />
                                  </PopIn>
                                ) : null}
                              </View>
                              <View style={{ flex: 1, gap: 2 }}>
                                <AppText
                                  variant="label"
                                  style={{
                                    fontWeight: selected
                                      ? theme.weight.semibold
                                      : theme.weight.medium,
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
                                    <DepartureTag label={almostFullLabel} pulse />
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
                                    fontWeight: selected
                                      ? theme.weight.semibold
                                      : theme.weight.medium,
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
                  <View
                    style={{ flexDirection: 'row', gap: theme.spacing(5), alignItems: 'center' }}
                  >
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <AppText variant="display">
                        {rating === null ? '—' : rating.toFixed(1)}
                      </AppText>
                      <View
                        style={{ flexDirection: 'row', gap: 2 }}
                        accessibilityLabel={rating === null ? notRatedLabel : reviewCountLabel}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <MaterialCommunityIcons
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
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: theme.spacing(2),
                            }}
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
                              <GrowBar
                                percent={percent}
                                color={theme.colors.rating}
                                delay={Number(5 - Number(star)) * 70}
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
                      {reviews.map((review, reviewIndex) => (
                        <FadeIn key={review.id} index={reviewIndex}>
                          <View style={{ gap: theme.spacing(2) }}>
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
                                    fontWeight: theme.weight.semibold,
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
                                  <MaterialCommunityIcons
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
                        </FadeIn>
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
            </FadeIn>
          </View>
        </GestureDetector>
      </Reanimated.ScrollView>
      {/* Header gọn (D2 bản vẽ 24/09) — chỉ mount khi đã cuộn qua khỏi ảnh
          bìa, đứng TRÊN hàng tab đang dính. Không mount lúc đầu để tránh
          trùng chữ tiêu đề/nhãn nút lùi-tim với khối hero (RNTL `getByText`/
          `getByLabelText` đơn sẽ vỡ nếu cả hai cùng có mặt). */}
      {compactHeaderVisible ? (
        <FadeIn distance={-16} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View
            testID="tour-detail-compact-header"
            style={{
              backgroundColor: theme.colors.background,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.border,
            }}
          >
            <View
              testID="tour-detail-compact-header-row"
              onLayout={(event) => {
                headerRowHeight.value = event.nativeEvent.layout.height;
              }}
              style={{
                paddingTop: insets.top + theme.spacing(1),
                paddingBottom: theme.spacing(2),
                paddingHorizontal: theme.spacing(3),
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
              }}
            >
              <IconButton icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} />
              <AppText
                variant="label"
                numberOfLines={1}
                style={{ flex: 1, fontWeight: theme.weight.semibold }}
              >
                {title}
              </AppText>
              <FavoriteButton
                favorited={favorited}
                label={favoriteLabel}
                onPress={onFavoritePress}
              />
            </View>
            {tabsSticky ? (
              <TabStrip
                flush
                drag={tabDrag}
                activeTab={activeTab}
                onChangeTab={handleChangeTab}
                tabLabels={tabLabels}
              />
            ) : null}
          </View>
        </FadeIn>
      ) : null}
      <FadeIn distance={24} delay={150}>
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
                <View
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing(1) }}
                >
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
                <View
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing(1) }}
                >
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
      </FadeIn>
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

/**
 * Huy hiệu "Booking closed"/"Almost full" (D3) — nền `warning` pha 20%. Chữ dùng token vai mực
 * `warning-emphasis` (G47, ADR-0019 AMEND 4): `warning` trần trên chính lớp tô ấy chỉ 1,68:1 ở
 * theme sáng; theme tối hai token cùng giá trị nên không đổi pixel nào.
 */
/** Thanh phân bố sao: chạy từ 0 tới phần trăm thật mỗi lần tab Reviews được mở (tắt khi giảm chuyển động). */
function GrowBar({ percent, color, delay }: { percent: number; color: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy một lần lúc mount
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) }),
    );
  }, []);

  // Bề rộng chạy thẳng trên luồng UI.
  const style = useAnimatedStyle(() => ({ width: `${percent * progress.value}%` }));

  return <Reanimated.View style={[{ height: '100%', backgroundColor: color }, style]} />;
}

function DepartureTag({ label, pulse = false }: { label: string; pulse?: boolean }) {
  const theme = useTheme();

  return (
    <Pulse active={pulse}>
      <View
        style={{
          paddingHorizontal: theme.spacing(2),
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: withAlpha(theme.colors.warning, 0.2),
        }}
      >
        <AppText variant="caption" style={{ color: theme.colors['warning-emphasis'] }}>
          {label}
        </AppText>
      </View>
    </Pulse>
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
  // Tim nảy khi vừa lưu + một vòng đỏ nở ra rồi tan (không chạy lúc mount hay khi bỏ lưu).
  const pop = usePop(favorited, 0.5);
  const ring = useRef(new Animated.Value(1)).current;
  const was = useRef(favorited);

  useEffect(() => {
    if (favorited && !was.current) {
      AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (reduced) return;
        ring.setValue(0);
        Animated.timing(ring, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }
    was.current = favorited;
  }, [favorited, ring]);

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
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: theme.touchTargetMin,
          height: theme.touchTargetMin,
          borderRadius: theme.touchTargetMin / 2,
          borderWidth: 2,
          borderColor: theme.colors['destructive-emphasis'],
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        {/* Feather không có biến thể "đặc" — MaterialCommunityIcons lúc đã lưu, cùng luật
            `tour-list-card.tsx` (E1/E4). */}
        {favorited ? (
          <MaterialCommunityIcons
            name="heart"
            size={20}
            color={theme.colors['destructive-emphasis']}
          />
        ) : (
          <Icon name="heart" size={20} color={theme.colors['on-media']} />
        )}
      </Animated.View>
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
      <Icon name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

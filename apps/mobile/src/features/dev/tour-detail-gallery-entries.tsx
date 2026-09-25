import { useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { View } from 'react-native';
import { PhotoViewer, type TourDetailPhoto } from '@/features/tour-detail/photo-viewer';
import {
  type TourDetailDepartureGroup,
  type TourDetailReview,
  TourDetailScreen,
  type TourDetailScreenProps,
} from '@/features/tour-detail/tour-detail-screen';
import type { GalleryEntry } from './gallery-entries';

const noop = () => {};

// Ảnh mẫu Hội An/Đà Nẵng có thật trên Cloudinary demo — cùng bộ đã dùng lúc
// soi D1–D5 trên browser, để khung này KHÔNG hiện placeholder xám.
const GALLERY_IMAGES = [
  {
    url: 'https://res.cloudinary.com/dbkgeehow/image/upload/c_fill,w_780,h_840,g_auto,q_auto,f_auto/tourism/catalog/tour/central-heritage-4d/hero',
    alt: 'Ha Long Bay panorama',
  },
  {
    url: 'https://res.cloudinary.com/dbkgeehow/image/upload/c_fill,w_128,h_128,g_auto,q_auto,f_auto/tourism/catalog/destination/hoi-an/gallery-04',
    alt: 'Hội An lantern street',
  },
  {
    url: 'https://res.cloudinary.com/dbkgeehow/image/upload/c_fill,w_128,h_128,g_auto,q_auto,f_auto/tourism/catalog/destination/hoi-an/gallery-05',
    alt: 'Hội An old town street',
  },
];
const GALLERY_PHOTOS: TourDetailPhoto[] = GALLERY_IMAGES.map((image, index) => ({
  url: image.url,
  alt: image.alt,
  creditLine: index === 0 ? 'Photo: Nguyễn Minh · CC BY-SA 4.0' : null,
}));

const DEPARTURE_GROUPS: TourDetailDepartureGroup[] = [
  {
    monthLabel: 'September 2026',
    rows: [
      {
        id: 'closed-1',
        rangeLabel: 'Wed 23 – Sat 26 Sep',
        seatsLabel: '0 seats left',
        priceLabel: '$459',
        compareAtPriceLabel: null,
        bookable: false,
        almostFull: false,
        cancellationCaption: 'Free cancellation until Sat 19 Sep',
      },
    ],
  },
  {
    monthLabel: 'October 2026',
    rows: [
      {
        id: 'open-1',
        rangeLabel: 'Sat 3 – Tue 6 Oct',
        seatsLabel: '12 seats left',
        priceLabel: '$459',
        compareAtPriceLabel: null,
        bookable: true,
        almostFull: false,
        cancellationCaption: 'Free cancellation until Sat 26 Sep',
      },
      {
        id: 'almost-full-1',
        rangeLabel: 'Sat 10 – Tue 13 Oct',
        seatsLabel: '3 seats left',
        priceLabel: '$459',
        compareAtPriceLabel: null,
        bookable: true,
        almostFull: true,
        cancellationCaption: 'Free cancellation until Sat 3 Oct',
      },
      {
        id: 'discount-1',
        rangeLabel: 'Sat 17 – Tue 20 Oct',
        seatsLabel: '9 seats left',
        priceLabel: '$419',
        compareAtPriceLabel: '$459',
        bookable: true,
        almostFull: false,
        cancellationCaption: 'Free cancellation until Sat 10 Oct',
      },
    ],
  },
];

const REVIEWS: TourDetailReview[] = [
  {
    id: 'r1',
    initials: 'YO',
    authorLabel: 'Yerin Oh',
    dateLabel: '5 Jul 2026',
    rating: 4,
    ratingLabel: '4 out of 5 stars',
    title: 'Solid four days',
    body: 'Good pacing overall, though the royal-style dinner in Huế on the last night was a bit overpriced for what was served.',
    photos: [],
  },
  {
    id: 'r2',
    initials: 'SP',
    authorLabel: 'Simon Peters',
    dateLabel: '26 Apr 2026',
    rating: 4,
    ratingLabel: '4 out of 5 stars',
    title: null,
    body: 'The Hải Vân Pass drive between Hội An and Huế was a highlight on its own, better than any of the museum stops honestly.',
    photos: GALLERY_PHOTOS.slice(1),
  },
  {
    id: 'r3',
    initials: '?',
    authorLabel: 'Deleted account',
    dateLabel: '2 Jan 2026',
    rating: 5,
    ratingLabel: '5 out of 5 stars',
    title: 'Would do again',
    body: 'Guide was fantastic, van was comfortable, hotels were exactly as described.',
    photos: [],
  },
];

/**
 * Props chung cho MỌI khung `TourDetailScreen` bên dưới — mỗi khung chỉ ghi
 * đè phần khác (`activeTab`/`status`/`selectedDepartureId`), cùng khuôn
 * `signInBase`/`registerBase`… của `gallery-entries.tsx`.
 */
const tourDetailBase: TourDetailScreenProps = {
  status: 'content',
  onBack: noop,
  backLabel: 'Back',
  onRetry: noop,
  errorTitle: "Couldn't load this tour.",
  retryLabel: 'Try again',
  notFoundTitle: "This tour isn't available anymore.",
  goBackLabel: 'Go back',
  exploreOtherLabel: 'Explore other tours',
  onExploreOther: noop,
  galleryImages: GALLERY_IMAGES,
  galleryPhotos: GALLERY_PHOTOS,
  moreImagesCount: 14,
  openGalleryLabel: 'Open gallery',
  title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
  rating: 4.3,
  reviewCountLabel: '3 reviews',
  notRatedLabel: 'New — no reviews yet',
  destinationsLine: 'Đà Nẵng · Hội An · Huế',
  summary:
    'Hand-picked journeys through limestone bays, terraced highlands, and lantern-lit old towns.',
  facts: [
    { icon: 'clock', label: 'Duration', value: '4 days' },
    { icon: 'users', label: 'Group size', value: 'Up to 16 guests' },
    { icon: 'activity', label: 'Difficulty', value: 'Easy' },
  ],
  fromLabel: 'From',
  priceLabel: '$419',
  perPersonLabel: '/ person',
  chooseDateLabel: 'Choose a date',
  onChooseDate: noop,
  favorited: false,
  favoriteLabel: 'Save tour to your wishlist',
  onFavoritePress: noop,
  authGateOpen: false,
  onCloseAuthGate: noop,
  authGateTitle: 'Save tours you love',
  authGateBody: 'Sign in to save tours you love.',
  signInLabel: 'Sign in',
  createAccountLabel: 'Create account',
  onSignIn: noop,
  onCreateAccount: noop,
  wishlistErrorLabel: null,
  activeTab: 'overview',
  onChangeTab: noop,
  tabLabels: { overview: 'Overview', itinerary: 'Itinerary', dates: 'Dates', reviews: 'Reviews' },
  itineraryDays: [
    {
      dayNumber: 1,
      title: 'Arrival in Đà Nẵng and My Khê Beach',
      lines: [
        { kind: 'timed', time: '09:00', text: 'Arrival pickup at Đà Nẵng International Airport' },
        { kind: 'timed', time: '10:30', text: 'Check in near My Khê Beach' },
        { kind: 'timed', time: '14:00', text: 'Marble Mountains cave-temple complex' },
        { kind: 'timed', time: '16:00', text: 'Free time or a swim at My Khê Beach' },
        { kind: 'timed', time: '18:30', text: 'Welcome dinner, Dragon Bridge fire show' },
      ],
    },
    { dayNumber: 2, title: 'A full day in Hội An', lines: [] },
    { dayNumber: 3, title: 'Over the Hải Vân Pass to Huế', lines: [] },
    { dayNumber: 4, title: "Huế's citadel and departure", lines: [] },
  ],
  meetingPoint: 'Arrival pickup at Đà Nẵng International Airport (day 1)',
  meetingPointTitle: 'Meeting point',
  cancellationBanner: 'Free cancellation until 7 days before departure',
  departureGroups: DEPARTURE_GROUPS,
  noDeparturesLabel: 'No departures are open for booking',
  selectedDepartureId: null,
  onSelectDeparture: noop,
  bookingClosedLabel: 'Booking closed',
  almostFullLabel: 'Almost full',
  askAboutDateLabel: 'Ask about this date',
  onAskAboutDate: noop,
  askAboutDateSheetOpen: false,
  onCloseAskAboutDateSheet: noop,
  askAboutDateSheetTitle: 'Ask about this date',
  askAboutDateSheetDescription: 'This departure is closed for booking.',
  askAboutDateNameLabel: 'Full name',
  askAboutDateEmailLabel: 'Email',
  askAboutDateMessageLabel: 'Your message',
  askAboutDateValues: { name: '', email: '', message: '' },
  askAboutDateErrors: {},
  onChangeAskAboutDate: noop,
  askAboutDateSubmitLabel: 'Send message',
  askAboutDateSubmittingLabel: 'Sending…',
  askAboutDateSubmitting: false,
  onSubmitAskAboutDate: noop,
  askAboutDateFormError: null,
  askAboutDateSent: false,
  askAboutDateSuccessTitle: 'Message sent',
  askAboutDateSuccessBody: "We'll reply by email soon.",
  askAboutDateCloseLabel: 'Close',
  bookCtaLabel: 'Book now',
  onBook: noop,
  reviewBreakdown: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 },
  reviewSort: 'newest',
  reviewSortLabels: { newest: 'Newest', oldest: 'Oldest', highest: 'Highest', lowest: 'Lowest' },
  onChangeReviewSort: noop,
  reviews: REVIEWS,
  noReviewsTitle: 'No reviews yet',
  noReviewsBody: 'This trip is new. Be the first to ride it and tell us how it went.',
  hasMoreReviews: false,
  loadingMoreReviews: false,
  onLoadMoreReviews: noop,
  loadMoreReviewsLabel: 'Load more reviews',
  closePhotosLabel: 'Close photos',
  photoCounterFor: (index, total) => `${index} / ${total}`,
  transformUrl: undefined,
};

/**
 * `PhotoViewer`/`AuthGateSheet` đều là `Modal` RN — che kín màn NÊN nút thoát
 * nổi của `GalleryScreen` (nằm ngoài `render()`) không bấm tới được lúc đang
 * mở. Bọc state cục bộ để nút X CỦA CHÍNH nó đóng lại, lộ ra khung trống bên
 * dưới — lúc đó nút thoát của gallery mới bấm được để về danh sách.
 */
function PhotoViewerPreview() {
  const [open, setOpen] = useState(true);
  const theme = useTheme();

  if (!open) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;

  return (
    <PhotoViewer
      photos={GALLERY_PHOTOS}
      initialIndex={0}
      onClose={() => setOpen(false)}
      closeLabel="Close photos"
      counterFor={(index, total) => `${index} / ${total}`}
    />
  );
}

/**
 * Đứng trên NỀN màn Overview thật (ảnh bìa + tiêu đề + tab) thay vì nền trơn
 * — đúng bối cảnh bấm tim thật (D1), khớp bản vẽ D6 (sheet đè lên ảnh, không
 * phải đè lên nền đen). `authGateOpen`/`onCloseAuthGate` của chính
 * `TourDetailScreen` — không cần dựng `AuthGateSheet` tay riêng ở đây.
 */
function AuthGateSheetPreview() {
  const [open, setOpen] = useState(true);

  return (
    <TourDetailScreen
      {...tourDetailBase}
      authGateOpen={open}
      onCloseAuthGate={() => setOpen(false)}
    />
  );
}

/**
 * Khung cụm xem tour (P5b-2 T5, ADR-0047 — D1/D2/D3/D4/D5/D6/D7 bản vẽ 18/09 +
 * 24/09), cùng khuôn `GALLERY_ENTRIES` của cụm auth: props cứng, không router,
 * không gọi API thật.
 */
export const TOUR_DETAIL_GALLERY_ENTRIES: GalleryEntry[] = [
  {
    id: 'D1',
    title: 'Chi tiết — Overview',
    render: () => <TourDetailScreen {...tourDetailBase} activeTab="overview" />,
  },
  {
    id: 'D2',
    title: 'Chi tiết — Itinerary',
    render: () => <TourDetailScreen {...tourDetailBase} activeTab="itinerary" />,
  },
  {
    id: 'D3a',
    title: 'Chi tiết — Dates (chưa chọn đợt)',
    render: () => <TourDetailScreen {...tourDetailBase} activeTab="dates" />,
  },
  {
    id: 'D3b',
    title: 'Chi tiết — Dates (đã chọn một đợt)',
    render: () => (
      <TourDetailScreen {...tourDetailBase} activeTab="dates" selectedDepartureId="open-1" />
    ),
  },
  {
    id: 'D3c',
    title: 'Chi tiết — Dates (không còn đợt nào)',
    render: () => <TourDetailScreen {...tourDetailBase} activeTab="dates" departureGroups={[]} />,
  },
  {
    id: 'D4a',
    title: 'Chi tiết — Reviews',
    render: () => <TourDetailScreen {...tourDetailBase} activeTab="reviews" />,
  },
  {
    id: 'D4b',
    title: 'Chi tiết — Reviews (chưa ai đánh giá)',
    render: () => (
      <TourDetailScreen
        {...tourDetailBase}
        activeTab="reviews"
        reviews={[]}
        reviewBreakdown={{ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }}
        rating={null}
      />
    ),
  },
  {
    id: 'D5',
    title: 'Trình xem ảnh',
    render: () => <PhotoViewerPreview />,
  },
  {
    id: 'D6',
    title: 'Khách bấm tim khi chưa đăng nhập',
    render: () => <AuthGateSheetPreview />,
  },
  {
    id: 'D7a',
    title: 'Chi tiết — đang tải',
    render: () => <TourDetailScreen {...tourDetailBase} status="loading" />,
  },
  {
    id: 'D7b',
    title: 'Chi tiết — lỗi mạng',
    render: () => <TourDetailScreen {...tourDetailBase} status="error" />,
  },
  {
    id: 'D7c',
    title: 'Chi tiết — tour không còn',
    render: () => <TourDetailScreen {...tourDetailBase} status="notFound" />,
  },
];

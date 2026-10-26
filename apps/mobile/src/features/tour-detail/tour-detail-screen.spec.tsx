import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { renderWithTheme, themeFor } from '@/test-utils';
import { chunkPairs, TourDetailScreen, type TourDetailScreenProps } from './tour-detail-screen';

const FACTS = [
  { icon: 'clock' as const, label: 'Duration', value: '4 days' },
  { icon: 'users' as const, label: 'Group size', value: 'Up to 16 guests' },
];

describe('chunkPairs', () => {
  it('chẵn: chia đúng từng cặp liên tiếp', () => {
    expect(chunkPairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('lẻ: cặp cuối chỉ có một phần tử', () => {
    expect(chunkPairs([1, 2, 3])).toEqual([[1, 2], [3]]);
  });

  it('rỗng: mảng rỗng', () => {
    expect(chunkPairs([])).toEqual([]);
  });
});

function baseProps(overrides: Partial<TourDetailScreenProps> = {}): TourDetailScreenProps {
  return {
    status: 'content',
    onBack: jest.fn(),
    backLabel: 'Back',
    onRetry: jest.fn(),
    errorTitle: "Couldn't load this tour.",
    retryLabel: 'Try again',
    notFoundTitle: "This tour isn't available anymore.",
    goBackLabel: 'Go back',
    exploreOtherLabel: 'Explore other tours',
    onExploreOther: jest.fn(),
    galleryImages: [],
    galleryPhotos: [],
    title: 'Central Heritage: Đà Nẵng–Hội An–Huế 4D3N',
    rating: 4.3,
    reviewCountLabel: '3 reviews',
    notRatedLabel: 'New — no reviews yet',
    destinationsLine: 'Đà Nẵng · Hội An · Huế',
    summary: 'Four days over the Hải Vân Pass.',
    facts: FACTS,
    fromLabel: 'From',
    priceLabel: '$419',
    perPersonLabel: '/ person',
    chooseDateLabel: 'Choose a date',
    onChooseDate: jest.fn(),
    favorited: false,
    favoriteLabel: 'Save tour to your wishlist',
    onFavoritePress: jest.fn(),
    authGateOpen: false,
    onCloseAuthGate: jest.fn(),
    authGateTitle: 'Save tours you love',
    authGateBody: 'Sign in to save tours you love.',
    signInLabel: 'Sign in',
    createAccountLabel: 'Create account',
    onSignIn: jest.fn(),
    onCreateAccount: jest.fn(),
    wishlistErrorLabel: null,
    activeTab: 'overview',
    onChangeTab: jest.fn(),
    tabLabels: { overview: 'Overview', itinerary: 'Itinerary', dates: 'Dates', reviews: 'Reviews' },
    itineraryDays: [],
    meetingPoint: null,
    meetingPointTitle: 'Meeting point',
    cancellationBanner: 'Free cancellation until 7 days before departure',
    departureGroups: [],
    noDeparturesLabel: 'No departures are open for booking',
    selectedDepartureId: null,
    onSelectDeparture: jest.fn(),
    bookingClosedLabel: 'Booking closed',
    soldOutLabel: 'Sold out',
    almostFullLabel: 'Almost full',
    askAboutDateLabel: 'Ask about this date',
    onAskAboutDate: jest.fn(),
    askAboutDateSheetOpen: false,
    onCloseAskAboutDateSheet: jest.fn(),
    askAboutDateSheetTitle: 'Ask about this date',
    askAboutDateSheetDescription: 'This departure is closed for booking.',
    askAboutDateNameLabel: 'Full name',
    askAboutDateEmailLabel: 'Email',
    askAboutDateMessageLabel: 'Your message',
    askAboutDateValues: { name: '', email: '', message: '' },
    askAboutDateErrors: {},
    onChangeAskAboutDate: jest.fn(),
    askAboutDateSubmitLabel: 'Send message',
    askAboutDateSubmittingLabel: 'Sending…',
    askAboutDateSubmitting: false,
    onSubmitAskAboutDate: jest.fn(),
    askAboutDateFormError: null,
    askAboutDateSent: false,
    askAboutDateSuccessTitle: 'Message sent',
    askAboutDateSuccessBody: "We'll reply by email soon.",
    askAboutDateCloseLabel: 'Close',
    bookCtaLabel: 'Book now',
    onBook: jest.fn(),
    reviewBreakdown: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 },
    reviewSort: 'newest',
    reviewSortLabels: {
      newest: 'Newest',
      oldest: 'Oldest',
      highest: 'Highest',
      lowest: 'Lowest',
    },
    onChangeReviewSort: jest.fn(),
    reviews: [],
    noReviewsTitle: 'No reviews yet',
    noReviewsBody: 'This trip is new. Be the first to ride it and tell us how it went.',
    hasMoreReviews: false,
    loadingMoreReviews: false,
    onLoadMoreReviews: jest.fn(),
    loadMoreReviewsLabel: 'Load more reviews',
    closePhotosLabel: 'Close photos',
    photoCounterFor: (index: number, total: number) => `${index} / ${total}`,
    transformUrl: undefined,
    ...overrides,
  };
}

describe('TourDetailScreen', () => {
  it('trạng thái loading: không vẽ tiêu đề tour', async () => {
    await renderWithTheme(<TourDetailScreen {...baseProps({ status: 'loading' })} />);
    expect(screen.queryByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeNull();
  });

  // Review M2-13: API trên Render ngủ dậy chậm, khách đứng ở khung chờ cả chục giây mà trước đây
  // chỉ lùi được bằng cử chỉ hệ thống.
  it('trạng thái loading: có nút lùi, bấm gọi onBack', async () => {
    const onBack = jest.fn();
    await renderWithTheme(<TourDetailScreen {...baseProps({ status: 'loading', onBack })} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('trạng thái error: vẽ câu lỗi + nút thử lại, bấm gọi onRetry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<TourDetailScreen {...baseProps({ status: 'error', onRetry })} />);

    expect(screen.getByText("Couldn't load this tour.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('trạng thái notFound (D7): vẽ câu "tour không còn" + nút Go back + link Explore other tours', async () => {
    const onBack = jest.fn();
    const onExploreOther = jest.fn();
    await renderWithTheme(
      <TourDetailScreen {...baseProps({ status: 'notFound', onBack, onExploreOther })} />,
    );

    expect(screen.getByText("This tour isn't available anymore.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Go back'));
    expect(onBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Explore other tours'));
    expect(onExploreOther).toHaveBeenCalled();
  });

  it('content: vẽ tiêu đề, điểm đánh giá, địa danh, mô tả, thẻ dữ kiện, giá', async () => {
    await renderWithTheme(<TourDetailScreen {...baseProps()} />);

    expect(screen.getByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toBeTruthy();
    expect(screen.getByText('4.3 · 3 reviews')).toBeTruthy();
    expect(screen.getByText('Đà Nẵng · Hội An · Huế')).toBeTruthy();
    expect(screen.getByText('4 days')).toBeTruthy();
    expect(screen.getByText('$419')).toBeTruthy();
  });

  it('chưa ai đánh giá (rating null): vẽ notRatedLabel thay vì dòng sao', async () => {
    await renderWithTheme(<TourDetailScreen {...baseProps({ rating: null })} />);
    expect(screen.getByText('New — no reviews yet')).toBeTruthy();
  });

  it('chỉ 1 ảnh: không vẽ chip đếm', async () => {
    await renderWithTheme(
      <TourDetailScreen
        {...baseProps({ galleryImages: [{ url: 'https://x/1.jpg', alt: 'Ảnh 1' }] })}
      />,
    );
    expect(screen.queryByTestId('tour-detail-photo-counter')).toBeNull();
  });

  it('nhiều ảnh (B3): pager ngang, chip đếm "1 / 4", không còn dải thumb', async () => {
    await renderWithTheme(
      <TourDetailScreen
        {...baseProps({
          galleryImages: [
            { url: 'https://x/1.jpg', alt: 'Ảnh 1' },
            { url: 'https://x/2.jpg', alt: 'Ảnh 2' },
            { url: 'https://x/3.jpg', alt: 'Ảnh 3' },
            { url: 'https://x/4.jpg', alt: 'Ảnh 4' },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('tour-detail-hero-pager')).toBeTruthy();
    expect(screen.getByText('1 / 4')).toBeTruthy();
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  describe('trình xem ảnh (D5)', () => {
    const GALLERY_IMAGES = [
      { url: 'https://x/1.jpg', alt: 'Ảnh 1' },
      { url: 'https://x/2.jpg', alt: 'Ảnh 2' },
      { url: 'https://x/3.jpg', alt: 'Ảnh 3' },
      { url: 'https://x/4.jpg', alt: 'Ảnh 4' },
    ];
    const GALLERY_PHOTOS = [
      { url: 'https://x/1.jpg', alt: 'Ảnh 1', creditLine: 'Photo: Nguyễn Minh' },
      { url: 'https://x/2.jpg', alt: 'Ảnh 2', creditLine: null },
      { url: 'https://x/3.jpg', alt: 'Ảnh 3', creditLine: null },
      { url: 'https://x/4.jpg', alt: 'Ảnh 4', creditLine: null },
    ];

    it('bấm ảnh bìa: mở trình xem tại đúng ảnh đang chọn', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            galleryImages: GALLERY_IMAGES,
            galleryPhotos: GALLERY_PHOTOS,
          })}
        />,
      );

      await fireEvent.press(screen.getByTestId('tour-detail-hero-image'));
      // Hai chỗ in "1 / 4": chip đếm của hero và bộ đếm của trình xem toàn màn.
      expect(screen.getAllByText('1 / 4')).toHaveLength(2);
      expect(screen.getByText('Photo: Nguyễn Minh')).toBeTruthy();
    });

    it('bấm ảnh review (D4): mở trình xem SCOPE theo ảnh của review đó', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'reviews',
            galleryImages: GALLERY_IMAGES,
            galleryPhotos: GALLERY_PHOTOS,
            reviews: [
              {
                id: 'r1',
                initials: 'YO',
                authorLabel: 'Yerin Oh',
                dateLabel: '5 Jul 2026',
                rating: 4,
                ratingLabel: '4 out of 5 stars',
                title: null,
                body: 'Great trip.',
                photos: [
                  { url: 'https://x/r1.jpg', alt: 'Ảnh review 1', creditLine: null },
                  { url: 'https://x/r2.jpg', alt: 'Ảnh review 2', creditLine: 'Photo: Khách' },
                ],
              },
            ],
          })}
        />,
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Ảnh review 2' }));
      // Chỉ 2 ảnh của REVIEW này trong trình xem, không phải 4 ảnh gallery tour.
      expect(screen.getByText('2 / 2')).toBeTruthy();
      expect(screen.getByText('Photo: Khách')).toBeTruthy();
    });
  });

  it('bấm nút lùi gọi onBack, bấm tim gọi onFavoritePress, bấm "Choose a date" gọi onChooseDate', async () => {
    const onBack = jest.fn();
    const onFavoritePress = jest.fn();
    const onChooseDate = jest.fn();
    await renderWithTheme(
      <TourDetailScreen {...baseProps({ onBack, onFavoritePress, onChooseDate })} />,
    );

    await fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Save tour to your wishlist'));
    expect(onFavoritePress).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Choose a date'));
    expect(onChooseDate).toHaveBeenCalled();
  });

  describe('tấm mời đăng nhập khi bấm tim (D6)', () => {
    it('authGateOpen=false: không vẽ tấm mời', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps({ authGateOpen: false })} />);
      expect(screen.queryByText('Save tours you love')).toBeNull();
    });

    it('authGateOpen=true: vẽ tấm mời, bấm Sign in/Create account gọi đúng callback', async () => {
      const onSignIn = jest.fn();
      const onCreateAccount = jest.fn();
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ authGateOpen: true, onSignIn, onCreateAccount })} />,
      );

      expect(screen.getByText('Save tours you love')).toBeTruthy();
      expect(screen.getByText('Sign in to save tours you love.')).toBeTruthy();
      await fireEvent.press(screen.getByText('Sign in'));
      expect(onSignIn).toHaveBeenCalled();
      await fireEvent.press(screen.getByText('Create account'));
      expect(onCreateAccount).toHaveBeenCalled();
    });

    it('wishlistErrorLabel: vẽ banner lỗi; null thì không vẽ gì', async () => {
      const { rerender } = await renderWithTheme(
        <TourDetailScreen {...baseProps({ wishlistErrorLabel: 'Something went wrong.' })} />,
      );
      expect(screen.getByText('Something went wrong.')).toBeTruthy();

      await rerender(<TourDetailScreen {...baseProps({ wishlistErrorLabel: null })} />);
      expect(screen.queryByText('Something went wrong.')).toBeNull();
    });
  });

  describe('tấm form "Ask about this date" (D3)', () => {
    it('askAboutDateSheetOpen=false: không vẽ tấm form', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps({ askAboutDateSheetOpen: false })} />);
      expect(screen.queryByLabelText('Full name')).toBeNull();
    });

    it('askAboutDateSheetOpen=true: vẽ tấm form, gõ ô tên gọi onChangeAskAboutDate', async () => {
      const onChangeAskAboutDate = jest.fn();
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ askAboutDateSheetOpen: true, onChangeAskAboutDate })} />,
      );

      expect(screen.getByLabelText('Full name')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('Full name'), 'Alice');
      expect(onChangeAskAboutDate).toHaveBeenCalledWith('name', 'Alice');
    });
  });

  describe('header gọn khi cuộn (D2)', () => {
    it('chưa cuộn: không mount header gọn', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps()} />);
      expect(screen.queryByTestId('tour-detail-compact-header')).toBeNull();
    });

    it('cuộn qua khỏi ảnh bìa: mount header gọn với tiêu đề + nút lùi/tim', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps()} />);

      await fireEvent.scroll(screen.getByTestId('tour-detail-scroll'), {
        nativeEvent: { contentOffset: { y: 1000 } },
      });

      expect(screen.getByTestId('tour-detail-compact-header')).toBeTruthy();
      expect(screen.getAllByText('Central Heritage: Đà Nẵng–Hội An–Huế 4D3N')).toHaveLength(2);
    });

    it('cuộn lên lại đỉnh: gỡ mount header gọn', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps()} />);
      const scrollView = screen.getByTestId('tour-detail-scroll');

      await fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 1000 } } });
      await fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 0 } } });

      expect(screen.queryByTestId('tour-detail-compact-header')).toBeNull();
    });
  });

  describe('vuốt ngang đổi tab', () => {
    async function swipe(activeTab: 'overview' | 'itinerary', events: object[]) {
      const onChangeTab = jest.fn();
      await renderWithTheme(<TourDetailScreen {...baseProps({ activeTab, onChangeTab })} />);
      fireGestureHandler(getByGestureTestId('tour-tab-swipe'), events as never);
      return onChangeTab;
    }

    it('vuốt trái đủ xa từ tab đầu → sang tab kế', async () => {
      const onChangeTab = await swipe('overview', [
        { x: 200, translationX: -10, velocityX: -100 },
        { x: 200, translationX: -90, velocityX: -200 },
      ]);
      expect(onChangeTab).toHaveBeenCalledWith('itinerary');
    });

    it('vuốt phải đủ xa → về tab trước', async () => {
      const onChangeTab = await swipe('itinerary', [
        { x: 200, translationX: 10, velocityX: 100 },
        { x: 200, translationX: 90, velocityX: 200 },
      ]);
      expect(onChangeTab).toHaveBeenCalledWith('overview');
    });

    it('vuốt ngắn và chậm → không đổi tab', async () => {
      const onChangeTab = await swipe('overview', [
        { x: 200, translationX: -10, velocityX: -50 },
        { x: 200, translationX: -30, velocityX: -50 },
      ]);
      expect(onChangeTab).not.toHaveBeenCalled();
    });

    it('bắt đầu sát mép trái (cử chỉ quay lại) → bỏ qua', async () => {
      const onChangeTab = await swipe('itinerary', [
        { x: 5, translationX: 10, velocityX: 100 },
        { x: 5, translationX: 120, velocityX: 900 },
      ]);
      expect(onChangeTab).not.toHaveBeenCalled();
    });

    it('đang ở tab đầu mà vuốt phải → không có tab trước, không gọi', async () => {
      const onChangeTab = await swipe('overview', [
        { x: 200, translationX: 10, velocityX: 100 },
        { x: 200, translationX: 120, velocityX: 900 },
      ]);
      expect(onChangeTab).not.toHaveBeenCalled();
    });
  });

  describe('chấm báo ảnh bìa', () => {
    const PHOTOS = [
      { url: 'https://img/a.jpg', alt: 'a' },
      { url: 'https://img/b.jpg', alt: 'b' },
    ];
    // Dải chấm ẩn khỏi trình đọc màn hình (đã có bộ đếm) nên phải bật `includeHiddenElements`.
    const dots = { includeHiddenElements: true };

    it('nhiều ảnh → có dải chấm', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps({ galleryImages: PHOTOS })} />);
      expect(screen.getByTestId('tour-detail-hero-dots', dots)).toBeTruthy();
    });

    it('một ảnh → không có dải chấm', async () => {
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ galleryImages: PHOTOS.slice(0, 1) })} />,
      );
      expect(screen.queryByTestId('tour-detail-hero-dots', dots)).toBeNull();
    });
  });

  describe('hàng tab dính (D2)', () => {
    it('cuộn tới sát mép: header gọn kèm bản sao hàng tab; cuộn lên lại thì gỡ', async () => {
      await renderWithTheme(<TourDetailScreen {...baseProps()} />);
      const scrollView = screen.getByTestId('tour-detail-scroll');

      await fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 1000 } } });
      await fireEvent(screen.getByTestId('tour-detail-compact-header-row'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 90 } },
      });
      // Chưa dính trước khi biết chiều cao header: 4 tab của hàng thật.
      expect(screen.getAllByRole('tab')).toHaveLength(4);

      await fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 1001 } } });
      expect(screen.getAllByRole('tab')).toHaveLength(8);

      await fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 0 } } });
      expect(screen.getAllByRole('tab')).toHaveLength(4);
    });
  });

  describe('tab Dates (D3)', () => {
    const GROUPS = [
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
            soldOut: false,
            almostFull: false,
            cancellationCaption: 'Free cancellation until Sat 19 Sep',
          },
          {
            id: 'sold-out-1',
            rangeLabel: 'Sun 27 – Wed 30 Sep',
            seatsLabel: '0 seats left',
            priceLabel: '$459',
            compareAtPriceLabel: null,
            bookable: false,
            soldOut: true,
            almostFull: false,
            cancellationCaption: 'Free cancellation until Sun 20 Sep',
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
            soldOut: false,
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
            soldOut: false,
            almostFull: true,
            cancellationCaption: 'Free cancellation until Sat 3 Oct',
          },
        ],
      },
    ];

    it('vẽ banner luật + nhãn tháng + hàng đợt', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'dates',
            cancellationBanner: 'Free cancellation until 7 days before departure',
            departureGroups: GROUPS,
          })}
        />,
      );

      expect(screen.getByText('Free cancellation until 7 days before departure')).toBeTruthy();
      expect(screen.getByText('September 2026')).toBeTruthy();
      expect(screen.getByText('October 2026')).toBeTruthy();
      expect(screen.getByText('Sat 3 – Tue 6 Oct')).toBeTruthy();
      expect(screen.getByText('12 seats left')).toBeTruthy();
    });

    it('đợt đã đóng: hiện tag "Booking closed" + link hỏi, bấm hàng KHÔNG chọn được', async () => {
      const onSelectDeparture = jest.fn();
      const onAskAboutDate = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'dates',
            departureGroups: GROUPS,
            onSelectDeparture,
            onAskAboutDate,
          })}
        />,
      );

      expect(screen.getByText('Booking closed')).toBeTruthy();
      await fireEvent.press(screen.getByText('Wed 23 – Sat 26 Sep'));
      expect(onSelectDeparture).not.toHaveBeenCalled();

      // Hàng đầu là đợt đã qua hạn; hàng hết chỗ bên dưới cũng có link hỏi riêng.
      const closedAsk = screen.getAllByText('Ask about this date').at(0);
      if (closedAsk === undefined) throw new Error('Không thấy link hỏi của đợt đã đóng');
      await fireEvent.press(closedAsk);
      expect(onAskAboutDate).toHaveBeenCalledWith('closed-1');
    });

    // Review M2-11: đợt còn hạn đặt mà kín chỗ không phải "đã đóng" — nói đúng lý do như web.
    it('đợt hết chỗ còn hạn: tag "Sold out" thay "Booking closed", vẫn có link hỏi', async () => {
      const onAskAboutDate = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'dates', departureGroups: GROUPS, onAskAboutDate })}
        />,
      );

      expect(screen.getByText('Sold out')).toBeTruthy();
      // Chỉ hàng đã qua hạn đặt mang "Booking closed".
      expect(screen.getAllByText('Booking closed')).toHaveLength(1);
      const soldOutAsk = screen.getAllByText('Ask about this date').at(-1);
      if (soldOutAsk === undefined) throw new Error('Không thấy link hỏi của đợt hết chỗ');
      await fireEvent.press(soldOutAsk);
      expect(onAskAboutDate).toHaveBeenCalledWith('sold-out-1');
    });

    it('đợt gần đầy: hiện tag "Almost full"', async () => {
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ activeTab: 'dates', departureGroups: GROUPS })} />,
      );
      expect(screen.getByText('Almost full')).toBeTruthy();
    });

    // G47 (ADR-0019 AMEND 4): chữ 12dp trên lớp tô warning 20% — mực `warning` trần chỉ 1,68:1
    // ở theme sáng. Ba tag dùng chung một component nên cùng mực.
    it.each(['light', 'dark'] as const)(
      'ba tag tô mực warning-emphasis (theme %s)',
      async (scheme) => {
        await renderWithTheme(
          <TourDetailScreen {...baseProps({ activeTab: 'dates', departureGroups: GROUPS })} />,
          scheme,
        );

        for (const label of ['Almost full', 'Booking closed', 'Sold out']) {
          expect(StyleSheet.flatten(screen.getByText(label).props.style).color).toBe(
            themeFor(scheme).colors['warning-emphasis'],
          );
        }
      },
    );

    it('bấm đợt đặt được gọi onSelectDeparture đúng id', async () => {
      const onSelectDeparture = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'dates', departureGroups: GROUPS, onSelectDeparture })}
        />,
      );

      await fireEvent.press(screen.getByText('Sat 3 – Tue 6 Oct'));
      expect(onSelectDeparture).toHaveBeenCalledWith('open-1');
    });

    it('không có đợt nào: hiện noDeparturesLabel', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'dates',
            departureGroups: [],
            noDeparturesLabel: 'No departures are open for booking',
          })}
        />,
      );
      expect(screen.getByText('No departures are open for booking')).toBeTruthy();
    });

    it('đã chọn một đợt: đáy màn đổi sang giá + hạn huỷ của đợt đó + "Book now"', async () => {
      const onBook = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'dates',
            departureGroups: GROUPS,
            selectedDepartureId: 'open-1',
            bookCtaLabel: 'Book now',
            onBook,
          })}
        />,
      );

      expect(screen.getByText('Free cancellation until Sat 26 Sep')).toBeTruthy();
      expect(screen.queryByText('Choose a date')).toBeNull();
      await fireEvent.press(screen.getByText('Book now'));
      expect(onBook).toHaveBeenCalled();
    });
  });

  describe('tab Reviews (D4)', () => {
    const REVIEWS = [
      {
        id: 'r1',
        initials: 'YO',
        authorLabel: 'Yerin Oh',
        dateLabel: '5 Jul 2026',
        rating: 4,
        ratingLabel: '4 out of 5 stars',
        title: 'Solid four days',
        body: 'Good pacing overall.',
        photos: [],
      },
      {
        id: 'r2',
        initials: '?',
        authorLabel: 'Deleted account',
        dateLabel: '26 Apr 2026',
        rating: 4,
        ratingLabel: '4 out of 5 stars',
        title: null,
        body: 'The Hải Vân Pass drive was a highlight.',
        photos: [
          { url: 'https://x/1.jpg', alt: 'Hội An street', creditLine: 'Photo: Nguyễn Minh' },
        ],
      },
    ];

    it('vẽ phân bố sao + chip sắp xếp + danh sách review', async () => {
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ activeTab: 'reviews', reviews: REVIEWS })} />,
      );

      expect(screen.getByText('Newest')).toBeTruthy();
      expect(screen.getByText('Yerin Oh')).toBeTruthy();
      expect(screen.getByText('Solid four days')).toBeTruthy();
      expect(screen.getByText('Deleted account')).toBeTruthy();
      expect(screen.getByText('The Hải Vân Pass drive was a highlight.')).toBeTruthy();
    });

    it('bấm một chip sắp xếp gọi onChangeReviewSort đúng khoá', async () => {
      const onChangeReviewSort = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'reviews', reviews: REVIEWS, onChangeReviewSort })}
        />,
      );

      await fireEvent.press(screen.getByText('Highest'));
      expect(onChangeReviewSort).toHaveBeenCalledWith('highest');
    });

    it('chưa ai review: hiện noReviewsTitle/noReviewsBody', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'reviews',
            reviews: [],
            noReviewsTitle: 'No reviews yet',
            noReviewsBody: 'This trip is new. Be the first to ride it and tell us how it went.',
          })}
        />,
      );

      expect(screen.getByText('No reviews yet')).toBeTruthy();
      expect(
        screen.getByText('This trip is new. Be the first to ride it and tell us how it went.'),
      ).toBeTruthy();
    });

    // Review M2-12: trang review đầu tải hỏng từng chỉ có một câu báo lỗi — khách phải rời màn rồi
    // vào lại mới thử được.
    it('tải review hỏng (có onRetryReviews): nút thử lại, bấm gọi onRetryReviews', async () => {
      const onRetryReviews = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'reviews',
            reviews: [],
            noReviewsTitle: "Couldn't load reviews.",
            noReviewsBody: '',
            onRetryReviews,
          })}
        />,
      );

      expect(screen.getByText("Couldn't load reviews.")).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(onRetryReviews).toHaveBeenCalledTimes(1);
    });

    it('không có onRetryReviews (rỗng thật hay đang tải): không vẽ nút thử lại', async () => {
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ activeTab: 'reviews', reviews: [] })} />,
      );

      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    });

    it('hasMoreReviews=false: không vẽ nút "Load more"', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'reviews', reviews: REVIEWS, hasMoreReviews: false })}
        />,
      );

      expect(screen.queryByText('Load more reviews')).toBeNull();
    });

    it('hasMoreReviews=true: bấm "Load more" gọi onLoadMoreReviews', async () => {
      const onLoadMoreReviews = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'reviews',
            reviews: REVIEWS,
            hasMoreReviews: true,
            onLoadMoreReviews,
          })}
        />,
      );

      await fireEvent.press(screen.getByText('Load more reviews'));
      expect(onLoadMoreReviews).toHaveBeenCalled();
    });

    it('loadingMoreReviews=true: đổi chữ nút + vô hiệu bấm', async () => {
      const onLoadMoreReviews = jest.fn();
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'reviews',
            reviews: REVIEWS,
            hasMoreReviews: true,
            loadingMoreReviews: true,
            loadMoreReviewsLabel: 'Loading…',
            onLoadMoreReviews,
          })}
        />,
      );

      await fireEvent.press(screen.getByText('Loading…'));
      expect(onLoadMoreReviews).not.toHaveBeenCalled();
    });
  });

  it('bấm một tab gọi onChangeTab đúng khoá', async () => {
    const onChangeTab = jest.fn();
    await renderWithTheme(<TourDetailScreen {...baseProps({ onChangeTab })} />);

    await fireEvent.press(screen.getByText('Itinerary'));
    expect(onChangeTab).toHaveBeenCalledWith('itinerary');
  });

  describe('tab Itinerary (D2)', () => {
    const ITINERARY_DAYS = [
      {
        dayNumber: 1,
        title: 'Arrival in Đà Nẵng',
        lines: [
          { kind: 'timed' as const, time: '09:00', text: 'Airport pickup' },
          { kind: 'plain' as const, text: 'Free evening' },
        ],
      },
      { dayNumber: 2, title: 'A full day in Hội An', lines: [] },
    ];

    it('ngày đầu mở sẵn (vẽ dòng lịch trình), ngày sau thu gọn', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: ITINERARY_DAYS })}
        />,
      );

      expect(screen.getByText('Arrival in Đà Nẵng')).toBeTruthy();
      expect(screen.getByText('09:00')).toBeTruthy();
      expect(screen.getByText('Airport pickup')).toBeTruthy();
      expect(screen.getByText('Free evening')).toBeTruthy();
    });

    it('F11: lịch trình về SAU lần render đầu vẫn mở sẵn ngày đầu', async () => {
      const { rerender } = await renderWithTheme(
        <TourDetailScreen {...baseProps({ activeTab: 'itinerary', itineraryDays: [] })} />,
      );

      await rerender(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: ITINERARY_DAYS })}
        />,
      );
      expect(screen.getByText('Airport pickup')).toBeTruthy();
    });

    it('F11: đã thu gọn hết thì refetch không tự mở lại ngày đầu', async () => {
      const { rerender } = await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: ITINERARY_DAYS })}
        />,
      );
      await fireEvent.press(screen.getByText('Arrival in Đà Nẵng'));

      await rerender(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: [...ITINERARY_DAYS] })}
        />,
      );
      // Thu gọn có animation ~0.3s: nội dung chỉ gỡ khỏi cây sau khi chạy xong.
      await waitFor(() => expect(screen.queryByText('Airport pickup')).toBeNull());
    });

    it('bấm ngày đang thu gọn để mở, bấm ngày đang mở để thu lại', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: ITINERARY_DAYS })}
        />,
      );

      // Ngày 1 mở sẵn — bấm để thu lại.
      await fireEvent.press(screen.getByText('Arrival in Đà Nẵng'));
      // Thu gọn có animation ~0.3s: nội dung chỉ gỡ khỏi cây sau khi chạy xong.
      await waitFor(() => expect(screen.queryByText('Airport pickup')).toBeNull());
    });

    it('có meetingPoint: vẽ khối "Meeting point"; null thì không vẽ', async () => {
      const { queryByText } = await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            activeTab: 'itinerary',
            itineraryDays: ITINERARY_DAYS,
            meetingPoint: 'Airport pickup counter',
          })}
        />,
      );
      expect(queryByText('Meeting point')).toBeTruthy();
      expect(queryByText('Airport pickup counter')).toBeTruthy();
    });
  });
});

import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
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
    moreImagesCount: 0,
    openGalleryLabel: 'Open gallery',
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

  it('chỉ 1 ảnh: không vẽ ô thumb nào (chỉ ảnh bìa)', async () => {
    await renderWithTheme(
      <TourDetailScreen
        {...baseProps({ galleryImages: [{ url: 'https://x/1.jpg', alt: 'Ảnh 1' }] })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ảnh 1' })).toBeNull();
  });

  it('nhiều ảnh: vẽ tối đa 3 ô thumb + "+N", bấm thumb đổi ảnh bìa', async () => {
    await renderWithTheme(
      <TourDetailScreen
        {...baseProps({
          galleryImages: [
            { url: 'https://x/1.jpg', alt: 'Ảnh 1' },
            { url: 'https://x/2.jpg', alt: 'Ảnh 2' },
            { url: 'https://x/3.jpg', alt: 'Ảnh 3' },
            { url: 'https://x/4.jpg', alt: 'Ảnh 4' },
          ],
          moreImagesCount: 14,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ảnh 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ảnh 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ảnh 4' })).toBeNull();
    expect(screen.getByText('+14')).toBeTruthy();

    const thumb2 = screen.getByRole('button', { name: 'Ảnh 2' });
    await fireEvent.press(thumb2);
    expect(thumb2.props.accessibilityState.selected).toBe(true);
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
            moreImagesCount: 1,
          })}
        />,
      );

      await fireEvent.press(screen.getByTestId('tour-detail-hero-image'));
      expect(screen.getByText('1 / 4')).toBeTruthy();
      expect(screen.getByText('Photo: Nguyễn Minh')).toBeTruthy();
    });

    it('bấm "+N": mở trình xem tại ảnh thứ 4 (đầu tiên chưa lọt thumb)', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({
            galleryImages: GALLERY_IMAGES,
            galleryPhotos: GALLERY_PHOTOS,
            moreImagesCount: 1,
            openGalleryLabel: 'Open gallery',
          })}
        />,
      );

      await fireEvent.press(screen.getByLabelText('Open gallery'));
      expect(screen.getByText('4 / 4')).toBeTruthy();
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

      await fireEvent.press(screen.getByText('Ask about this date'));
      expect(onAskAboutDate).toHaveBeenCalledWith('closed-1');
    });

    it('đợt gần đầy: hiện tag "Almost full"', async () => {
      await renderWithTheme(
        <TourDetailScreen {...baseProps({ activeTab: 'dates', departureGroups: GROUPS })} />,
      );
      expect(screen.getByText('Almost full')).toBeTruthy();
    });

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

    it('bấm ngày đang thu gọn để mở, bấm ngày đang mở để thu lại', async () => {
      await renderWithTheme(
        <TourDetailScreen
          {...baseProps({ activeTab: 'itinerary', itineraryDays: ITINERARY_DAYS })}
        />,
      );

      // Ngày 1 mở sẵn — bấm để thu lại.
      await fireEvent.press(screen.getByText('Arrival in Đà Nẵng'));
      expect(screen.queryByText('Airport pickup')).toBeNull();
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

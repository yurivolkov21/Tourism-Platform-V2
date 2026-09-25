import { isDefinedError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PublicReview, windowDaysForTripLength } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { consumePendingReplay, setPendingReturn } from '@/features/auth/return-to';
import {
  type AskAboutDateErrors,
  type AskAboutDateField,
  type AskAboutDateState,
  buildAskAboutDatePayload,
  validateAskAboutDate,
} from '@/features/tour-detail/ask-about-date';
import {
  ALMOST_FULL_THRESHOLD,
  formatDepartureDate,
  formatDepartureRange,
  groupDeparturesByMonth,
} from '@/features/tour-detail/departures';
import { parseItineraryDescription } from '@/features/tour-detail/itinerary';
import {
  mediaCreditText,
  photoDisplayUrl,
  type TourDetailPhoto,
} from '@/features/tour-detail/photo-viewer';
import { formatReviewDate, reviewAuthorInitials } from '@/features/tour-detail/reviews';
import {
  type TourDetailDepartureGroup,
  type TourDetailFact,
  type TourDetailItineraryDay,
  type TourDetailReview,
  type TourDetailReviewSort,
  TourDetailScreen,
  type TourDetailStatus,
  type TourDetailTab,
} from '@/features/tour-detail/tour-detail-screen';
import { tourGallery } from '@/features/tour-detail/tour-gallery';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

/**
 * Route chi tiết tour (D1/D7 — ADR-0047 T5). Gọi `catalog.tours.bySlug`,
 * `NOT_FOUND` rơi vào D7 riêng (khác lỗi mạng chung). `TourDetailScreen` chỉ
 * vẽ (khuôn `features/explore`).
 */
export default function TourDetailRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<TourDetailTab>('overview');
  // D3 — không đợt nào chọn sẵn (khớp D1: đáy màn mặc định "From … Choose a
  // date", chỉ đổi "Book now" SAU khi khách tự bấm một đợt).
  const [selectedDepartureId, setSelectedDepartureId] = useState<string | null>(null);
  const [reviewSort, setReviewSort] = useState<TourDetailReviewSort>('newest');
  // D4 — phân trang review: gộp thủ công (không dùng useInfiniteQuery, không
  // có tiền lệ nào trong repo) — mỗi `page` là một query key riêng của
  // TanStack Query, route tự nối các trang đã tải vào `reviewItems`.
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewItems, setReviewItems] = useState<readonly PublicReview[]>([]);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  // D6 — tấm mời đăng nhập khi bấm tim lúc chưa có phiên; `wished` là trạng
  // thái LẠC QUAN hiển thị ngay, `wishlistError` tự xoá sau vài giây.
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [wished, setWished] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  // D3 — tấm form "Ask about this date", mở từ link trên đợt đã đóng.
  // `askAboutDateDeparture` giữ context (tourId/travelDate/nhãn) của đợt vừa
  // bấm, đọc lúc mở chứ không lúc gửi (tránh race nếu route re-render).
  const [askAboutDateOpen, setAskAboutDateOpen] = useState(false);
  const [askAboutDateDeparture, setAskAboutDateDeparture] = useState<{
    tourId: string;
    travelDate: string;
    rangeLabel: string;
  } | null>(null);
  const [askAboutDateValues, setAskAboutDateValues] = useState<AskAboutDateState>({
    name: '',
    email: '',
    message: '',
  });
  const [askAboutDateErrors, setAskAboutDateErrors] = useState<AskAboutDateErrors>({});
  const [askAboutDateFormError, setAskAboutDateFormError] = useState<string | null>(null);
  const [askAboutDateSent, setAskAboutDateSent] = useState(false);

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const queryClient = useQueryClient();
  // D6 fix — sau khi mutation tim (replay HOẶC bấm tay) settle, ép `wishlist.check`
  // refetch: màn có thể vẫn mount sẵn dưới modal đăng nhập nên GET (enabled khi vừa
  // `signedIn`) và POST save có thể đua nhau; GET cũ về sau sẽ đè `wished` sai nếu
  // không invalidate.
  function invalidateWishlistCheck() {
    queryClient.invalidateQueries({ queryKey: orpc.wishlist.check.key() });
  }

  const query = useQuery(orpc.catalog.tours.bySlug.queryOptions({ input: { slug } }));
  const reviewsQuery = useQuery(
    orpc.reviews.listByTour.queryOptions({
      input: { tourSlug: slug, sort: reviewSort, page: reviewPage },
    }),
  );
  // Nối trang mới vào danh sách đã tải; `reviewPage === 1` (đầu tour, hoặc
  // vừa đổi `reviewSort`) THAY hẳn thay vì nối, để không dính review của sort
  // cũ. `reviewTotalPages` tách riêng khỏi `reviewsQuery.data` — data rỗng
  // trong lúc đang tải trang kế (TanStack Query không giữ data cũ giữa hai
  // query key khác nhau), giữ riêng thì nút "Load more" không nhấp nháy ẩn.
  useEffect(() => {
    if (reviewsQuery.data === undefined) return;
    const data = reviewsQuery.data;
    setReviewItems((prev) => (reviewPage === 1 ? data.items : [...prev, ...data.items]));
    setReviewTotalPages(data.totalPages);
  }, [reviewsQuery.data, reviewPage]);
  const { tourDetail } = messages.mobile;
  const { toursPage } = messages;

  const tourId = query.data?.id;
  // Trạng thái wished BAN ĐẦU — chỉ hỏi khi đã đăng nhập VÀ đã có id tour.
  // Dùng `wishlist.check` (batch) với mảng MỘT phần tử thay vì tự chế endpoint
  // đơn — cùng shape server đã có (ADR A11).
  const wishlistCheckQuery = useQuery(
    orpc.wishlist.check.queryOptions({
      input: { tourIds: tourId === undefined ? [] : [tourId] },
      context: withMobileAuth(),
      enabled: signedIn && tourId !== undefined,
    }),
  );
  useEffect(() => {
    if (wishlistCheckQuery.data !== undefined && tourId !== undefined) {
      setWished(wishlistCheckQuery.data.wishedTourIds.includes(tourId));
    }
  }, [wishlistCheckQuery.data, tourId]);
  // Đăng xuất giữa chừng (hoặc đổi tour): đừng để tim đứng nguyên trạng thái
  // của phiên/tour trước.
  useEffect(() => {
    if (!signedIn) setWished(false);
  }, [signedIn]);

  // D6 — quay lại từ chặng đăng nhập (mục 1c spec P5b-4): tự lưu tim nếu khách
  // đã bấm tim TRƯỚC khi bị chặn. `consumePendingReplay` chỉ trả giá trị khi có
  // gì đó thật sự đang chờ — lượt ghé màn bình thường (không qua auth gate) luôn
  // trả `undefined`, effect no-op. Cố ý CHỈ phụ thuộc [signedIn, tourId] —
  // setWishlistMutation không nên khiến effect chạy lại (đó không phải lúc
  // "vừa có phiên", chỉ là mutation object đổi identity giữa các lần render).
  // biome-ignore lint/correctness/useExhaustiveDependencies: xem giải thích trên.
  useEffect(() => {
    if (!signedIn || tourId === undefined) return;
    const replay = consumePendingReplay();
    if (replay?.kind !== 'wishlist' || replay.tourId !== tourId) return;
    setWished(true);
    setWishlistMutation.mutate(
      { tourId, wished: true },
      {
        onError: () => {
          setWished(false);
          setWishlistError(messages.wishlist.error);
        },
        onSettled: invalidateWishlistCheck,
      },
    );
  }, [signedIn, tourId]);

  // Báo lỗi ngắn (D6) tự biến mất — không cần khách bấm tắt.
  useEffect(() => {
    if (wishlistError === null) return;
    const id = setTimeout(() => setWishlistError(null), 3000);
    return () => clearTimeout(id);
  }, [wishlistError]);

  const setWishlistMutation = useMutation(
    orpc.wishlist.set.mutationOptions({ context: withMobileAuth() }),
  );
  // D3 — `enquiries.create` là @Public (không cần đăng nhập); đính cookie
  // (nếu có) CHỈ để API ghi `enquiries.user_id`, cùng lý do web đính
  // `withBrowserAuth()` ở `PrivateTripForm` (W4 E8).
  const askAboutDateMutation = useMutation(
    orpc.enquiries.create.mutationOptions({ context: withMobileAuth() }),
  );

  function handleFavoritePress() {
    if (!signedIn) {
      setAuthGateOpen(true);
      return;
    }
    if (tourId === undefined) return;
    const next = !wished;
    // Lạc quan (D6): đổi ngay, hỏng thì trả lại + báo lỗi ngắn.
    setWished(next);
    setWishlistMutation.mutate(
      { tourId, wished: next },
      {
        onError: () => {
          setWished(!next);
          setWishlistError(messages.wishlist.error);
        },
        onSettled: invalidateWishlistCheck,
      },
    );
  }

  // Ghi lại "quay về tour này + tự lưu tim" TRƯỚC khi rời màn (D6, mục 1c spec
  // P5b-4) — dùng chung cho cả `onSignIn` lẫn `onCreateAccount` bên dưới, thay vì
  // lặp lại cùng một điều kiện ở hai chỗ. `tourId` có thể chưa sẵn sàng (tour đang
  // tải lúc khách bấm tim rất nhanh) — không set `replay` thì đăng nhập xong đơn
  // giản KHÔNG tự lưu, không phải lỗi, chỉ là không có gì để replay.
  function recordReturn() {
    setPendingReturn(
      tourId === undefined
        ? { path: `/tours/${slug}` }
        : { path: `/tours/${slug}`, replay: { kind: 'wishlist', tourId } },
    );
  }

  const notFound = query.isError && isDefinedError(query.error) && query.error.code === 'NOT_FOUND';
  const status: TourDetailStatus = query.isPending
    ? 'loading'
    : notFound
      ? 'notFound'
      : query.isError
        ? 'error'
        : 'content';

  const tour = query.data;

  function openAskAboutDate(departureId: string) {
    const departure = tour?.departures.find((d) => d.id === departureId);
    if (departure === undefined || tourId === undefined) return;
    setAskAboutDateDeparture({
      tourId,
      travelDate: departure.startDate,
      rangeLabel: formatDepartureRange(departure.startDate, departure.endDate),
    });
    // Điền sẵn tên/email nếu đã đăng nhập (khớp web `PrivateTripForm`) — khách
    // vãng lai gõ tay.
    setAskAboutDateValues({
      name: session?.user?.name ?? '',
      email: session?.user?.email ?? '',
      message: '',
    });
    setAskAboutDateErrors({});
    setAskAboutDateFormError(null);
    setAskAboutDateSent(false);
    setAskAboutDateOpen(true);
  }

  function submitAskAboutDate() {
    const errors = validateAskAboutDate(askAboutDateValues);
    setAskAboutDateErrors(errors);
    if (Object.keys(errors).length > 0 || askAboutDateDeparture === null) return;
    setAskAboutDateFormError(null);
    askAboutDateMutation.mutate(
      buildAskAboutDatePayload(askAboutDateValues, askAboutDateDeparture),
      {
        onSuccess: () => setAskAboutDateSent(true),
        onError: () => setAskAboutDateFormError(tourDetail.askAboutDateSheet.error),
      },
    );
  }

  const facts: TourDetailFact[] = [];
  if (tour) {
    facts.push({
      icon: 'clock',
      label: tourDetail.facts.duration,
      value: messages.mobile.home.durationDays(tour.durationDays),
    });
    facts.push({
      icon: 'users',
      label: tourDetail.facts.groupSize,
      value: tourDetail.maxGroup(tour.maxGroupSize),
    });
    if (tour.difficulty !== null) {
      facts.push({
        icon: 'activity',
        label: tourDetail.facts.difficulty,
        value: toursPage.difficultyLabels[tour.difficulty],
      });
    }
    if (tour.suitableFor.length > 0) {
      facts.push({
        icon: 'smile',
        label: tourDetail.facts.goodFor,
        value: tour.suitableFor.map((t) => messages.travellerTypes[t]).join(' · '),
      });
    }
  }

  const galleryImages = tour === undefined ? [] : tourGallery(tour.media);
  // D5 — cùng bộ ảnh/thứ tự với `galleryImages`, thêm ghi công cho trình xem.
  const galleryPhotos: TourDetailPhoto[] = galleryImages.map((m) => ({
    url: m.url,
    alt: m.alt,
    creditLine: mediaCreditText(m.author, m.license),
  }));
  const itineraryDays: TourDetailItineraryDay[] =
    tour?.itinerary.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      lines: parseItineraryDescription(day.description),
    })) ?? [];

  // D3 — nhóm theo tháng + quy đổi mỗi đợt sang view model (tiền/ngày đã
  // format sẵn, `almostFull` suy từ `seatsLeft`). `bookable` đọc THẲNG cờ
  // server tính (ADR-0041) — route không tự so ngày bằng giờ máy.
  const cancellationBanner =
    tour === undefined
      ? ''
      : messages.cancellationDeadline.rule(windowDaysForTripLength(tour.durationDays));
  const departureGroups: TourDetailDepartureGroup[] =
    tour === undefined
      ? []
      : groupDeparturesByMonth(tour.departures).map((group) => ({
          monthLabel: group.monthLabel,
          rows: group.departures.map((departure) => ({
            id: departure.id,
            rangeLabel: formatDepartureRange(departure.startDate, departure.endDate),
            seatsLabel: tourDetail.seatsLeft(departure.seatsLeft),
            priceLabel: formatMoney(departure.effectivePrice, tour.currency),
            compareAtPriceLabel:
              departure.compareAtPrice === null
                ? null
                : formatMoney(departure.compareAtPrice, tour.currency),
            bookable: departure.bookable,
            almostFull: departure.bookable && departure.seatsLeft <= ALMOST_FULL_THRESHOLD,
            cancellationCaption: messages.cancellationDeadline.short(
              formatDepartureDate(departure.bookingDeadline),
            ),
          })),
        }));

  // D4 — `reviewItems` đã gộp mọi trang tải tới giờ (xem effect trên).
  // `breakdown` đọc THẲNG từ lượt fetch gần nhất — ổn định qua các trang vì
  // server tính trên tập chưa lọc trang, không đổi theo `page`.
  const reviewBreakdown = reviewsQuery.data?.breakdown ?? {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };
  const reviews: TourDetailReview[] = reviewItems.map((review) => ({
    id: review.id,
    initials: reviewAuthorInitials(review.authorName),
    authorLabel: review.authorName ?? messages.tourDetail.reviews.deletedAuthor,
    dateLabel: formatReviewDate(review.createdAt),
    rating: review.rating,
    ratingLabel: messages.tourDetail.reviews.ratingLabel(review.rating),
    title: review.title,
    body: review.body,
    photos: review.media.map(
      (m): TourDetailPhoto => ({
        url: photoDisplayUrl(m),
        alt: m.alt,
        creditLine: mediaCreditText(m.author, m.license),
      }),
    ),
  }));
  const reviewSortLabels: Record<TourDetailReviewSort, string> = {
    newest: tourDetail.sortNewest,
    oldest: tourDetail.sortOldest,
    highest: tourDetail.sortHighest,
    lowest: tourDetail.sortLowest,
  };

  return (
    <TourDetailScreen
      status={status}
      onBack={() => router.back()}
      backLabel={messages.mobile.auth.back}
      onRetry={() => void query.refetch()}
      errorTitle={tourDetail.error}
      retryLabel={tourDetail.retry}
      notFoundTitle={tourDetail.notFound}
      goBackLabel={tourDetail.goBack}
      exploreOtherLabel={tourDetail.exploreOther}
      onExploreOther={() => router.navigate('/explore')}
      galleryImages={galleryImages.map((m) => ({ url: m.url, alt: m.alt ?? tour?.title ?? '' }))}
      galleryPhotos={galleryPhotos}
      moreImagesCount={Math.max(0, galleryImages.length - 3)}
      openGalleryLabel={messages.tourDetail.mediaPanel.openGallery}
      title={tour?.title ?? ''}
      rating={tour?.ratingAvg ?? null}
      // `reviewCount`/`notRated` sống ở khối tourDetail của WEB (top-level,
      // không phải `messages.mobile.tourDetail`) — dùng chung, đúng câu web
      // đã duyệt. Chip sao render icon+màu riêng (component), KHÔNG dùng
      // `tourDetail.reviewsLine()` — chuỗi đó gộp "★"+"(N reviews)" vào một
      // chuỗi, lệch mockup (icon tách màu vàng riêng, nối bằng "·").
      reviewCountLabel={tour === undefined ? '' : messages.tourDetail.reviewCount(tour.ratingCount)}
      notRatedLabel={messages.tourDetail.notRated}
      destinationsLine={tour?.destinations.map((d) => d.name).join(' · ') ?? ''}
      summary={tour?.summary ?? null}
      facts={facts}
      fromLabel={tourDetail.from}
      priceLabel={tour === undefined ? '' : formatMoney(tour.priceFrom, tour.currency)}
      perPersonLabel={tourDetail.perPerson}
      chooseDateLabel={tourDetail.chooseDate}
      onChooseDate={() => setActiveTab('dates')}
      favorited={wished}
      favoriteLabel={tour === undefined ? '' : toursPage.wishlistLabel(tour.title)}
      onFavoritePress={handleFavoritePress}
      authGateOpen={authGateOpen}
      onCloseAuthGate={() => setAuthGateOpen(false)}
      authGateTitle={messages.mobile.authPrompts.savedGateTitle}
      authGateBody={messages.mobile.authPrompts.wishlistReason}
      signInLabel={messages.mobile.authPrompts.signIn}
      createAccountLabel={messages.mobile.authPrompts.createAccount}
      onSignIn={() => {
        setAuthGateOpen(false);
        recordReturn();
        router.navigate('/login');
      }}
      onCreateAccount={() => {
        setAuthGateOpen(false);
        recordReturn();
        router.navigate('/register');
      }}
      wishlistErrorLabel={wishlistError}
      activeTab={activeTab}
      onChangeTab={setActiveTab}
      tabLabels={{
        overview: tourDetail.overviewTitle,
        itinerary: tourDetail.itineraryTitle,
        dates: tourDetail.datesTitle,
        reviews: tourDetail.reviewsTitle,
      }}
      itineraryDays={itineraryDays}
      meetingPoint={tour?.meetingPoint ?? null}
      meetingPointTitle={tourDetail.meetingPointTitle}
      cancellationBanner={cancellationBanner}
      departureGroups={departureGroups}
      noDeparturesLabel={messages.tourDetail.departures.none}
      selectedDepartureId={selectedDepartureId}
      onSelectDeparture={setSelectedDepartureId}
      bookingClosedLabel={tourDetail.bookingClosed}
      almostFullLabel={tourDetail.almostFull}
      askAboutDateLabel={tourDetail.askAboutDate}
      onAskAboutDate={openAskAboutDate}
      askAboutDateSheetOpen={askAboutDateOpen}
      onCloseAskAboutDateSheet={() => setAskAboutDateOpen(false)}
      askAboutDateSheetTitle={tourDetail.askAboutDate}
      askAboutDateSheetDescription={
        askAboutDateDeparture === null
          ? ''
          : tourDetail.askAboutDateSheet.description(askAboutDateDeparture.rangeLabel)
      }
      askAboutDateNameLabel={messages.mobile.auth.register.name}
      askAboutDateEmailLabel={messages.mobile.auth.signIn.email}
      askAboutDateMessageLabel={tourDetail.askAboutDateSheet.message}
      askAboutDateValues={askAboutDateValues}
      askAboutDateErrors={askAboutDateErrors}
      onChangeAskAboutDate={(field: AskAboutDateField, value: string) => {
        setAskAboutDateValues((s) => ({ ...s, [field]: value }));
        setAskAboutDateErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
      }}
      askAboutDateSubmitLabel={tourDetail.askAboutDateSheet.submit}
      askAboutDateSubmittingLabel={tourDetail.askAboutDateSheet.submitting}
      askAboutDateSubmitting={askAboutDateMutation.isPending}
      onSubmitAskAboutDate={submitAskAboutDate}
      askAboutDateFormError={askAboutDateFormError}
      askAboutDateSent={askAboutDateSent}
      askAboutDateSuccessTitle={tourDetail.askAboutDateSheet.successTitle}
      askAboutDateSuccessBody={tourDetail.askAboutDateSheet.successBody}
      askAboutDateCloseLabel={tourDetail.askAboutDateSheet.close}
      bookCtaLabel={messages.mobile.booking.bookCta}
      // Flow đặt chỗ mobile chưa dựng (P5b-3) — nút chưa làm gì.
      onBook={() => {}}
      reviewBreakdown={reviewBreakdown}
      reviewSort={reviewSort}
      reviewSortLabels={reviewSortLabels}
      onChangeReviewSort={(sort) => {
        setReviewSort(sort);
        setReviewPage(1);
        setReviewItems([]);
      }}
      reviews={reviews}
      noReviewsTitle={messages.tourDetail.reviewsTab.emptyTitle}
      noReviewsBody={messages.tourDetail.reviewsTab.emptyBody}
      hasMoreReviews={reviewPage < reviewTotalPages}
      loadingMoreReviews={reviewsQuery.isFetching && reviewPage > 1}
      onLoadMoreReviews={() => setReviewPage((p) => p + 1)}
      loadMoreReviewsLabel={
        reviewsQuery.isFetching && reviewPage > 1
          ? tourDetail.loadingReviews
          : tourDetail.loadMoreReviews
      }
      closePhotosLabel={messages.tourDetail.gallery.close}
      photoCounterFor={messages.tourDetail.gallery.counter}
      transformUrl={cloudinaryUrl}
    />
  );
}

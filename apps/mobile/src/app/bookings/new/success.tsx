import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { clearCompletedBooking, getCompletedBooking } from '@/features/booking/booking-draft';
import { BookingSuccessScreen } from '@/features/booking/booking-success-screen';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

/**
 * B8 (spec P5b-3) — đặt chỗ xong. `verify.tsx` chỉ tới đây khi `bookings.byCode`
 * ĐÃ xác nhận PAID — không tự suy đoán từ việc trình duyệt vừa đóng.
 */
export default function BookingSuccessRoute() {
  const draft = getCompletedBooking();
  const { booking } = messages.mobile;

  useEffect(() => {
    if (draft === null) router.back();
  }, [draft]);

  // B8 là màn cuối: tắt nút back cứng Android (cử chỉ vuốt iOS tắt ở _layout).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (draft === null) return null;

  const { trip } = draft;
  const partySize = draft.numAdults + draft.numChildren;
  const amount = formatMoney(draft.totalAmount, trip.currency);
  const bookingCode = draft.bookingCode ?? '';

  function done(next: string) {
    clearCompletedBooking();
    router.replace(next);
  }

  // Email không có khoảng trắng nên RN có thể ngắt dòng ngay tại "@" hoặc
  // ".". Chỉ nối dấu "." là chưa đủ — "@" vẫn là điểm ngắt hợp lệ, renderer
  // bị cấm ngắt ở "." thì ngắt ngay trước đó (trông y hệt vì word joiner vô
  // hình). Phải nối CẢ HAI để cả email thành một khối không ngắt được, buộc
  // nó xuống nguyên dòng tiếp theo thay vì vỡ giữa domain/TLD.
  const noBreakEmail = draft.contactEmail.replace(/[@.]/g, '⁠$&');

  return (
    <BookingSuccessScreen
      heroImageUrl={trip.tourImageUrl}
      heading={booking.successTitle}
      subtitle={booking.successSubtitle(noBreakEmail)}
      bookingCodeLabel={booking.bookingCodeLabel}
      bookingCode={bookingCode}
      tourTitle={trip.tourTitle}
      travellersLabel={messages.mobile.trips.travellersCount(partySize)}
      dateRangeLabel={formatDepartureRange(trip.startDate, trip.endDate)}
      totalAmount={amount}
      viewBookingLabel={booking.viewBooking}
      onViewBooking={() => done(`/bookings/${bookingCode}`)}
      browseToursLabel={booking.browseTours}
      onBrowseTours={() => done('/explore')}
      transformUrl={cloudinaryUrl}
    />
  );
}

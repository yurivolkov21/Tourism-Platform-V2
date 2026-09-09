import { messages } from '@tourism/i18n';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/placeholder-screen';

/**
 * NỢ CÓ HỒ SƠ — màn này PHẢI có gác đăng nhập trước khi nối API (P5b).
 *
 * Hiện chưa có gác, và ở P5a thì vô hại vì màn chỉ in lại tham số. Nhưng
 * `scheme: 'nexora'` là namespace KHÔNG độc quyền (app nào cũng khai được trên
 * Android, và `app.json` chưa có App Links đã xác minh), nên ngày màn này đọc
 * booking thật mà không gác thì `nexora://bookings/<mã người khác>` là một
 * đường xem đơn của người lạ.
 *
 * Cảnh báo thêm: kiểu `<{ code: string }>` dưới đây là ASSERTION, không phải
 * phép kiểm — `useLocalSearchParams` trả `string | string[] | undefined` ở
 * runtime, và giá trị do người ngoài điều khiển hoàn toàn. P5b phải kẹp
 * (dạng, độ dài) TRƯỚC khi đưa vào lời gọi API.
 */
export default function BookingDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { titles } = messages.mobile.appShell;

  return <PlaceholderScreen title={titles.bookingDetail} detail={code} />;
}

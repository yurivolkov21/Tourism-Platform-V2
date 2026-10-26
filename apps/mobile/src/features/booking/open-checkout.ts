import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';

/**
 * Kết quả mở trang thanh toán: `returned` — cổng đã trả khách về app (ADR-0062); `closed` — khách
 * tự đóng trình duyệt; `failed` — không mở được trình duyệt (trước đây lỗi bị nuốt, nút im lặng).
 * Cả `returned` lẫn `closed` đều KHÔNG nói đã trả tiền: màn gọi vẫn hỏi lại `bookings.byCode`.
 */
export type CheckoutOutcome = 'returned' | 'closed' | 'failed';

/**
 * URL của chính app cho một đường dẫn — gửi lên API làm `appReturnUrl`. Bản build ra
 * `nexora://…`, Expo Go ra `exp://<IP LAN>:<cổng>/--/…`; cả hai đều qua luật của contract.
 */
export function appReturnUrl(path: string): string {
  return Linking.createURL(path);
}

/**
 * Mở trang thanh toán. Có `returnUrl` thì dùng phiên auth của trình duyệt: cổng chuyển về URL app
 * (qua trang chuyển tiếp của web) là tab tự đóng và khách về thẳng app. Trên Android, polyfill của
 * expo-web-browser tự đợi app về `active` nếu khách đóng tab tay, nên promise chỉ xong khi khách
 * đã quay lại.
 */
export async function openCheckout(url: string, returnUrl?: string): Promise<CheckoutOutcome> {
  if (returnUrl === undefined) return openAndWaitForReturn(url);
  try {
    const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
    return result.type === 'success' ? 'returned' : 'closed';
  } catch {
    return 'failed';
  }
}

/**
 * Không có URL quay về: mở trình duyệt thường. Promise chỉ xong khi khách đã QUAY LẠI app, để
 * caller hỏi lại trạng thái đúng lúc. iOS tự đợi trình duyệt đóng; Android thì `openBrowserAsync`
 * trả `opened` ngay khi Custom Tab bật lên, nên phải đợi lần AppState về `active` kế tiếp — cùng
 * cách polyfill `openAuthSessionAsync` của expo-web-browser làm cho Android.
 */
async function openAndWaitForReturn(url: string): Promise<CheckoutOutcome> {
  // Đăng ký TRƯỚC khi mở: Custom Tab đẩy app xuống nền ngay lúc bật.
  const returned = nextActive();
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === WebBrowser.WebBrowserResultType.OPENED) await returned.promise;
    return 'closed';
  } catch {
    return 'failed';
  } finally {
    returned.cancel();
  }
}

function nextActive(): { promise: Promise<void>; cancel: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') resolve();
  });
  return { promise, cancel: () => subscription.remove() };
}

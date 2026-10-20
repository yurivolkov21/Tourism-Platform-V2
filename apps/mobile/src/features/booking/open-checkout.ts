import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';

/**
 * Mở trang thanh toán; `false` khi trình duyệt không mở được (trước đây lỗi bị nuốt, nút im lặng).
 *
 * Promise chỉ xong khi khách đã QUAY LẠI app, để caller hỏi lại trạng thái đúng lúc. iOS
 * tự đợi trình duyệt đóng; Android thì `openBrowserAsync` trả `opened` ngay khi Custom
 * Tab bật lên, nên phải đợi lần AppState về `active` kế tiếp — cùng cách polyfill
 * `openAuthSessionAsync` của expo-web-browser làm cho Android.
 */
export async function openCheckout(url: string): Promise<boolean> {
  // Đăng ký TRƯỚC khi mở: Custom Tab đẩy app xuống nền ngay lúc bật.
  const returned = nextActive();
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === WebBrowser.WebBrowserResultType.OPENED) await returned.promise;
    return true;
  } catch {
    return false;
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

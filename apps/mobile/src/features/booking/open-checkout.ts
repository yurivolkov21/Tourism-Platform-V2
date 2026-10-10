import * as WebBrowser from 'expo-web-browser';

/** Mở trang thanh toán; `false` khi trình duyệt không mở được (trước đây lỗi bị nuốt, nút im lặng). */
export async function openCheckout(url: string): Promise<boolean> {
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    return false;
  }
}

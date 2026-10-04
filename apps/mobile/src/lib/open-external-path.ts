import { Linking } from 'react-native';

/**
 * Gốc production của trang công khai (ADR-0024). Các trang pháp lý/biên tập luôn
 * mở trên production, KHÔNG theo `EXPO_PUBLIC_WEB_URL` (đó là origin dev/LAN để
 * checkout và API, không phải nơi lưu trang pháp lý).
 */
export const PUBLIC_SITE_ORIGIN = 'https://www.nexora-travel.agency';

/**
 * Mở một đường dẫn pháp lý/biên tập trên WEB production bằng trình duyệt ngoài —
 * app không dựng lại các trang đó (Register §legal, Account §menu pháp lý, bài
 * blog "đọc trên web").
 */
export function openExternalPath(path: string): void {
  void Linking.openURL(`${PUBLIC_SITE_ORIGIN}${path}`);
}

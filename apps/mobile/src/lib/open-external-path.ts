import { Linking } from 'react-native';
import { env } from '@/lib/env';

/**
 * Mở một đường dẫn pháp lý/biên tập trên WEB bằng trình duyệt ngoài — app
 * không dựng lại các trang đó (Register §legal, Account §menu pháp lý). Rút
 * chung 24/09 khi Account thêm 5 dòng gọi cùng khuôn (Register có 2).
 */
export function openExternalPath(path: string): void {
  void Linking.openURL(`${env().webUrl}${path}`);
}

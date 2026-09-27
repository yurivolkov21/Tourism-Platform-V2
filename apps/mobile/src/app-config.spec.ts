import { buildTheme } from '@tourism/mobile-ui';
import appConfig from '../app.json';

/**
 * `app.json` là JSON thuần nên không import được token — màu nền splash phải gõ
 * tay. Test này là thứ giữ cho lời gõ tay đó không trôi khỏi token; lưới
 * `check-mobile-tokens-only.mjs` không với tới được vì nó chỉ quét file nguồn.
 *
 * Splash luôn dùng bảng TỐI, kể cả máy đang để sáng: ảnh mark chỉ có một bản, và
 * nền tối là nền mà cả hai viên kim cương đều đọc được.
 *
 * Cấu hình nằm trong plugin `expo-splash-screen` chứ không phải khoá `expo.splash`
 * — SDK 57 đã bỏ khoá đó khỏi schema và `expo-doctor` báo đỏ nếu còn.
 */
function splashOptions(): { image: string; backgroundColor: string } {
  for (const plugin of appConfig.expo.plugins) {
    if (!Array.isArray(plugin)) continue;

    const [name, options] = plugin;
    if (name !== 'expo-splash-screen' || typeof options !== 'object') continue;

    // `plugins` giờ có HAI entry mang options khác hình dạng (expo-splash-screen
    // + expo-image-picker, ADR-0040 AMEND 5) — tsc suy `options` thành union hai
    // shape đó chứ không tự thu hẹp theo `name` (JSON literal không giữ kiểu tuple
    // gắn với literal). Guard runtime ở trên đã xác nhận đúng plugin, ép kiểu là
    // an toàn.
    return options as { image: string; backgroundColor: string };
  }

  throw new Error('app.json thiếu plugin expo-splash-screen');
}

describe('app.json', () => {
  it('nền splash đúng bằng màu background của chế độ tối', () => {
    expect(splashOptions().backgroundColor).toBe(buildTheme('dark').colors.background);
  });

  it('splash trỏ đúng file mark đang có trong repo', () => {
    expect(splashOptions().image).toBe('./assets/splash-mark.png');
  });
});

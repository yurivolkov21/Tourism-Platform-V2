import { buildTheme } from '@tourism/mobile-ui';
import appConfig from '../app.json';

/**
 * `app.json` là JSON thuần nên không import được token — màu nền splash phải gõ
 * tay. Test này là thứ giữ cho lời gõ tay đó không trôi khỏi token; lưới
 * `check-mobile-tokens-only.mjs` không với tới được vì nó chỉ quét file nguồn.
 *
 * Splash luôn dùng bảng TỐI, kể cả máy đang để sáng: ảnh mark chỉ có một bản, và
 * nền tối là nền mà cả hai viên kim cương đều đọc được.
 */
describe('app.json', () => {
  it('nền splash đúng bằng màu background của chế độ tối', () => {
    expect(appConfig.expo.splash.backgroundColor).toBe(buildTheme('dark').colors.background);
  });

  it('splash trỏ đúng file mark đang có trong repo', () => {
    expect(appConfig.expo.splash.image).toBe('./assets/splash-mark.png');
  });
});

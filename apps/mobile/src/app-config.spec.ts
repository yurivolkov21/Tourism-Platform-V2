import { buildTheme } from '@tourism/mobile-ui';
import appConfig from '../app.json';
import easConfig from '../eas.json';
import { readEnv } from './lib/env';

/**
 * Options của một plugin trong `app.json`. `plugins` có nhiều entry mang options
 * khác hình dạng (splash, image-picker, google-signin) — tsc suy ra một union
 * các shape đó chứ không tự thu hẹp theo `name` (JSON literal không giữ kiểu
 * tuple gắn với literal), nên trả `unknown` để chỗ gọi ép kiểu sau khi guard
 * runtime ở đây đã xác nhận đúng plugin.
 */
function pluginOptions(pluginName: string): unknown {
  for (const plugin of appConfig.expo.plugins) {
    if (!Array.isArray(plugin)) continue;

    const [name, options] = plugin;
    if (name === pluginName && typeof options === 'object') return options;
  }

  throw new Error(`app.json thiếu plugin ${pluginName}`);
}

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
  return pluginOptions('expo-splash-screen') as { image: string; backgroundColor: string };
}

describe('app.json', () => {
  it('nền splash đúng bằng màu background của chế độ tối', () => {
    expect(splashOptions().backgroundColor).toBe(buildTheme('dark').colors.background);
  });

  it('splash trỏ đúng file mark đang có trong repo', () => {
    expect(splashOptions().image).toBe('./assets/splash-mark.png');
  });
});

/**
 * Bản `preview` là APK demo buổi bảo vệ (ADR-0056 §5). Env của nó gõ tay trong
 * `eas.json`, và lỗi gõ chỉ lộ ra sau một lượt build EAS (hạn mức có hạn) cộng
 * một lần cài máy — nên chốt ở đây bằng chính hàm đọc env của app.
 */
describe('eas.json', () => {
  const previewEnv = easConfig.build.preview.env;

  it('bản preview trỏ production và có client Google', () => {
    const read = readEnv(previewEnv);

    expect(read.apiUrl).toBe('https://api.nexora-travel.agency');
    expect(read.webUrl).toBe('https://www.nexora-travel.agency');
    expect(read.google).not.toBeNull();
  });

  // Plugin google-signin ghi giá trị này vào Info.plist làm URL scheme nhận kết
  // quả đăng nhập trên iOS; lệch với client iOS thì Google không trả về app.
  it('iosUrlScheme của plugin google-signin là dạng đảo của client iOS', () => {
    const options = pluginOptions('@react-native-google-signin/google-signin') as {
      iosUrlScheme: string;
    };
    const clientPrefix = previewEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.replace(
      /\.apps\.googleusercontent\.com$/,
      '',
    );

    expect(options.iosUrlScheme).toBe(`com.googleusercontent.apps.${clientPrefix}`);
  });

  // Client Android/iOS phải nằm CÙNG dự án Google Cloud với client web thì ID
  // token mới mang audience web — số dự án là phần trước dấu `-` đầu tiên.
  it('client web và client iOS cùng một dự án Google Cloud', () => {
    const projectNumber = (clientId: string) => clientId.split('-')[0];

    expect(projectNumber(previewEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)).toBe(
      projectNumber(previewEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    );
  });
});

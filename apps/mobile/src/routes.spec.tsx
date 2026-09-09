import { messages } from '@tourism/i18n';
import {
  fireEvent,
  getMockConfig,
  renderRouter,
  screen,
  testRouter,
} from 'expo-router/testing-library';

// Spec của cây route đặt NGOÀI `src/app` là bắt buộc: expo-router coi mọi file
// `.tsx` dưới thư mục app là một route (ignore list của nó chỉ có `+html`,
// `+native-intent`, `+api`, `+middleware`) — để `.spec.tsx` trong đó là tự đẻ
// thêm một route rác.

const shell = messages.mobile.appShell;
const placeholder = shell.placeholder.title;

/**
 * `renderRouter` gắn `getPathname()` lên chính đối tượng Promise mà `render()`
 * của RNTL 14 trả về (`Object.assign(result, …)`). Hai bẫy nối nhau: `await
 * renderRouter(...)` trả về kết quả render đã resolve — không còn mấy hàm đó;
 * và `return app` trong một hàm `async` cũng tự await luôn thenable. Nên trả
 * về một object THƯỜNG bọc lấy nó.
 */
async function openApp(initialUrl: string) {
  const app = renderRouter('src/app', { initialUrl });
  await app;
  return { pathname: () => app.getPathname() };
}

/**
 * Kiểm kê cây route BẰNG MÁY, đọc từ chính cấu hình mà router dựng ra.
 *
 * Thay cho `experiments.typedRoutes`, vốn đã bị gỡ: type của nó chỉ do DEV
 * SERVER sinh vào `.expo/types` (gitignore) nên CI không bao giờ có — typecheck
 * ở CI yếu hơn hẳn ở máy dev, còn bản local lạc hậu thì làm dev đỏ oan trong
 * khi CI xanh. Một lưới chỉ tồn tại trên một máy không phải là lưới. SDK 57
 * không có lệnh sinh type độc lập (`expo export` cũng không sinh), và dựng lại
 * bộ quét route của Expo ngay trước freeze là rủi ro lớn hơn lợi ích.
 *
 * Danh sách dưới đây chạy ở CẢ gate lẫn CI và bắt được cả THÊM lẫn XOÁ route.
 */
type ScreenTree = string | { path?: string; screens?: Record<string, ScreenTree> };

/** Gom mọi lá của cây thành `nhóm/màn` để so bằng một danh sách phẳng. */
function flatten(tree: Record<string, ScreenTree>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([name, node]) =>
      typeof node === 'string' || node.screens === undefined
        ? [`${prefix}${name}`]
        : flatten(node.screens, `${prefix}${name}/`),
    )
    .sort();
}

const EXPECTED_ROUTES = [
  '(auth)/forgot-password',
  '(auth)/login',
  '(auth)/register',
  '(tabs)/account',
  '(tabs)/explore',
  '(tabs)/index',
  '(tabs)/saved',
  '(tabs)/trips',
  '+not-found',
  'bookings/[code]',
  'tours/[slug]',
];

describe('kiểm kê cây route', () => {
  it('đúng bằng danh sách đã khai — thêm hay xoá route đều phải đi qua đây', () => {
    const root = getMockConfig('src/app').screens.__root as {
      screens: Record<string, ScreenTree>;
    };

    expect(flatten(root.screens)).toEqual(EXPECTED_ROUTES);
  });

  // Neo của stack gốc: mất nó là mọi deep link thành ngõ cụt một chiều. Test
  // deep-link phía dưới canh HÀNH VI, còn dòng này canh chính cấu hình — hai
  // tầng khác nhau vì đây là thứ dễ bị xoá nhầm khi refactor layout.
  it('stack gốc neo vào nhóm (tabs)', () => {
    const root = getMockConfig('src/app').screens.__root as { initialRouteName?: string };

    expect(root.initialRouteName).toBe('(tabs)');
  });
});

describe('vỏ điều hướng', () => {
  it('mở app là vào tab Home', async () => {
    const app = await openApp('/');

    expect(app.pathname()).toBe('/');
    expect(screen.getAllByText(shell.titles.home).length).toBeGreaterThan(0);
    expect(screen.getByText(placeholder)).toBeTruthy();
  });

  it('thanh tab hiện đủ 5 nhãn, đọc từ @tourism/i18n', async () => {
    await openApp('/');

    for (const label of Object.values(messages.mobile.tabs)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['/explore', shell.titles.explore],
    ['/saved', shell.titles.saved],
    ['/trips', shell.titles.trips],
    ['/account', shell.titles.account],
  ])('tab %s render được và mang đúng tiêu đề', async (url, title) => {
    const app = await openApp(url);

    expect(app.pathname()).toBe(url);
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText(placeholder)).toBeTruthy();
  });

  // Sáu màn có header KHÔNG in lại tiêu đề ở thân nữa (navigator đã vẽ) — nên
  // ở đây chỉ khẳng định được đường dẫn và nội dung thân.
  //
  // GHI RÕ CHỖ HỤT: tiêu đề header là prop native của `RNSScreenStackHeaderConfig`,
  // không phải text truy được; RNTL 14 lại bỏ nhóm query `UNSAFE_*` và
  // `screen.root` không có `findAll`. Nên "tiêu đề header đọc từ @tourism/i18n"
  // hiện KHÔNG có test — sai tiêu đề là lỗi thấy ngay bằng mắt trên máy, và
  // lớp canh i18n vẫn còn ở 5 tab (tiêu đề thân) cùng test nhãn thanh tab.
  it.each([['/login'], ['/register'], ['/forgot-password']])(
    'màn auth %s render được',
    async (url) => {
      const app = await openApp(url);

      expect(app.pathname()).toBe(url);
      expect(screen.getByText(placeholder)).toBeTruthy();
    },
  );

  it('tours/[slug] render được và đọc được slug từ URL', async () => {
    const app = await openApp('/tours/ha-giang-loop');

    expect(app.pathname()).toBe('/tours/ha-giang-loop');
    expect(screen.getByText('ha-giang-loop')).toBeTruthy();
  });

  it('bookings/[code] render được và đọc được mã từ URL', async () => {
    const app = await openApp('/bookings/NX-2026-0001');

    expect(app.pathname()).toBe('/bookings/NX-2026-0001');
    expect(screen.getByText('NX-2026-0001')).toBeTruthy();
  });

  // Vào app bằng deep link thì stack chỉ có ĐÚNG màn được trỏ tới nếu root
  // layout không khai anchor — không nút back, back cứng Android thoát thẳng
  // app. `unstable_settings.anchor` là thứ chèn `(tabs)` xuống dưới; test này
  // canh chính nó, vì mất anchor là mất đường về mà không có gì đỏ.
  it.each([['/tours/ha-giang-loop'], ['/bookings/NX-2026-0001'], ['/login']])(
    'deep link thẳng vào %s vẫn còn đường quay lại',
    async (url) => {
      await openApp(url);

      expect(testRouter.canGoBack()).toBe(true);
    },
  );

  it.each([['/login'], ['/register'], ['/forgot-password']])(
    'màn auth %s có nút đóng đưa về tab',
    async (url) => {
      const app = await openApp(url);

      // `fireEvent.press` của RNTL 14 là BẤT ĐỒNG BỘ — thiếu `await` thì
      // assertion chạy trước khi router kịp đổi và test đỏ oan (hoặc tệ hơn:
      // xanh oan ở một assertion lỏng hơn).
      await fireEvent.press(screen.getByLabelText(shell.close));

      expect(app.pathname()).toBe('/');
    },
  );

  it('URL lạ rơi vào +not-found chứ không phải màn trắng', async () => {
    await openApp('/khong-ton-tai');

    expect(screen.getByText(shell.notFound.title)).toBeTruthy();
    expect(screen.getByText(shell.notFound.body)).toBeTruthy();
    expect(screen.getByText(shell.notFound.back)).toBeTruthy();
  });
});

import { messages } from '@tourism/i18n';
import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

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

  it.each([
    ['/login', shell.titles.login],
    ['/register', shell.titles.register],
    ['/forgot-password', shell.titles.forgotPassword],
  ])('màn auth %s render được', async (url, title) => {
    const app = await openApp(url);

    expect(app.pathname()).toBe(url);
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });

  it('tours/[slug] render được và đọc được slug từ URL', async () => {
    const app = await openApp('/tours/ha-giang-loop');

    expect(app.pathname()).toBe('/tours/ha-giang-loop');
    expect(screen.getAllByText(shell.titles.tourDetail).length).toBeGreaterThan(0);
    expect(screen.getByText('ha-giang-loop')).toBeTruthy();
  });

  it('bookings/[code] render được và đọc được mã từ URL', async () => {
    const app = await openApp('/bookings/NX-2026-0001');

    expect(app.pathname()).toBe('/bookings/NX-2026-0001');
    expect(screen.getAllByText(shell.titles.bookingDetail).length).toBeGreaterThan(0);
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

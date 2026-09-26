import { messages } from '@tourism/i18n';
import {
  fireEvent,
  getMockConfig,
  renderRouter,
  screen,
  testRouter,
} from 'expo-router/testing-library';
import { onboardingStore } from '@/features/onboarding/onboarding-store';

// Spec của cây route đặt NGOÀI `src/app` là bắt buộc: expo-router coi mọi file
// `.tsx` dưới thư mục app là một route (ignore list của nó chỉ có `+html`,
// `+native-intent`, `+api`, `+middleware`) — để `.spec.tsx` trong đó là tự đẻ
// thêm một route rác.

const shell = messages.mobile.appShell;
const placeholder = shell.placeholder.title;

// Mọi test trong file này mô phỏng người ĐÃ xem onboarding — nếu không, vỏ ứng
// dụng sẽ thay màn sang `/onboarding` ngay lúc mở và mọi khẳng định về route
// khác đều sai. Đường vào lần đầu có spec riêng ở `onboarding-entry.spec.tsx`,
// đặt thành file riêng vì jest chỉ cấp sổ module mới cho từng FILE.
beforeEach(async () => {
  await onboardingStore.markSeen();
});

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
  '(auth)/reset-password',
  '(auth)/success',
  '(auth)/verify-email',
  '(tabs)/account',
  '(tabs)/explore',
  '(tabs)/index',
  '(tabs)/saved',
  '(tabs)/trips',
  '+not-found',
  'bookings/[code]',
  'change-password',
  'dev/gallery',
  'dev/tour-gallery',
  'onboarding',
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
    // Home không còn placeholder (P5b-2 T1) — khẳng định bằng tiêu đề "Recommendations",
    // luôn vẽ ở mọi trạng thái tải/lỗi/rỗng/có dữ liệu.
    expect(screen.getByText(messages.mobile.home.browseHeadline)).toBeTruthy();
    // Tab Home đang được chọn.
    expect(screen.getByLabelText(shell.titles.home)).toBeTruthy();
  });

  it('thanh tab có đủ 5 tab, tên đọc từ @tourism/i18n', async () => {
    await openApp('/');

    // Thanh tab nổi (khuôn v1) KHÔNG vẽ nhãn chữ — tên tab đi qua
    // `accessibilityLabel` cho trình đọc màn hình, nên phải tìm theo nhãn a11y
    // chứ không phải theo text hiển thị.
    for (const label of Object.values(messages.mobile.tabs)) {
      expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
    }
  });

  it.each([['/trips', shell.titles.trips]])(
    'tab %s render được và mang đúng tiêu đề',
    async (url, title) => {
      const app = await openApp(url);

      expect(app.pathname()).toBe(url);
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      expect(screen.getByText(placeholder)).toBeTruthy();
    },
  );

  it('tab /account render được, không còn chỗ giữ chỗ — chưa đăng nhập nên vào thẳng A2', async () => {
    const app = await openApp('/account');

    expect(app.pathname()).toBe('/account');
    // Chưa đăng nhập (không mock session) → AuthGateScreen (A2), cùng khuôn
    // S3 của Saved — tiêu đề khác "Account" (chữ tab, chỉ còn đọc qua a11y).
    expect(screen.getByText(messages.mobile.authPrompts.accountGateTitle)).toBeTruthy();
    expect(screen.queryByText(placeholder)).toBeNull();
    // NĂM dòng mở trình duyệt ngoài, không chỉ ba dòng pháp lý (phản hồi
    // 26/09, đối chiếu mockup — Help & FAQ/About Nexora từng bị thiếu ở A2).
    expect(screen.getByText(messages.mobile.account.menuHelp)).toBeTruthy();
    expect(screen.getByText(messages.mobile.account.menuAbout)).toBeTruthy();
  });

  it('tab /explore render được, không còn chỗ giữ chỗ', async () => {
    const app = await openApp('/explore');

    expect(app.pathname()).toBe('/explore');
    // Explore không còn placeholder (P5b-2 T2) — khẳng định bằng tiêu đề thật
    // của màn, khác chữ tab "Explore" (chỉ còn đọc qua a11y label của tab bar).
    expect(screen.getByText(messages.mobile.explore.title)).toBeTruthy();
    expect(screen.queryByText(placeholder)).toBeNull();
  });

  it('tab /saved render được, không còn chỗ giữ chỗ — chưa đăng nhập nên vào thẳng S3', async () => {
    const app = await openApp('/saved');

    expect(app.pathname()).toBe('/saved');
    // Chưa đăng nhập (không mock session) → AuthGateScreen (S3), tiêu đề khác
    // "Saved tours" của S1 — cùng khuôn `savedGateTitle` dùng ở D6/tour-detail.
    expect(screen.getByText(messages.mobile.authPrompts.savedGateTitle)).toBeTruthy();
    expect(screen.queryByText(placeholder)).toBeNull();
  });

  // Sáu màn có header KHÔNG in lại tiêu đề ở thân nữa (navigator đã vẽ) — nên
  // ở đây chỉ khẳng định được đường dẫn và nội dung thân.
  //
  // GHI RÕ CHỖ HỤT: tiêu đề header là prop native của `RNSScreenStackHeaderConfig`,
  // không phải text truy được; RNTL 14 lại bỏ nhóm query `UNSAFE_*` và
  // `screen.root` không có `findAll`. Nên "tiêu đề header đọc từ @tourism/i18n"
  // hiện KHÔNG có test — sai tiêu đề là lỗi thấy ngay bằng mắt trên máy, và
  // lớp canh i18n vẫn còn ở 5 tab (tiêu đề thân) cùng test nhãn thanh tab.
  // Cụm auth không còn chỗ giữ chỗ nào (P5b-1). Khẳng định bằng câu PHỤ ĐỀ chứ
  // không phải tiêu đề: "Create account" còn là nhãn nút và là đường dẫn ở chân
  // màn Sign in, nên tìm theo tiêu đề là tìm ra nhiều chỗ.
  it.each([
    ['/login', messages.mobile.auth.signIn.body],
    ['/register', messages.mobile.auth.register.body],
    ['/forgot-password', messages.mobile.auth.forgotPassword.body],
    ['/reset-password?token=abc', messages.mobile.auth.resetPassword.body],
  ])('màn auth %s render được màn thật, không còn chỗ giữ chỗ', async (url, body) => {
    await openApp(url);

    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryByText(placeholder)).toBeNull();
  });

  // Link đặt lại mật khẩu không mang token thì không gọi action nào — vào thẳng
  // kênh 3.
  it('reset-password thiếu token thì vào thẳng trạng thái link hỏng', async () => {
    await openApp('/reset-password');

    expect(screen.getByText(messages.authForms.resetPassword.invalidToken.heading)).toBeTruthy();
    expect(
      screen.queryByPlaceholderText(messages.mobile.auth.resetPassword.newPassword),
    ).toBeNull();
  });

  it.each([
    ['verified', messages.authForms.verifyEmail.toast.title],
    ['password-updated', messages.authForms.resetPassword.toast.title],
  ])('màn kết quả đọc kind=%s từ URL', async (kind, title) => {
    await openApp(`/success?kind=${kind}`);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(messages.mobile.auth.success.signIn)).toBeTruthy();
  });

  it('verify-email đọc email từ URL và nhắc lại trong phụ đề', async () => {
    const app = await openApp('/verify-email?email=lan%40example.com');

    expect(app.pathname()).toBe('/verify-email');
    expect(screen.getByText('lan@example.com')).toBeTruthy();
  });

  // Vào thẳng `/verify-email` mà không mang email (gõ tay, link cũ) thì màn
  // không gửi mã cho ai được — kênh 3 thay cả thân màn thay vì để một ô nhập
  // chạy không.
  it('verify-email thiếu email thì đổi sang trạng thái kênh 3', async () => {
    await openApp('/verify-email');

    expect(screen.getByText(messages.authForms.verifyEmail.noEmail.heading)).toBeTruthy();
    expect(screen.queryByLabelText(messages.mobile.auth.verifyEmail.codeLabel)).toBeNull();
  });

  it('tours/[slug] render được, không còn chỗ giữ chỗ (P5b T5)', async () => {
    const app = await openApp('/tours/ha-giang-loop');

    expect(app.pathname()).toBe('/tours/ha-giang-loop');
    // Màn thật không còn in thẳng slug ra thân màn (P5b T5) — trạng thái
    // đang tải chỉ vẽ khung xám, không có chữ nào để đọc slug qua đó nữa.
    expect(screen.queryByText(placeholder)).toBeNull();
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

  // Màn ĐẦU của nhóm dùng X đóng cả nhóm: Sign in, và Reset password vì nó mở
  // từ link trong email nên phía sau không có màn nào.
  it.each([['/login'], ['/reset-password?token=abc']])(
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

  // Màn ĐI TIẾP dùng mũi tên lùi một bước. Vào thẳng bằng deep link thì bước lùi
  // đó rơi vào neo `(tabs)` — vẫn có đường về.
  it.each([['/register'], ['/forgot-password'], ['/verify-email?email=lan%40example.com']])(
    'màn auth %s lùi một bước chứ không đóng cả nhóm',
    async (url) => {
      const app = await openApp(url);

      await fireEvent.press(screen.getByLabelText(messages.mobile.auth.back));

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

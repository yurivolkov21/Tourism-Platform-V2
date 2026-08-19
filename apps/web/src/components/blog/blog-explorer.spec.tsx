import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalPost } from '@/lib/api/posts';
import { sortPostsByDate } from '@/lib/blog';
import { BlogExplorer } from './blog-explorer';

// Fixture VM (JournalPost, hậu Task 5) — KHÔNG dùng mock journal cũ nữa: shape
// đó thiếu `tags` (bắt buộc từ khi chip lọc chuyển sang nguồn `fetchPostTags`,
// và đã khai tử hoàn toàn ở Task 10). 9 bài để giữ đúng phép tính phân trang
// 6+3 đã canh từ trước; `p5` mang thêm tag phụ "sa-pa" để có bài cho case chọn
// chip tag phụ.
const post = (
  slug: string,
  date: string,
  category: string,
  tags: { slug: string; name: string }[] = [{ slug: category.toLowerCase(), name: category }],
): JournalPost => ({
  slug,
  title: slug,
  excerpt: '',
  // Bài chưa có ảnh là trạng thái HỢP LỆ — SlotImage tự rơi về giữ chỗ.
  cover: null,
  date,
  readMinutes: 5,
  category,
  author: 'Guide',
  tags,
});

const POSTS: JournalPost[] = [
  post('p1', '2026-01-01', 'Food'),
  post('p2', '2026-01-02', 'Food'),
  post('p3', '2026-01-03', 'Nature'),
  post('p4', '2026-01-04', 'Nature'),
  post('p5', '2026-01-05', 'Packing', [
    { slug: 'packing', name: 'Packing' },
    { slug: 'sa-pa', name: 'Sa Pa' },
  ]),
  post('p6', '2026-01-06', 'Packing'),
  post('p7', '2026-01-07', 'Culture'),
  post('p8', '2026-01-08', 'Culture'),
  post('p9', '2026-01-09', 'Food'),
];

const TAGS = [
  { slug: 'food', name: 'Food' },
  { slug: 'nature', name: 'Nature' },
  { slug: 'packing', name: 'Packing' },
  { slug: 'culture', name: 'Culture' },
  { slug: 'sa-pa', name: 'Sa Pa' },
];

// BlogExplorer ghi URL bằng history.replaceState (đổi từ router.replace ở Task 12
// — router.replace kích hoạt RSC round-trip mỗi lần bấm). Bọc lại để kiểm đúng
// thứ nó hứa.
const replace = vi.fn();

beforeAll(() => {
  // jsdom mở ở "/" mặc định; component đọc window.location.pathname thật nên phải
  // đưa nó về đúng route TRƯỚC khi bọc replaceState.
  window.history.pushState({}, '', '/blog');
  window.history.replaceState = replace as unknown as typeof window.history.replaceState;
});

beforeEach(() => {
  replace.mockClear();
});

/**
 * Đếm card bài viết bằng LINK trỏ `/blog/<slug>`, không bằng `role="article"`:
 * `PostCard` là card TRẦN, gốc của nó là `<Link>` chứ không phải `<article>` như
 * `TourListCard`. Không đổi markup PostCard để vừa test — nó dùng chung với trang
 * Home và ở đó bố cục đã được chốt.
 */
function postCards(): HTMLElement[] {
  return screen.getAllByRole('link').filter((el) => el.getAttribute('href')?.startsWith('/blog/'));
}

// Slug địa danh thật của catalog — dùng để tách tag thành hai họ Topic/Place.
const DESTS = ['can-tho', 'da-nang', 'hanoi', 'hoi-an', 'hue', 'ninh-binh', 'sa-pa'];

function renderBlog(
  initial: {
    initialTopics?: string[];
    initialPlaces?: string[];
    initialLegacyTag?: string;
    initialQuery?: string;
    initialPage?: number;
  } = {},
) {
  return render(
    // reducedMotion="always" cho tất định: lưới bài dùng AnimatePresence +
    // blur, không khoá lại thì đếm card lúc đang animate ra số khác.
    <MotionConfig reducedMotion="always">
      <BlogExplorer posts={POSTS} tags={TAGS} destinationSlugs={DESTS} {...initial} />
    </MotionConfig>,
  );
}

describe('BlogExplorer — phân trang', () => {
  it('mặc định hiện 6 bài, không phải cả 9', () => {
    // 9 bài / 6 mỗi trang = 2 trang. Chọn 6 thay vì 9 (plan ghi 9) chính vì 9 cho
    // đúng 1 trang và thanh phân trang tự ẩn — tính năng không bao giờ chạy.
    renderBlog();
    expect(postCards()).toHaveLength(6);
  });

  it('trang 2 chỉ chứa phần dư', () => {
    renderBlog({ initialPage: 2 });
    expect(postCards()).toHaveLength(POSTS.length - 6);
  });

  it('thanh phân trang có mặt và công bố trang hiện tại', () => {
    renderBlog();
    const nav = screen.getByRole('navigation', { name: /pagination/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });

  it('bấm sang trang 2 thì mang nội dung trang 2 vào VÀ ghi vào URL', async () => {
    const user = userEvent.setup();
    renderBlog();

    // Bài đầu của trang 2 = bài thứ 7 theo ngày. Tính bằng chính hàm mà component
    // dùng, không hardcode slug — mock đổi thứ tự thì test đi theo.
    const firstOnPageTwo = sortPostsByDate(POSTS)[6];
    expect(firstOnPageTwo).toBeDefined();
    expect(
      screen.queryByRole('link', { name: new RegExp(firstOnPageTwo?.title ?? '') }),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: '2' }));

    // KHÔNG đếm số card ở đây, và `waitFor` cũng không cứu được: lưới bọc trong
    // `AnimatePresence mode="popLayout"`, mà trong jsdom các card đang exit KHÔNG
    // bao giờ rời DOM (không có animation frame thật để animation hoàn tất) — đếm
    // luôn ra 9 = 6 cũ + 3 mới. Đếm chỉ tin được ở lần render đầu (hai test trên).
    // Thứ thật sự cần khẳng định là nội dung trang 2 đã VÀO và URL đã ghi.
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: new RegExp(firstOnPageTwo?.title ?? '') }),
      ).toBeInTheDocument(),
    );
    expect(replace).toHaveBeenCalledWith(null, '', '/blog?page=2');
  });

  // Bug 19/08 (user báo): sang trang 2 thì "footer bị đẩy lên, lộ khoảng
  // trắng". Đo bằng Chromium: KHÔNG phải load chậm — toàn bộ bài đã ở client.
  // Lưới co ngay về 3 bài (829px thay vì 1832) nhưng viewport vẫn đứng ở toạ
  // độ thanh phân trang cũ (~1440), giờ là vùng footer; 6 thẻ cũ bị popLayout
  // ép `position:absolute` ở chỗ cũ trong ~600ms và KÉO chiều cao cuộn của
  // trang theo (2340 → 2020 khi chúng unmount) → dưới footer là 320px trắng
  // cho tới khi ghost biến mất. Sửa gốc: đổi trang thì cuộn về ĐẦU LƯỚI (như
  // mọi phân trang), và ghost không được kéo chiều cao trang.
  it('bấm sang trang 2 → cuộn về đầu lưới (window.scrollTo), lọc thì KHÔNG', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const user = userEvent.setup();
    renderBlog();

    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    // Lọc/tìm cũng setPage(1) — nhưng người dùng đang ĐỨNG ở sidebar, cuộn họ
    // đi là giật; chỉ đổi trang qua thanh phân trang mới cuộn.
    scrollTo.mockClear();
    await user.click(screen.getByRole('button', { name: '1' }));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1));
    scrollTo.mockClear();
    await user.type(screen.getByRole('searchbox'), 'x');
    expect(scrollTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('lưới KHÔNG cho ghost đang thoát kéo chiều cao trang — overflow clip', () => {
    renderBlog();
    const grid = screen.getByRole('heading', { name: 'All stories' }).nextElementSibling;
    expect(grid?.className).toMatch(/overflow-clip/);
  });

  it('page=1 KHÔNG ghi vào URL — nó là mặc định', async () => {
    const user = userEvent.setup();
    renderBlog({ initialPage: 2 });
    await user.click(screen.getByRole('button', { name: '1' }));
    expect(replace).toHaveBeenCalledWith(null, '', '/blog');
  });

  it('KHÔNG có ô chọn số bài mỗi trang — /blog không truyền onPageSizeChange', () => {
    renderBlog();
    expect(screen.queryByLabelText(/per page/i)).not.toBeInTheDocument();
  });
});

describe('BlogExplorer — lọc và phân trang không đánh nhau', () => {
  it('đổi chuyên mục thì về trang 1', async () => {
    // Không reset thì đang ở trang 2 mà lọc còn 3 kết quả sẽ ra màn hình trắng.
    const user = userEvent.setup();
    const tag = TAGS[0];
    expect(tag).toBeDefined();
    renderBlog({ initialPage: 2 });

    // Chip <Link> cũ đã thay bằng ô tick trong sidebar (17/08) — query theo
    // role checkbox. Neo `^` vì accessible name còn kèm số đếm phía sau.
    if (tag) await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${tag.name}`) }));
    expect(postCards().length).toBeGreaterThan(0);
    // URL cuối cùng không còn `page=2`.
    const lastCall = replace.mock.calls.at(-1);
    expect(String(lastCall?.[2])).not.toContain('page=');
  });

  it('chọn chip tag PHỤ (sa-pa) hiện đúng bài mang tag đó, dù category hiển thị là Packing', async () => {
    // p5 có category "Packing" (tag hiển thị đầu tiên) NHƯNG cũng mang tag phụ
    // "sa-pa" — chip lọc phải phủ được cả tag phụ này (filterPostsByTag match
    // trên toàn mảng tags, không chỉ category).
    //
    // KHÔNG đếm postCards() ở đây — cùng lý do đã ghi ở test "bấm sang trang
    // 2": card đang exit không rời DOM trong jsdom (AnimatePresence cần một
    // animation frame thật để hoàn tất, jsdom không có), nên p5 vốn đã nằm
    // trong 6 card trang 1 (sort mới-nhất-trước) khiến đếm số card không phân
    // biệt được "đã lọc" với "chưa lọc". `aria-live` count là plain text, đi
    // thẳng theo `visible.length`, không qua AnimatePresence — tin được.
    const user = userEvent.setup();
    renderBlog();

    await user.click(screen.getByRole('checkbox', { name: /^Sa Pa/ }));

    await waitFor(() => expect(screen.getByText('1 story')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /p5/ })).toBeInTheDocument();
  });

  it('gõ tìm kiếm cũng về trang 1', async () => {
    const user = userEvent.setup();
    renderBlog({ initialPage: 2 });
    await user.type(screen.getByRole('searchbox', { name: /search journal/i }), 'hoi an');
    const lastCall = replace.mock.calls.at(-1);
    expect(String(lastCall?.[2])).not.toContain('page=');
  });

  it('card featured tràn 2 cột CHỈ ở trang 1', () => {
    // Ở trang 2 thì bài đầu của trang chỉ là bài thứ 7 theo ngày; cho nó khổ lớn
    // là nói sai về thứ bậc nội dung.
    const { unmount } = renderBlog();
    expect(document.querySelector('.sm\\:col-span-2')).not.toBeNull();
    unmount();

    renderBlog({ initialPage: 2 });
    expect(document.querySelector('.sm\\:col-span-2')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Filter sidebar hai trục (17/08) — thay hàng chip đơn tuyển cũ
// ─────────────────────────────────────────────────────────────────────────
describe('BlogExplorer — sidebar lọc hai trục', () => {
  const tickFor = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  // `AnimatePresence` giữ thẻ đang thoát trong DOM thêm một nhịp, kể cả với
  // reducedMotion="always" — đọc DOM ngay sau click sẽ đếm cả thẻ sắp biến
  // mất. Đo được lúc dựng: lọc còn 3 bài mà vẫn thấy 4 link.
  // KHÔNG đếm card sau khi lọc: trong jsdom các thẻ đang exit của
  // `AnimatePresence` không bao giờ rời DOM (không có animation frame thật) —
  // quy ước này đã ghi ở test phân trang phía trên. Dòng "N stories" lấy thẳng
  // từ `visible.length` nên là chỗ khẳng định chính xác và ổn định.
  const expectStories = (n: number) =>
    waitFor(() =>
      expect(screen.getByText(new RegExp(`^${n} (story|stories)$`))).toBeInTheDocument(),
    );

  it('dòng "N stories" nằm TRONG khung sidebar (hàng đầu, cạnh Filters), không đứng riêng một dòng trên lưới', () => {
    renderBlog();
    const count = screen.getByText(/^9 stories$/);
    // Cùng khung card với tiêu đề "Filters".
    const filtersHeading = screen.getByRole('heading', { name: 'Filters' });
    expect(count.closest('aside')).not.toBeNull();
    expect(count.closest('aside')).toBe(filtersHeading.closest('aside'));
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('tag được tách thành hai họ theo slug ĐỊA DANH từ API', () => {
    renderBlog();
    // 'sa-pa' trùng slug destination → vào Place; còn lại vào Topic.
    // Tiêu đề nhóm là <legend> của <fieldset> — role "group" có tên nhóm.
    expect(screen.getByRole('group', { name: /Topic/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Place/ })).toBeInTheDocument();
    const place = screen.getByRole('group', { name: /Place/ });
    expect(place).toHaveTextContent('Sa Pa');
    expect(place).not.toHaveTextContent('Food');
  });

  it('destinations rỗng → dồn hết về Topic, KHÔNG vỡ và không hiện Place rỗng', () => {
    render(
      <MotionConfig reducedMotion="always">
        <BlogExplorer posts={POSTS} tags={TAGS} destinationSlugs={[]} />
      </MotionConfig>,
    );
    expect(screen.getByRole('group', { name: /Topic/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Place/ })).not.toBeInTheDocument();
  });

  it('ĐA TUYỂN trong cùng trục là OR — chip cũ chỉ chọn được một', async () => {
    const user = userEvent.setup();
    renderBlog();
    await user.click(tickFor('Food'));
    await expectStories(3); // p1, p2, p9
    await user.click(tickFor('Nature'));
    // OR: Food(3) + Nature(2) = 5, không phải giao = 0
    await expectStories(5);
  });

  it('bỏ tick thì nới lại kết quả', async () => {
    const user = userEvent.setup();
    renderBlog();
    await user.click(tickFor('Food'));
    await user.click(tickFor('Food'));
    await expectStories(9); // hết lọc → cả 9 bài
  });

  it('chip đang lọc hiện ra và bấm × thì gỡ đúng bộ lọc đó', async () => {
    const user = userEvent.setup();
    renderBlog();
    await user.click(tickFor('Food'));
    const chip = screen.getByRole('button', { name: /remove filter food/i });
    await user.click(chip);
    expect(screen.queryByRole('button', { name: /remove filter food/i })).not.toBeInTheDocument();
    await expectStories(9);
  });

  it('"Clear all" chỉ hiện khi ĐANG lọc', async () => {
    const user = userEvent.setup();
    renderBlog();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    await user.click(tickFor('Food'));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await expectStories(9);
  });

  it('link CŨ `?tag=sa-pa` vẫn lọc được và vào đúng họ Place', async () => {
    // Không được để link đã chia sẻ chết khi đổi sang ?topic=/?place=.
    renderBlog({ initialLegacyTag: 'sa-pa' });
    expect(screen.getByRole('button', { name: /remove filter sa pa/i })).toBeInTheDocument();
    await expectStories(1);
  });

  it('số đếm ĐỔI theo trục kia — đây là chỗ count của API nói dối', async () => {
    const user = userEvent.setup();
    renderBlog();
    const placeSection = () => screen.getByRole('group', { name: /Place/ });
    expect(placeSection()).toHaveTextContent('1');
    await user.click(tickFor('Food'));
    // Bài 'Sa Pa' mang tag packing, không phải food → sau khi lọc Food thì về 0
    expect(placeSection()).toHaveTextContent('0');
  });
});

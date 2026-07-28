import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { postCategories, sortPostsByDate } from '@/lib/blog';
import { JOURNAL_POSTS } from '@/mocks/journal';
import { BlogExplorer } from './blog-explorer';

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

function renderBlog(
  initial: { initialTag?: string; initialQuery?: string; initialPage?: number } = {},
) {
  return render(
    // reducedMotion="always" cho tất định: lưới bài dùng AnimatePresence +
    // blur, không khoá lại thì đếm card lúc đang animate ra số khác.
    <MotionConfig reducedMotion="always">
      <BlogExplorer posts={JOURNAL_POSTS} categories={postCategories(JOURNAL_POSTS)} {...initial} />
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
    expect(postCards()).toHaveLength(JOURNAL_POSTS.length - 6);
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
    const firstOnPageTwo = sortPostsByDate(JOURNAL_POSTS)[6];
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
    const category = postCategories(JOURNAL_POSTS)[0];
    expect(category).toBeDefined();
    renderBlog({ initialPage: 2 });

    // Chip chuyên mục là <Link> thật (server-render được, crawl được) — không
    // phải button, nên phải query theo role link.
    if (category) await user.click(screen.getByRole('link', { name: category }));
    expect(postCards().length).toBeGreaterThan(0);
    // URL cuối cùng không còn `page=2`.
    const lastCall = replace.mock.calls.at(-1);
    expect(String(lastCall?.[2])).not.toContain('page=');
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

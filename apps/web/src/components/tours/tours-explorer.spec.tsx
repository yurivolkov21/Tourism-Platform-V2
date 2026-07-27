import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tourCategories } from '@/lib/tours';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';
import { ToursExplorer } from './tours-explorer';

// next/navigation không chạy ngoài Next runtime — thay bằng đôi giả để kiểm
// đúng thứ ToursExplorer hứa: mỗi lần đổi bộ lọc thì URL được ghi lại.
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tours',
}));

function renderExplorer(initial: Parameters<typeof ToursExplorer>[0]['initial'] = {}) {
  // MotionConfig reducedMotion="always" cho tất định (root layout thật dùng
  // "user"). LƯU Ý: nó KHÔNG làm animation thoát của AnimatePresence kết thúc —
  // mode="popLayout" cần đo layout mà jsdom trả về toàn số 0, nên phần tử đang
  // thoát nằm lại DOM vô thời hạn. Vì vậy mọi assertion sau khi ĐỔI bộ lọc phải
  // nhắm vào trạng thái (URL, vùng aria-live) chứ không đếm số card.
  return render(
    <MotionConfig reducedMotion="always">
      <ToursExplorer
        tours={TOURS}
        categories={tourCategories(TOURS)}
        destinations={DESTINATIONS}
        initial={initial}
      />
    </MotionConfig>,
  );
}

beforeEach(() => {
  replace.mockClear();
});

describe('ToursExplorer — hiển thị', () => {
  it('mặc định hiện 12 tour đầu — đúng limit mặc định của contract', () => {
    renderExplorer();
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });

  it('công bố tổng số kết quả qua vùng aria-live', () => {
    renderExplorer();
    expect(screen.getByRole('status')).toHaveTextContent('16 tours');
  });

  it('trang 2 hiện 4 tour còn lại', () => {
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });
});

describe('ToursExplorer — lọc', () => {
  it('chọn chip chuyên mục thì lọc và ghi vào URL', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: /^Trekking,/ }));
    expect(replace).toHaveBeenCalledWith('/tours?category=trekking', { scroll: false });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 tours'));
  });

  it('chuyên mục lạ trong URL cho trạng thái RỖNG, không âm thầm hiện hết', () => {
    renderExplorer({ category: 'khong-ton-tai' });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText(/no tours match/i)).toBeInTheDocument();
  });

  it('nút xoá bộ lọc đưa danh sách về đủ 12 card của trang 1', async () => {
    const user = userEvent.setup();
    renderExplorer({ category: 'khong-ton-tai' });
    await user.click(screen.getByRole('button', { name: /clear all filters/i }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(screen.getByRole('status')).toHaveTextContent('16 tours');
  });

  it('lọc featured chỉ giữ tour featured', () => {
    renderExplorer({ featured: true });
    const count = TOURS.filter((t) => t.isFeatured).length;
    expect(screen.getAllByRole('article')).toHaveLength(count);
  });

  it('tìm kiếm bỏ dấu — gõ "ha long" ra tour Hạ Long', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole('searchbox'), 'ha long');
    expect(screen.getByRole('status')).toHaveTextContent('2 tours');
  });
});

describe('ToursExplorer — phân trang', () => {
  it('thanh phân trang biến mất khi kết quả chỉ còn 1 trang', () => {
    renderExplorer({ category: 'trekking' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });

  it('đổi bộ lọc khi đang ở trang 2 thì nhảy về trang 1 — không để màn hình trắng', async () => {
    const user = userEvent.setup();
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /^Trekking,/ }));
    // URL là bằng chứng tất định của việc page đã reset: nếu page còn 2 thì
    // chuỗi sẽ là '/tours?category=trekking&page=2' và lưới ra 0 card (chỉ có
    // 3 tour trekking, không đủ sang trang 2).
    expect(replace).toHaveBeenLastCalledWith('/tours?category=trekking', { scroll: false });
  });

  it('bấm số trang 2 thì ghi page vào URL', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(replace).toHaveBeenCalledWith('/tours?page=2', { scroll: false });
  });
});

describe('ToursExplorer — sắp xếp', () => {
  it('sort giá tăng dần đưa tour rẻ nhất lên đầu', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.selectOptions(screen.getByLabelText(/sort by/i), 'priceAsc');
    const cheapest = [...TOURS].sort((a, b) => Number(a.basePrice) - Number(b.basePrice))[0];
    await waitFor(() =>
      expect(screen.getAllByRole('article')[0]).toHaveTextContent(cheapest?.title ?? ''),
    );
  });

  it('sort mặc định (newest) KHÔNG ghi vào URL — giữ link sạch', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.selectOptions(screen.getByLabelText(/sort by/i), 'priceAsc');
    expect(replace).toHaveBeenLastCalledWith('/tours?sort=priceAsc', { scroll: false });
    await user.selectOptions(screen.getByLabelText(/sort by/i), 'newest');
    expect(replace).toHaveBeenLastCalledWith('/tours', { scroll: false });
  });
});

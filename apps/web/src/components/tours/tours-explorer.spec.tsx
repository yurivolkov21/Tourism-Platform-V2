import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { tourCategories } from '@/lib/tours';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';
import { ToursExplorer } from './tours-explorer';

// ToursExplorer ghi URL bằng history.replaceState (KHÔNG phải router.replace —
// cái đó kích hoạt RSC round-trip mỗi lần bấm, xem comment trong component).
// Bọc lại để kiểm đúng thứ nó hứa: mỗi lần đổi bộ lọc thì URL được ghi lại.
const replace = vi.fn();
beforeAll(() => {
  // jsdom mở ở "/" mặc định; component đọc window.location.pathname thật nên
  // phải đưa nó về đúng route TRƯỚC khi bọc replaceState.
  window.history.pushState({}, '', '/tours');
  window.history.replaceState = replace as unknown as typeof window.history.replaceState;
});

function renderExplorer(initial: Parameters<typeof ToursExplorer>[0]['initial'] = {}) {
  // MotionConfig reducedMotion="always" cho tất định — hero vẫn dùng motion
  // (root layout thật để "user"). Danh sách card KHÔNG còn dùng motion: bản cũ
  // dùng AnimatePresence mode="popLayout" + layout + blur, vừa tốn hiệu năng
  // vừa khiến phần tử đang thoát nằm lại DOM vô thời hạn trong jsdom. Nay là
  // CSS keyframes thuần nên đếm card sau khi lọc đã tin được.
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
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    expect(replace).toHaveBeenCalledWith(null, '', '/tours?categories=trekking');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 tours'));
  });

  it('chuyên mục lạ trong URL cho trạng thái RỖNG, không âm thầm hiện hết', () => {
    renderExplorer({ categories: 'khong-ton-tai' });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText(/no tours match/i)).toBeInTheDocument();
  });

  it('nút xoá bộ lọc đưa danh sách về đủ 12 card của trang 1', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'khong-ton-tai' });
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
    renderExplorer({ categories: 'trekking' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });

  it('đổi bộ lọc khi đang ở trang 2 thì nhảy về trang 1 — không để màn hình trắng', async () => {
    const user = userEvent.setup();
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(4);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    // URL là bằng chứng tất định của việc page đã reset: nếu page còn 2 thì
    // chuỗi sẽ là '/tours?category=trekking&page=2' và lưới ra 0 card (chỉ có
    // 3 tour trekking, không đủ sang trang 2).
    expect(replace).toHaveBeenLastCalledWith(null, '', '/tours?categories=trekking');
  });

  it('bấm số trang 2 thì ghi page vào URL', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(replace).toHaveBeenCalledWith(null, '', '/tours?page=2');
  });
});

describe('ToursExplorer — sắp xếp', () => {
  /** Select của Base UI không phải <select> gốc nên userEvent.selectOptions
      không dùng được — phải mở popup rồi bấm đúng option. */
  async function pickSort(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: label }));
  }

  it('sort giá tăng dần đưa tour rẻ nhất lên đầu', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await pickSort(user, /price: low to high/i);
    const cheapest = [...TOURS].sort((a, b) => Number(a.basePrice) - Number(b.basePrice))[0];
    await waitFor(() =>
      expect(screen.getAllByRole('article')[0]).toHaveTextContent(cheapest?.title ?? ''),
    );
  });

  it('sort mặc định (newest) KHÔNG ghi vào URL — giữ link sạch', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await pickSort(user, /price: low to high/i);
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(null, '', '/tours?sort=priceAsc'));
    await pickSort(user, /newest first/i);
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(null, '', '/tours'));
  });

  it('nút mở sort công bố nhãn "Sort by" cho trình đọc màn hình', () => {
    renderExplorer();
    expect(screen.getByRole('combobox')).toHaveAccessibleName(/sort by/i);
  });

  it('nút sort hiện NHÃN chứ không phải giá trị thô', () => {
    renderExplorer();
    // Base UI Select.Value in giá trị thô nếu không truyền hàm render — nút sẽ
    // hiện "newest" thay vì "Newest first".
    expect(screen.getByRole('combobox')).toHaveTextContent('Newest first');
    expect(screen.getByRole('combobox')).not.toHaveTextContent(/^newest$/);
  });
});

describe('ToursExplorer — sidebar đa chọn', () => {
  it('chọn hai chuyên mục là OR — kết quả bằng tổng của cả hai', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await user.click(screen.getByRole('checkbox', { name: /^Food & markets, / }));
    // 3 trekking + 3 food
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('6 tours'));
    expect(replace).toHaveBeenLastCalledWith(null, '', '/tours?categories=trekking,food');
  });

  it('facet khác nhau là AND — thu hẹp kết quả', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 tours'));
    // 3 tour trekking: 8 ngày · 3 ngày · 2 ngày → chỉ 1 cái vào nhóm "4+ days"
    await user.click(screen.getByRole('checkbox', { name: /^4\+ days/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 tour'));
  });

  it('option dẫn tới 0 kết quả bị VÔ HIỆU HOÁ — chặn ngõ cụt trắng trang', async () => {
    const user = userEvent.setup();
    renderExplorer();
    // Không tour trekking nào là tour trong ngày.
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    // Base UI đánh dấu vô hiệu hoá bằng aria-disabled trên <span role="checkbox">
    // chứ không phải thuộc tính `disabled` native, nên toBeDisabled() không nhận ra.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /^Day trip, / })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    // Bấm vào cũng không đổi gì — người dùng không tự đưa mình vào ngõ cụt được.
    await user.click(screen.getByRole('checkbox', { name: /^Day trip, / }));
    expect(screen.getByRole('status')).toHaveTextContent('3 tours');
  });

  it('option ĐANG BẬT không bao giờ bị vô hiệu hoá — nếu không sẽ tự khoá mình', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await user.click(screen.getByRole('checkbox', { name: /^4\+ days/ }));
    // "4+ days" đang bật; dù có kết hợp nào làm nó về 0 thì vẫn phải bỏ chọn được.
    const box = screen.getByRole('checkbox', { name: /^4\+ days/ });
    expect(box).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(box);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 tours'));
  });

  it('số đếm cạnh mỗi option phản ánh các facet khác đang bật', async () => {
    const user = userEvent.setup();
    renderExplorer();
    // Chưa lọc gì: Trekking có 3 tour.
    expect(screen.getByRole('checkbox', { name: 'Trekking, 3 tours' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /^4\+ days/ }));
    // Trong nhóm 4+ days chỉ còn 1 tour trekking → số cạnh Trekking đổi thành 1.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Trekking, 1 tour' })).toBeInTheDocument(),
    );
  });

  it('bỏ chọn bằng chip đang bật thì kết quả trở lại', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'trekking' });
    expect(screen.getByRole('status')).toHaveTextContent('3 tours');
    await user.click(screen.getByRole('button', { name: /remove filter trekking/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('16 tours'));
  });

  it('mọi nhóm facet mở sẵn, và lựa chọn từ URL hiện đúng trạng thái checked', () => {
    renderExplorer({ prices: '<100' });
    expect(screen.getByRole('checkbox', { name: /under \$100/i })).toBeChecked();
    // Nhóm không có lựa chọn nào cũng phải mở — đó là lý do dùng sidebar.
    expect(screen.getByRole('checkbox', { name: /^Challenging, / })).not.toBeChecked();
  });

  it('nút thu sidebar đổi nhãn và giữ nguyên bộ lọc', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'trekking' });
    const toggle = screen.getByRole('button', { name: /hide filters/i });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /show filters/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 tours');
  });

  it('lọc theo độ khó bỏ qua tour không ghi độ khó', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('checkbox', { name: /^Challenging, / }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 tour'));
  });
});

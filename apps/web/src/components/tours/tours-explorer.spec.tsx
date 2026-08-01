import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { tourCategories } from '@/lib/tours';
// `mocks/tours.ts` + `mocks/destinations.ts` đã khai tử ở Task 7 (cụm
// destinations-api) — hai biến dưới đây giờ là fixture nội bộ trích nguyên vẹn
// từ mock cũ, xem đầu file fixture để biết vì sao (mọi con số các test dưới
// đây đang canh — 16 tour, 9 destination, 3 tour trekking, … — vẫn đúng
// nguyên xi).
import {
  FIXTURE_DESTINATIONS as DESTINATIONS,
  FIXTURE_TOURS as TOURS,
} from '@/test/fixtures/catalog';
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
  // (root layout thật để "user"). Danh sách card KHÔNG dùng motion: nó là CSS
  // keyframes thuần, nên đếm card sau khi lọc tin được.
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

/** Bộ lọc nằm trong drawer nên mọi tương tác với facet phải mở nó trước. */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^filters/i }));
  await screen.findByRole('dialog');
}

describe('ToursExplorer — hiển thị', () => {
  it('mặc định hiện 10 tour mỗi trang', () => {
    renderExplorer();
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('số kết quả là TIÊU ĐỀ khu vực, đồng thời công bố qua aria-live', () => {
    renderExplorer();
    const heading = screen.getByRole('status');
    expect(heading).toHaveTextContent('16 tours');
    expect(heading.tagName).toBe('H2');
  });

  it('đang lọc thì tiêu đề nói rõ đang xem một phần của cái gì', () => {
    renderExplorer({ categories: 'trekking' });
    expect(screen.getByRole('status')).toHaveTextContent('3 of 16 tours');
  });

  it('trang 2 hiện 6 tour còn lại', () => {
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(6);
  });

  it('không có bộ lọc nào bật thì KHÔNG render chip rỗng', () => {
    renderExplorer();
    expect(screen.queryByRole('button', { name: /remove filter/i })).toBeNull();
  });
});

describe('ToursExplorer — drawer bộ lọc', () => {
  it('nút Filters mở drawer và mang huy hiệu đếm khi đang lọc', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'trekking' });
    const trigger = screen.getByRole('button', { name: /^filters/i });
    expect(trigger).toHaveTextContent('1');
    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('header drawer công bố số kết quả sống, không phải nhãn tĩnh', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    expect(screen.getByText(/16 tours match/i)).toBeInTheDocument();
  });

  it('nút đóng drawer mang số kết quả — lối thoát, không phải lệnh Apply', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    expect(screen.getByRole('button', { name: /show 16 tours/i })).toBeInTheDocument();
  });

  it('lọc áp dụng TỨC THÌ, không chờ bấm Apply', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    // Số ở header drawer đổi ngay, chưa hề đóng drawer.
    await waitFor(() => expect(screen.getByText(/3 tours match/i)).toBeInTheDocument());
    expect(replace).toHaveBeenCalledWith(null, '', '/tours?categories=trekking');
  });
});

describe('ToursExplorer — lọc', () => {
  it('chuyên mục lạ trong URL cho trạng thái RỖNG, không âm thầm hiện hết', () => {
    renderExplorer({ categories: 'khong-ton-tai' });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText(/no tours match/i)).toBeInTheDocument();
  });

  it('nút xoá bộ lọc đưa danh sách về đủ 10 card của trang 1', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'khong-ton-tai' });
    await user.click(screen.getByRole('button', { name: /clear all filters/i }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(10));
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
    expect(screen.getByRole('status')).toHaveTextContent('2 of 16 tours');
  });

  it('chip trên thanh kết quả gỡ được bộ lọc mà không cần mở drawer', async () => {
    const user = userEvent.setup();
    renderExplorer({ categories: 'trekking' });
    expect(screen.getByRole('status')).toHaveTextContent('3 of 16 tours');
    await user.click(screen.getByRole('button', { name: /remove filter trekking/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('16 tours'));
  });
});

describe('ToursExplorer — phân trang', () => {
  it('dãy số trang biến mất khi chỉ còn 1 trang, nhưng thanh vẫn giữ phạm vi', () => {
    renderExplorer({ categories: 'trekking' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
    // Vẫn phải nói cho người dùng biết họ đang xem bao nhiêu trên tổng bao nhiêu.
    expect(screen.getByText(/showing 1–3 of 3/i)).toBeInTheDocument();
  });

  it('dòng phạm vi khớp trang đang xem', () => {
    renderExplorer({ page: 2 });
    expect(screen.getByText(/showing 11–16 of 16/i)).toBeInTheDocument();
  });

  it('đổi bộ lọc khi đang ở trang 2 thì nhảy về trang 1 — không để màn hình trắng', async () => {
    const user = userEvent.setup();
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(6);
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    // URL là bằng chứng tất định: nếu page còn 2 thì chuỗi sẽ kèm &page=2 và
    // lưới ra 0 card (chỉ 3 tour trekking, không đủ sang trang 2).
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
    await user.click(screen.getByRole('combobox', { name: /sort by/i }));
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

  it('sort ở NGOÀI trang, không nằm trong drawer — lọc và sắp xếp là hai mô hình khác nhau', () => {
    renderExplorer();
    expect(screen.getByRole('combobox', { name: /sort by/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('nút mở sort công bố nhãn "Sort by" và hiện NHÃN chứ không phải giá trị thô', () => {
    renderExplorer();
    const trigger = screen.getByRole('combobox', { name: /sort by/i });
    expect(trigger).toHaveAccessibleName(/sort by/i);
    expect(trigger).toHaveTextContent('Newest first');
  });
});

describe('ToursExplorer — facet đa chọn', () => {
  it('chọn hai chuyên mục là OR — kết quả bằng tổng của cả hai', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await user.click(screen.getByRole('checkbox', { name: /^Food & markets, / }));
    // 3 trekking + 3 food
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('6 of 16 tours'));
    expect(replace).toHaveBeenLastCalledWith(null, '', '/tours?categories=trekking,food');
  });

  it('facet khác nhau là AND — thu hẹp kết quả', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 of 16 tours'));
    // 3 tour trekking: 8 ngày · 3 ngày · 2 ngày → chỉ 1 cái vào nhóm "4+ days"
    await user.click(screen.getByRole('button', { name: /^4\+ days, / }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 16 tours'));
  });

  it('option dẫn tới 0 kết quả bị VÔ HIỆU HOÁ — chặn ngõ cụt trắng trang', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    // Không tour trekking nào là tour trong ngày.
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Day trip, / })).toBeDisabled());
  });

  it('option ĐANG BẬT không bao giờ bị vô hiệu hoá — nếu không sẽ tự khoá mình', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    await user.click(screen.getByRole('button', { name: /^4\+ days, / }));
    const pill = screen.getByRole('button', { name: /^4\+ days, / });
    expect(pill).not.toBeDisabled();
    await user.click(pill);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 of 16 tours'));
  });

  it('số đếm cạnh mỗi option phản ánh các facet khác đang bật', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    expect(screen.getByRole('checkbox', { name: 'Trekking, 3 tours' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^4\+ days, / }));
    // Trong nhóm 4+ days chỉ còn 1 tour trekking.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Trekking, 1 tour' })).toBeInTheDocument(),
    );
  });

  it('lọc theo độ khó bỏ qua tour không ghi độ khó', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /^Challenging, / }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 16 tours'));
  });
});

describe('ToursFilters — danh sách dài rút gọn', () => {
  it('Destination 9 địa danh chỉ hiện 6 + nút mở hết', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    expect(screen.getByRole('checkbox', { name: /^Sa Pa, / })).toBeInTheDocument();
    // Phú Quốc là mục thứ 9 → nằm ngoài 6 mục đầu
    expect(screen.queryByRole('checkbox', { name: /^Phú Quốc, / })).toBeNull();
    expect(screen.getByRole('button', { name: /show all 9/i })).toBeInTheDocument();
  });

  it('bấm "Show all" hiện đủ 9 rồi thu lại được', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /show all 9/i }));
    expect(screen.getByRole('checkbox', { name: /^Phú Quốc, / })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.queryByRole('checkbox', { name: /^Phú Quốc, / })).toBeNull();
  });

  it('option đang bật nằm ngoài 6 mục đầu thì nhóm tự mở hết', async () => {
    // Nếu không, chip "Phú Quốc" hiện trên thanh kết quả mà trong drawer không
    // tìm ra ô nào để bỏ chọn.
    const user = userEvent.setup();
    renderExplorer({ destinations: 'phu-quoc' });
    await openFilters(user);
    expect(screen.getByRole('checkbox', { name: /^Phú Quốc, / })).toBeChecked();
    expect(screen.queryByRole('button', { name: /show all 9/i })).toBeNull();
  });

  it('nhóm ngắn KHÔNG có nút "Show all" thừa', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);
    // Chỉ Destination (9) vượt ngưỡng 6; Category đúng 6, ba nhóm pill có 3.
    expect(screen.getAllByRole('button', { name: /show all/i })).toHaveLength(1);
  });
});

describe('ToursExplorer — số tour mỗi trang', () => {
  it('đổi sang 50/trang thì hiện hết 16 tour và dãy số trang biến mất', async () => {
    const user = userEvent.setup();
    renderExplorer();
    const trigger = screen.getByRole('combobox', { name: /tours per page/i });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: '50' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(16));
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });

  it('đổi số/trang khi đang ở trang 2 thì về trang 1 — không để màn hình trắng', async () => {
    const user = userEvent.setup();
    renderExplorer({ page: 2 });
    expect(screen.getAllByRole('article')).toHaveLength(6);
    await user.click(screen.getByRole('combobox', { name: /tours per page/i }));
    await user.click(await screen.findByRole('option', { name: '50' }));
    // Với 50/trang chỉ còn 1 trang; giữ nguyên page=2 sẽ ra 0 card.
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(16));
  });

  it('giá trị mặc định 10 KHÔNG ghi vào URL, giá trị khác thì có', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('combobox', { name: /tours per page/i }));
    await user.click(await screen.findByRole('option', { name: '20' }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(null, '', '/tours?limit=20'));
  });

  it('đọc limit từ URL', () => {
    renderExplorer({ limit: 20 });
    expect(screen.getAllByRole('article')).toHaveLength(16);
  });

  it('limit lạ trong URL rơi về mặc định thay vì vỡ', () => {
    renderExplorer({ limit: 999 });
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });
});

describe('ToursExplorer — facet destination từ API (19 slug thật, khác 9 destination mock)', () => {
  // Tour #22 rút gọn (spec 2026-07-31-tours-catalogue-api §3/§5): destination
  // 'vung-tau' KHÔNG nằm trong 9 destination mock (Sa Pa…Phú Quốc), nên phép
  // thử này không thể "ăn may" pass nhờ trùng dữ liệu sẵn có — nó buộc phải
  // chạy qua đúng đường lọc facet generic bằng slug thật từ API.
  const vungTauTour = {
    ...TOURS[0],
    id: 'test-vung-tau-coastal-2d',
    slug: 'vung-tau-coastal-2d',
    title: 'Vũng Tàu Coastal Escape 2D1N',
    destinations: [{ slug: 'vung-tau', name: 'Vũng Tàu', isPrimary: true }],
  };
  const vungTauDestination = {
    id: 'test-vung-tau',
    slug: 'vung-tau',
    name: 'Vũng Tàu',
    country: 'Vietnam',
    region: 'Southern Vietnam',
    description: null,
    tourCount: 1,
  };

  it('chọn destination vung-tau (từ URL) lọc đúng ra vung-tau-coastal-2d', () => {
    const tours = [...TOURS, vungTauTour];
    render(
      <MotionConfig reducedMotion="always">
        <ToursExplorer
          tours={tours}
          categories={tourCategories(tours)}
          destinations={[...DESTINATIONS, vungTauDestination]}
          initial={{ destinations: 'vung-tau' }}
        />
      </MotionConfig>,
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Vũng Tàu Coastal Escape 2D1N')).toBeInTheDocument();
  });
});

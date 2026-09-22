import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { MotionConfig } from 'motion/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// `mocks/tours.ts` + `mocks/destinations.ts` đã khai tử ở Task 7 (cụm
// destinations-api) — hai biến dưới đây giờ là fixture nội bộ trích nguyên vẹn
// từ mock cũ, xem đầu file fixture để biết vì sao (mọi con số các test dưới
// đây đang canh — 16 tour, 9 destination, 3 tour trekking, … — vẫn đúng
// nguyên xi).
import {
  FIXTURE_CATEGORIES as CATEGORIES,
  FIXTURE_DESTINATIONS as DESTINATIONS,
  FIXTURE_TOURS as TOURS,
} from '@/test/fixtures/catalog';
import { ToursExplorer } from './tours-explorer';

// Từ cụm B (nút tim), cây của ToursExplorer có `WishlistProvider` → chạm
// next/navigation, session và API. Không mock thì `useRouter()` ném
// "invariant expected app router to be mounted" và CẢ 38 test ở đây đỏ vì một
// lý do không liên quan gì tới thứ chúng đang canh.
//
// Mock ở mức TỐI THIỂU và mặc định CHƯA đăng nhập: các test dưới đây kiểm lọc,
// phân trang và URL — không kiểm wishlist. Hành vi nút tim có spec riêng ở
// `wishlist-heart.spec.tsx`.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/tours',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }) }));

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
        categories={CATEGORIES}
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

  // Bệnh chung 3 explorer (đo 19/08): đổi trang thì lưới thay tại chỗ nhưng
  // khung hình đứng nguyên ở thanh phân trang — phải cuộn về đầu lưới.
  it('bấm số trang → cuộn về đầu lưới; đổi bộ lọc thì KHÔNG cuộn', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    scrollTo.mockClear();
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: /^Trekking, / }));
    expect(scrollTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
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

  /**
   * Ba test dưới đây pin HỢP ĐỒNG mà trang listing dựa vào từ 22/09: bộ chip
   * danh mục đến từ endpoint `catalog.categories.list`, không còn suy từ danh
   * sách tour đã tải. Điều đó chỉ có nghĩa nếu explorer render ĐÚNG thứ nó
   * được đưa — đúng thứ tự, đủ cả danh mục không có tour nào — mà vẫn tự đếm
   * lấy con số in trên chip.
   */
  it('chip danh mục theo thứ tự PROP, không theo thứ tự xuất hiện trong lưới', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);

    // Đọc `htmlFor` của nhãn chứ không `id` của ô: Base UI tự sinh id cho phần
    // tử mang `role="checkbox"`, chỉ nhãn mới giữ `facet-<slug>`.
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    const rendered = [...screen.getByRole('dialog').querySelectorAll('label')]
      .map((label) => label.htmlFor.replace(/^facet-/, ''))
      .filter((slug) => slugs.has(slug));

    // `FIXTURE_TOURS` mở đầu bằng một tour `cruises`; nếu chip vẫn suy từ lưới
    // thì `cruises` đứng đầu thay vì `food`.
    expect(rendered).toEqual(CATEGORIES.map((c) => c.slug));
  });

  it('danh mục KHÔNG có tour nào vẫn có mặt trong danh sách, ở dạng khoá', async () => {
    const user = userEvent.setup();
    render(
      <MotionConfig reducedMotion="always">
        <ToursExplorer
          tours={TOURS}
          categories={[...CATEGORIES, { slug: 'wellness', name: 'Wellness retreats' }]}
          destinations={DESTINATIONS}
          initial={{}}
        />
      </MotionConfig>,
    );
    await openFilters(user);
    // Danh sách gập ở 6 mục; danh mục thứ bảy nằm sau nút "Show all".
    await user.click(screen.getByRole('button', { name: 'Show all 7' }));

    // Admin vừa tạo danh mục và chưa gắn tour nào: nó phải có mặt để họ thấy
    // mình đã tạo đúng, nhưng khoá lại vì bấm chỉ dẫn tới một lưới trống.
    // `aria-disabled` chứ không `toBeDisabled()`: Base UI dựng ô bằng `<span>`,
    // và thuộc tính `disabled` không có nghĩa trên thẻ đó.
    expect(screen.getByRole('checkbox', { name: 'Wellness retreats, 0 tours' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('danh mục ĐÃ ẨN đang lọc: chip in TÊN, và vẫn có ô để bỏ tick', async () => {
    // Admin ẩn "Cruises" → endpoint thôi trả nó, nhưng link cũ
    // `/tours?categories=cruises` vẫn lọc đúng vì API công khai không gác
    // `isActive` khi lọc tour. Trước bản vá: chip in chữ `cruises` (slug máy)
    // và thẻ Category không có dòng nào tích, nên khách thấy lưới bị thu hẹp
    // mà không tìm ra chỗ tắt.
    const user = userEvent.setup();
    const visible = CATEGORIES.filter((c) => c.slug !== 'cruises');
    render(
      <MotionConfig reducedMotion="always">
        <ToursExplorer
          tours={TOURS}
          categories={visible}
          destinations={DESTINATIONS}
          initial={{ categories: 'cruises' }}
        />
      </MotionConfig>,
    );

    // Chip trên thanh kết quả mang TÊN, không phải slug. Khớp CHÍNH XÁC chứ
    // không `/cruises/i`: slug `cruises` và tên `Cruises` chỉ khác mỗi chữ
    // hoa, nên regex bỏ qua hoa-thường thì ca này xanh cả khi chip in slug.
    expect(
      screen.getByRole('button', { name: messages.toursPage.removeFilter('Cruises') }),
    ).toBeInTheDocument();

    // Và thẻ Category có đúng ô ấy, đang tích — 5 mục còn lại cộng mục bù là
    // 6, vừa đúng trần gập nên không có nút "Show all".
    await openFilters(user);
    expect(screen.getByRole('checkbox', { name: /^Cruises, / })).toBeChecked();
  });

  it('endpoint danh mục RỚT: thẻ facet vẫn có mục, suy từ tour đã tải', async () => {
    // `null` = lời gọi hỏng. Rơi về suy-từ-tour là hành vi trước 22/09 — xấu
    // hơn bản đầy đủ nhưng còn dùng được, khác hẳn một thẻ có viền mà rỗng ruột.
    const user = userEvent.setup();
    render(
      <MotionConfig reducedMotion="always">
        <ToursExplorer tours={TOURS} categories={null} destinations={DESTINATIONS} initial={{}} />
      </MotionConfig>,
    );
    await openFilters(user);

    expect(screen.getByRole('checkbox', { name: /^Trekking, / })).toBeInTheDocument();
  });

  it('con số trên chip đếm từ lưới đã lọc, KHÔNG lấy `toursCount` của endpoint', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await openFilters(user);

    // Endpoint khai `trekking` có 3 tour trên toàn catalogue. Bật thêm một
    // facet thì chỉ còn 1 — in 3 lúc ấy là hứa nhiều hơn thực tế.
    expect(CATEGORIES.find((c) => c.slug === 'trekking')?.toursCount).toBe(3);
    await user.click(screen.getByRole('button', { name: /^4\+ days, / }));
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
    cover: null,
  };

  it('chọn destination vung-tau (từ URL) lọc đúng ra vung-tau-coastal-2d', () => {
    const tours = [...TOURS, vungTauTour];
    render(
      <MotionConfig reducedMotion="always">
        <ToursExplorer
          tours={tours}
          categories={CATEGORIES}
          destinations={[...DESTINATIONS, vungTauDestination]}
          initial={{ destinations: 'vung-tau' }}
        />
      </MotionConfig>,
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Vũng Tàu Coastal Escape 2D1N')).toBeInTheDocument();
  });
});

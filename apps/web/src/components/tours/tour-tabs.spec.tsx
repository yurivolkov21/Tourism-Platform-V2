import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TourTabs } from './tour-tabs';

const panels = {
  overview: <p>OVERVIEW_BODY</p>,
  itinerary: <p>ITINERARY_BODY</p>,
  departures: <p>DEPARTURES_BODY</p>,
  reviews: <p>REVIEWS_BODY</p>,
  goodToKnow: <p>GOODTOKNOW_BODY</p>,
};

describe('TourTabs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });

  it('render ĐỦ 5 panel vào DOM, chỉ ẩn bằng thuộc tính hidden', () => {
    // Trang tour là SSG nằm trong sitemap: mount có điều kiện = giấu lịch trình
    // khỏi crawler. Đây là ràng buộc của ADR-0022, không phải sở thích.
    render(<TourTabs panels={panels} />);
    for (const body of [
      'OVERVIEW_BODY',
      'ITINERARY_BODY',
      'DEPARTURES_BODY',
      'REVIEWS_BODY',
      'GOODTOKNOW_BODY',
    ]) {
      expect(screen.getByText(body)).toBeInTheDocument();
    }
  });

  it('mặc định mở tab đầu tiên khi URL không có hash', () => {
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.overview })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('hash trên URL mở đúng tab', () => {
    window.history.replaceState(null, '', '/tours/x#departures');
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.departures })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('hash lạ thì rơi về tab đầu, không để trang trống', () => {
    window.history.replaceState(null, '', '/tours/x#khong-ton-tai');
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.overview })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('đổi tab thì ghi lại hash', async () => {
    render(<TourTabs panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    expect(window.location.hash).toBe('#reviews');
  });

  it('link trong trang trỏ hash khác thì tab đổi theo', () => {
    // Thẻ policy ở panel đặt chỗ và link trong card dữ kiện đều là <a href="#...">.
    // Không nghe `hashchange` thì URL đổi mà tab đứng yên — bấm xong không thấy
    // gì xảy ra.
    render(<TourTabs panels={panels} />);
    // `act` bắt buộc: `hashchange` bắn NGOÀI React nên setState của listener
    // không được flush trước khi assert nếu không bọc.
    act(() => {
      window.location.hash = '#good-to-know';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('tab', { name: messages.tourDetail.tabs.goodToKnow })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('ghi hash bằng replaceState — không đẻ mục lịch sử để Back phải bấm 5 lần', async () => {
    const before = window.history.length;
    render(<TourTabs panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.itinerary }));
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    expect(window.history.length).toBe(before);
  });

  it('CHỈ panel Itinerary bị bó hẹp 768 — bốn panel kia dùng trọn bề ngang', () => {
    // `.pane.narrow` trong wireframe chỉ gắn cho tab Itinerary: dòng lịch trình
    // là văn xuôi, đọc hết 1056 thì dài quá tầm mắt.
    const { container } = render(<TourTabs panels={panels} />);
    const narrow = container.querySelectorAll('[data-narrow="true"]');
    expect(narrow).toHaveLength(1);
    expect(narrow[0]).toHaveTextContent('ITINERARY_BODY');
  });
});

// ── Dải cuộn ngang khi năm tab không vừa khung (điện thoại) ──────────────────
// jsdom không có layout nên mọi số đo phải giả lập. Số dưới đây là số ĐO THẬT
// ở viewport 375 (07–08/10): khung 279px, mép trái khung ở x=48 vì thân trang
// đệm `px-12`; năm tab rộng 61 · 54 · 73 · 56 · 90, khe 24 → nội dung 430px.
// Sau G26 (thân trang dưới `md` đệm `px-4`) khung ở 375 là 343px, mép trái
// x=16. Dải vẫn tràn nên kịch bản giữ nguyên giá trị: phép tính cuộn chỉ cần
// một dải tràn, không phụ thuộc bề rộng khung cụ thể.
const LIST_LEFT = 48;
const GAP = 24;
const PHONE = { clientWidth: 279, widths: [61, 54, 73, 56, 90] };
const DESKTOP = { clientWidth: 1056, widths: [192, 192, 192, 192, 192] };

function rectOf(left: number, width: number): DOMRect {
  return {
    left,
    right: left + width,
    width,
    x: left,
    top: 0,
    bottom: 38,
    height: 38,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Giả lập layout của dải: bề rộng khung, bề rộng nội dung, vị trí từng tab.
    Vị trí màn hình của tab trượt theo `scrollLeft` y như trình duyệt thật. */
function mockStripLayout({ clientWidth, widths }: { clientWidth: number; widths: number[] }) {
  const list = screen.getByRole('tablist');
  const starts: number[] = [];
  let x = 0;
  for (const width of widths) {
    starts.push(x);
    x += width + GAP;
  }
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(list, 'scrollWidth', {
    configurable: true,
    value: Math.max(clientWidth, x - GAP),
  });
  list.getBoundingClientRect = () => rectOf(LIST_LEFT, clientWidth);
  screen.getAllByRole('tab').forEach((tab, i) => {
    tab.getBoundingClientRect = () =>
      rectOf(LIST_LEFT + (starts[i] ?? 0) - list.scrollLeft, widths[i] ?? 0);
  });
  return list;
}

function goToHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('TourTabs — dải cuộn ngang khi năm tab không vừa khung', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/tours/x');
  });

  it('dải cuộn căn tab từ mép trái — căn giữa đẩy tab đầu tràn sang trái, chỗ không cuộn tới được', () => {
    // Đo 08/10 bằng Chromium ở 375: lớp gốc của TabsList có `justify-center`.
    // Trong vùng cuộn, nội dung 430px căn giữa khung 279px tràn đều HAI phía:
    // Overview nằm ở x=−75 mà `scrollLeft` không âm được, nên tab đầu mất hẳn
    // (`scrollWidth` chỉ 354). jsdom không có layout nên canh bằng chính lớp
    // CSS; số đo trước/sau ghi ở CHANGELOG.
    render(<TourTabs panels={panels} />);
    expect(screen.getByRole('tablist')).toHaveClass('max-sm:justify-start');
  });

  it('đang ở đầu dải → chỉ mép phải mờ, vì bên phải còn tab bị che', () => {
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(PHONE);
    fireEvent.scroll(list);
    expect(list).toHaveAttribute('data-overflow-end');
    expect(list).not.toHaveAttribute('data-overflow-start');
  });

  it('cuộn tới cuối → chỉ mép trái mờ', () => {
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(PHONE);
    list.scrollLeft = 151;
    fireEvent.scroll(list);
    expect(list).toHaveAttribute('data-overflow-start');
    expect(list).not.toHaveAttribute('data-overflow-end');
  });

  it('dải vừa khung (desktop) thì không mờ mép nào và trả wheel cho Lenis; tràn thì giữ wheel cho dải', () => {
    // Gắn `data-lenis-prevent` vô điều kiện thì desktop mất cuộn mượt mỗi lần
    // lăn chuột ngang qua dải tab, dù dải chẳng có gì để cuộn.
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(DESKTOP);
    fireEvent.scroll(list);
    expect(list).not.toHaveAttribute('data-overflow-start');
    expect(list).not.toHaveAttribute('data-overflow-end');
    expect(list).not.toHaveAttribute('data-lenis-prevent');

    mockStripLayout(PHONE);
    fireEvent.scroll(list);
    expect(list).toHaveAttribute('data-lenis-prevent');
  });

  it('theo dõi kích thước cả dải lẫn từng tab, đổi kích thước thì tính lại mép', () => {
    // Font nạp xong làm TAB rộng ra trong khi dải giữ nguyên kích thước: chỉ
    // theo dõi dải là bỏ lỡ, mép mờ đứng sai trạng thái tới lần cuộn kế.
    const watchers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private readonly watcher: { callback: ResizeObserverCallback; targets: Element[] };
      constructor(callback: ResizeObserverCallback) {
        this.watcher = { callback, targets: [] };
        watchers.push(this.watcher);
      }
      observe(target: Element) {
        this.watcher.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      render(<TourTabs panels={panels} />);
      const list = mockStripLayout(PHONE);
      // Base UI cũng có observer riêng trên dải và từng tab (để cập nhật
      // indicator), nên không nhận diện theo phần tử được theo dõi. Gọi lần
      // lượt từng observer: cái làm mép mờ bật lên là observer của TourTabs.
      const ours = watchers.find((watcher) => {
        act(() => {
          watcher.callback([], {} as ResizeObserver);
        });
        return list.hasAttribute('data-overflow-end');
      });
      expect(ours?.targets).toEqual(expect.arrayContaining([list, ...screen.getAllByRole('tab')]));
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it('link trỏ #good-to-know → dải cuộn tới cuối để tab đang mở lộ ra', () => {
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(PHONE);
    goToHash('#good-to-know');
    // Good to know 340–430: 430 + 32 − 279 = 183, kẹp ở mức cuộn tối đa 151.
    expect(list.scrollLeft).toBe(151);
  });

  it('bấm tab đang bị che một nửa → dải cuộn vừa đủ để tab ra khỏi vùng mờ', async () => {
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(PHONE);
    await userEvent.click(screen.getByRole('tab', { name: messages.tourDetail.tabs.reviews }));
    // Reviews 260–316: 316 + 32 − 279 = 69.
    expect(list.scrollLeft).toBe(69);
  });

  it('dải đã cuộn tới cuối, mở tab bên trái → cuộn lùi vừa đủ', () => {
    // Bắt lỗi quy đổi toạ độ: vị trí màn hình của tab đã trừ `scrollLeft`,
    // quên cộng lại thì Itinerary bị tính ở −66 và dải lùi quá tay về 0.
    render(<TourTabs panels={panels} />);
    const list = mockStripLayout(PHONE);
    list.scrollLeft = 151;
    goToHash('#itinerary');
    // Itinerary 85–139: 85 − 32 = 53.
    expect(list.scrollLeft).toBe(53);
  });
});

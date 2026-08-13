import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourDetailVM, TourReviewsPageVM } from '@/lib/api/tours';
import { ReviewsPanel } from './reviews-panel';

const fetchFromBrowser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/tours', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tours')>()),
  fetchTourReviewsFromBrowser: fetchFromBrowser,
}));

const REVIEWS = [
  {
    id: 'r1',
    rating: 3,
    title: 'Amazing scenery, rough patch on day 3',
    body: 'A flat tyre cost us two hours on the plateau road.',
    authorName: 'Trần Văn Minh',
    authorDeleted: false,
    createdAt: '2026-07-14T15:10:00.000Z',
    media: [],
  },
  {
    id: 'r2',
    rating: 5,
    title: null,
    body: 'Đồng Văn old quarter at night, then Mã Pí Lèng the next morning.',
    authorName: null,
    authorDeleted: true,
    createdAt: '2026-06-01T08:25:00.000Z',
    media: [],
  },
  {
    id: 'r3',
    rating: 4,
    title: 'Rugged and unforgettable',
    body: 'Four days on the back of a bike is tiring but worth it.',
    authorName: 'Min-jun Lee',
    authorDeleted: false,
    createdAt: '2026-04-03T17:40:00.000Z',
    media: [],
  },
] as unknown as TourReviewsPageVM['items'];

const PAGE = {
  items: REVIEWS,
  page: 1,
  limit: 6,
  total: 5,
  totalPages: 1,
  breakdown: { '1': 0, '2': 0, '3': 1, '4': 1, '5': 3 },
} as unknown as TourReviewsPageVM;

const TOUR = {
  slug: 'ha-giang-loop-4d',
  title: 'Hà Giang Loop by Easyrider',
  ratingAvg: 4.4,
  ratingCount: 5,
} as unknown as TourDetailVM;

function open() {
  return userEvent.setup().click(screen.getByRole('button', { name: 'Show all reviews' }));
}

describe('ReviewsPanel', () => {
  beforeEach(() => {
    fetchFromBrowser.mockReset();
    fetchFromBrowser.mockResolvedValue({ ...PAGE, items: [REVIEWS[0]], total: 1, totalPages: 1 });
  });

  it('điểm lớn và "Based on N" lấy từ tour, KHÔNG tính lại từ breakdown', () => {
    // Tính lại avg ở FE là giấu lỗi cập nhật `ratingAvg` phía API thay vì lộ nó.
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    expect(screen.getByText('4.4')).toBeInTheDocument();
    expect(screen.getByText('Based on 5 reviews')).toBeInTheDocument();
  });

  it('biểu đồ đủ năm mức sao, bề rộng tính trên TỔNG chứ không trên cột cao nhất', () => {
    const { container } = render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    expect(screen.getByText('5★')).toBeInTheDocument();
    expect(screen.getByText('1★')).toBeInTheDocument();
    // 3 review 5 sao trên tổng 5 = 60%, KHÔNG phải 100% (nó là cột cao nhất).
    const fills = [...container.querySelectorAll('span[style*="width"]')];
    // jsdom rút gọn "60.00%" thành "60%" khi ghi vào style — so trên giá trị đã rút.
    expect(fills[0]?.getAttribute('style')).toContain('60%');
  });

  it('chỉ hai review làm mồi trong tab, phần còn lại đi qua modal', () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    expect(screen.getByText(/A flat tyre/)).toBeInTheDocument();
    expect(screen.queryByText(/Four days on the back/)).toBeNull();
  });

  it('tác giả đã xoá tài khoản hiện "Deleted account", review vẫn ở lại', () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    expect(screen.getByText('Deleted account')).toBeInTheDocument();
    expect(screen.getByText(/Đồng Văn old quarter/)).toBeInTheDocument();
  });

  it('KHÔNG có huy hiệu "Verified" — contract không phơi `source`', () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it('tour chưa có review nào thì KHÔNG vẽ biểu đồ năm cột 0%', () => {
    render(
      <ReviewsPanel
        tour={{ ...TOUR, ratingAvg: null, ratingCount: 0 } as unknown as TourDetailVM}
        reviews={
          {
            ...PAGE,
            items: [],
            total: 0,
            breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          } as unknown as TourReviewsPageVM
        }
      />,
    );
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.queryByText('5★')).toBeNull();
  });

  it('mở modal thì thấy đủ trang đầu, KHÔNG gọi lại API (đã có dữ liệu server)', async () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Four days on the back/)).toBeInTheDocument();
    expect(fetchFromBrowser).not.toHaveBeenCalled();
  });

  it('dòng phụ modal nói tên tour, điểm và tổng review', async () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    expect(
      screen.getByText('Hà Giang Loop by Easyrider · 4.4 out of 5 · 5 reviews'),
    ).toBeInTheDocument();
  });

  it('đổi sắp xếp gọi LẠI SERVER với đúng khoá, không sắp lại ở client', async () => {
    // Client chỉ nắm một trang; "highest first" tính tại chỗ sẽ mâu thuẫn trang kế.
    const user = userEvent.setup();
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    await user.click(screen.getByRole('button', { name: /Newest first/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Highest rated/ }));
    expect(fetchFromBrowser).toHaveBeenCalledWith(
      'ha-giang-loop-4d',
      expect.objectContaining({ sort: 'highest', page: 1 }),
    );
  });

  it('bấm sao lọc đúng mức đó; bấm lại chính nó thì bỏ lọc', async () => {
    const user = userEvent.setup();
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    const fourStars = screen.getByRole('button', { name: '4 stars only' });
    await user.click(fourStars);
    expect(fetchFromBrowser).toHaveBeenLastCalledWith(
      'ha-giang-loop-4d',
      expect.objectContaining({ rating: 4 }),
    );
    await user.click(fourStars);
    expect(screen.getByText('Any rating')).toBeInTheDocument();
  });

  it('bật "With photos" gửi cờ lọc lên server', async () => {
    const user = userEvent.setup();
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    await user.click(screen.getByRole('button', { name: /With photos/ }));
    expect(fetchFromBrowser).toHaveBeenLastCalledWith(
      'ha-giang-loop-4d',
      expect.objectContaining({ withPhotos: true }),
    );
  });

  it('có bộ lọc thì chân modal nói rõ tổng là tổng ĐÃ LỌC', async () => {
    const user = userEvent.setup();
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    expect(screen.getByText('Showing 1–5 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '4 stars only' }));
    expect(await screen.findByText('Showing 1–1 of 1 matching')).toBeInTheDocument();
  });

  it('trang 1 thì nút Prev tắt; chỉ một trang thì Next cũng tắt', async () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('đang chờ server thì GIỮ kết quả cũ, không thay bằng chữ "Loading"', async () => {
    // Thay danh sách bằng một dòng chữ khiến mỗi lần đổi bộ lọc là chữ biến mất
    // rồi hiện lại — đúng cái giật người dùng báo. Chỉ được làm mờ.
    const user = userEvent.setup();
    let release: (v: unknown) => void = () => {};
    fetchFromBrowser.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    await user.click(screen.getByRole('button', { name: '4 stars only' }));
    // Vẫn thấy review cũ TRONG MODAL suốt lúc chờ (tab nền cũng có bản mồi
    // của chính review đó, nên phải hỏi trong phạm vi dialog).
    expect(within(screen.getByRole('dialog')).getByText(/A flat tyre/)).toBeInTheDocument();
    release({ ...PAGE, items: [REVIEWS[2]], total: 1, totalPages: 1 });
    expect(await screen.findByText(/Four days on the back/)).toBeInTheDocument();
  });

  it('hộp modal cao CỐ ĐỊNH — lọc đổi số kết quả không được làm nó nảy', async () => {
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    const box = screen.getByRole('dialog');
    expect(box.className).toContain('h-[min(760px,100%)]');
    expect(box.className).not.toContain('max-h-[min(760px,100%)]');
  });

  it('bộ lọc không khớp gì thì nói thẳng, không để danh sách trống trơn', async () => {
    const user = userEvent.setup();
    fetchFromBrowser.mockResolvedValue({ ...PAGE, items: [], total: 0, totalPages: 0 });
    render(<ReviewsPanel tour={TOUR} reviews={PAGE} />);
    await open();
    await user.click(screen.getByRole('button', { name: '1 star only' }));
    expect(await screen.findByText('No reviews match these filters.')).toBeInTheDocument();
  });
});

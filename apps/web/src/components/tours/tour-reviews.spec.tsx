import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TourReviewVM } from '@/lib/api/tours';
import { averageRating } from '@/lib/tours';
import { TourReviews } from './tour-reviews';

function rv(n: number, overrides: Partial<TourReviewVM> = {}): TourReviewVM {
  const author = overrides.authorName === undefined ? `Guest ${n}` : overrides.authorName;
  return {
    id: `rv-${n}`,
    rating: 5,
    title: null,
    body: `Review body number ${n}.`,
    authorName: author,
    authorDeleted: author === null,
    // Ngày giảm dần theo n để thứ tự "mới nhất trước" đoán được trong test.
    createdAt: `2026-0${Math.max(1, 9 - n)}-15T10:00:00.000Z`,
    media: [],
    ...overrides,
  };
}

function renderReviews(reviews: TourReviewVM[]) {
  return render(<TourReviews reviews={reviews} ratingAvg={averageRating(reviews)} />);
}

describe('TourReviews — trạng thái rỗng', () => {
  it('không review nào thì mời HỎI, KHÔNG mời viết review', () => {
    // Luồng viết review cần auth + bookingCode + booking PAID; nó chưa tồn tại
    // trong web nên một nút "Write a review" là hứa thứ sản phẩm không giữ.
    renderReviews([]);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();

    // CTA là LINK (nó điều hướng sang /contact), không phải nút. Trước đây test
    // này khoá hiện trạng SAI — `Button render={<a/>}` của Base UI đè mất role
    // link ngầm — và đã vá ở `fix/anchor-link-role`. Bất biến chung cho cả 6 CTA
    // điều hướng nằm ở `link-cta.spec.tsx`; ở đây chỉ giữ phần thuộc về khu reviews.
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/contact',
    );

    expect(screen.queryByRole('button', { name: /write a review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /write a review/i })).not.toBeInTheDocument();
  });

  it('trạng thái rỗng KHÔNG in 0.0 hay 0 sao', () => {
    renderReviews([]);
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});

describe('TourReviews — tóm tắt và danh sách trên trang', () => {
  const three = [rv(1), rv(2, { rating: 4 }), rv(3, { rating: 4 })];

  it('điểm trung bình khớp trung bình thật của danh sách', () => {
    // (5+4+4)/3 = 4,33 → 4.3. Bất biến quan trọng nhất: con số ở tóm tắt phải
    // tính được từ chính danh sách người đọc thấy.
    renderReviews(three);
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('4.3 average from 3 reviews')).toBeInTheDocument();
  });

  it('một review dùng dạng SỐ ÍT', () => {
    renderReviews([rv(1)]);
    expect(screen.getByText('5.0 average from 1 review')).toBeInTheDocument();
  });

  it('đúng 3 review thì KHÔNG có nút xem tất cả — cả ba đã ở trên trang', () => {
    renderReviews(three);
    expect(screen.queryByRole('button', { name: /see all/i })).not.toBeInTheDocument();
  });

  it('hơn 3 review thì nút hiện với đúng TỔNG số', () => {
    renderReviews([rv(1), rv(2), rv(3), rv(4), rv(5)]);
    expect(screen.getByRole('button', { name: 'See all 5 reviews' })).toBeInTheDocument();
  });

  it('chỉ 3 review ở trên trang dù có nhiều hơn', () => {
    renderReviews([rv(1), rv(2), rv(3), rv(4), rv(5)]);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('gọi thẳng là "Most recent", KHÔNG gọi là nổi bật', () => {
    // Contract không có tiêu chí nào để chọn review nổi bật, nên gọi vậy là bịa.
    renderReviews(three);
    expect(screen.getByText('Most recent')).toBeInTheDocument();
    expect(screen.queryByText(/highlight/i)).not.toBeInTheDocument();
  });
});

describe('TourReviews — nhánh dữ liệu của từng review', () => {
  it('tác giả đã xoá tài khoản hiện "Deleted account" và CHÌM xuống cuối', () => {
    const reviews = [
      rv(1, { authorName: null, createdAt: '2026-09-01T10:00:00.000Z' }),
      rv(2, { createdAt: '2026-06-01T10:00:00.000Z' }),
      rv(3, { createdAt: '2026-05-01T10:00:00.000Z' }),
    ];
    renderReviews(reviews);
    expect(screen.getByText('Deleted account')).toBeInTheDocument();
    // Dù mới nhất, nó vẫn phải ở cuối — đúng thứ tự server trả về.
    const names = screen.getAllByRole('article').map((el) => el.textContent ?? '');
    expect(names.at(-1)).toContain('Deleted account');
  });

  it('review không tiêu đề vẫn render, chỉ mất phần tiêu đề', () => {
    renderReviews([rv(1, { title: null, body: 'Just a body, no heading.' })]);
    expect(screen.getByText('Just a body, no heading.')).toBeInTheDocument();
  });

  it('rating đọc được thành câu, không phải năm icon rời rạc', () => {
    renderReviews([rv(1, { rating: 4 })]);
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
  });

  it('ngày hiện dạng tháng + năm', () => {
    renderReviews([rv(1, { createdAt: '2026-07-18T09:12:00.000Z' })]);
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });
});

describe('TourReviews — dialog xem tất cả', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => rv(i + 1));

  it('mở dialog với tiêu đề mang đúng tổng số', async () => {
    const user = userEvent.setup();
    renderReviews(twelve);
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('All 12 reviews');
  });

  it('dialog phân trang 5 mỗi trang', async () => {
    const user = userEvent.setup();
    renderReviews(twelve);
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    expect(screen.getByText('Showing 1–5 of 12')).toBeInTheDocument();
  });

  it('bấm trang 3 hiện phần dư', async () => {
    const user = userEvent.setup();
    renderReviews(twelve);
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();
  });

  it('đóng rồi mở lại thì VỀ trang 1', async () => {
    // Giữ trang cũ làm người đọc mở ra thấy "trang 3" mà không nhớ vì sao.
    const user = userEvent.setup();
    renderReviews(twelve);
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    await screen.findByRole('dialog');
    expect(screen.getByText('Showing 1–5 of 12')).toBeInTheDocument();
  });

  it('KHÔNG có ô chọn số review mỗi trang', async () => {
    const user = userEvent.setup();
    renderReviews(twelve);
    await user.click(screen.getByRole('button', { name: 'See all 12 reviews' }));
    await screen.findByRole('dialog');
    expect(screen.queryByLabelText(/per page/i)).not.toBeInTheDocument();
  });
});

describe('TourReviews — bốn thứ cố tình KHÔNG có', () => {
  const many = Array.from({ length: 8 }, (_, i) => rv(i + 1, { rating: ((i % 5) + 1) as number }));

  it('không có badge "Verified" — source chỉ tồn tại ở AdminReviewSchema', () => {
    renderReviews(many);
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it('không có histogram phân bố sao — contract không trả số đếm theo mức', () => {
    renderReviews(many);
    expect(screen.queryByText(/5 star/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('không có điều khiển sắp xếp hay lọc — query schema chỉ có page/pageSize', () => {
    renderReviews(many);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/sort by/i)).not.toBeInTheDocument();
  });
});

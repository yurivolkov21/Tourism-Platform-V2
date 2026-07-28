import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MockMediaItem } from '@/mocks/types';
import { TourGallery } from './tour-gallery';

function img(n: number, alt: string | null = `Photo ${n}`): MockMediaItem {
  return {
    publicId: `p${n}`,
    url: `https://cdn.example/${n}.jpg`,
    type: 'IMAGE',
    role: n === 0 ? 'hero' : 'gallery',
    posterUrl: null,
    width: 1600,
    height: 1067,
    alt,
    sortOrder: n,
  };
}

const SIX = [img(0), img(1), img(2), img(3), img(4), img(5)];

function renderGallery(media: MockMediaItem[]) {
  return render(<TourGallery media={media} primaryLabel="Hạ Long" />);
}

describe('TourGallery — ba nhánh số lượng ảnh', () => {
  it('không ảnh nào thì KHÔNG render gì — không khung rỗng, không nút', () => {
    // Nhánh THẬT khi gắn API: tour vừa tạo, biên tập chưa upload.
    const { container } = renderGallery([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('một ảnh cho một ô, không khảm và không nút xem tất cả', () => {
    renderGallery([img(0)]);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('năm ảnh vừa đúng khảm (1 lớn + 4 nhỏ) nên KHÔNG có nút xem tất cả', () => {
    // Nút chỉ có lý do tồn tại khi còn ảnh chưa lộ ra trên khảm.
    renderGallery([img(0), img(1), img(2), img(3), img(4)]);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });

  it('sáu ảnh thì hiện nút với ĐÚNG tổng số, không phải số ảnh còn ẩn', () => {
    renderGallery(SIX);
    expect(screen.getByRole('button', { name: 'View all 6 photos' })).toBeInTheDocument();
  });
});

describe('TourGallery — tên khả truy cập của ô khảm', () => {
  it('mỗi ô nói VỊ TRÍ của nó, không bịa mô tả nội dung ảnh', () => {
    // `alt` có thể null, nên ô khảm không được hứa mô tả. Mô tả nằm ở chú thích
    // trong lightbox, chỗ duy nhất chắc chắn có bề rộng cho một câu.
    renderGallery(SIX);
    expect(screen.getByRole('button', { name: 'Open photo 1 of 6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open photo 5 of 6' })).toBeInTheDocument();
  });
});

describe('TourGallery — lightbox', () => {
  it('bấm ô thứ ba mở lightbox ở ĐÚNG ảnh đó', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    await user.click(screen.getByRole('button', { name: 'Open photo 3 of 6' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
  });

  it('mũi tên phải/trái đổi ảnh', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 6' }));
    await screen.findByRole('dialog');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
  });

  it('KHÔNG cuộn vòng: nút bị vô hiệu ở hai đầu', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    // Tới ảnh cuối rồi bấm tiếp mà quay về ảnh đầu làm người xem tưởng mình
    // chưa xem hết — cùng luật với dải khởi hành.
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 6' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled();

    // Ảnh thứ 6 KHÔNG có ô trên khảm (khảm chỉ có 1 lớn + 4 nhỏ) — đó chính là lý
    // do nút "View all" tồn tại. Đi tới cuối bằng nút Next.
    const next = screen.getByRole('button', { name: 'Next photo' });
    for (let i = 0; i < 5; i++) await user.click(next);
    expect(screen.getByText('6 / 6')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it('nút "View all" mở lightbox từ ảnh đầu', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    await user.click(screen.getByRole('button', { name: 'View all 6 photos' }));
    await screen.findByRole('dialog');
    expect(screen.getByText('1 / 6')).toBeInTheDocument();
  });

  it('bộ đếm được công bố qua aria-live — đổi ảnh bằng bàn phím vẫn nghe được', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 6' }));
    await screen.findByRole('dialog');
    expect(screen.getByText('1 / 6')).toHaveAttribute('aria-live', 'polite');
  });

  it('Escape đóng lightbox', async () => {
    const user = userEvent.setup();
    renderGallery(SIX);
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 6' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TourGallery — chú thích theo alt', () => {
  it('có alt thì hiện thành chú thích đọc được', async () => {
    const user = userEvent.setup();
    renderGallery([img(0, 'A junk anchored between karsts at dawn'), img(1), img(2)]);
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 3' }));
    await screen.findByRole('dialog');
    // ĐÚNG MỘT lần: mô tả chỉ ở chú thích, không lặp lại làm nhãn placeholder —
    // chú thích là thứ ở lại khi có ảnh thật.
    expect(screen.getAllByText('A junk anchored between karsts at dawn')).toHaveLength(1);
  });

  it('alt null thì KHÔNG bịa chú thích nào', async () => {
    const user = userEvent.setup();
    renderGallery([img(0, null), img(1, null), img(2, null)]);
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 3' }));
    const dialog = await screen.findByRole('dialog');
    // Bộ đếm đã cho biết đang xem ảnh nào; bịa mô tả còn tệ hơn để trống.
    expect(dialog).toHaveTextContent('1 / 3');
    expect(dialog.querySelectorAll('p')).toHaveLength(1);
  });
});

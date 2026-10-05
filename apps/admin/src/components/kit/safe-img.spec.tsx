import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafeImg } from './safe-img';

/** Ô ảnh của admin (spec 2026-10-05 §4 #13): ảnh hỏng thành icon có tên, không thành ô trống. */
describe('SafeImg', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ảnh tải được: một <img> lazy với alt cho sẵn', () => {
    const { container } = render(
      <SafeImg
        src="https://res.cloudinary.com/demo/x.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('ảnh lỗi: thay bằng ô có tên "Photo unavailable"', () => {
    const { container } = render(
      <SafeImg
        src="https://res.cloudinary.com/demo/gone.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(screen.getByRole('img', { name: messages.admin.table.photoUnavailable })).toHaveClass(
      'size-10',
    );
  });

  // jsdom không tải ảnh (`complete` luôn false khi có src), nên hai ca dưới giả hai getter
  // để dựng đúng cảnh trình duyệt thật: ảnh trong HTML server đã xong việc trước khi React
  // hydrate và gắn `onError`.
  it('ảnh đã hỏng TRƯỚC khi React gắn onError (lúc hydrate): đo lại sau mount và vẫn thay', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const { container } = render(
      <SafeImg
        src="https://res.cloudinary.com/demo/gone.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).toBeInTheDocument();
  });

  it('ảnh đã tải xong trước mount (có bề rộng thật): giữ nguyên ảnh', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(160);
    const { container } = render(
      <SafeImg
        src="https://res.cloudinary.com/demo/x.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/demo/x.jpg',
    );
    expect(
      screen.queryByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).not.toBeInTheDocument();
  });

  it('src đổi sau khi ảnh cũ hỏng: thử ảnh mới, không giữ ô hỏng của ảnh cũ', () => {
    const { container, rerender } = render(
      <SafeImg
        src="https://res.cloudinary.com/demo/gone.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    rerender(
      <SafeImg
        src="https://res.cloudinary.com/demo/new.jpg"
        alt=""
        width={40}
        height={40}
        className="size-10"
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/demo/new.jpg',
    );
  });
});

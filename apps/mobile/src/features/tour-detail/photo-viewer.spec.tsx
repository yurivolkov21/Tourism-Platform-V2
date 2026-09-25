import { fireEvent, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { renderWithTheme } from '@/test-utils';
import { mediaCreditText, PhotoViewer, pageIndexFromOffset, photoDisplayUrl } from './photo-viewer';

describe('mediaCreditText', () => {
  it('cả hai có: nối bằng " · "', () => {
    expect(mediaCreditText('Nguyễn Minh', 'CC BY-SA 4.0')).toBe('Nguyễn Minh · CC BY-SA 4.0');
  });

  it('chỉ có author: chỉ in author', () => {
    expect(mediaCreditText('Nguyễn Minh', null)).toBe('Nguyễn Minh');
  });

  it('chỉ có license: chỉ in license', () => {
    expect(mediaCreditText(null, 'Public domain')).toBe('Public domain');
  });

  it('cả hai null: null (không vẽ dòng ghi công)', () => {
    expect(mediaCreditText(null, null)).toBeNull();
  });
});

describe('photoDisplayUrl', () => {
  it('IMAGE: dùng url', () => {
    expect(photoDisplayUrl({ type: 'IMAGE', url: 'https://x/photo.jpg', posterUrl: null })).toBe(
      'https://x/photo.jpg',
    );
  });

  it('VIDEO: dùng posterUrl', () => {
    expect(
      photoDisplayUrl({
        type: 'VIDEO',
        url: 'https://x/clip.mp4',
        posterUrl: 'https://x/poster.jpg',
      }),
    ).toBe('https://x/poster.jpg');
  });

  it('VIDEO thiếu posterUrl (trái luật): rơi về url thay vì vỡ', () => {
    expect(photoDisplayUrl({ type: 'VIDEO', url: 'https://x/clip.mp4', posterUrl: null })).toBe(
      'https://x/clip.mp4',
    );
  });
});

describe('pageIndexFromOffset', () => {
  it('làm tròn về trang gần nhất', () => {
    expect(pageIndexFromOffset(0, 400, 5)).toBe(0);
    expect(pageIndexFromOffset(400, 400, 5)).toBe(1);
    expect(pageIndexFromOffset(820, 400, 5)).toBe(2);
  });

  it('kẹp trong khoảng hợp lệ — quán tính vượt quá trang cuối/đầu', () => {
    expect(pageIndexFromOffset(10_000, 400, 5)).toBe(4);
    expect(pageIndexFromOffset(-400, 400, 5)).toBe(0);
  });

  it('pageWidth hoặc totalPages <= 0: về 0, không chia cho 0', () => {
    expect(pageIndexFromOffset(400, 0, 5)).toBe(0);
    expect(pageIndexFromOffset(400, 400, 0)).toBe(0);
  });
});

describe('PhotoViewer', () => {
  const PHOTOS = [
    { url: 'https://x/1.jpg', alt: 'Ảnh 1', creditLine: 'Photo: Nguyễn Minh · CC BY-SA 4.0' },
    { url: 'https://x/2.jpg', alt: 'Ảnh 2', creditLine: null },
    { url: 'https://x/3.jpg', alt: null, creditLine: null },
  ];

  function baseProps() {
    return {
      onClose: jest.fn(),
      closeLabel: 'Close photos',
      counterFor: (index: number, total: number) => `${index} / ${total}`,
      photos: PHOTOS,
      initialIndex: 0,
    };
  }

  it('mở đúng initialIndex: alt + ghi công + đếm của ảnh đó', async () => {
    await renderWithTheme(<PhotoViewer {...baseProps()} initialIndex={0} />);

    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByText('Ảnh 1')).toBeTruthy();
    expect(screen.getByText('Photo: Nguyễn Minh · CC BY-SA 4.0')).toBeTruthy();
  });

  it('ảnh không có ghi công/alt: không vẽ dòng nào cho phần thiếu', async () => {
    await renderWithTheme(<PhotoViewer {...baseProps()} initialIndex={2} />);

    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.queryByText('Ảnh 1')).toBeNull();
  });

  it('vuốt sang trang kế: cập nhật đếm + alt theo ảnh mới', async () => {
    const pageWidth = Dimensions.get('window').width;
    await renderWithTheme(<PhotoViewer {...baseProps()} initialIndex={0} />);

    await fireEvent(screen.getByTestId('photo-viewer-scroll'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: pageWidth, y: 0 } },
    });

    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByText('Ảnh 2')).toBeTruthy();
  });

  it('bấm nút đóng gọi onClose', async () => {
    const onClose = jest.fn();
    await renderWithTheme(<PhotoViewer {...baseProps()} onClose={onClose} />);

    await fireEvent.press(screen.getByLabelText('Close photos'));
    expect(onClose).toHaveBeenCalled();
  });
});

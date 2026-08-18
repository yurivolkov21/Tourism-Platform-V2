import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DestinationVM } from '@/lib/api/tours';
import { DestinationTile } from './destination-tile';

/**
 * Canh HAI CHẾ ĐỘ ĐỌC của thẻ địa danh.
 *
 * Vì sao đáng có test: thẻ này phục vụ đồng thời ô ĐÃ có ảnh và ô CHƯA có
 * (9/19 địa danh có cover tính tới 18/08). Hai trạng thái cần hai cách xử lý
 * chữ ngược nhau — có ảnh thì phủ tối + chữ sáng, không ảnh thì bỏ phủ + chữ
 * theo theme. Trộn nhầm thì một nửa số ô mất chữ, mà không có lỗi nào được ném
 * ra: chỉ là chữ chìm vào nền.
 */

const DEST = {
  slug: 'hoi-an',
  name: 'Hội An',
  description: 'Lantern-lit old town on the Hoài river.',
  tourCount: 6,
  cover: null,
} as unknown as DestinationVM;

const withCover = (): DestinationVM =>
  ({
    ...DEST,
    cover: {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/destinations/hoi-an',
      alt: null,
      width: 2400,
      height: 1600,
      type: 'IMAGE',
    },
  }) as unknown as DestinationVM;

describe('DestinationTile — hai chế độ đọc', () => {
  it('CÓ cover → render ảnh thật và chữ dùng token trên-ảnh', () => {
    const { container } = render(<DestinationTile destination={withCover()} variant="feature" />);
    expect(container.querySelector('img')).not.toBeNull();
    // Chữ phải chuyển sang token dành cho nền ảnh, không phải mực theo theme.
    expect(container.innerHTML).toContain('text-on-media');
    expect(container.innerHTML).not.toContain('text-foreground"');
  });

  it('CÓ cover → có lớp phủ để chữ đọc được trên ảnh', () => {
    const { container } = render(<DestinationTile destination={withCover()} variant="feature" />);
    // Hai lớp gradient chồng nhau; đếm để không ai vô tình bỏ bớt một lớp.
    const scrims = container.querySelectorAll('[class*="via-overlay"]');
    expect(scrims.length).toBe(2);
  });

  it('KHÔNG cover → giữ ô giữ chỗ và KHÔNG phủ tối', () => {
    const { container } = render(<DestinationTile destination={DEST} variant="feature" />);
    expect(container.querySelector('img')).toBeNull();
    // Phủ tối lên ô giữ chỗ màu phẳng cho ra tấm xám chết — vòng thiết kế
    // trước đã dựng thử rồi bác, nên đây là bất biến chứ không phải tuỳ ý.
    expect(container.querySelectorAll('[class*="via-overlay"]').length).toBe(0);
  });

  it('cả hai chế độ đều giữ tên và link lọc tour', () => {
    for (const d of [DEST, withCover()]) {
      const { container } = render(<DestinationTile destination={d} variant="photo" />);
      expect(container.querySelector('h3')?.textContent).toBe('Hội An');
      expect(container.querySelector('a')?.getAttribute('href')).toBe('/tours?destinations=hoi-an');
    }
  });

  it('variant đổi cỡ chữ tên, không đổi chế độ đọc', () => {
    const feature = render(<DestinationTile destination={withCover()} variant="feature" />);
    const photo = render(<DestinationTile destination={withCover()} variant="photo" />);
    expect(feature.container.querySelector('h3')?.className).toContain('text-2xl');
    expect(photo.container.querySelector('h3')?.className).toContain('text-lg');
  });
});

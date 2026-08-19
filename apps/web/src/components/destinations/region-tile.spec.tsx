import { render, screen } from '@testing-library/react';
import type { MediaItem } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { RegionTile } from './region-tile';

describe('RegionTile', () => {
  it('là ảnh khả truy cập mang nhãn mô tả, không phải div trơ', () => {
    render(<RegionTile label="Terraced rice fields" />);
    expect(screen.getByRole('img', { name: 'Terraced rice fields' })).toBeInTheDocument();
  });

  it('KHÔNG in nhãn thành chữ — nhãn chỉ cho trình đọc màn hình', () => {
    render(<RegionTile label="Terraced rice fields" />);
    expect(screen.queryByText('Terraced rice fields')).not.toBeInTheDocument();
  });

  // Bất biến MỚI (ADR-0015): nền pha từ token BRAND, không còn token vùng. Vế
  // `not.toContain('--region-')` là vế đáng canh nhất — nó chặn cả họ token cũ
  // quay lại, kể cả slot chưa ai dùng tới.
  it('nền pha từ token brand, KHÔNG token vùng và KHÔNG hex', () => {
    const { container } = render(<RegionTile label="x" />);
    const style = container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('--primary');
    expect(style).toContain('--hero');
    expect(style).not.toContain('--region-');
    expect(style).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  // `decorative`: ô nào có CHỮ KỀ BÊN nói đúng cái nhãn đó (hero có <h1> tên
  // vùng, bưu thiếp có <h3> tên bưu thiếp) thì nhãn là lặp — trình đọc màn hình
  // đọc hai lần. Ô đó là trang trí, phải biến mất khỏi cây trợ năng.
  it('decorative: KHÔNG mang role img — nhãn đã có ở chữ kề bên', () => {
    render(<RegionTile label="Northern Vietnam" decorative />);
    // `hidden: true` để phép tìm KHÔNG bị chính `aria-hidden` che mất: ta đang
    // khẳng định cái role không tồn tại, không phải nó chỉ bị ẩn.
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('decorative: mang aria-hidden nên biến mất khỏi cây trợ năng', () => {
    const { container } = render(<RegionTile label="Northern Vietnam" decorative />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  // Lỗi user chỉ ra ở hero (29/07): `RegionTile` dùng làm NỀN TRANG TRÍ vẫn vẽ
  // `ImageIcon` giữa khoảng trống, nổi lên như một vật thể lạ. Icon chỉ có
  // nghĩa khi ô THẬT SỰ đứng vào vị trí của một tấm ảnh (gallery/bưu thiếp).
  it('decorative: KHÔNG render icon — nền trang trí không cần tín hiệu "đây là ảnh"', () => {
    const { container } = render(<RegionTile label="Northern Vietnam" decorative />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('có nhãn (không decorative): CÓ icon — tín hiệu "đây là chỗ của ảnh" ở gallery/bưu thiếp', () => {
    const { container } = render(<RegionTile label="Terraced rice fields" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  // Trường hợp thứ BA, sinh ra ở Task 5l: ô gallery nằm TRONG một `<button>` mở
  // lightbox, và chính cái nút đã mang tên khả truy cập ("View photo: …"). Ô phải
  // ẩn khỏi cây trợ năng như `decorative` — nhưng nó VẪN đứng đúng vị trí một
  // tấm ảnh, nên vẫn cần icon. Hai mối quan tâm đó là hai prop rời nhau:
  // `decorative` lo TRỢ NĂNG, `withIcon` lo THỊ GIÁC.
  it('decorative + withIcon: ẩn khỏi trợ năng mà VẪN có icon — ô trong nút mở lightbox', () => {
    const { container } = render(<RegionTile label="Terraced rice fields" decorative withIcon />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('withIcon KHÔNG đổi gì ở chế độ thường — ô có nhãn vốn đã có icon', () => {
    const { container } = render(<RegionTile label="Terraced rice fields" withIcon />);
    expect(screen.getByRole('img', { name: 'Terraced rice fields' })).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });
});

// 19/08: 15 khe `region-gallery-*` có ảnh thật — ô đổi ruột, giữ bố cục/trợ năng.
const IMAGE = {
  publicId: 'tourism/catalog/site/region-gallery-north-1',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/catalog/site/region-gallery-north-1',
  type: 'IMAGE',
  role: 'hero',
  posterUrl: null,
  width: 2400,
  height: 1600,
  alt: null,
  sortOrder: 0,
} as unknown as MediaItem;

describe('RegionTile — có ảnh thật', () => {
  it('render <img> thay gradient, KHÔNG còn icon giữ chỗ', () => {
    const { container } = render(<RegionTile label="Lan Hạ Bay" image={IMAGE} />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('không decorative → vẫn là role="img" mang nhãn (nhãn là thông tin duy nhất của ô)', () => {
    render(<RegionTile label="Lan Hạ Bay" image={IMAGE} />);
    expect(screen.getByRole('img', { name: 'Lan Hạ Bay' })).toBeInTheDocument();
  });

  it('decorative → aria-hidden, không role img (nút cha đã mang tên)', () => {
    const { container } = render(<RegionTile label="Lan Hạ Bay" image={IMAGE} decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('image null → gradient + icon như cũ (khe trống không vỡ)', () => {
    const { container } = render(<RegionTile label="Lan Hạ Bay" image={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

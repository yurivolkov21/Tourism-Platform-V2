import { render, screen } from '@testing-library/react';
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
});

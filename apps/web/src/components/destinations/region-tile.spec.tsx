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

  it('nền pha từ token vùng, KHÔNG hex', () => {
    const { container } = render(<RegionTile label="x" />);
    const style = container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('--region-primary');
    expect(style).toContain('--region-spark');
    expect(style).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

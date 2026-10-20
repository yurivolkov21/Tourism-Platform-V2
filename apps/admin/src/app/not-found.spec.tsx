import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import AdminNotFound from './not-found';

// Trang 404 chỉ cần `connection()` để render động (W3-H2) — ở test là no-op.
vi.mock('next/server', () => ({ connection: vi.fn(async () => undefined) }));

describe('404 của admin', () => {
  // Review A2: `buttonVariants` trần trên `Link` để `border-transparent` gốc thắng viền outline.
  it('link Back to dashboard giữ viền nút outline', async () => {
    render(await AdminNotFound());
    const home = screen.getByRole('link', { name: messages.admin.errors.backHome });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveClass('border-border');
    expect(home).not.toHaveClass('border-transparent');
  });
});

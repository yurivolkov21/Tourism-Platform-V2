import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountNav } from './account-nav';

// Pathname MUTABLE giữa các test (khác 2 tiền lệ trong repo — `wishlist-heart.spec.tsx`,
// `tours-explorer.spec.tsx` — đều dùng hằng số vì chỉ cần MỘT giá trị). Ở đây cần đổi
// pathname giữa các `it` để kiểm `isActive` theo route con, nên phải qua biến ngoài mock.
let mockPathname = '/account/bookings';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('AccountNav — ba tab (hub gỡ theo spec 2026-08-10)', () => {
  it('render đúng BA tab Trips/Saved/Profile, KHÔNG có Dashboard', () => {
    mockPathname = '/account/bookings';
    render(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Trips' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saved tours' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('ở route con `/account/bookings/TRV-X` → tab Trips mang aria-current="page"', () => {
    mockPathname = '/account/bookings/TRV-X';
    render(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Saved tours' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });
});

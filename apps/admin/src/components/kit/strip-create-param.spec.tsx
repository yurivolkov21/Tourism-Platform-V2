import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StripCreateParam } from './strip-create-param';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tours',
  useSearchParams: () => new URLSearchParams('create=1&status=live'),
}));

describe('StripCreateParam', () => {
  it('gỡ `create` khỏi URL ngay sau mount, giữ tham số khác, không cuộn trang', () => {
    render(<StripCreateParam />);
    expect(replace).toHaveBeenCalledWith('/tours?status=live', { scroll: false });
  });
});

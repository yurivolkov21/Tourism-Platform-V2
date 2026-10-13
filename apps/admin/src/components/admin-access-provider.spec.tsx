import { render } from '@testing-library/react';
import type { AdminProcedureKey } from '@tourism/contract/admin-access';
import { describe, expect, it } from 'vitest';
import { AdminAccessProvider, useCanAccess } from './admin-access-provider';

function Probe({ access }: { access: AdminProcedureKey }) {
  return <span>{useCanAccess(access) ? 'shown' : 'hidden'}</span>;
}

const BOTH = (
  <>
    <Probe access="bookings.refund" />
    <Probe access="bookings.list" />
  </>
);

// Role đi qua biến, không viết literal: lint a11y của Biome đọc `role="STAFF"` trên JSX như
// một ARIA role sai, dù đây là prop của provider chứ không phải thuộc tính DOM.
function renderAs(role: string) {
  return render(<AdminAccessProvider role={role}>{BOTH}</AdminAccessProvider>);
}

describe('useCanAccess', () => {
  it('Staff: khoá owner ẩn, khoá staff hiện', () => {
    const { container } = renderAs('STAFF');
    expect(container.textContent).toBe('hiddenshown');
  });

  it('Owner: mọi khoá hiện', () => {
    const { container } = renderAs('ADMIN');
    expect(container.textContent).toBe('shownshown');
  });

  it('role lạ trong provider: ẩn hết — fail-closed', () => {
    const { container } = renderAs('CUSTOMER');
    expect(container.textContent).toBe('hiddenhidden');
  });

  it('không có provider: hiện (plan P4f quyết định 3 — gác thật ở API)', () => {
    const { container } = render(BOTH);
    expect(container.textContent).toBe('shownshown');
  });
});

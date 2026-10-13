import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toUserDetailVM } from '@/lib/users-view';
import { userDetailFixture } from '@/test/user-detail';
import { UserDetail } from './user-detail';

const t = messages.admin.users;

function renderDetail(patch: Parameters<typeof userDetailFixture>[0] = {}) {
  return render(
    <UserDetail detail={toUserDetailVM(userDetailFixture(patch))} backHref="/users?view=staff" />,
  );
}

describe('UserDetail', () => {
  it('đầu trang và hai card đầu: tên, nút quay lại đúng danh sách, link bookings mọi ngày', () => {
    renderDetail({ signInMethods: ['password', 'google'] });
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.detail.back })).toHaveAttribute(
      'href',
      '/users?view=staff',
    );
    expect(screen.getByText('Password, Google')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.detail.activity.viewBookings })).toHaveAttribute(
      'href',
      '/bookings?q=ada%40example.com&dates=all',
    );
  });

  it('khách: ba card Access, Lock, Sessions; không có dòng của Owner', () => {
    renderDetail();
    expect(screen.getByText(t.detail.access.customer)).toBeInTheDocument();
    expect(screen.getByText(t.detail.lock.unlocked)).toBeInTheDocument();
    expect(screen.getByText(t.detail.sessions.active)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.owner)).not.toBeInTheDocument();
  });

  it('Owner: chỉ dòng giải thích — không card Lock, không card Sessions', () => {
    renderDetail({ role: 'ADMIN' });
    expect(screen.getByText(t.detail.owner)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.lock.unlocked)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.sessions.active)).not.toBeInTheDocument();
  });

  it('Owner đang khoá (ca hiếm): card Lock vẫn hiện để còn đường mở', () => {
    renderDetail({ role: 'ADMIN', status: 'locked', lockedAt: '2026-10-02T03:00:00.000Z' });
    expect(screen.getByText('Locked since 2 Oct 2026, 03:00 UTC')).toBeInTheDocument();
  });

  it('đang khoá: card Lock nói từ khi nào và vì sao', () => {
    renderDetail({
      status: 'locked',
      lockedAt: '2026-10-02T03:00:00.000Z',
      lockReason: 'Chargeback abuse',
    });
    expect(screen.getByText('Locked since 2 Oct 2026, 03:00 UTC')).toBeInTheDocument();
    expect(screen.getAllByText('Reason: Chargeback abuse').length).toBeGreaterThan(0);
  });

  it('lịch sử rỗng nói câu empty', () => {
    renderDetail();
    expect(screen.getByText(t.history.empty)).toBeInTheDocument();
  });
});

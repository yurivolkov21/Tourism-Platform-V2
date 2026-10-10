import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { parseSubscribersSearchParams } from '@/lib/subscribers-query';
import { SubscribersTable } from './subscribers-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/subscribers',
  useSearchParams: () => new URLSearchParams(),
}));

const t = messages.admin.subscribers.list;

describe('SubscribersTable — nút Export', () => {
  it('nằm TRONG ô tiêu đề cột Actions, nên không đè chữ của cột nào', () => {
    render(
      <SubscribersTable
        rows={[
          {
            id: '5b1a0000-0000-4000-8000-000000000001',
            email: 'reader@example.com',
            source: 'Footer',
            subscribed: '1 Oct 2026',
            confirmed: '1 Oct 2026',
            unsubscribed: 'Still subscribed',
            isActive: true,
          },
        ]}
        query={parseSubscribersSearchParams({})}
        sources={[]}
        total={1}
        totalPages={1}
        unsubscribe={vi.fn()}
      />,
    );

    const header = screen.getByRole('columnheader', { name: new RegExp(t.columns.actions) });
    expect(within(header).getByRole('link', { name: t.exportExcel })).toBeInTheDocument();
  });
});

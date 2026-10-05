import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toDestinationRowVM } from '@/lib/destinations-view';
import { DestinationsTable } from './destinations-table';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

describe('DestinationsTable — Quick Create', () => {
  it('`openCreate` mở sẵn hộp Add destination', async () => {
    render(
      <DestinationsTable
        rows={[
          toDestinationRowVM({
            id: 'd1500001-0000-4000-8000-000000000001',
            slug: 'hoi-an',
            name: 'Hội An',
            country: 'Vietnam',
            region: 'Central Vietnam',
            description: null,
            isActive: true,
            tourCount: 0,
            linkedTourCount: 0,
          }),
        ]}
        create={vi.fn()}
        update={vi.fn()}
        setActive={vi.fn()}
        remove={vi.fn()}
        openCreate
      />,
    );
    expect(
      await screen.findByRole('dialog', { name: messages.admin.destinations.create.dialog.title }),
    ).toBeInTheDocument();
  });

  it('Quick Create ngay trên trang này: `openCreate` bật sau mount vẫn mở hộp, gỡ tham số thì hộp còn mở', async () => {
    const actions = { create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() };
    const { rerender } = render(<DestinationsTable rows={[]} {...actions} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Cùng route, chỉ query đổi: React giữ nguyên bảng, chỉ prop đổi.
    rerender(<DestinationsTable rows={[]} {...actions} openCreate />);
    expect(
      await screen.findByRole('dialog', { name: messages.admin.destinations.create.dialog.title }),
    ).toBeInTheDocument();

    // `StripCreateParam` gỡ `create` khỏi URL → trang dựng lại với `openCreate` tắt.
    rerender(<DestinationsTable rows={[]} {...actions} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

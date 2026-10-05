import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toCategoryRowVMs } from '@/lib/categories-view';
import { CategoriesTable } from './categories-table';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

describe('CategoriesTable — Quick Create', () => {
  it('`openCreate` mở sẵn hộp Add category', async () => {
    render(
      <CategoriesTable
        rows={toCategoryRowVMs([
          {
            id: 'c1400001-0000-4000-8000-000000000001',
            slug: 'day-trips',
            name: 'Day trips',
            description: null,
            order: 1,
            isActive: true,
            tourCount: 0,
            linkedTourCount: 0,
          },
        ])}
        create={vi.fn()}
        update={vi.fn()}
        setActive={vi.fn()}
        move={vi.fn()}
        remove={vi.fn()}
        openCreate
      />,
    );
    expect(
      await screen.findByRole('dialog', { name: messages.admin.categories.create.dialog.title }),
    ).toBeInTheDocument();
  });

  it('Quick Create ngay trên trang này: `openCreate` bật sau mount vẫn mở hộp, gỡ tham số thì hộp còn mở', async () => {
    const actions = {
      create: vi.fn(),
      update: vi.fn(),
      setActive: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
    };
    const { rerender } = render(<CategoriesTable rows={[]} {...actions} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Cùng route, chỉ query đổi: React giữ nguyên bảng, chỉ prop đổi.
    rerender(<CategoriesTable rows={[]} {...actions} openCreate />);
    expect(
      await screen.findByRole('dialog', { name: messages.admin.categories.create.dialog.title }),
    ).toBeInTheDocument();

    // `StripCreateParam` gỡ `create` khỏi URL → trang dựng lại với `openCreate` tắt.
    rerender(<CategoriesTable rows={[]} {...actions} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

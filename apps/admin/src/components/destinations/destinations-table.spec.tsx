import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDestinationRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toDestinationRowVM } from '@/lib/destinations-view';
import { DestinationsTable } from './destinations-table';

/**
 * Router ỔN ĐỊNH qua các lần render, như Next thật (`useRouter` memo theo router). Mock trả
 * object mới mỗi render thì `refreshList` đổi danh tính ở MỌI render — ca đối chứng của D1 cũng
 * mất focus, và lỗi thật (server action đổi danh tính sau mỗi `router.refresh()`) bị che đi.
 */
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const t = messages.admin.destinations;

const HOI_AN: AdminDestinationRow = {
  id: 'd1500001-0000-4000-8000-000000000001',
  slug: 'hoi-an',
  name: 'Hội An',
  country: 'Vietnam',
  region: 'Central Vietnam',
  description: null,
  isActive: true,
  tourCount: 0,
  linkedTourCount: 0,
};

/**
 * Một bộ lệnh ghi MỚI — mô phỏng lượt `router.refresh()`: Flight client giải mã server action
 * thành một closure mới mỗi lần, nên trang chở xuống bảng những hàm khác danh tính (review D1).
 */
function freshActions() {
  return { create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() };
}

describe('DestinationsTable — Quick Create', () => {
  it('`openCreate` mở sẵn hộp Add destination', async () => {
    render(
      <DestinationsTable rows={[toDestinationRowVM(HOI_AN)]} {...freshActions()} openCreate />,
    );
    expect(await screen.findByRole('dialog', { name: t.create.dialog.title })).toBeInTheDocument();
  });

  it('Quick Create ngay trên trang này: `openCreate` bật sau mount vẫn mở hộp, gỡ tham số thì hộp còn mở', async () => {
    const actions = freshActions();
    const { rerender } = render(<DestinationsTable rows={[]} {...actions} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Cùng route, chỉ query đổi: React giữ nguyên bảng, chỉ prop đổi.
    rerender(<DestinationsTable rows={[]} {...actions} openCreate />);
    expect(await screen.findByRole('dialog', { name: t.create.dialog.title })).toBeInTheDocument();

    // `StripCreateParam` gỡ `create` khỏi URL → trang dựng lại với `openCreate` tắt.
    rerender(<DestinationsTable rows={[]} {...actions} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('DestinationsTable — ô hành động sống qua lượt làm mới (review D1)', () => {
  it('làm mới sau IN_USE: lệnh ghi mới, hàng thành có tour — đúng nút Delete ấy còn giữ focus', () => {
    const { rerender } = render(
      <DestinationsTable rows={[toDestinationRowVM(HOI_AN)]} {...freshActions()} />,
    );
    const button = screen.getByRole('button', { name: t.delete.actionLabel('Hội An') });
    button.focus();
    expect(button).toHaveFocus();

    // Payload mới đáp xuống: server action khác danh tính, và hàng giờ có 2 tour.
    rerender(
      <DestinationsTable
        rows={[toDestinationRowVM({ ...HOI_AN, tourCount: 2, linkedTourCount: 2 })]}
        {...freshActions()}
      />,
    );

    const after = screen.getByRole('button', { name: t.delete.actionLabel('Hội An') });
    expect(after).toBe(button);
    expect(after).toHaveFocus();
    expect(after).toHaveAttribute('aria-disabled', 'true');
  });

  it('hộp Edit đang mở trong ô không biến mất khi lệnh ghi đổi danh tính', async () => {
    const user = userEvent.setup();
    const rows = [toDestinationRowVM(HOI_AN)];
    const { rerender } = render(<DestinationsTable rows={rows} {...freshActions()} />);

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel('Hội An') }));
    expect(await screen.findByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();

    rerender(<DestinationsTable rows={rows} {...freshActions()} />);
    expect(screen.getByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();
  });

  it('ô gọi lệnh ghi MỚI NHẤT mà bảng nhận, không giữ bản của lượt trước', async () => {
    // Canh cách vá: cột đứng yên thì ô phải đọc lệnh qua context — một closure chụp lúc dựng
    // cột sẽ gọi mãi bản đầu tiên.
    const user = userEvent.setup();
    const rows = [toDestinationRowVM(HOI_AN)];
    const first = freshActions();
    const { rerender } = render(<DestinationsTable rows={rows} {...first} />);
    const latest = freshActions();
    latest.remove.mockResolvedValue({ ok: true, deleted: { slug: HOI_AN.slug } });
    rerender(<DestinationsTable rows={rows} {...latest} />);

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Hội An') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));

    await waitFor(() => expect(latest.remove).toHaveBeenCalledWith({ id: HOI_AN.id }));
    expect(first.remove).not.toHaveBeenCalled();
  });
});

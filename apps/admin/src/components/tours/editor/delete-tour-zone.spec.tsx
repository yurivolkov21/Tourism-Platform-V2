import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeleteTourAction } from '@/lib/tour-editor-write';
import { withRole } from '@/test/access';
import { detailFixture, TOUR_ID } from '@/test/tour-detail';
import { DeleteTourZone } from './delete-tour-zone';

/**
 * Vùng xoá tour (spec F17 §2d): chỉ tour chưa từng có booking; hộp xác nhận nói
 * đúng từng thứ mất theo, kèm số chuyến.
 */
const t = messages.admin.tours.editor.delete;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href), refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  refresh.mockReset();
});

const detail = detailFixture({ departureCount: 2 });

async function openDialog(remove: DeleteTourAction) {
  const user = userEvent.setup();
  render(<DeleteTourZone detail={detail} remove={remove} />);
  await user.click(screen.getByRole('button', { name: t.action }));
  const dialog = await screen.findByRole('dialog', { name: t.dialog.title });
  return { user, dialog };
}

describe('DeleteTourZone', () => {
  it('mở hộp xác nhận nói đúng số chuyến bị xoá theo', async () => {
    const { dialog } = await openDialog(vi.fn());

    expect(within(dialog).getByText(t.dialog.body(2))).toBeInTheDocument();
    expect(t.dialog.body(2)).toContain('together with 2 departures, ');
    expect(within(dialog).getByText(t.dialog.warning)).toBeInTheDocument();
  });

  it('hộp xác nhận kể cả số ảnh mất theo — hàng "Photos" (F18, ADR-0048 §7)', async () => {
    const { dialog } = await openDialog(vi.fn());

    // `detailFixture()` có đúng một ảnh — ảnh bìa. Hàng là cặp <dt>/<dd> của kit.
    const label = within(dialog).getByText(t.rows.photos);
    expect(label.nextElementSibling?.textContent).toBe('1');
    expect(t.dialog.body(2)).toContain('cost lines, photos, destination links');
  });

  it('xác nhận → gọi remove({ id }), về /tours, toast "Tour deleted"', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true, deleted: { slug: detail.slug } });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tours'));
    expect(remove).toHaveBeenCalledWith({ id: TOUR_ID });
    expect(success).toHaveBeenCalledWith(t.toast.title, {
      description: t.toast.body(detail.title),
    });
  });

  it('TOUR_HAS_BOOKINGS → câu lỗi hiện TRONG hộp, hộp còn mở', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, code: 'TOUR_HAS_BOOKINGS' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t.errors.TOUR_HAS_BOOKINGS);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
  });

  // Review A2: booking tới sau lúc trang tải nên `bookingCount` trong tay còn 0 — đóng hộp mà
  // không làm mới thì vùng vẫn mời bấm "Delete tour" để nhận lại đúng lỗi ấy.
  it('TOUR_HAS_BOOKINGS rồi đóng hộp → làm mới để vùng thành dạng "đã có booking"', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, code: 'TOUR_HAS_BOOKINGS' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));
    await within(dialog).findByRole('alert');
    expect(refresh).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: t.dialog.cancel }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.dialog.title })).not.toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('huỷ hộp khi chưa gửi gì → không làm mới', async () => {
    const { user, dialog } = await openDialog(vi.fn());

    await user.click(within(dialog).getByRole('button', { name: t.dialog.cancel }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.dialog.title })).not.toBeInTheDocument(),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('NOT_FOUND → hộp đóng, toast lỗi, về /tours', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tours'));
    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.dialog.title })).not.toBeInTheDocument(),
    );
  });

  it('Staff (ADR-0052): vùng xoá không render gì — kể cả câu "đã có booking"', () => {
    for (const fixture of [detail, detailFixture({ bookingCount: 3 })]) {
      const { container, unmount } = render(<DeleteTourZone detail={fixture} remove={vi.fn()} />, {
        wrapper: withRole('STAFF'),
      });
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});

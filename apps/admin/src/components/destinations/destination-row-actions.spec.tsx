import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDestinationRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDestinationRowVM } from '@/lib/destinations-view';
import { DestinationRowActions } from './destination-row-actions';

/**
 * Hai nút của một hàng bảng điểm đến (spec P4e-2 F15). Phần đáng pin là hộp
 * xác nhận ẨN: nó phải in đúng số tour và nói đủ những gì bảng đo spec §4.6
 * tìm ra — thứ admin hay đoán nhầm nhất là tưởng ẩn điểm đến thì ẩn luôn tour
 * đi qua nó, còn thứ không ai đoán ra là hộ chiếu của khách.
 */

const t = messages.admin.destinations;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const row = (over: Partial<AdminDestinationRow> = {}): AdminDestinationRow => ({
  id: 'd1500001-0000-4000-8000-000000000001',
  slug: 'hoi-an',
  name: 'Hội An',
  country: 'Vietnam',
  region: 'Central Vietnam',
  description: null,
  isActive: true,
  tourCount: 4,
  ...over,
});

function renderRow(data: AdminDestinationRow, over: Record<string, unknown> = {}) {
  const vm = toDestinationRowVM(data);
  const update = vi.fn(async () => ({ ok: true as const, row: data }));
  const setActive = vi.fn(async () => ({
    ok: true as const,
    row: { ...data, isActive: !data.isActive },
  }));
  render(
    <DestinationRowActions
      row={vm}
      update={update}
      setActive={setActive}
      disabled={false}
      onSettled={vi.fn()}
      {...over}
    />,
  );
  return { vm, update, setActive };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('DestinationRowActions — hộp xác nhận ẩn', () => {
  it('in tên, vùng, SỐ TOUR, và kể đủ các hệ quả của bảng đo', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow(row());

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.hideTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setActive.dialog.hideBody)).toBeInTheDocument();
    expect(screen.getByText(t.setActive.rows.tours)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    for (const line of [
      t.setActive.dialog.hideRegionTours('Central Vietnam'),
      t.setActive.dialog.hideRegionOwnTours('Central Vietnam'),
      t.setActive.dialog.hidePassport,
      t.setActive.dialog.hideJournal,
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText(t.setActive.dialog.hideWarning)).toBeInTheDocument();
  });

  it('câu trấn an mang giọng TRUNG TÍNH, không tô đỏ (bài học 14)', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow(row());

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.hideWarning)).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  });

  it('điểm đến CHƯA có vùng: hộp không nói về trang vùng nào', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow(row({ region: 'Mekong' }));

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));

    await screen.findByText(t.setActive.dialog.hidePassport);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      t.setActive.dialog.hidePassport,
      t.setActive.dialog.hideJournal,
    ]);
  });

  it('hàng ĐÃ ẨN: nút đổi thành Show, hộp không kể hệ quả của việc ẩn', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow(row({ isActive: false }));

    await user.click(screen.getByRole('button', { name: t.setActive.showLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.showTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setActive.dialog.showWarning)).toBeInTheDocument();
    expect(screen.queryByText(t.setActive.dialog.hidePassport)).not.toBeInTheDocument();
  });

  it('xác nhận: gửi cờ NGƯỢC với trạng thái hiện tại, toast đọc TỪ RESPONSE', async () => {
    const user = userEvent.setup();
    const { vm, setActive } = renderRow(row());

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));
    await user.click(await screen.findByRole('button', { name: t.setActive.dialog.hideSubmit }));

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ id: vm.id, isActive: false }));
    expect(success).toHaveBeenCalledWith(t.setActive.toast.hiddenTitle, {
      description: t.setActive.toast.hiddenBody('Hội An'),
    });
  });

  it('nút Hide giữ chỗ cho nhãn Show — cụm nút các hàng thẳng cột (bài học 13)', () => {
    const { vm } = renderRow(row());
    const button = screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) });

    // Nhãn đang hiện đọc được, nhãn giữ chỗ thì ẩn khỏi trình đọc màn hình.
    expect(button).toHaveTextContent(t.setActive.hide);
    const reserved = [...button.querySelectorAll('[aria-hidden="true"]')].map((node) =>
      node.textContent?.trim(),
    );
    expect(reserved).toContain(t.setActive.show);
  });
});

describe('DestinationRowActions — form sửa', () => {
  it('mở form với giá trị hiện tại, vùng chọn sẵn tên CHUẨN, và KHÔNG có ô slug', async () => {
    // DB lưu dạng kiểu cũ `central`: form phải chọn sẵn `Central Vietnam`, để
    // lưu lại là cột mang đúng tên chuẩn.
    const user = userEvent.setup();
    const { vm } = renderRow(row({ region: 'central' }));

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));

    expect(await screen.findByText(t.edit.dialog.title)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.name)).toHaveValue('Hội An');
    expect(screen.getByLabelText(t.form.region)).toHaveValue('Central Vietnam');
    expect(screen.queryByLabelText(t.form.slug)).not.toBeInTheDocument();
  });

  it('lưu: gửi payload SỬA không mang slug', async () => {
    const user = userEvent.setup();
    const { vm, update } = renderRow(row());

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));
    await user.selectOptions(await screen.findByLabelText(t.form.region), 'Southern Vietnam');
    await user.click(screen.getByRole('button', { name: t.edit.dialog.submit }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      id: vm.id,
      name: 'Hội An',
      country: 'Vietnam',
      region: 'Southern Vietnam',
      description: null,
    });
  });

  it('bảng đang bận: khoá cả hai nút, và bấm vào cũng không mở gì', async () => {
    // Khẳng định "không mở" chỉ có nghĩa khi ĐÃ bấm (bài học 15, ca xanh giả
    // của F14).
    const user = userEvent.setup();
    const { vm } = renderRow(row(), { disabled: true });
    const edit = screen.getByRole('button', { name: t.edit.actionLabel(vm.name) });

    expect(edit).toBeDisabled();
    expect(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) })).toBeDisabled();

    await user.click(edit);

    expect(screen.queryByText(t.edit.dialog.title)).not.toBeInTheDocument();
  });
});

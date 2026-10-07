import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDestinationRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDestinationRowVM } from '@/lib/destinations-view';
import { DestinationRowActions } from './destination-row-actions';

/**
 * Ba nút của một hàng bảng điểm đến (spec P4e-2 F15; nút Delete theo ADR-0053).
 * Phần đáng pin:
 *
 *  ① hộp xác nhận ẨN phải in đúng số tour và nói đủ những gì bảng đo spec §4.6
 *    tìm ra — thứ admin hay đoán nhầm nhất là tưởng ẩn điểm đến thì ẩn luôn tour
 *    đi qua nó, còn thứ không ai đoán ra là hộ chiếu của khách;
 *  ② nút Delete chỉ bấm được khi hàng 0 tour mọi trạng thái — gương của `IN_USE`,
 *    và còn tour thì tooltip nói vì sao.
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
  linkedTourCount: 4,
  ...over,
});

function renderRow(data: AdminDestinationRow, over: Record<string, unknown> = {}) {
  const vm = toDestinationRowVM(data);
  const update = vi.fn(async () => ({ ok: true as const, row: data }));
  const setActive = vi.fn(async () => ({
    ok: true as const,
    row: { ...data, isActive: !data.isActive },
  }));
  const remove = vi.fn(async () => ({ ok: true as const, deleted: { slug: data.slug } }));
  const onSettled = vi.fn();
  render(
    <DestinationRowActions
      row={vm}
      update={update}
      setActive={setActive}
      remove={remove}
      disabled={false}
      focusAfterDelete={createRef()}
      onSettled={onSettled}
      {...over}
    />,
  );
  return { vm, update, setActive, remove, onSettled };
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
      t.setActive.dialog.hideRegionOwnTours.central('Central Vietnam'),
      t.setActive.dialog.hideCounts,
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
    expect(screen.getByText(t.setActive.dialog.hideBodyNoRegion)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      t.setActive.dialog.hideCounts,
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
    // Response KHÁC request — một admin khác vừa đổi tên và bỏ vùng. Mock phản
    // chiếu đúng request thì ca này không phân biệt được toast dựng từ response
    // với toast dựng từ hàng đang hiện (vòng review F15).
    const user = userEvent.setup();
    const data = row();
    const vm = toDestinationRowVM(data);
    const setActive = vi.fn(async () => ({
      ok: true as const,
      row: { ...data, isActive: false, name: 'Phố cổ Hội An', region: null },
    }));
    render(
      <DestinationRowActions
        row={vm}
        update={vi.fn()}
        setActive={setActive}
        remove={vi.fn()}
        disabled={false}
        focusAfterDelete={createRef()}
        onSettled={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));
    await user.click(await screen.findByRole('button', { name: t.setActive.dialog.hideSubmit }));

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ id: vm.id, isActive: false }));
    expect(success).toHaveBeenCalledWith(t.setActive.toast.hiddenTitle, {
      description: t.setActive.toast.hiddenBody('Phố cổ Hội An', false),
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
    expect(screen.getByRole('combobox', { name: t.form.region })).toHaveTextContent(
      'Central Vietnam',
    );
    expect(screen.queryByLabelText(t.form.slug)).not.toBeInTheDocument();
  });

  it('lưu: gửi payload SỬA không mang slug', async () => {
    const user = userEvent.setup();
    const { vm, update } = renderRow(row());

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));
    await user.click(await screen.findByRole('combobox', { name: t.form.region }));
    await user.click(await screen.findByRole('option', { name: 'Southern Vietnam' }));
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

  it('bảng đang bận: khoá cả hai nút mà vẫn nhận focus, và bấm vào cũng không mở gì', async () => {
    // Khoá bằng `aria-disabled`, KHÔNG bằng thuộc tính `disabled`: hộp thoại đóng
    // đúng lúc bảng làm mới, và Base UI trả focus về nút đã mở nó — nút
    // `disabled` thật thì focus rơi về <body> (vòng review F15).
    // Khẳng định "không mở" chỉ có nghĩa khi ĐÃ bấm (bài học 15, ca xanh giả
    // của F14).
    const user = userEvent.setup();
    const { vm } = renderRow(row(), { disabled: true });
    const edit = screen.getByRole('button', { name: t.edit.actionLabel(vm.name) });
    const hide = screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) });

    for (const button of [edit, hide]) {
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toHaveAttribute('disabled');
    }
    edit.focus();
    expect(edit).toHaveFocus();

    await user.click(edit);
    await user.click(hide);

    expect(screen.queryByText(t.edit.dialog.title)).not.toBeInTheDocument();
    expect(screen.queryByText(t.setActive.dialog.hideTitle)).not.toBeInTheDocument();
  });
});

describe('DestinationRowActions — nút Delete (ADR-0053)', () => {
  it('còn tour: nút Delete khoá, rê chuột thấy "Used by N tours"', async () => {
    const user = userEvent.setup();
    renderRow(row());

    const button = screen.getByRole('button', { name: t.delete.actionLabel('Hội An') });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // Câu ấy còn ở span ẩn cho trình đọc màn hình (Ruling F-e) — tìm trong popup tooltip.
    expect(button).toHaveAccessibleDescription(t.delete.inUse(4));
    await user.hover(button);
    expect(
      await screen.findByText(t.delete.inUse(4), { selector: '[data-slot="tooltip-content"]' }),
    ).toBeInTheDocument();
  });

  it('chỉ còn tour nháp (0 đang bán): nút Delete VẪN khoá — đếm tour mọi trạng thái', async () => {
    // ADR-0053 §1: xoá được khi KHÔNG tour nào dùng, kể cả tour đang tắt bán. Hàng mặc
    // định có hai số bằng nhau nên ca trên không phân biệt được; nút đọc `tourCount` thì
    // hàng này mời bấm, và server trả `IN_USE`.
    const user = userEvent.setup();
    renderRow(row({ tourCount: 0, linkedTourCount: 1 }));

    const button = screen.getByRole('button', { name: t.delete.actionLabel('Hội An') });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(t.delete.inUse(1));
    await user.hover(button);
    expect(
      await screen.findByText(t.delete.inUse(1), { selector: '[data-slot="tooltip-content"]' }),
    ).toBeInTheDocument();
  });

  it('0 tour: xác nhận gửi đúng id, toast tên hàng, rồi làm mới bảng', async () => {
    const user = userEvent.setup();
    const data = row({ tourCount: 0, linkedTourCount: 0 });
    const { remove, onSettled } = renderRow(data);

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Hội An') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith({ id: data.id });
    expect(success).toHaveBeenCalledWith(t.delete.toast.title, {
      description: t.delete.toast.body('Hội An'),
    });
  });

  it('hàng ĐÃ ẨN còn tour: lý do khoá chỉ nói số tour — nút bật tắt cạnh đó đang là Show (Ruling F-b)', () => {
    renderRow(row({ isActive: false }));

    expect(
      screen.getByRole('button', { name: t.delete.actionLabel('Hội An') }),
    ).toHaveAccessibleDescription(t.delete.inUseHidden(4));
  });

  /** Bấm Delete ở hàng 0 tour rồi xác nhận, server trả `IN_USE` (một tour vừa gắn vào). */
  async function deleteHitsInUse(isActive: boolean) {
    const user = userEvent.setup();
    const remove = vi.fn(async () => ({ ok: false as const, code: 'IN_USE' as const }));
    const { onSettled } = renderRow(row({ isActive, tourCount: 0, linkedTourCount: 0 }), {
      remove,
    });

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Hội An') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
  }

  it('hàng đang hiện gặp IN_USE: toast khuyên ẩn như cũ', async () => {
    await deleteHitsInUse(true);

    expect(errorToast).toHaveBeenCalledWith(t.delete.errors.IN_USE);
  });

  it('hàng ĐÃ ẨN gặp IN_USE: toast nói lý do, không khuyên ẩn (Ruling F-b)', async () => {
    await deleteHitsInUse(false);

    expect(errorToast).toHaveBeenCalledWith(t.delete.inUseRaceHidden);
  });
});

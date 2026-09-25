import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetCostsAction } from '@/lib/tour-editor-write';
import { detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import { TourCostsForm } from './tour-costs-form';

/**
 * Tab Costs (spec F17 §2h): khung Totals tính ngay khi gõ bằng hàm giá vốn của
 * contract; dòng gõ dở bị bỏ qua; không có ô nhập giá vốn.
 */
const e = messages.admin.tours.editor;
const t = e.costs;
const le = messages.admin.listEditor;
const fe = e.form.errors;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

const NEXT_VERSION = '2026-09-24T10:11:13.000Z';
const LUNCH = {
  category: 'MEALS' as const,
  label: 'Lunch',
  amount: '8.50',
  basis: 'PER_PERSON' as const,
};

function renderForm(detail: AdminTourDetail = detailFixture(), save: SetCostsAction = vi.fn()) {
  const user = userEvent.setup();
  render(<TourCostsForm detail={detail} save={save} />);
  return { user };
}

const saveButton = () => screen.getByRole('button', { name: e.save });
const labels = () => screen.getAllByRole('textbox', { name: t.label });
const amounts = () => screen.getAllByRole('textbox', { name: t.amount });
const totals = () => screen.getByRole('region', { name: t.totals.title });
/** Các cặp nhãn → giá trị của khung Totals, theo thứ tự trên màn hình. */
const totalPairs = () =>
  within(totals())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  option: string,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('TourCostsForm', () => {
  it('thêm hai dòng: Totals tính NGAY khi gõ, trước khi Save', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture({ basePrice: '99.00', maxGroupSize: 12 }), save);

    expect(within(totals()).getByText(t.totals.none)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.addItem }));
    await user.type(labels()[0] as HTMLElement, 'Lunch');
    await user.type(amounts()[0] as HTMLElement, '8.50');
    await user.click(screen.getByRole('button', { name: t.addItem }));
    await user.type(labels()[1] as HTMLElement, 'Boat');
    await user.type(amounts()[1] as HTMLElement, '100.01');
    await choose(
      user,
      screen.getAllByRole('combobox', { name: t.basis })[1] as HTMLElement,
      t.bases.PER_DEPARTURE,
    );

    expect(totalPairs()).toEqual([
      [t.totals.perPerson, '$8.50'],
      [t.totals.perDeparture, '$100.01'],
      [t.totals.costPrice(12), '$16.83'],
      [t.totals.margin, t.totals.marginValue('$82.17', 83)],
    ]);
    expect(totals().querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('số tiền gõ dở "12." bị bỏ qua khi cộng, không hiện NaN', async () => {
    const { user } = renderForm(detailFixture({ costItems: [LUNCH] }));

    await user.click(screen.getByRole('button', { name: t.addItem }));
    await user.type(amounts()[1] as HTMLElement, '12.');

    expect(totalPairs()[0]).toEqual([t.totals.perPerson, '$8.50']);
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('xoá hết dòng: Totals quay về câu mời thêm dòng', async () => {
    const { user } = renderForm(detailFixture({ costItems: [LUNCH] }));

    expect(within(totals()).queryByText(t.totals.none)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: le.remove(t.itemName(1)) }));

    expect(within(totals()).getByText(t.totals.none)).toBeInTheDocument();
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });

  it('ghi chú hệ quả hiện cạnh nút Save; không có ô nhập giá vốn', () => {
    renderForm(detailFixture({ costItems: [LUNCH] }));

    expect(screen.getByText(t.note)).toBeInTheDocument();
    // Một dòng chi phí = ô nhãn + ô số tiền; giá vốn không có ô nào (spec §2b.5).
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('hạng mục là ô chọn đủ tám mục; Save gửi đúng payload', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(detailFixture({ costItems: [LUNCH] }), save);

    await user.click(screen.getByRole('combobox', { name: t.category }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(Object.values(t.categories));
    await user.click(screen.getByRole('option', { name: t.categories.GUIDE }));
    await user.clear(labels()[0] as HTMLElement);
    await user.type(labels()[0] as HTMLElement, '  Guide fee ');
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({
      id: TOUR_ID,
      version: VERSION,
      items: [{ category: 'GUIDE', label: 'Guide fee', amount: '8.50', basis: 'PER_PERSON' }],
    });
  });

  it('nhãn trống và số tiền sai: lỗi dưới từng ô, không gửi', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture(), save);

    await user.click(screen.getByRole('button', { name: t.addItem }));
    await user.type(amounts()[0] as HTMLElement, 'abc');
    await user.click(saveButton());

    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual([fe.required, fe.price]);
    expect(save).not.toHaveBeenCalled();
  });

  it('lưu hai lần liền: lần hai gửi version của response lần một, không phải của props', async () => {
    // Response mang ĐÚNG thứ vừa lưu ("Lunch!"): form phải lấy nó làm bản gốc mới
    // thì nút Save mới tắt — response trùng dữ liệu cũ sẽ che mất lỗi ấy.
    const save = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({
          costItems: [{ ...LUNCH, label: 'Lunch!' }],
          version: NEXT_VERSION,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({ costItems: [LUNCH], version: '2026-09-24T10:11:14.000Z' }),
      });
    const { user } = renderForm(detailFixture({ costItems: [LUNCH] }), save);

    await user.type(labels()[0] as HTMLElement, '!');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-disabled', 'true'));

    await user.type(labels()[0] as HTMLElement, '?');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    expect(save.mock.calls[0]?.[0].version).toBe(VERSION);
    expect(save.mock.calls[1]?.[0].version).toBe(NEXT_VERSION);
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourEditorOptions } from '@/lib/api/tours';
import type { CreateTourAction } from '@/lib/tour-editor-write';
import { CATEGORY_ID, DEST_A, HIDDEN_CATEGORY_ID, TOUR_ID } from '@/test/tour-detail';
import { NewTourDialog } from './new-tour-dialog';

/**
 * Hộp New tour ở trang Tours (spec F17 §2a): bảy ô, slug tự điền theo tên tới
 * khi admin chạm vào nó, tour sinh ra đang tắt bán rồi mở thẳng khu làm việc.
 */
const e = messages.admin.tours.editor;
const t = e.create;
const d = e.details;
const fe = e.form.errors;

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

const OPTIONS: TourEditorOptions = {
  categories: [
    { id: CATEGORY_ID, name: 'Day Tours', isActive: true },
    { id: HIDDEN_CATEGORY_ID, name: 'Retired', isActive: false },
  ],
  destinations: [{ id: DEST_A, name: 'Hạ Long', isActive: true }],
};

/** "Hội An Lantern Walk" — chữ "ộ" (U+1ED9) dựng từ mã số, không gõ thẳng. */
const TITLE = `H${String.fromCodePoint(0x1ed9)}i An Lantern Walk`;

async function openDialog(create: CreateTourAction = vi.fn(), options = OPTIONS) {
  const user = userEvent.setup();
  render(<NewTourDialog options={options} create={create} />);
  await user.click(screen.getByRole('button', { name: t.action }));
  const dialog = await screen.findByRole('dialog', { name: t.dialog.title });
  return { user, dialog };
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.type(within(dialog).getByRole('textbox', { name: d.title }), TITLE);
  await choose(user, d.category, 'Day Tours');
  await choose(user, t.primaryDestination, 'Hạ Long');
  await user.type(within(dialog).getByRole('textbox', { name: d.durationDays }), '1');
  await user.type(within(dialog).getByRole('textbox', { name: d.maxGroupSize }), '10');
  await user.type(within(dialog).getByRole('textbox', { name: d.basePrice }), '45');
}

describe('NewTourDialog', () => {
  it('gõ tên thì slug tự điền; sửa tay slug rồi thì tên thôi ghi đè', async () => {
    const { user, dialog } = await openDialog();
    const title = within(dialog).getByRole('textbox', { name: d.title });
    const slug = within(dialog).getByRole('textbox', { name: t.slug });

    await user.type(title, TITLE);
    expect(slug).toHaveValue('hoi-an-lantern-walk');

    await user.clear(slug);
    await user.type(slug, 'lanterns');
    await user.type(title, ' Tour');
    expect(slug).toHaveValue('lanterns');
  });

  it('ô slug tắt soát chính tả, tự viết hoa, tự sửa chữ', async () => {
    const { dialog } = await openDialog();
    const slug = within(dialog).getByRole('textbox', { name: t.slug });

    expect(slug).toHaveAttribute('spellcheck', 'false');
    expect(slug).toHaveAttribute('autocapitalize', 'none');
    expect(slug).toHaveAttribute('autocorrect', 'off');
  });

  it('bấm tạo khi trống → lỗi dưới từng ô, không gửi', async () => {
    const create = vi.fn();
    const { user, dialog } = await openDialog(create);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    const alerts = within(dialog)
      .getAllByRole('alert')
      .map((alert) => alert.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining([
        fe.required,
        fe.chooseCategory,
        fe.chooseDestination,
        fe.wholeNumber(1, 30),
        fe.wholeNumber(1, 100),
        fe.price,
      ]),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('SLUG_TAKEN → câu lỗi DƯỚI ô slug, hộp vẫn mở, chữ đã gõ còn nguyên', async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, code: 'SLUG_TAKEN' });
    const { user, dialog } = await openDialog(create);

    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    const slug = within(dialog).getByRole('textbox', { name: t.slug });
    await waitFor(() =>
      expect(slug).toHaveAccessibleDescription(expect.stringContaining(t.errors.SLUG_TAKEN)),
    );
    expect(within(dialog).getAllByText(t.errors.SLUG_TAKEN)).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: d.title })).toHaveValue(TITLE);
  });

  it('thành công → mở thẳng khu làm việc của tour mới, toast nói tour đang tắt bán', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ ok: true, created: { id: TOUR_ID, slug: 'hoi-an-lantern-walk' } });
    const { user, dialog } = await openDialog(create);

    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tours/hoi-an-lantern-walk'));
    expect(create).toHaveBeenCalledWith({
      title: TITLE,
      slug: 'hoi-an-lantern-walk',
      categoryId: CATEGORY_ID,
      primaryDestinationId: DEST_A,
      durationDays: 1,
      maxGroupSize: 10,
      basePrice: '45',
    });
    expect(success).toHaveBeenCalledWith(t.toast.title, { description: t.toast.body });
  });

  it('danh sách chọn rỗng → câu giải thích và nút tạo khoá', async () => {
    const { dialog } = await openDialog(vi.fn(), { ...OPTIONS, destinations: [] });

    expect(within(dialog).getByText(t.noOptions)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t.dialog.submit })).toBeDisabled();
  });

  it('danh mục đã ẩn vẫn chọn được, mang "(hidden)"', async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole('combobox', { name: d.category }));
    expect(await screen.findByRole('option', { name: 'Retired (hidden)' })).toBeInTheDocument();
  });
});

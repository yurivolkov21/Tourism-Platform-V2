import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourEditorOptions } from '@/lib/api/tours';
import { requestCreate } from '@/lib/quick-create';
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
    // Điều hướng là việc SAU lệnh (vòng review F17): push trong lệnh cộng
    // refresh ở onSettled là dựng trang tour mới hai lần.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('LINK_NOT_FOUND → câu báo trong hộp, làm mới danh sách chọn; hộp vẫn mở, chữ còn nguyên (review S1)', async () => {
    // Danh mục hay điểm đến vừa bị xoá ở tab khác. Không làm mới thì Picker còn giữ đúng mục ấy
    // tới khi F5, và chọn lại nó là lỗi lặp lại.
    const create = vi.fn().mockResolvedValue({ ok: false, code: 'LINK_NOT_FOUND' });
    const { user, dialog } = await openDialog(create);

    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(t.errors.LINK_NOT_FOUND);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(errorToast).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: d.title })).toHaveValue(TITLE);
  });

  it('LINK_NOT_FOUND rồi danh sách mới không còn danh mục vừa chọn: ô Category về câu giữ chỗ và báo chọn lại, không in id; chữ khác còn nguyên (review G6-F4)', async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, code: 'LINK_NOT_FOUND' });
    const user = userEvent.setup();
    const view = render(<NewTourDialog options={OPTIONS} create={create} />);
    await user.click(screen.getByRole('button', { name: t.action }));
    const dialog = await screen.findByRole('dialog', { name: t.dialog.title });
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));
    await within(dialog).findByText(t.errors.LINK_NOT_FOUND);

    // Lượt `router.refresh()` đáp xuống: "Day Tours" vừa bị xoá ở tab khác.
    view.rerender(
      <NewTourDialog
        options={{
          ...OPTIONS,
          categories: OPTIONS.categories.filter((option) => option.id !== CATEGORY_ID),
        }}
        create={create}
      />,
    );

    const category = within(dialog).getByRole('combobox', { name: d.category });
    expect(category).toHaveTextContent(d.categoryPlaceholder);
    expect(category).not.toHaveTextContent(CATEGORY_ID);
    expect(within(dialog).getByText(fe.chooseCategory)).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: t.primaryDestination })).toHaveTextContent(
      'Hạ Long',
    );
    expect(within(dialog).getByRole('textbox', { name: d.title })).toHaveValue(TITLE);
    // Câu báo vẫn đứng đó — nó là thứ bảo người dùng chọn lại.
    expect(within(dialog).getByText(t.errors.LINK_NOT_FOUND)).toBeInTheDocument();
  });

  it('kết cục không rõ (GENERIC) → refresh bảng để xem tour đã có chưa, không điều hướng', async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, code: 'GENERIC' });
    const { user, dialog } = await openDialog(create);

    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });

  it('danh sách chọn rỗng → câu giải thích và nút tạo khoá', async () => {
    const { dialog } = await openDialog(vi.fn(), { ...OPTIONS, destinations: [] });

    expect(within(dialog).getByText(t.noOptions)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t.dialog.submit })).toBeDisabled();
  });

  it('danh mục đã ẩn vẫn chọn được, kèm nhãn phụ "Hidden"', async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole('combobox', { name: d.category }));
    expect(
      await screen.findByRole('option', {
        name: messages.admin.option.withHint('Retired', messages.admin.tours.list.hiddenHint),
      }),
    ).toBeInTheDocument();
  });

  it('Quick Create từ trang khác: yêu cầu đang chờ lúc mount → hộp mở sẵn mà không cần bấm nút', async () => {
    requestCreate('tour');
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
  });

  it('Quick Create ngay trên trang này: yêu cầu mới mở hộp ngay, không cần bấm nút', async () => {
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => requestCreate('tour'));
    expect(await screen.findByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
  });

  it('hộp mở bằng Quick Create, không qua nút: Esc thì focus về nút New tour, không rơi về body (review A2-8)', async () => {
    const user = userEvent.setup();
    requestCreate('tour');
    render(<NewTourDialog options={OPTIONS} create={vi.fn()} />);
    await screen.findByRole('dialog', { name: t.dialog.title });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: t.action })).toHaveFocus());
  });
});

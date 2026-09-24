import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type AdminDestinationRow, REGIONS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newDestinationFormValues } from '@/lib/destinations-write';
import { DestinationFormDialog } from './destination-form-dialog';

/**
 * Form THÊM và SỬA một điểm đến (spec P4e-2 F15).
 *
 * Hai ô mang hai quyết định của spec:
 *
 *  ① ô VÙNG là danh sách chọn ba mục, không phải ô chữ (§2b, ADR-0045) — cột
 *    DB là chữ tự do, một lần gõ nhầm là điểm đến biến khỏi mọi trang vùng;
 *  ② ô SLUG có ở form tạo, VẮNG ở form sửa (§2c).
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

const SAVED: AdminDestinationRow = {
  id: 'd1500001-0000-4000-8000-000000000001',
  slug: 'da-lat',
  name: 'Đà Lạt',
  country: 'Vietnam',
  region: 'Southern Vietnam',
  description: null,
  isActive: true,
  tourCount: 0,
};

const EMPTY = { name: '', slug: '', country: 'Vietnam', region: '', description: '' };

function renderDialog(
  props: Partial<React.ComponentProps<typeof DestinationFormDialog<'SLUG_TAKEN'>>> = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => ({ ok: true as const, row: SAVED }));
  const onClose = props.onClose ?? vi.fn();
  const onSettled = props.onSettled ?? vi.fn();
  render(
    <DestinationFormDialog<'SLUG_TAKEN'>
      copy={t.create.dialog}
      formId="destination-create"
      mode="create"
      initial={EMPTY}
      isStale={() => false}
      errorCopy={() => t.create.errors.SLUG_TAKEN}
      toast={() => ({ title: t.create.toast.title, description: 'done' })}
      {...props}
      onSubmit={onSubmit}
      onClose={onClose}
      onSettled={onSettled}
    />,
  );
  return { onSubmit, onClose, onSettled };
}

/** Chọn một vùng ở `FormSelect` của kit: mở trigger rồi bấm mục (Base UI Select). */
async function chooseRegion(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('combobox', { name: t.form.region }));
  await user.click(await screen.findByRole('option', { name }));
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('DestinationFormDialog — ô vùng', () => {
  it('là một danh sách CHỌN, không phải ô chữ', () => {
    renderDialog();

    expect(screen.getByRole('combobox', { name: t.form.region })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: t.form.region })).not.toBeInTheDocument();
  });

  it('chưa chọn thì hiện câu giữ chỗ; mở ra chọn được ĐÚNG ba vùng của contract', async () => {
    // Không có mục "chưa có vùng" trong danh sách — không ai chọn lại được trạng
    // thái ấy (bản `<select>` gốc cũ dùng một `<option disabled>` cho việc này).
    const user = userEvent.setup();
    renderDialog();
    const region = screen.getByRole('combobox', { name: t.form.region });
    expect(region).toHaveTextContent(t.form.regionPlaceholder);

    await user.click(region);
    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual(REGIONS.map((item) => item.name));
  });

  it('chưa chọn vùng mà bấm gửi: báo tại ô, KHÔNG gọi server', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText(t.form.name), 'Đà Lạt');
    await user.click(screen.getByRole('button', { name: t.create.dialog.submit }));

    expect(await screen.findByText(t.form.errors.regionRequired)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('chọn vùng rồi gửi: server nhận ĐÚNG tên vùng', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText(t.form.name), 'Đà Lạt');
    await chooseRegion(user, 'Southern Vietnam');
    await user.click(screen.getByRole('button', { name: t.create.dialog.submit }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Đà Lạt', slug: 'da-lat', region: 'Southern Vietnam' }),
    );
  });

  it('form SỬA chọn sẵn đúng vùng đang có', () => {
    renderDialog({
      mode: 'edit',
      copy: t.edit.dialog,
      initial: { ...EMPTY, name: 'Hà Nội', slug: 'hanoi', region: 'Northern Vietnam' },
    });

    expect(screen.getByRole('combobox', { name: t.form.region })).toHaveTextContent(
      'Northern Vietnam',
    );
  });

  it('quốc gia điền sẵn Vietnam ở form tạo', () => {
    // Dựng bằng CHÍNH giá trị đầu mà bảng dùng — fixture `EMPTY` tự mang
    // "Vietnam" nên ca cũ không canh gì cả (vòng review F15).
    renderDialog({ initial: newDestinationFormValues() });

    expect(screen.getByLabelText(t.form.country)).toHaveValue('Vietnam');
  });
});

describe('DestinationFormDialog — ô slug', () => {
  it('chế độ TẠO: ô slug có mặt, sửa được, và không bị soát chính tả hay tự sửa chữ', () => {
    // Ba thuộc tính của ô slug danh mục (lượt thử tay F14), dùng lại nguyên.
    renderDialog();
    const slug = screen.getByLabelText(t.form.slug);

    expect(slug).toBeEnabled();
    expect(slug).toHaveAttribute('spellcheck', 'false');
    expect(slug).toHaveAttribute('autocapitalize', 'none');
    expect(slug).toHaveAttribute('autocorrect', 'off');
  });

  it('chế độ SỬA: ô slug KHÔNG có mặt — đây là chốt của "đặt một lần"', () => {
    renderDialog({
      mode: 'edit',
      copy: t.edit.dialog,
      initial: { ...EMPTY, name: 'Hà Nội', slug: 'hanoi', region: 'Northern Vietnam' },
    });

    expect(screen.queryByLabelText(t.form.slug)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.form.name)).toBeEnabled();
  });

  it('gõ TÊN thì slug tự điền theo — bỏ dấu tiếng Việt, trần 80', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(t.form.name), 'Đà Lạt');
    expect(screen.getByLabelText(t.form.slug)).toHaveValue('da-lat');

    await user.clear(screen.getByLabelText(t.form.name));
    await user.type(screen.getByLabelText(t.form.name), 'a'.repeat(90));
    expect(screen.getByLabelText(t.form.slug)).toHaveValue('a'.repeat(80));
  });

  it('admin sửa tay ô slug rồi thì gõ tên KHÔNG ghi đè nữa', async () => {
    // Slug thật do người chọn: `Hà Nội` mang `hanoi`, không phải `ha-noi`.
    const user = userEvent.setup();
    renderDialog();

    const slug = screen.getByLabelText(t.form.slug);
    await user.type(screen.getByLabelText(t.form.name), 'Hà Nội');
    await user.clear(slug);
    await user.type(slug, 'hanoi');
    await user.type(screen.getByLabelText(t.form.name), ' Old Quarter');

    expect(slug).toHaveValue('hanoi');
  });

  it('slug sai khuôn báo CHÍNH câu của danh mục tại ô, không gọi server', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText(t.form.name), 'X');
    await user.clear(screen.getByLabelText(t.form.slug));
    await user.type(screen.getByLabelText(t.form.slug), 'hoi--an');
    await chooseRegion(user, 'Central Vietnam');
    await user.click(screen.getByRole('button', { name: t.create.dialog.submit }));

    expect(
      await screen.findByText(messages.admin.categories.form.errors.slugShape),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

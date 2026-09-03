import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnquiryStatusPanel } from './status-panel';

/**
 * Ô đổi trạng thái của `/enquiries/[id]` (spec P4c §3-F9) — consumer thứ tư
 * của `ConfirmWriteDialog`, và là consumer thứ hai không có ô note. Vòng đời
 * lệnh ghi đã pin ở spec của kit; ở đây pin phần DOMAIN: dialog nêu rõ
 * `from → to`, ba hệ quả, input gửi đi, và toast kể theo RESPONSE.
 */
const t = messages.admin.enquiries.setStatus;
const status = messages.admin.enquiries.status;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const ID = '0198c000-0000-7000-8000-000000000001';
const NAME = 'Ada Lovelace';

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

/** Chọn một trạng thái đích rồi mở dialog xác nhận. */
async function choose(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: label }));
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, label: string) {
  await choose(user, label);
  await user.click(screen.getByRole('button', { name: t.action }));
}

describe('EnquiryStatusPanel', () => {
  it('chưa chọn gì khác: nút bị KHOÁ — không mời xác nhận một lệnh không làm gì', () => {
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent(status.NEW);
    expect(screen.getByRole('button', { name: t.action })).toBeDisabled();
  });

  it('chọn trạng thái khác → mở được dialog, nhưng MỞ thôi thì chưa bắn gì', async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn();
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={setStatus} />);

    await openDialog(user, status.WON);
    expect(await screen.findByText(t.dialog.title)).toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('dialog nêu rõ lead + from → to bằng NHÃN, ba hệ quả, cảnh báo append-only, KHÔNG ô note', async () => {
    const user = userEvent.setup();
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={vi.fn()} />);
    await openDialog(user, status.WON);

    expect(await screen.findByText(NAME)).toBeInTheDocument();
    expect(screen.getByText(t.from)).toBeInTheDocument();
    expect(screen.getByText(t.to)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.audit)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.stats)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.consequences.free)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.warning)).toBeInTheDocument();
    // Lệnh này không mang ghi chú — kit bỏ hẳn ô khi không truyền `noteId`.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('xác nhận gửi ĐÚNG { id, status } của trạng thái ĐÍCH', async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(async () => ({
      ok: true as const,
      name: NAME,
      status: 'WON' as const,
    }));
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={setStatus} />);

    await openDialog(user, status.WON);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));
    expect(setStatus).toHaveBeenCalledWith({ id: ID, status: 'WON' });
  });

  it('thành công: toast kể theo RESPONSE (không theo input), đóng dialog + refresh trang', async () => {
    const user = userEvent.setup();
    // Server trả tên/trạng thái THẬT — ở đây cố ý khác input để chứng minh
    // toast đọc response chứ không đọc lại thứ vừa gửi đi.
    const setStatus = vi.fn(async () => ({
      ok: true as const,
      name: 'Grace Hopper',
      status: 'LOST' as const,
    }));
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={setStatus} />);

    await openDialog(user, status.WON);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(success).toHaveBeenCalledWith(t.toast.title, {
      description: t.toast.body('Grace Hopper', status.LOST),
    });
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('NOT_FOUND (trạng-thái-cũ): đóng + toast đúng câu + refresh, không mời bấm lại', async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(async () => ({ ok: false as const, code: 'NOT_FOUND' as const }));
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={setStatus} />);

    await openDialog(user, status.WON);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
    expect(screen.queryByText(t.dialog.title)).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('hết phiên (UNAUTHORIZED): dialog Ở LẠI kèm câu đăng nhập lại, lựa chọn còn nguyên', async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(async () => ({ ok: false as const, code: 'UNAUTHORIZED' as const }));
    render(<EnquiryStatusPanel id={ID} name={NAME} status="NEW" setStatus={setStatus} />);

    await openDialog(user, status.WON);
    await user.click(await screen.findByRole('button', { name: t.dialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
    expect(screen.getByText(t.dialog.title)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('chuyển LÙI cũng đi qua đúng dialog đó — không luật máy nào chặn, câu chữ là lớp bảo vệ', async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(async () => ({
      ok: true as const,
      name: NAME,
      status: 'NEW' as const,
    }));
    render(<EnquiryStatusPanel id={ID} name={NAME} status="WON" setStatus={setStatus} />);

    await openDialog(user, status.NEW);
    expect(await screen.findByText(t.dialog.title)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.dialog.submit }));
    expect(setStatus).toHaveBeenCalledWith({ id: ID, status: 'NEW' });
  });
});

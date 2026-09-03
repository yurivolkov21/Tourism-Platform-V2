import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENQUIRY_NOTE_MAX_LENGTH } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnquiryNoteForm } from './note-form';

/**
 * Form thêm note của `/enquiries/[id]` (spec P4c §3-F9) — hành vi ghi DUY
 * NHẤT của admin không đi qua `ConfirmWriteDialog`, nên ba luật của kit phải
 * được pin lại ngay tại đây: cổng chống bấm đúp, body gửi đi đã trim, và
 * đoạn văn KHÔNG bị xoá khi lệnh hỏng.
 */
const t = messages.admin.enquiries.detail.notes;

const success = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const ID = '0198c000-0000-7000-8000-000000000001';

beforeEach(() => {
  success.mockReset();
  refresh.mockReset();
});

const textarea = () => screen.getByLabelText(t.label);
const submitButton = () => screen.getByRole('button', { name: t.submit });

describe('EnquiryNoteForm', () => {
  it('ô rỗng: nút bị KHOÁ, và ô toàn dấu cách cũng vậy (note trắng là dòng chết trong thread)', async () => {
    const user = userEvent.setup();
    render(<EnquiryNoteForm id={ID} addNote={vi.fn()} />);
    expect(submitButton()).toBeDisabled();

    await user.type(textarea(), '   ');
    expect(submitButton()).toBeDisabled();
  });

  it('đếm ký tự đọc độ dài THÔ trên trần của contract, cập nhật theo từng phím', async () => {
    const user = userEvent.setup();
    render(<EnquiryNoteForm id={ID} addNote={vi.fn()} />);
    expect(screen.getByText(t.counter(0, ENQUIRY_NOTE_MAX_LENGTH))).toBeInTheDocument();

    await user.type(textarea(), 'hello');
    expect(screen.getByText(t.counter(5, ENQUIRY_NOTE_MAX_LENGTH))).toBeInTheDocument();
  });

  it('ô nhập chặn ở đúng trần contract — không để người gõ thừa rồi ăn 400', () => {
    render(<EnquiryNoteForm id={ID} addNote={vi.fn()} />);
    expect(textarea()).toHaveAttribute('maxlength', String(ENQUIRY_NOTE_MAX_LENGTH));
  });

  it('gửi ĐÚNG { id, body } với body đã TRIM — thread không nhận khoảng trắng thừa', async () => {
    const user = userEvent.setup();
    const addNote = vi.fn(async () => ({ ok: true as const }));
    render(<EnquiryNoteForm id={ID} addNote={addNote} />);

    await user.type(textarea(), '  Called the lead.  ');
    await user.click(submitButton());
    expect(addNote).toHaveBeenCalledWith({ id: ID, body: 'Called the lead.' });
  });

  it('thành công: xoá ô + toast + refresh trang', async () => {
    const user = userEvent.setup();
    render(<EnquiryNoteForm id={ID} addNote={vi.fn(async () => ({ ok: true as const }))} />);

    await user.type(textarea(), 'Called the lead.');
    await user.click(submitButton());

    expect(textarea()).toHaveValue('');
    // Toast dùng ĐÚNG câu của `addNote`, không mượn tiêu đề thẻ "Internal notes".
    expect(success).toHaveBeenCalledWith(messages.admin.enquiries.addNote.toast.title, {
      description: messages.admin.enquiries.addNote.toast.body,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('lỗi: hiện câu của mã đó VÀ GIỮ NGUYÊN đoạn vừa gõ (mất một đoạn văn vì lỗi mạng là không chấp nhận được)', async () => {
    const user = userEvent.setup();
    const addNote = vi.fn(async () => ({ ok: false as const, code: 'NOT_FOUND' as const }));
    render(<EnquiryNoteForm id={ID} addNote={addNote} />);

    await user.type(textarea(), 'Called the lead.');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.enquiries.addNote.errors.NOT_FOUND,
    );
    expect(textarea()).toHaveValue('Called the lead.');
    // Trạng-thái-cũ: kéo trang tươi về để admin nhìn sự thật trước khi thử lại.
    expect(refresh).toHaveBeenCalled();
  });

  it('hết phiên (UNAUTHORIZED): hiện câu đăng nhập lại, KHÔNG refresh (thử lại tại chỗ được)', async () => {
    const user = userEvent.setup();
    const addNote = vi.fn(async () => ({ ok: false as const, code: 'UNAUTHORIZED' as const }));
    render(<EnquiryNoteForm id={ID} addNote={addNote} />);

    await user.type(textarea(), 'Called the lead.');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('action NÉM: coi như kết cục KHÔNG RÕ, giữ đoạn văn, không toast thành công', async () => {
    const user = userEvent.setup();
    const addNote = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    render(<EnquiryNoteForm id={ID} addNote={addNote} />);

    await user.type(textarea(), 'Called the lead.');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.admin.errors.write.GENERIC);
    expect(textarea()).toHaveValue('Called the lead.');
    expect(success).not.toHaveBeenCalled();
  });

  it('bấm đúp chỉ bắn MỘT lệnh — `pending` là cổng, không chỉ để đổi chữ nút', async () => {
    const user = userEvent.setup();
    let resolve: (() => void) | undefined;
    const addNote = vi.fn(
      () =>
        new Promise<{ ok: true }>((r) => {
          resolve = () => r({ ok: true });
        }),
    );
    render(<EnquiryNoteForm id={ID} addNote={addNote} />);

    await user.type(textarea(), 'Called the lead.');
    await user.click(submitButton());
    await user.click(screen.getByRole('button', { name: t.submitting }));
    expect(addNote).toHaveBeenCalledTimes(1);
    resolve?.();
  });
});

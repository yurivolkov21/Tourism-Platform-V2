import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmWriteDialog } from './confirm-write-dialog';

/**
 * Hợp đồng của MÁY confirm-write (kit P4b — nâng từ hai bản chép
 * `ModerateDialog`/`DecideDialog` ở sổ nợ F4 31/08). Test ở đây pin đúng
 * phần KIT chịu trách nhiệm — vòng đời một lệnh ghi: trim note, khoá khi
 * đang bắn, và ba lối ra khác nhau cho ba loại kết cục. Copy/hệ quả/nội
 * dung của từng vùng vẫn có test riêng ở vùng đó.
 */

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const COPY = {
  title: 'Do the thing?',
  body: 'This is what happens.',
  warning: 'This cannot be undone.',
  submit: 'Do it',
  submitting: 'Doing…',
  cancel: 'Cancel',
  noteLabel: 'Note (optional)',
  notePlaceholder: 'Kept in the audit trail.',
};

const ROWS = [
  { label: 'Booking', value: 'BK-ABCD1234' },
  { label: 'Customer', value: 'Ada Lovelace' },
];

/** Mã contract giả lập: một mã trạng-thái-cũ, một mã thử-lại-được. */
type TestCode = 'GONE' | 'RETRYABLE';
const ERROR_COPY: Record<TestCode, string> = {
  GONE: 'It is gone. The queue has been refreshed.',
  RETRYABLE: 'The provider said no. Try again.',
};

const onClose = vi.fn();
const onSettled = vi.fn();

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  onClose.mockReset();
  onSettled.mockReset();
});

/** Dựng máy với một `onSubmit` cho sẵn — mọi prop khác giữ nguyên. */
function renderDialog(onSubmit: (note: string) => Promise<unknown>) {
  return render(
    <ConfirmWriteDialog<TestCode>
      copy={COPY}
      rows={ROWS}
      extra={<p>Consequences go here.</p>}
      noteId="test-note"
      onSubmit={onSubmit as never}
      isStale={(code) => code === 'GONE'}
      errorCopy={(code) =>
        code in ERROR_COPY
          ? ERROR_COPY[code as TestCode]
          : messages.admin.errors.write[code as 'GENERIC']
      }
      onClose={onClose}
      onSettled={onSettled}
    />,
  );
}

describe('ConfirmWriteDialog — ngữ cảnh + cổng xác nhận', () => {
  it('hiện title, body, các dòng ngữ cảnh, phần riêng của vùng và câu cảnh báo', async () => {
    renderDialog(vi.fn());

    expect(await screen.findByText(COPY.title)).toBeInTheDocument();
    expect(screen.getByText(COPY.body)).toBeInTheDocument();
    expect(screen.getByText('BK-ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Consequences go here.')).toBeInTheDocument();
    expect(screen.getByText(COPY.warning)).toBeInTheDocument();
  });

  it('mở dialog KHÔNG bắn gì — phải bấm nút xác nhận', async () => {
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(await screen.findByText(COPY.title)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('note đi tới vùng đã TRIM — vùng tự quyết gửi hay bỏ field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: true, toast: { title: 'a', description: 'b' } });
    renderDialog(onSubmit);
    await user.type(await screen.findByLabelText(COPY.noteLabel), '  spaced out  ');
    await user.click(screen.getByRole('button', { name: COPY.submit }));

    expect(onSubmit).toHaveBeenCalledWith('spaced out');
  });
});

describe('ConfirmWriteDialog — ba lối ra của một lệnh ghi', () => {
  it('thành công: toast do vùng soạn + đóng dialog + onSettled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      ok: true,
      toast: { title: 'Done', description: 'BK-ABCD1234 is done.' },
    });
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    expect(success).toHaveBeenCalledWith('Done', { description: 'BK-ABCD1234 is done.' });
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mã thử-lại-được: alert đúng câu và dialog Ở LẠI (không đóng, không refresh)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, code: 'RETRYABLE' });
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_COPY.RETRYABLE);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('mã TRẠNG-THÁI-CŨ: đóng + toast lỗi + onSettled — copy hứa refresh thì phải refresh', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, code: 'GONE' });
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    expect(errorToast).toHaveBeenCalledWith(ERROR_COPY.GONE);
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });

  it('kết cục KHÔNG RÕ (GENERIC) đi lối trạng-thái-cũ dù vùng không khai nó', async () => {
    // Bấm lại mù sau một kết cục mập mờ là công thức lệnh đúp — luật này
    // thuộc KIT, không phụ thuộc `isStale` của vùng.
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, code: 'GENERIC' });
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });

  it('onSubmit NÉM (mạng đứt) đối xử như GENERIC', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('boom'));
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
    expect(onClose).toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalled();
  });
});

describe('ConfirmWriteDialog — khoá trong lúc bắn', () => {
  it('đang bắn thì Esc KHÔNG đóng được — lỗi về sau không được phép tàng hình', async () => {
    const user = userEvent.setup();
    let settle: (value: { ok: false; code: TestCode }) => void = () => {};
    const onSubmit = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve as typeof settle;
        }),
    );
    renderDialog(onSubmit);
    await user.click(await screen.findByRole('button', { name: COPY.submit }));

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    settle({ ok: false, code: 'RETRYABLE' });
    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_COPY.RETRYABLE);
  });

  it('bấm hai lần liên tiếp chỉ bắn MỘT lệnh', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockImplementation(() => new Promise(() => {}));
    renderDialog(onSubmit);
    const submit = await screen.findByRole('button', { name: COPY.submit });
    await user.click(submit);
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('nút Cancel gọi onClose khi rảnh', async () => {
    const user = userEvent.setup();
    renderDialog(vi.fn());
    await user.click(await screen.findByRole('button', { name: COPY.cancel }));

    expect(onClose).toHaveBeenCalled();
  });

  it('không truyền noteId (retry outbox F7): không có ô note, onSubmit nhận chuỗi rỗng', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: true as const,
      toast: { title: 'Done', description: 'ok' },
    }));
    const { noteLabel: _label, notePlaceholder: _placeholder, ...copy } = COPY;
    render(
      <ConfirmWriteDialog<TestCode>
        copy={copy}
        rows={ROWS}
        onSubmit={onSubmit}
        isStale={() => false}
        errorCopy={() => 'x'}
        onClose={onClose}
        onSettled={onSettled}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(onSubmit).toHaveBeenCalledWith('');
  });
});

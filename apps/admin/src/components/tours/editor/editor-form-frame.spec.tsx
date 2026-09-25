import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorFormFrame } from './editor-form-frame';

/**
 * Khung chung của bốn form tab (spec F17 §2i): dải báo trên cùng, ghi chú và nút
 * Save ở chân. Nút chỉ sáng khi form có thay đổi.
 */
const t = messages.admin.tours.editor;

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh() }) }));

beforeEach(() => refresh.mockReset());

function frame(props: Partial<React.ComponentProps<typeof EditorFormFrame>> = {}) {
  const onSubmit = vi.fn();
  render(
    <EditorFormFrame dirty={false} pending={false} banner={null} onSubmit={onSubmit} {...props}>
      <input aria-label="Name" />
    </EditorFormFrame>,
  );
  return { onSubmit: (props.onSubmit as ReturnType<typeof vi.fn>) ?? onSubmit };
}

const saveButton = () => screen.getByRole('button', { name: t.save });

describe('EditorFormFrame', () => {
  it('chưa có thay đổi: nút Save khoá (vẫn focus được) và bấm không gửi', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame();

    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(saveButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('có thay đổi: bấm Save gửi đúng một lần', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame({ dirty: true });

    await user.click(saveButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('đang lưu: chữ nút là "Saving…" và không gửi thêm', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame({ dirty: true, pending: true });

    const button = screen.getByRole('button', { name: t.saving });
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('dải stale: câu báo và nút Reload gọi router.refresh()', async () => {
    const user = userEvent.setup();
    frame({ banner: { kind: 'stale' } });

    expect(screen.getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.banners.reload }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('dải notReady: câu báo và link của từng chỗ thiếu', () => {
    frame({
      banner: {
        kind: 'notReady',
        issues: [
          { key: 'summary', label: 'A summary', href: '/tours/ha-long#tour-summary' },
          { key: 'days', label: 'An itinerary for day 3', href: '/tours/ha-long/itinerary#day-3' },
        ],
      },
    });

    expect(screen.getByText(t.banners.notReady)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A summary' })).toHaveAttribute(
      'href',
      '/tours/ha-long#tour-summary',
    );
    expect(screen.getByRole('link', { name: 'An itinerary for day 3' })).toHaveAttribute(
      'href',
      '/tours/ha-long/itinerary#day-3',
    );
  });

  it('dải notReady mà bản dự tính không thấy thiếu gì → câu "Reload to see what changed"', () => {
    frame({ banner: { kind: 'notReady', issues: [] } });
    expect(screen.getByText(t.banners.notReadyUnknown)).toBeInTheDocument();
    // Không in câu "…would leave it missing:" trước một danh sách rỗng.
    expect(screen.queryByText(t.banners.notReady)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
  });

  it('dải lỗi kết cục không rõ: câu lỗi kèm Reload; lỗi rõ thì không có Reload', () => {
    const { unmount } = render(
      <EditorFormFrame
        dirty
        pending={false}
        banner={{ kind: 'error', message: 'Something broke', uncertain: true }}
        onSubmit={vi.fn()}
      >
        <span />
      </EditorFormFrame>,
    );
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
    unmount();

    frame({ banner: { kind: 'error', message: 'Not allowed', uncertain: false } });
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.banners.reload })).not.toBeInTheDocument();
  });

  it('ghi chú hiện cạnh nút Save', () => {
    frame({ note: 'A new base price applies straight away.' });
    expect(screen.getByText('A new base price applies straight away.')).toBeInTheDocument();
  });
});

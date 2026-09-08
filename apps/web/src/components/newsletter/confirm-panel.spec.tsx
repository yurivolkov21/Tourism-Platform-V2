import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPanel } from './confirm-panel';

// Mock 'sonner' — cùng khuôn `unsubscribe-panel.spec.tsx`.
const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { newsletter: { confirm } } }));

const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'v1.confirm.deadbeef';
const EMAIL = 'jane@example.com';
const t = messages.newsletterConfirmPage;

beforeEach(() => {
  vi.clearAllMocks();
});

// W4 E3 (double opt-in) — island `/newsletter/confirm`: GET đã chạy ở page
// (không side effect), khách phải BẤM thì POST claim mới chạy.
describe('ConfirmPanel', () => {
  it('render trạng thái confirm: heading, body có email, nút Confirm — KHÔNG gọi API khi mới mở', () => {
    render(<ConfirmPanel id={ID} token={TOKEN} email={EMAIL} />);
    expect(screen.getByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
    expect(screen.getByText(t.confirm.body(EMAIL))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.button })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('bấm Confirm → gọi api.newsletter.confirm({id,token}) đúng MỘT lần, toast success, chuyển sang confirmed + link Home', async () => {
    confirm.mockResolvedValueOnce({ confirmed: true });
    const user = userEvent.setup();
    render(<ConfirmPanel id={ID} token={TOKEN} email={EMAIL} />);

    await user.click(screen.getByRole('button', { name: t.confirm.button }));

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith({ id: ID, token: TOKEN });
    expect(success).toHaveBeenCalledWith(t.toast.confirmed.title, {
      description: t.toast.confirmed.body,
    });
    expect(await screen.findByRole('heading', { name: t.confirmed.heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.confirmed.homeLink })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lỗi mạng/5xx → toast error, panel GIỮ trạng thái confirm để bấm lại', async () => {
    confirm.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ConfirmPanel id={ID} token={TOKEN} email={EMAIL} />);

    await user.click(screen.getByRole('button', { name: t.confirm.button }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(t.toast.error.title, { description: t.toast.error.body }),
    );
    expect(screen.getByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.button })).toBeEnabled();
  });

  it('429 throttle → toast warning (cùng copy error, khác kind), panel giữ confirm', async () => {
    confirm.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'TOO_MANY_REQUESTS',
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<ConfirmPanel id={ID} token={TOKEN} email={EMAIL} />);

    await user.click(screen.getByRole('button', { name: t.confirm.button }));

    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith(t.toast.error.title, {
        description: t.toast.error.body,
      }),
    );
    expect(screen.getByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
  });
});

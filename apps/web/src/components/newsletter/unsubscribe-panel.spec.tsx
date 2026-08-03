import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsubscribePanel } from './unsubscribe-panel';

// Mock 'sonner' — cùng khuôn `newsletter-form.spec.tsx`.
const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

// Mock client API — spec chỉ kiểm gọi ĐÚNG procedure + payload, không gọi API thật.
const { unsubscribe, resubscribe } = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  resubscribe: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ api: { newsletter: { unsubscribe, resubscribe } } }));

const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'tok-abc';
const EMAIL = 'm***@example.com';
const t = messages.unsubscribePage;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnsubscribePanel — trạng thái confirm', () => {
  it('alreadyUnsubscribed=false → hiện heading/body/nút confirm', () => {
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={false} />);

    expect(screen.getByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
    expect(screen.getByText(t.confirm.body(EMAIL))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.button })).toBeInTheDocument();
  });
});

describe('UnsubscribePanel — trạng thái alreadyUnsubscribed', () => {
  it('alreadyUnsubscribed=true → hiện copy riêng + nút Re-subscribe', () => {
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={true} />);

    expect(
      screen.getByRole('heading', { name: t.alreadyUnsubscribed.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.alreadyUnsubscribed.body(EMAIL))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.alreadyUnsubscribed.resubscribeButton }),
    ).toBeInTheDocument();
  });
});

describe('UnsubscribePanel — POST unsubscribe thành công', () => {
  it('bấm "Unsubscribe me" → gọi api.newsletter.unsubscribe({id,token}), toast success, panel đổi sang trạng thái unsubscribed', async () => {
    unsubscribe.mockResolvedValueOnce({ unsubscribed: true });
    const user = userEvent.setup();
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={false} />);

    await user.click(screen.getByRole('button', { name: t.confirm.button }));

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
    expect(unsubscribe).toHaveBeenCalledWith({ id: ID, token: TOKEN });
    expect(success).toHaveBeenCalledWith(t.toast.unsubscribed.title, {
      description: t.toast.unsubscribed.body,
    });
    expect(
      await screen.findByRole('heading', { name: t.unsubscribed.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.unsubscribed.resubscribeButton }),
    ).toBeInTheDocument();
  });
});

describe('UnsubscribePanel — POST resubscribe thành công', () => {
  it('từ trạng thái unsubscribed, bấm Re-subscribe → gọi resubscribe (KHÔNG gọi lại unsubscribe — mutation-bite), toast welcome-back, panel quay về confirm', async () => {
    unsubscribe.mockResolvedValueOnce({ unsubscribed: true });
    resubscribe.mockResolvedValueOnce({ subscribed: true });
    const user = userEvent.setup();
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={false} />);

    // Bước 1: unsubscribe trước để vào trạng thái unsubscribed.
    await user.click(screen.getByRole('button', { name: t.confirm.button }));
    await screen.findByRole('heading', { name: t.unsubscribed.heading });

    // Bước 2: resubscribe.
    await user.click(screen.getByRole('button', { name: t.unsubscribed.resubscribeButton }));

    await waitFor(() => expect(resubscribe).toHaveBeenCalledTimes(1));
    expect(resubscribe).toHaveBeenCalledWith({ id: ID, token: TOKEN });
    expect(unsubscribe).toHaveBeenCalledTimes(1); // vẫn 1 — KHÔNG gọi thêm lần nữa
    expect(success).toHaveBeenCalledWith(t.toast.resubscribed.title, {
      description: t.toast.resubscribed.body,
    });
    expect(await screen.findByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.button })).toBeInTheDocument();
  });

  it('từ trạng thái alreadyUnsubscribed, bấm Re-subscribe → gọi resubscribe, KHÔNG gọi unsubscribe, panel quay về confirm', async () => {
    resubscribe.mockResolvedValueOnce({ subscribed: true });
    const user = userEvent.setup();
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={true} />);

    await user.click(screen.getByRole('button', { name: t.alreadyUnsubscribed.resubscribeButton }));

    await waitFor(() => expect(resubscribe).toHaveBeenCalledTimes(1));
    expect(resubscribe).toHaveBeenCalledWith({ id: ID, token: TOKEN });
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
  });
});

describe('UnsubscribePanel — lỗi POST giữ nguyên panel', () => {
  it('lỗi mạng/5xx khi unsubscribe → toast error, panel GIỮ trạng thái confirm', async () => {
    unsubscribe.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={false} />);

    await user.click(screen.getByRole('button', { name: t.confirm.button }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(t.toast.error.title, {
        description: t.toast.error.body,
      }),
    );
    expect(screen.getByRole('heading', { name: t.confirm.heading })).toBeInTheDocument();
  });

  it('429 throttle khi resubscribe → toast warning (cùng copy error, khác kind), panel GIỮ trạng thái alreadyUnsubscribed', async () => {
    resubscribe.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'TOO_MANY_REQUESTS',
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<UnsubscribePanel id={ID} token={TOKEN} email={EMAIL} alreadyUnsubscribed={true} />);

    await user.click(screen.getByRole('button', { name: t.alreadyUnsubscribed.resubscribeButton }));

    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith(t.toast.error.title, {
        description: t.toast.error.body,
      }),
    );
    expect(
      screen.getByRole('heading', { name: t.alreadyUnsubscribed.heading }),
    ).toBeInTheDocument();
  });
});

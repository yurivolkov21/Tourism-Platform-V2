import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterForm } from './newsletter-form';

// Component KHÔNG dùng `motion` (khác `contact-split.tsx`) nên spec này
// không cần stub `IntersectionObserver` — đúng lý do tách component (bớt
// noise cho test, xem comment banner `newsletter-form.tsx`).

// Mock module 'sonner' — cùng khuôn `contact-split.spec.tsx`/`submit.spec.ts`.
const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

// Mock client API — spec chỉ kiểm submit gọi ĐÚNG payload, không gọi API thật.
const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { newsletter: { subscribe } } }));

describe('NewsletterForm — honeypot ẩn khỏi accessibility tree', () => {
  it('field "website" tồn tại trong DOM nhưng getByRole KHÔNG thấy (aria-hidden ancestor)', () => {
    const { container } = render(<NewsletterForm />);
    expect(screen.queryByRole('textbox', { name: /website/i })).not.toBeInTheDocument();
    expect(container.querySelector('#footer-newsletter-website')).not.toBeNull();
  });

  it('chỉ 1 textbox thật (email) lên accessibility tree, honeypot không tính vào', () => {
    render(<NewsletterForm />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});

describe('NewsletterForm — validate inline', () => {
  it('email rỗng → lỗi "required" hiện inline, KHÔNG gọi client', async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    expect(
      await screen.findByText(messages.newsletterForm.errors.email.required),
    ).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('email sai định dạng → lỗi "invalid" hiện inline, KHÔNG gọi client', async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByRole('textbox'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    expect(
      await screen.findByText(messages.newsletterForm.errors.email.invalid),
    ).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe('NewsletterForm — submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('email hợp lệ → gọi api.newsletter.subscribe đúng payload {email}, toast success MỘT KIỂU, reset input', async () => {
    subscribe.mockResolvedValueOnce({ subscribed: true });
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByRole('textbox'), 'minh@example.com');
    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    expect(subscribe).toHaveBeenCalledWith({ email: 'minh@example.com' });
    expect(success).toHaveBeenCalledWith(messages.newsletterForm.toast.success.title, {
      description: messages.newsletterForm.toast.success.body,
    });

    // Reset: input trở lại rỗng sau thành công.
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe(''));
  });

  it('lỗi mạng/5xx → toast error, GIỮ NGUYÊN email đã nhập', async () => {
    subscribe.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByRole('textbox'), 'minh@example.com');
    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(messages.newsletterForm.toast.error.title, {
        description: messages.newsletterForm.toast.error.body,
      }),
    );
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('minh@example.com');
  });

  it('429 throttle → toast riêng (warning), GIỮ NGUYÊN email đã nhập', async () => {
    subscribe.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'TOO_MANY_REQUESTS',
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByRole('textbox'), 'minh@example.com');
    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith(messages.newsletterForm.toast.throttle.title, {
        description: messages.newsletterForm.toast.throttle.body,
      }),
    );
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('minh@example.com');
  });

  it('anti-enumeration: subscribe lần hai cùng email → CÙNG MỘT toast success, KHÔNG nhánh phân biệt', async () => {
    // Contract server LUÔN trả {subscribed:true} dù email mới hay đã tồn tại
    // (spec §3) — mock trả y hệt cả hai lần để chứng minh client không có
    // logic nào đọc field khác để đổi copy.
    subscribe.mockResolvedValue({ subscribed: true });
    const user = userEvent.setup();
    render(<NewsletterForm />);

    for (let i = 0; i < 2; i++) {
      await user.type(screen.getByRole('textbox'), 'minh@example.com');
      await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));
      await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(i + 1));
    }

    expect(success).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenNthCalledWith(1, messages.newsletterForm.toast.success.title, {
      description: messages.newsletterForm.toast.success.body,
    });
    expect(success).toHaveBeenNthCalledWith(2, messages.newsletterForm.toast.success.title, {
      description: messages.newsletterForm.toast.success.body,
    });
  });

  it('honeypot điền → passthrough vào payload.website (mutation-bite: đổi tên field → test phải catch)', async () => {
    subscribe.mockResolvedValueOnce({ subscribed: true });
    const user = userEvent.setup();
    const { container } = render(<NewsletterForm />);

    await user.type(screen.getByRole('textbox'), 'minh@example.com');
    const honeypot = container.querySelector('#footer-newsletter-website') as HTMLInputElement;
    await user.type(honeypot, 'http://spam.example');
    await user.click(screen.getByRole('button', { name: messages.newsletterForm.submitLabel }));

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    expect(subscribe).toHaveBeenCalledWith({
      email: 'minh@example.com',
      website: 'http://spam.example',
    });
  });
});

import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Contact } from './contact';

// jsdom KHÔNG có IntersectionObserver mà mọi `motion.*` ở đây dùng
// `whileInView` — stub cục bộ (cùng ghi chú với contact-split.spec.tsx).
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ useSession: useSessionMock }));
beforeEach(() => useSessionMock.mockReturnValue({ data: null }));

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { enquiries: { create } } }));

const SUBMIT = /Get my itineraries/i;

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Your name'), 'Minh Anh');
  await user.type(screen.getByLabelText('Email address'), 'minh@example.com');
  await user.type(screen.getByLabelText('Message'), 'Two of us, easy pace, love food markets.');
}

describe('Home Contact — nối enquiries.create (19/08, cùng khuôn contact-split)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('honeypot "website" có trong DOM nhưng KHÔNG lên accessibility tree', () => {
    render(<Contact />);
    expect(document.querySelector('input[name="website"]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Website' })).toBeNull();
  });

  it('form KHÔNG dùng validate HTML — noValidate, không required', () => {
    render(<Contact />);
    expect(screen.getByLabelText('Your name').closest('form')).toHaveAttribute('novalidate');
    expect(screen.getByLabelText('Email address')).not.toBeRequired();
  });

  it('submit form trắng → lỗi required dưới name/email/message, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByText(messages.contactForm.errors.name.required)).toBeInTheDocument();
    expect(screen.getByText(messages.contactForm.errors.email.required)).toBeInTheDocument();
    expect(screen.getByText(messages.contactForm.errors.message.required)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('message 9 ký tự → tooShort đúng ô, không phải required', async () => {
    const user = userEvent.setup();
    render(<Contact />);

    await user.type(screen.getByLabelText('Message'), 'chin ky t');
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(
      await screen.findByText(messages.contactForm.errors.message.tooShort),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('hợp lệ → gọi api.enquiries.create đúng payload (dates ghép vào message, region → interests), toast success, reset', async () => {
    create.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<Contact />);

    await fillValid(user);
    await user.type(screen.getByLabelText('Travel dates'), 'Oct 12 – Oct 18');
    await user.selectOptions(screen.getByLabelText(messages.homeContact.regionLabel), 'north');
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      name: 'Minh Anh',
      email: 'minh@example.com',
      message: 'Two of us, easy pace, love food markets.\n\nPreferred dates: Oct 12 – Oct 18',
      interests: ['north'],
    });
    expect(success).toHaveBeenCalledWith(messages.homeContact.toast.success.title, {
      description: messages.homeContact.toast.success.body,
    });
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
  });

  it('region "Anywhere" (mặc định) → interests rỗng, KHÔNG gửi "any"', async () => {
    create.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<Contact />);

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]?.[0]).toMatchObject({ interests: [] });
  });

  it('lỗi mạng/5xx → toast error, GIỮ NGUYÊN dữ liệu', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<Contact />);

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(error).toHaveBeenCalledWith(messages.homeContact.toast.error.title, {
      description: messages.homeContact.toast.error.body,
    });
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Minh Anh');
  });

  it('429 throttle → toast warning riêng', async () => {
    create.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: false,
        code: 'TOO_MANY_REQUESTS',
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<Contact />);

    await fillValid(user);
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning).toHaveBeenCalledWith(messages.homeContact.toast.throttle.title, {
      description: messages.homeContact.toast.throttle.body,
    });
  });

  it('đã đăng nhập → ô tên điền sẵn tên thật; chưa đăng nhập → trống', async () => {
    useSessionMock.mockReturnValue({ data: { user: { name: 'Trần Mai Anh' } } });
    render(<Contact />);
    await waitFor(() =>
      expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Trần Mai Anh'),
    );
  });
});

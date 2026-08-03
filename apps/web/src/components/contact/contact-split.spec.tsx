import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ContactSplit } from './contact-split';

// jsdom KHÔNG hiện thực IntersectionObserver, mà mọi `motion.div` trong
// component dùng `whileInView` — thiếu API này ném ReferenceError lúc mount.
// Stub cục bộ (KHÔNG dời lên vitest.setup.ts — xem ghi chú y hệt ở
// `reveal-item.spec.tsx`: dời lên global làm gãy test ở file khác).
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

// Mock module 'sonner' — chỉ cần assert đúng hàm/tham số, không cần Toaster
// thật (jsdom không render toast container). Cùng khuôn với submit.spec.ts.
const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

// Mock client API — spec chỉ kiểm submit gọi ĐÚNG payload, không gọi API thật.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { enquiries: { create } } }));

async function fillValidLetter(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Where do we write back?'), 'minh@example.com');
  await user.type(
    screen.getByLabelText('What do you love when travelling?'),
    'Slow mornings, street food, and a boat ride at sunset.',
  );
  await user.type(screen.getByLabelText('Your name'), 'Minh Anh');
}

describe('ContactSplit — honeypot ẩn khỏi accessibility tree', () => {
  it('field "website" tồn tại trong DOM nhưng getByRole KHÔNG thấy (aria-hidden ancestor)', () => {
    const { container } = render(<ContactSplit />);
    expect(screen.queryByRole('textbox', { name: /website/i })).not.toBeInTheDocument();
    // Vẫn thật sự có trong DOM — bot đọc HTML/CSS thô vẫn tưởng field thật.
    expect(container.querySelector('#cl-website')).not.toBeNull();
  });

  it('5 field text thật (count/dates/loves/email/name) lên accessibility tree, honeypot không tính vào', () => {
    render(<ContactSplit />);
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });
});

describe('ContactSplit — validate inline', () => {
  it('submit form trắng → lỗi "required" hiện đúng dưới name/email/loves, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<ContactSplit />);

    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    expect(await screen.findByText(messages.contactForm.errors.name.required)).toBeInTheDocument();
    expect(screen.getByText(messages.contactForm.errors.email.required)).toBeInTheDocument();
    expect(screen.getByText(messages.contactForm.errors.message.required)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('loves 9 ký tự (< 10) → lỗi "tooShort" đúng field, không phải "required"', async () => {
    const user = userEvent.setup();
    render(<ContactSplit />);

    await user.type(screen.getByLabelText('Where do we write back?'), 'minh@example.com');
    await user.type(screen.getByLabelText('Your name'), 'Minh Anh');
    await user.type(screen.getByLabelText('What do you love when travelling?'), '123456789');
    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    expect(
      await screen.findByText(messages.contactForm.errors.message.tooShort),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ContactSplit — submit', () => {
  it('hợp lệ → gọi api.enquiries.create đúng payload, toast success, reset form', async () => {
    create.mockResolvedValueOnce({ id: '0198c9c4-0000-7000-8000-000000000001' });
    const user = userEvent.setup();
    render(<ContactSplit />);

    await fillValidLetter(user);
    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      name: 'Minh Anh',
      email: 'minh@example.com',
      message: 'Slow mornings, street food, and a boat ride at sunset.',
      interests: [],
    });
    expect(success).toHaveBeenCalledWith(messages.contactForm.toast.success.title, {
      description: messages.contactForm.toast.success.body,
    });

    // Reset: field trở lại rỗng sau thành công.
    await waitFor(() =>
      expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe(''),
    );
    expect((screen.getByLabelText('Where do we write back?') as HTMLInputElement).value).toBe('');
  });

  it('lỗi mạng/5xx → toast error, GIỮ NGUYÊN dữ liệu đã nhập', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ContactSplit />);

    await fillValidLetter(user);
    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(messages.contactForm.toast.error.title, {
        description: messages.contactForm.toast.error.body,
      }),
    );
    // Dữ liệu KHÔNG bị xoá.
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Minh Anh');
  });

  it('429 throttle → toast riêng (warning), GIỮ NGUYÊN dữ liệu', async () => {
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
    render(<ContactSplit />);

    await fillValidLetter(user);
    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith(messages.contactForm.toast.throttle.title, {
        description: messages.contactForm.toast.throttle.body,
      }),
    );
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Minh Anh');
  });
});

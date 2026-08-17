import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mock session — khuôn giống user-menu.spec.tsx: `vi.fn()` trần rồi set trạng
// thái trong beforeEach. KHÔNG đặt impl mặc định trong `vi.fn(() => …)` vì
// TS suy ra kiểu trả về là `{ data: null }`, khiến test đăng-nhập-rồi không
// gán được `{ data: { user } }` (đã đỏ typecheck vì lỗi này).
const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ useSession: useSessionMock }));

// Mặc định cấp file: CHƯA đăng nhập. Cần vì mọi describe trong file đều render
// ContactSplit, mà `vi.fn()` trần trả `undefined` → destructure `{ data }` ném.
beforeEach(() => useSessionMock.mockReturnValue({ data: null }));

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

/** Region đổi từ dropdown sang NHÓM RADIO 17/08 (4 lựa chọn thì hiện hết).
    Không còn popup để mở — bấm thẳng vào radio. Điều test khẳng định vẫn y
    nguyên: chọn miền nào thì `payload.interests` mang đúng miền đó. */
async function pickRegion(user: ReturnType<typeof userEvent.setup>, regionName: RegExp) {
  await user.click(screen.getByRole('radio', { name: regionName }));
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('Select region → payload.interests có region được chọn (dong day onValueChange → state → buildEnquiryPayload)', async () => {
    create.mockResolvedValueOnce({ id: '0198c9c4-0000-7000-8000-000000000002' });
    const user = userEvent.setup();
    render(<ContactSplit />);

    await pickRegion(user, /Northern Vietnam/i);
    await fillValidLetter(user);
    await user.click(screen.getByRole('button', { name: 'Send the letter' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      name: 'Minh Anh',
      email: 'minh@example.com',
      message: 'Slow mornings, street food, and a boat ride at sunset.',
      interests: ['north'],
    });
  });
});

describe('ContactSplit — điền sẵn chữ ký từ session', () => {
  it('CHƯA đăng nhập → ô chữ ký để TRỐNG', () => {
    render(<ContactSplit />);
    expect(screen.getByLabelText('Your name')).toHaveValue('');
  });

  it('đã đăng nhập → chữ ký điền sẵn tên thật', async () => {
    useSessionMock.mockReturnValue({ data: { user: { name: 'Minh Anh' } } });
    render(<ContactSplit />);
    await waitFor(() => expect(screen.getByLabelText('Your name')).toHaveValue('Minh Anh'));
  });

  it('khách đã gõ tay rồi session mới tới → KHÔNG ghi đè', async () => {
    // Đây là tình huống thật, không phải phòng xa: `useSession` trả về bất
    // đồng bộ, nên khách hoàn toàn có thể gõ xong trước khi session tới.
    const user = userEvent.setup();
    const { rerender } = render(<ContactSplit />);
    await user.type(screen.getByLabelText('Your name'), 'Người khác');

    useSessionMock.mockReturnValue({ data: { user: { name: 'Minh Anh' } } });
    rerender(<ContactSplit />);

    await waitFor(() => expect(screen.getByLabelText('Your name')).toHaveValue('Người khác'));
  });
});

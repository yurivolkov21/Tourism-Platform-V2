import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OtpForm } from './otp-form';

// Mock authClient — cùng khuôn login-form.spec.tsx. OtpForm (verify-email,
// Task 5) chỉ dùng emailOtp.verifyEmail + emailOtp.sendVerificationOtp.
const { verifyEmail, sendVerificationOtp } = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    emailOtp: { verifyEmail, sendVerificationOtp },
  },
}));

// Mock sonner — chỉ soi có gọi toast.success không.
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess },
}));

// Mock next/navigation — OtpForm push + refresh sau khi verify thành công.
const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const baseProps = {
  stub: 'BOARDING CHECK · EMAIL · GATE: VERIFY',
  heading: 'We mailed you six digits.',
  description: 'Enter the code we sent to confirm your email address.',
  submitLabel: 'Stamp my ticket',
};

async function typeOtp(user: ReturnType<typeof userEvent.setup>, digits: string) {
  // input-otp expose MỘT input ẩn nhận trọn chuỗi, gõ từng ký tự vẫn ra đúng.
  const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
  await user.type(hiddenInput, digits);
}

describe('OtpForm — verify-email (có email)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Luôn khôi phục real timers dù test throw giữa chừng — không thì fake
  // timers rò rỉ sang test sau (userEvent thật của các describe khác sẽ treo
  // vì chờ real setTimeout dưới đồng hồ giả không bao giờ tự trôi).
  afterEach(() => {
    vi.useRealTimers();
  });

  it('submit đủ 6 số → gọi authClient.emailOtp.verifyEmail đúng payload', async () => {
    verifyEmail.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Stamp my ticket' }));

    await waitFor(() => expect(verifyEmail).toHaveBeenCalledTimes(1));
    expect(verifyEmail).toHaveBeenCalledWith({ email: 'minh@example.com', otp: '123456' });
  });

  it('thành công → toast success + push(safeRedirect) + refresh', async () => {
    verifyEmail.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Stamp my ticket' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('redirect param an toàn → push đúng đích đó', async () => {
    verifyEmail.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<OtpForm {...baseProps} email="minh@example.com" redirect="/account" />);

    await typeOtp(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Stamp my ticket' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/account'));
  });

  it('OTP sai (mock error) → text invalidOtp hiện inline, KHÔNG reset countdown resend', async () => {
    vi.useFakeTimers();
    verifyEmail.mockResolvedValueOnce({ data: null, error: { code: 'INVALID_OTP' } });
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    // Cho đồng hồ chạy vài giây trước khi submit lỗi — chỉ cần < 60s, không
    // phụ thuộc số giây chính xác input-otp polling tiêu tốn bao nhiêu tick.
    await vi.advanceTimersByTimeAsync(5000);
    const countdownBefore = screen.getByText(/^\d+s$/).textContent;

    // Chuyển VỀ real timers TRƯỚC khi submit — `waitFor`/promise resolution
    // của handleSubmit không cần đồng hồ giả nữa, và mixing hai cơ chế hay
    // treo (`waitFor` nội bộ testing-library trông cậy real timer để poll).
    vi.useRealTimers();

    const hiddenInput = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Stamp my ticket' }));

    expect(await screen.findByText(messages.authForms.errors.invalidOtp)).toBeInTheDocument();
    // Countdown KHÔNG bị reset về 60s sau lỗi OTP — so với giá trị trước submit
    // (đồng hồ giả đã tắt nên số này cũng không tự trôi thêm trong lúc chờ).
    expect(screen.getByText(/^\d+s$/).textContent).toBe(countdownBefore);
    expect(push).not.toHaveBeenCalled();
  });

  it('lỗi mạng thật (promise reject từ verifyEmail) → hiện errors.generic, nút hết pending', async () => {
    verifyEmail.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    await typeOtp(user, '123456');
    const submitButton = screen.getByRole('button', { name: 'Stamp my ticket' });
    await user.click(submitButton);

    expect(await screen.findByText(messages.authForms.errors.generic)).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('resend lỗi mạng thật (promise reject) → hiện errors.generic, KHÔNG reset đếm ngược', async () => {
    vi.useFakeTimers();
    sendVerificationOtp.mockRejectedValueOnce(new Error('network down'));
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    for (let i = 0; i < 61; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Resend the code' })).toBeInTheDocument();

    // Chuyển về real timers trước khi click + waitFor — cùng lý do các test
    // resend/OTP sai ở trên (mixing waitFor với fake timers hay treo).
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Resend the code' }));

    expect(await screen.findByText(messages.authForms.errors.generic)).toBeInTheDocument();
    // Nút "Resend the code" vẫn còn đó — đếm ngược KHÔNG bị reset về 60s sau
    // khi resend lỗi mạng thật.
    expect(screen.getByRole('button', { name: 'Resend the code' })).toBeInTheDocument();
  });

  it('nút resend (sau khi countdown về 0) → gọi sendVerificationOtp đúng type', async () => {
    vi.useFakeTimers();
    sendVerificationOtp.mockResolvedValueOnce({ data: {}, error: null });
    render(<OtpForm {...baseProps} email="minh@example.com" />);

    // Đi từng nhịp 1s (thay vì nhảy 60s một lần) — chuỗi setTimeout đệ quy
    // của countdown chỉ tự tái lập lịch SAU khi effect chạy lại; nhảy cả cục
    // dễ "mất" tick vì các timer nội bộ khác của input-otp chen giữa cùng
    // hàng đợi. Advance lẻ từng giây đảm bảo đủ 61 lần giảm để về 0.
    // `act` bọc từng nhịp — buộc React flush effect (tái lập lịch setTimeout
    // kế tiếp) TRƯỚC khi vòng lặp qua nhịp sau, không thì cứ hai lần advance
    // mới ăn một lần giảm (đo được: thiếu `act` → 61 nhịp chỉ giảm ~30 lần).
    for (let i = 0; i < 61; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Resend the code' })).toBeInTheDocument();

    // Chuyển về real timers trước khi click + waitFor — cùng lý do test OTP
    // sai ở trên (mixing waitFor với fake timers hay treo).
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Resend the code' }));

    await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledTimes(1));
    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: 'minh@example.com',
      type: 'email-verification',
    });
  });
});

describe('OtpForm — verify-email (thiếu email)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('email null → panel hướng dẫn hiện, link /login, KHÔNG gọi client', () => {
    render(<OtpForm {...baseProps} email={null} />);

    expect(screen.getByText(messages.authForms.verifyEmail.noEmail.heading)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Stamp my ticket' })).not.toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(sendVerificationOtp).not.toHaveBeenCalled();
  });
});

describe('OtpForm — two-factor (không truyền prop email, static mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('không truyền email → form tĩnh vẫn render bình thường, submit KHÔNG gọi client', async () => {
    const user = userEvent.setup();
    render(<OtpForm {...baseProps} />);

    expect(
      screen.queryByText(messages.authForms.verifyEmail.noEmail.heading),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stamp my ticket' }));

    expect(verifyEmail).not.toHaveBeenCalled();
  });
});

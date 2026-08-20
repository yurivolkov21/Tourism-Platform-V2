import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailBanner } from './verify-email-banner';

// Banner chỉ dành cho session TÀN DƯ chưa verify (siết 20/08) — mock
// useSession theo từng nhánh.
const { useSession, sendVerificationOtp } = vi.hoisted(() => ({
  useSession: vi.fn(),
  sendVerificationOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { emailOtp: { sendVerificationOtp } },
  useSession,
}));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.clearAllMocks();
  sendVerificationOtp.mockResolvedValue({ data: {}, error: null });
});

describe('VerifyEmailBanner', () => {
  it('không session → không render gì', () => {
    useSession.mockReturnValue({ data: null });
    const { container } = render(<VerifyEmailBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('session đã verify → không render gì (đường đi của mọi account mới)', () => {
    useSession.mockReturnValue({
      data: { user: { email: 'ok@example.com', emailVerified: true } },
    });
    const { container } = render(<VerifyEmailBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('session CŨ chưa verify → hiện dải; bấm → gửi OTP mới + sang /verify-email', async () => {
    useSession.mockReturnValue({
      data: { user: { email: 'old@example.com', emailVerified: false } },
    });
    render(<VerifyEmailBanner />);
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /verify now/i }));
    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: 'old@example.com',
      type: 'email-verification',
    });
    expect(push).toHaveBeenCalledWith('/verify-email?email=old%40example.com');
  });
});

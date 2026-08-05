import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDeleteError } from '@/lib/api/account';
import { DangerZone } from './danger-zone';

/**
 * Gate "gõ đúng chữ DELETE mới bật nút" (spec §3) + hành động xoá THẬT
 * (Task 7/A2 — `DELETE /api/account` → `authClient.signOut()` →
 * `router.push('/')` + toast, xem describe cuối file).
 */

// Mock fetch helper — GIỮ NGUYÊN `AccountDeleteError` thật (importOriginal)
// để `instanceof` trong `danger-zone.tsx` hoạt động đúng với fixture 401.
const { deleteAccount } = vi.hoisted(() => ({ deleteAccount: vi.fn() }));
vi.mock('@/lib/api/account', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/account')>();
  return { ...actual, deleteAccount };
});

// Mock Better Auth client — chỉ cần soi `signOut()` được gọi, không cần BA
// thật (cùng khuôn `user-menu.spec.tsx`).
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }));

// Mock next/navigation — `router.push('/')` sau khi xoá + signOut thành công.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Mock sonner — toast CHỈ cho kết quả THÀNH CÔNG (spec §5).
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

async function openDialogAndUnlock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete account' }));
  await user.type(screen.getByRole('textbox'), 'DELETE');
}

describe('DangerZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mở dialog → nút xác nhận bị khoá (disabled) khi ô gõ còn rỗng', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled();
  });

  it('gõ sai chữ (thường, thiếu ký tự, thừa ký tự) → nút vẫn khoá', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    const input = screen.getByRole('textbox');
    const confirmBtn = screen.getByRole('button', { name: 'Yes, delete my account' });

    await user.type(input, 'delete');
    expect(confirmBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELET');
    expect(confirmBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELETEE');
    expect(confirmBtn).toBeDisabled();
  });

  it('gõ đúng chữ "DELETE" → nút xác nhận bật (không còn disabled)', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    await user.type(screen.getByRole('textbox'), 'DELETE');
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeEnabled();
  });
});

describe('DangerZone — xoá tài khoản thật (Task 7/A2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gõ đúng + bấm xác nhận → deleteAccount() rồi signOut() rồi push("/") + toast', async () => {
    deleteAccount.mockResolvedValueOnce(undefined);
    signOut.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DangerZone />);

    await openDialogAndUnlock(user);
    await user.click(screen.getByRole('button', { name: 'Yes, delete my account' }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/');
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('deleteAccount lỗi chung → message inline, KHÔNG signOut/push, nút hết pending', async () => {
    deleteAccount.mockRejectedValueOnce(new AccountDeleteError(500));
    const user = userEvent.setup();
    render(<DangerZone />);

    await openDialogAndUnlock(user);
    await user.click(screen.getByRole('button', { name: 'Yes, delete my account' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeEnabled();
  });

  it('deleteAccount 401 giữa chừng → message riêng + link /login?redirect=, KHÔNG auto-signout', async () => {
    deleteAccount.mockRejectedValueOnce(new AccountDeleteError(401));
    const user = userEvent.setup();
    render(<DangerZone />);

    await openDialogAndUnlock(user);
    await user.click(screen.getByRole('button', { name: 'Yes, delete my account' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: 'Log in again' });
    expect(loginLink).toHaveAttribute('href', '/login?redirect=/account/profile');
    expect(signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

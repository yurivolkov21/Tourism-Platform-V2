import { createORPCErrorFromJson } from '@orpc/client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetractReviewButton } from './retract-review-button';

const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

const { retract, refresh } = vi.hoisted(() => ({ retract: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api: { reviews: { retract } } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const REVIEW_ID = '22222222-2222-4222-8222-222222222222';
const t = messages.reviews.retract;

beforeEach(() => {
  vi.clearAllMocks();
});

// W4 U2 (ADR-0032 AMEND 1): rút review ĐÃ ĐĂNG — hai bước bấm, câu xác nhận
// nói rõ tính chung cuộc; lỗi định danh 409 đọc theo mã (vòng vá review W4).
describe('RetractReviewButton', () => {
  it('bước 1 chỉ là nút mở — KHÔNG gọi API; bước 2 hiện câu xác nhận không-hoàn-tác + nút Keep', async () => {
    const user = userEvent.setup();
    render(<RetractReviewButton reviewId={REVIEW_ID} />);

    await user.click(screen.getByRole('button', { name: t.button }));

    expect(retract).not.toHaveBeenCalled();
    expect(screen.getByText(t.confirm)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.cancel })).toBeInTheDocument();
  });

  it('Keep my review → đóng khối xác nhận, không gọi API', async () => {
    const user = userEvent.setup();
    render(<RetractReviewButton reviewId={REVIEW_ID} />);
    await user.click(screen.getByRole('button', { name: t.button }));
    await user.click(screen.getByRole('button', { name: t.cancel }));
    expect(screen.queryByText(t.confirm)).toBeNull();
    expect(retract).not.toHaveBeenCalled();
  });

  it('xác nhận → gọi reviews.retract({id}) MỘT lần, toast done, router.refresh() để slot chuyển sang retracted', async () => {
    retract.mockResolvedValueOnce({ id: REVIEW_ID });
    const user = userEvent.setup();
    render(<RetractReviewButton reviewId={REVIEW_ID} />);
    await user.click(screen.getByRole('button', { name: t.button }));
    // Trong khối xác nhận, nút hành động mang CÙNG nhãn `t.button` (đỏ).
    const buttons = screen.getAllByRole('button', { name: t.button });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => expect(retract).toHaveBeenCalledTimes(1));
    expect(retract).toHaveBeenCalledWith({ id: REVIEW_ID });
    expect(success).toHaveBeenCalledWith(t.toast.done.title, { description: t.toast.done.body });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('409 REVIEW_NOT_RETRACTABLE → toast theo MÃ (review không còn đăng), đóng xác nhận, refresh trang', async () => {
    retract.mockRejectedValueOnce(
      createORPCErrorFromJson({
        defined: true,
        code: 'REVIEW_NOT_RETRACTABLE',
        status: 409,
        message: 'Only a published review can be retracted',
        data: null,
      }),
    );
    const user = userEvent.setup();
    render(<RetractReviewButton reviewId={REVIEW_ID} />);
    await user.click(screen.getByRole('button', { name: t.button }));
    const buttons = screen.getAllByRole('button', { name: t.button });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(t.toast.error.title, {
        description: t.errors.REVIEW_NOT_RETRACTABLE,
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t.confirm)).toBeNull();
  });

  it('lỗi mạng/5xx → toast error chung, KHÔNG refresh, đóng xác nhận để bấm lại', async () => {
    retract.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<RetractReviewButton reviewId={REVIEW_ID} />);
    await user.click(screen.getByRole('button', { name: t.button }));
    const buttons = screen.getAllByRole('button', { name: t.button });
    await user.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(t.toast.error.title, { description: t.toast.error.body }),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(t.confirm)).toBeNull();
  });
});

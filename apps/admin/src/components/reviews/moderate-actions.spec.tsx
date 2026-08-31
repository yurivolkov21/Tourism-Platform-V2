import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModerateTarget } from '@/lib/reviews-moderate';
import { ModerateActions } from './moderate-actions';

const t = messages.admin.reviews.moderate;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

// Sau mọi kết cục đã-chạm-server, hàng đợi phải được kéo về tươi (nếp F2/F3).
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const PENDING: ModerateTarget = {
  id: '11111111-1111-4111-8111-111111111111',
  ratingLabel: messages.admin.reviews.list.ratingLabel(5),
  title: 'Trip of a lifetime',
  body: 'The guide knew every cove and the kayaking was the highlight.',
  photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/one.jpg', alt: 'Sunrise' }],
  photosLabel: messages.admin.reviews.list.photos(1),
  authorLabel: 'Ada Lovelace',
  authorDeleted: false,
  source: 'VERIFIED',
  tourTitle: 'Ha Long Bay Cruise',
  approved: false,
};

const APPROVED: ModerateTarget = { ...PENDING, approved: true };

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

/** Mở dialog từ nút của hàng — nhãn nút phụ thuộc trạng thái hiện tại. */
async function open(user: ReturnType<typeof userEvent.setup>, approved: boolean) {
  await user.click(screen.getByRole('button', { name: approved ? t.unapprove : t.approve }));
}

describe('ModerateActions — nút của hàng', () => {
  it('hàng chờ duyệt mang nút Approve; hàng đã duyệt mang nút Unapprove (một nút, đúng chiều còn lại)', () => {
    const { unmount } = render(<ModerateActions review={PENDING} moderate={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.approve })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.unapprove })).not.toBeInTheDocument();
    unmount();

    render(<ModerateActions review={APPROVED} moderate={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.unapprove })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.approve })).not.toBeInTheDocument();
  });

  it('cụm nút có tên riêng theo tác giả — trình đọc màn hình phân biệt được hàng nào', () => {
    render(<ModerateActions review={PENDING} moderate={vi.fn()} />);
    expect(screen.getByRole('group', { name: t.actionsLabel('Ada Lovelace') })).toBeInTheDocument();
  });

  it('mở dialog KHÔNG bắn gì — phải bấm nút xác nhận trong dialog', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn();
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    expect(moderate).not.toHaveBeenCalled();
  });
});

describe('ModerateActions — confirm nêu hệ quả THẬT (spec §3-F4)', () => {
  it('approve nói đủ ba việc: đăng công khai · tính lại rating tour · email cho tác giả', async () => {
    const user = userEvent.setup();
    render(<ModerateActions review={PENDING} moderate={vi.fn()} />);
    await open(user, false);

    expect(await screen.findByText(t.approveDialog.consequences.publish)).toBeInTheDocument();
    expect(
      screen.getByText(t.approveDialog.consequences.rating('Ha Long Bay Cruise')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.consequences.email)).toBeInTheDocument();
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
  });

  it('review CURATED: dialog nói KHÔNG có email nào — không hứa thứ service không làm', async () => {
    const user = userEvent.setup();
    render(<ModerateActions review={{ ...PENDING, source: 'CURATED' }} moderate={vi.fn()} />);
    await open(user, false);

    expect(
      await screen.findByText(t.approveDialog.consequences.noEmailCurated),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.approveDialog.consequences.email)).not.toBeInTheDocument();
  });

  it('review không gắn tour: dialog nói KHÔNG rating nào đổi', async () => {
    const user = userEvent.setup();
    render(<ModerateActions review={{ ...PENDING, tourTitle: null }} moderate={vi.fn()} />);
    await open(user, false);

    expect(await screen.findByText(t.approveDialog.consequences.noRating)).toBeInTheDocument();
  });

  it('unapprove nói gỡ khỏi trang tour + tính lại rating + khách KHÔNG được báo', async () => {
    const user = userEvent.setup();
    render(<ModerateActions review={APPROVED} moderate={vi.fn()} />);
    await open(user, true);

    expect(await screen.findByText(t.unapproveDialog.consequences.hide)).toBeInTheDocument();
    expect(
      screen.getByText(t.unapproveDialog.consequences.rating('Ha Long Bay Cruise')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.unapproveDialog.consequences.noEmail)).toBeInTheDocument();
    expect(screen.queryByText(t.approveDialog.consequences.email)).not.toBeInTheDocument();
  });

  it('dialog mang ĐỦ nội dung để quyết: tác giả, tour, số sao, nguyên văn review, ảnh đính kèm', async () => {
    // Duyệt một review là đăng nó ra site — không được bấm mù rồi mới đọc.
    const user = userEvent.setup();
    render(<ModerateActions review={PENDING} moderate={vi.fn()} />);
    await open(user, false);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Ha Long Bay Cruise')).toBeInTheDocument();
    expect(screen.getByText(messages.admin.reviews.list.ratingLabel(5))).toBeInTheDocument();
    expect(screen.getByText(/kayaking was the highlight/)).toBeInTheDocument();
    expect(screen.getByAltText('Sunrise')).toBeInTheDocument();
  });
});

describe('ModerateActions — chiều lệnh đóng băng lúc mở dialog (review F4 31/08)', () => {
  it('queue refresh làm prop approved lật trong lúc dialog mở → dialog GIỮ chiều Approve', async () => {
    // Khoá chống tái hiện: bản đầu derive `approve` mỗi render — dialog đang
    // mở tự biến thành Unapprove và cú click gửi lệnh ngược ý định.
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: true, approved: true });
    const view = render(<ModerateActions review={PENDING} moderate={moderate} />);
    await user.click(screen.getByRole('button', { name: t.approve }));
    expect(await screen.findByText(t.approveDialog.title)).toBeInTheDocument();

    // Refresh mang bản approved về (admin khác vừa duyệt) — dialog KHÔNG lật.
    view.rerender(<ModerateActions review={APPROVED} moderate={moderate} />);
    expect(screen.getByText(t.approveDialog.title)).toBeInTheDocument();
    expect(screen.queryByText(t.unapproveDialog.title)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.approveDialog.submit }));
    expect(moderate).toHaveBeenCalledWith({ id: PENDING.id, approve: true });
  });
});

describe('ModerateActions — input gửi đi', () => {
  it('approve gửi approve: true, không kèm note khi admin bỏ trống (audit ghi null, không phải chuỗi rỗng)', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: true, approved: true });
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(moderate).toHaveBeenCalledWith({ id: PENDING.id, approve: true });
  });

  it('unapprove gửi approve: false kèm note đã trim — note vào lịch sử moderation', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: true, approved: false });
    render(<ModerateActions review={APPROVED} moderate={moderate} />);
    await open(user, true);
    await user.type(await screen.findByLabelText(t.noteLabel), '  Spam link in the body.  ');
    await user.click(screen.getByRole('button', { name: t.unapproveDialog.submit }));

    expect(moderate).toHaveBeenCalledWith({
      id: PENDING.id,
      approve: false,
      note: 'Spam link in the body.',
    });
  });
});

describe('ModerateActions — kết quả server', () => {
  it('thành công: toast kể đúng chiều vừa chạy + đóng dialog + refresh hàng đợi', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: true, approved: true });
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(success).toHaveBeenCalledWith(t.toast.approvedTitle, {
      description: t.toast.approvedBody('Ada Lovelace'),
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
  });

  it('toast đọc chiều từ RESPONSE, không từ nút đã bấm', async () => {
    // Server là nơi biết cuối cùng review đang ở trạng thái nào — client chỉ kể lại.
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: true, approved: false });
    render(<ModerateActions review={APPROVED} moderate={moderate} />);
    await open(user, true);
    await user.click(await screen.findByRole('button', { name: t.unapproveDialog.submit }));

    expect(success).toHaveBeenCalledWith(t.toast.unapprovedTitle, {
      description: t.toast.unapprovedBody('Ada Lovelace'),
    });
  });

  it('REVIEW_NOT_FOUND (trạng-thái-cũ): đóng + toast đúng câu + refresh — copy hứa thì UI phải làm', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: false, code: 'REVIEW_NOT_FOUND' });
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(t.errors.REVIEW_NOT_FOUND);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });

  it('kết cục KHÔNG RÕ (GENERIC): đóng dialog + toast + refresh — nhìn dữ liệu tươi trước khi thử lại', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: false, code: 'GENERIC' });
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC);
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText(t.approveDialog.warning)).not.toBeInTheDocument();
  });

  it('action NÉM (mạng đứt) đối xử như GENERIC: đóng + toast + refresh', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockRejectedValue(new Error('boom'));
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(errorToast).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('hết phiên (UNAUTHORIZED): dialog Ở LẠI kèm câu đăng nhập lại — ngữ cảnh và note không mất', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockResolvedValue({ ok: false, code: 'UNAUTHORIZED' });
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('đang bắn thì Esc KHÔNG đóng được dialog — lỗi về sau không được phép tàng hình', async () => {
    const user = userEvent.setup();
    let settle: (value: { ok: false; code: 'UNAUTHORIZED' }) => void = () => {};
    const moderate = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve as typeof settle;
        }),
    );
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    await user.click(await screen.findByRole('button', { name: t.approveDialog.submit }));

    await user.keyboard('{Escape}');
    expect(screen.getByText(t.approveDialog.warning)).toBeInTheDocument();

    settle({ ok: false, code: 'UNAUTHORIZED' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.errors.write.UNAUTHORIZED,
    );
  });

  it('bấm hai lần liên tiếp chỉ bắn MỘT lệnh', async () => {
    const user = userEvent.setup();
    const moderate = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<ModerateActions review={PENDING} moderate={moderate} />);
    await open(user, false);
    const submit = await screen.findByRole('button', { name: t.approveDialog.submit });
    await user.click(submit);
    await user.click(submit);

    expect(moderate).toHaveBeenCalledTimes(1);
  });
});

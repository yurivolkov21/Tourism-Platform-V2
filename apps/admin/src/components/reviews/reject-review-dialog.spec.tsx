import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REJECT_DETAIL_MAX, REJECT_REASONS } from '@/lib/reject-reasons';
import type { ModerateTarget } from '@/lib/reviews-moderate';
import { ModerateActions } from './moderate-actions';

/**
 * Dialog bác review (ADR-0031 AMEND 1): lý do chọn từ danh sách bên trái chứ không
 * gõ tay — câu chuẩn KHOÁ, khách đọc nguyên văn; admin chỉ thêm một câu chi tiết.
 * Câu mở, hệ quả và câu cuối nói theo LẦN BÁC: lần đầu tác giả còn sửa được.
 */
const t = messages.admin.reviews.moderate;
const picker = t.reasonPicker;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

const PENDING: ModerateTarget = {
  id: '11111111-1111-4111-8111-111111111111',
  ratingLabel: messages.admin.reviews.list.ratingLabel(4),
  title: 'Golden Bridge',
  body: 'The cable car ride up is one of the longest I have done.',
  photos: [],
  photosLabel: null,
  authorLabel: 'Ashley Reyes',
  authorDeleted: false,
  source: 'VERIFIED',
  tourTitle: 'Ba Na Hills & Golden Bridge Day Trip',
  approved: false,
  state: 'pending',
  rejectionCount: 0,
};

const reason = (key: string) => {
  const found = REJECT_REASONS.find((entry) => entry.key === key);
  if (!found) throw new Error(`Không có lý do ${key}`);
  return found;
};

/**
 * Nút chọn của một lý do. Khớp theo CẢ tên lẫn câu khách đọc: tên "Other" trùng
 * phần đầu với "Other people in photos", nên khớp riêng tên là bắt nhầm.
 */
const radioOf = (key: string) => {
  const entry = reason(key);
  return screen.getByRole('radio', {
    name: (name) => name.includes(entry.label) && name.includes(entry.text),
  });
};

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

async function openReject(review: ModerateTarget, moderate = vi.fn()) {
  const user = userEvent.setup();
  render(<ModerateActions review={review} moderate={moderate} />);
  await user.click(screen.getByRole('button', { name: t.reject }));
  return { user, moderate, dialog: screen.getByRole('dialog') };
}

/** Ô "Why it was rejected" — câu khách sẽ đọc, KHÔNG phải ô nhập. */
const whyBox = () => screen.getByRole('status', { name: t.reasonLabel });

describe('RejectReviewDialog — chọn lý do', () => {
  it('cột trái có ô tìm và đủ danh sách lý do; chưa chọn thì ô Why nhắc chọn', async () => {
    await openReject(PENDING);

    expect(screen.getByRole('searchbox', { name: picker.searchLabel })).toBeInTheDocument();
    const list = screen.getByRole('radiogroup', { name: picker.label });
    expect(within(list).getAllByRole('radio')).toHaveLength(REJECT_REASONS.length);
    expect(whyBox()).toHaveTextContent(t.reasonEmpty);
  });

  it('bấm một lý do → ô Why hiện NGUYÊN VĂN câu chuẩn, và nó không phải ô gõ được', async () => {
    const { user } = await openReject(PENDING);

    await user.click(radioOf('offensive'));

    expect(whyBox()).toHaveTextContent(reason('offensive').text);
    // Câu chuẩn khoá: ô gõ DUY NHẤT là ô chi tiết (và ô tìm).
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: t.detailLabel })).toBeInTheDocument();
  });

  it('ô tìm lọc theo cả tên lẫn câu; không khớp gì thì nói ra', async () => {
    const { user } = await openReject(PENDING);
    const search = screen.getByRole('searchbox', { name: picker.searchLabel });

    await user.type(search, 'refund');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(radioOf('bookingIssue')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText(picker.noMatch)).toBeInTheDocument();
  });

  it('ô chi tiết có trần để note ghép luôn vừa trần của contract', async () => {
    await openReject(PENDING);
    expect(screen.getByRole('textbox', { name: t.detailLabel })).toHaveAttribute(
      'maxlength',
      String(REJECT_DETAIL_MAX),
    );
  });
});

describe('RejectReviewDialog — gửi đi', () => {
  it('note = câu chuẩn nguyên văn + chi tiết đã trim; toast kể kết cục server trả', async () => {
    const moderate = vi.fn().mockResolvedValue({ ok: true, state: 'rejected' });
    const { user } = await openReject(PENDING, moderate);

    await user.click(radioOf('peopleInPhotos'));
    await user.type(screen.getByRole('textbox', { name: t.detailLabel }), '  The second photo.  ');
    await user.click(screen.getByRole('button', { name: t.rejectDialog.submit }));

    expect(moderate).toHaveBeenCalledWith({
      id: PENDING.id,
      verdict: 'reject',
      note: `${reason('peopleInPhotos').text} The second photo.`,
    });
    expect(success).toHaveBeenCalledWith(t.toast.rejectedTitle, {
      description: t.toast.rejectedBody(PENDING.authorLabel),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('chưa chọn lý do mà bấm Reject → KHÔNG bắn, báo phải chọn', async () => {
    const { user, moderate } = await openReject(PENDING);

    await user.click(screen.getByRole('button', { name: t.rejectDialog.submit }));

    expect(moderate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.reasonMissing);
  });

  it('"Other": nhãn ô chi tiết thành bắt buộc; bỏ trống thì KHÔNG bắn', async () => {
    const { user, moderate } = await openReject(PENDING);

    await user.click(radioOf('other'));
    const detail = screen.getByRole('textbox', { name: t.detailLabelRequired });
    await user.type(detail, '   ');
    await user.click(screen.getByRole('button', { name: t.rejectDialog.submit }));

    expect(moderate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.detailMissing);
    expect(detail).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('RejectReviewDialog — nói theo lần bác', () => {
  it('lần bác đầu: câu mở và câu cuối nói tác giả còn sửa được; câu cuối KHÔNG tô đỏ', async () => {
    const { dialog } = await openReject(PENDING);

    expect(dialog).toHaveTextContent(t.rejectDialog.body.editable);
    expect(dialog).toHaveTextContent(t.rejectDialog.consequences.queue.editable);
    expect(dialog).toHaveTextContent(t.rejectDialog.consequences.email.editable);
    expect(screen.getByText(t.rejectDialog.warning.editable)).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    // Review đang chờ vốn không ở trên site — không hứa gỡ khỏi trang tour.
    expect(dialog).not.toHaveTextContent(t.rejectDialog.consequences.hide);
  });

  it('lần bác thứ hai: chung cuộc, cảnh báo đỏ, không còn câu nào hứa đường sửa', async () => {
    const { dialog } = await openReject({ ...PENDING, rejectionCount: 1 });

    expect(dialog).toHaveTextContent(t.rejectDialog.body.final);
    expect(dialog).toHaveTextContent(t.rejectDialog.consequences.email.final);
    expect(screen.getByText(t.rejectDialog.warning.final)).toHaveAttribute(
      'data-tone',
      'destructive',
    );
    expect(dialog).not.toHaveTextContent(t.rejectDialog.body.editable);
  });

  it('review ĐANG hiện, lần chung cuộc → nhắc Unpublish là đường lùi', async () => {
    await openReject({ ...PENDING, approved: true, state: 'approved', rejectionCount: 1 });
    expect(screen.getByText(t.rejectDialog.warning.finalLive)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { ReviewRowVM } from '@/lib/reviews-view';
import { ReviewDetailsDialog } from './review-details-dialog';

const t = messages.admin.reviews;

/**
 * Dialog CHỈ ĐỌC (vòng chỉnh 05/09). Trước nó, cửa duy nhất để đọc trọn một
 * review là dialog xác nhận Approve — muốn đọc thì phải mở một hành động GHI
 * rồi bấm huỷ. Test ở đây canh đúng hai thứ: đọc được ĐỦ, và KHÔNG ghi được.
 */

/** Body dài hơn hai dòng bảng cắt được, và CÓ xuống dòng để kiểm giữ nguyên văn. */
const BODY = 'Dòng đầu tiên của khách.\n\nDòng thứ hai sau một dòng trắng.';

function rowFor(overrides: Partial<ReviewRowVM> = {}): ReviewRowVM {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    rating: 4,
    ratingLabel: t.list.ratingLabel(4),
    title: 'Trip of a lifetime',
    body: BODY,
    photos: [
      {
        thumb:
          'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_128,h_128,c_fill/a.jpg',
        large: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/a.jpg',
        alt: 'Sunrise over the bay',
      },
    ],
    photosLabel: t.list.photos(1),
    authorLabel: 'Ada Lovelace',
    authorDeleted: false,
    source: 'VERIFIED',
    sourceLabel: t.source.VERIFIED,
    tourTitle: 'Ha Long Bay Cruise',
    approved: false,
    state: 'pending',
    moderationNote: null,
    stateLabel: t.state.pending,
    submitted: '4 Sep 2026, 12:15 UTC',
    moderated: null,
    moderatedBy: null,
    ...overrides,
  };
}

async function openDialog(overrides: Partial<ReviewRowVM> = {}) {
  const user = userEvent.setup();
  const row = rowFor(overrides);
  render(<ReviewDetailsDialog row={row} />);
  await user.click(screen.getByRole('button', { name: t.details.open(row.authorLabel) }));
  return user;
}

describe('ReviewDetailsDialog', () => {
  it('nút mở LÀ chính đoạn chữ đang đọc dở, và có tên cho trình đọc màn hình', () => {
    // Không phải một icon "xem" riêng: thứ người ta muốn bấm là đoạn chữ.
    render(<ReviewDetailsDialog row={rowFor()} />);
    const trigger = screen.getByRole('button', { name: t.details.open('Ada Lovelace') });

    expect(trigger).toHaveTextContent('Trip of a lifetime');
  });

  it('chưa bấm thì KHÔNG mount dialog — trang 50 hàng không dựng 50 cây', () => {
    render(<ReviewDetailsDialog row={rowFor()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mở ra là đọc được NGUYÊN VĂN, giữ cả chỗ xuống dòng', async () => {
    // Bảng cắt còn hai dòng; nếu dialog cũng cắt thì nó chẳng giải quyết gì.
    await openDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Dòng đầu tiên của khách.');
    expect(dialog).toHaveTextContent('Dòng thứ hai sau một dòng trắng.');
  });

  it('nói rõ AI viết và LÚC NÀO', async () => {
    await openDialog();

    expect(screen.getByRole('dialog')).toHaveTextContent(
      t.details.subtitle('Ada Lovelace', '4 Sep 2026, 12:15 UTC'),
    );
  });

  it('ảnh dùng bản ĐỌC ĐƯỢC, không phải thumbnail của bảng', async () => {
    // `c_fill` vuông có thể xén mất đúng thứ khách đang phàn nàn — ảnh review
    // là bằng chứng, nên dialog phải lấy bản `c_limit`.
    await openDialog();

    const photo = screen.getByRole('img', { name: 'Sunrise over the bay' });
    expect(photo).toHaveAttribute('src', expect.stringContaining('c_limit'));
    expect(photo.getAttribute('src')).not.toContain('c_fill');
  });

  it('review KHÔNG có tiêu đề: nói ra thay vì chừa khoảng trống', async () => {
    await openDialog({ title: null });

    expect(screen.getByRole('dialog')).toHaveTextContent(t.details.noTitle);
  });

  it('không có ảnh thì KHÔNG in tiêu đề mục ảnh', async () => {
    await openDialog({ photos: [], photosLabel: null });

    expect(screen.queryByText(t.details.photosHeading)).toBeNull();
  });

  it('chưa ai duyệt: nói thẳng, không để ô trống', async () => {
    await openDialog();

    expect(screen.getByRole('dialog')).toHaveTextContent(t.list.neverModerated);
  });

  it('đã duyệt: in cả mốc thời gian lẫn người duyệt', async () => {
    await openDialog({
      approved: true,
      state: 'approved',
      stateLabel: t.state.approved,
      moderated: t.list.moderated('5 Sep 2026, 09:00 UTC'),
      moderatedBy: t.list.moderatedBy('Admin Nexora'),
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('5 Sep 2026, 09:00 UTC');
    expect(dialog).toHaveTextContent('Admin Nexora');
  });

  it('mất tên người duyệt vẫn giữ mốc thời gian', async () => {
    // `moderatedBy` là FK SetNull: admin cũ bị xoá thì tên biến mất, nhưng
    // "đã có người quyết, lúc này" vẫn là sự thật phải kể.
    await openDialog({ moderated: t.list.moderated('5 Sep 2026, 09:00 UTC'), moderatedBy: null });

    expect(screen.getByRole('dialog')).toHaveTextContent('5 Sep 2026, 09:00 UTC');
    expect(screen.queryByText(t.list.neverModerated)).toBeNull();
  });

  it('CHỈ ĐỌC: không có nút duyệt hay gỡ duyệt nào trong dialog', async () => {
    // Trộn đọc với ghi là dựng lại đúng vấn đề vừa gỡ, chỉ theo chiều ngược.
    await openDialog();

    const dialog = screen.getByRole('dialog');
    const labels = ['button']
      .flatMap(() => Array.from(dialog.querySelectorAll('button')))
      .map((button) => button.textContent);
    expect(labels).not.toContain(t.moderate.approve);
    expect(labels).not.toContain(t.moderate.unpublish);
  });

  it('review bị bác hiện LÝ DO — thứ audit trail vẫn ghi mà chưa ai từng đọc', async () => {
    // Cùng câu khách nhận trong email (ADR-0031 §6), nên người duyệt sau đọc
    // hồ sơ thấy chính xác thứ khách đã đọc.
    await openDialog({
      state: 'rejected',
      stateLabel: t.state.rejected,
      moderationNote: 'Nội dung không nói về chuyến đi.',
      moderated: t.list.moderated('5 Sep 2026, 09:00 UTC'),
    });

    expect(screen.getByRole('dialog')).toHaveTextContent('Nội dung không nói về chuyến đi.');
  });

  it('review chưa bị bác thì KHÔNG có dòng lý do, dù ghi chú duyệt có tồn tại', async () => {
    // `note` của một lần duyệt là ghi chú NỘI BỘ ("the author never sees it"),
    // in nó dưới nhãn "vì sao bị bác" là nói sai cả hai chuyện.
    await openDialog({ state: 'approved', moderationNote: 'Ghi chú nội bộ.' });

    expect(screen.queryByText(t.moderate.reasonLabel)).toBeNull();
  });

  it('đóng lại được, và đóng rồi thì dialog biến mất', async () => {
    const user = await openDialog();
    await user.click(screen.getByRole('button', { name: t.details.close }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toQueueRowVM } from '@/lib/media-view';
import { mediaQueue, queueRow } from '@/test/media';
import { MediaQueueTab } from './media-queue';

/**
 * Tab Cleanup queue (spec P4f Media §6.3): tóm tắt dọn bật hay tắt, bảng chỉ đọc, avatar không lộ
 * ảnh khách, không một nút nào.
 */
const q = messages.admin.media.queue;

const ROWS = [
  queueRow(),
  queueRow({
    publicId: 'tourism/avatars/00000000-0000-4000-8000-0000000000aa/file',
    url: null,
    zone: 'AVATAR',
    ownerLabel: null,
    ownerSlug: null,
  }),
  queueRow({
    publicId: 'tourism/catalog/site/about-cta',
    zone: null,
    state: 'REFUSED',
    dueAt: null,
  }),
];

function renderQueue(queue = mediaQueue({ rows: ROWS })) {
  render(<MediaQueueTab queue={queue} rows={queue.rows.map(toQueueRowVM)} />);
}

describe('MediaQueueTab', () => {
  it('tóm tắt: dọn đang bật và lượt dọn gần nhất', () => {
    renderQueue();
    expect(screen.getByText(q.on(7))).toBeInTheDocument();
    expect(screen.getByText(q.lastDone('19 Oct 2026, 00:00 UTC', 3, 3, 0))).toBeInTheDocument();
  });

  it('môi trường tắt GC nói thẳng không xoá gì', () => {
    renderQueue(mediaQueue({ gcEnabled: false, lastSweep: null, rows: ROWS }));
    expect(screen.getByText(q.off)).toBeInTheDocument();
    expect(screen.getByText(q.lastNone)).toBeInTheDocument();
  });

  it('mỗi dòng: loại, chủ (link khi còn), trạng thái; avatar là biểu tượng; không nút nào', () => {
    renderQueue();
    const table = screen.getByRole('table', { name: q.caption });
    const [, tour, avatar, refused] = within(table).getAllByRole('row');
    expect(
      within(tour as HTMLElement).getByRole('link', { name: 'Hoi An by night' }),
    ).toHaveAttribute('href', '/tours/hoi-an-by-night/photos');
    expect(tour).toHaveTextContent('Deleted after 21 Oct 2026, 07:47 UTC');
    expect(within(avatar as HTMLElement).queryByRole('img')).not.toBeInTheDocument();
    expect(avatar).toHaveTextContent(q.zone.AVATAR);
    expect(avatar).toHaveTextContent(q.avatarOwner);
    expect(refused).toHaveTextContent(q.outsideZone);
    expect(refused).toHaveTextContent(q.state.REFUSED);
    expect(within(table).queryByRole('button')).not.toBeInTheDocument();
  });

  it('hàng rỗng: một câu thay bảng', () => {
    renderQueue(mediaQueue({ rows: [] }));
    expect(screen.getByText(q.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

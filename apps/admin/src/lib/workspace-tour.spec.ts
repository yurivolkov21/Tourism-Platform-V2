import { ORPCError } from '@orpc/client';
import { describe, expect, it } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { settleWorkspaceTour } from './workspace-tour';

/**
 * Layout khu làm việc tour đọc tour cho phần đầu (vòng review F17). Tab
 * Departures (F12, đang vận hành) tự đọc dữ liệu của nó, nên lượt đọc của phần
 * đầu hỏng — vd khe deploy: admin lên trước API, route `GET tours/{slug}` chưa
 * có — thì tab ấy vẫn phải sống; chỉ phần đầu vắng mặt.
 */
describe('settleWorkspaceTour', () => {
  it('có tour → found', async () => {
    const detail = detailFixture();
    await expect(settleWorkspaceTour(Promise.resolve(detail))).resolves.toEqual({
      kind: 'found',
      detail,
    });
  });

  it('không có tour (null) → missing — layout gọi notFound()', async () => {
    await expect(settleWorkspaceTour(Promise.resolve(null))).resolves.toEqual({ kind: 'missing' });
  });

  it('lượt đọc ném (API lỗi, route chưa deploy) → unavailable, không ném tiếp', async () => {
    await expect(settleWorkspaceTour(Promise.reject(new ORPCError('NOT_FOUND')))).resolves.toEqual({
      kind: 'unavailable',
    });
    await expect(settleWorkspaceTour(Promise.reject(new Error('boom')))).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});

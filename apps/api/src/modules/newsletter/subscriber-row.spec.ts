import { SubscriberRowSchema } from '@tourism/contract';
import { LIST_SELECT, type SubscriberListRow, toSubscriberRow } from './subscriber-row.js';

/**
 * Mapper hàng subscriber (spec P4c §3-F10) — THUẦN, không cần DB.
 *
 * Ba thứ đáng pin: hai mốc ra ISO UTC, `source`/`unsubscribedAt` null đi
 * thẳng qua (null là câu trả lời PHỔ BIẾN ở cột `source` — form footer không
 * gửi nó), và `select` chở ĐÚNG năm cột — không kéo `updatedAt` xuống bảng.
 */

const row: SubscriberListRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: 'footer',
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  unsubscribedAt: new Date('2026-09-02T08:30:00.000Z'),
};

describe('toSubscriberRow', () => {
  it('hai mốc ra chuỗi ISO UTC, hợp lệ với contract', () => {
    const mapped = toSubscriberRow(row);
    expect(mapped).toEqual({
      id: row.id,
      email: 'ada@example.com',
      source: 'footer',
      createdAt: '2026-09-01T10:00:00.000Z',
      unsubscribedAt: '2026-09-02T08:30:00.000Z',
    });
    expect(SubscriberRowSchema.parse(mapped)).toEqual(mapped);
  });

  it('`unsubscribedAt` null (còn nhận tin) đi thẳng qua, không thành chuỗi', () => {
    expect(toSubscriberRow({ ...row, unsubscribedAt: null }).unsubscribedAt).toBeNull();
  });

  it('`source` null — form footer của web không gửi nguồn nào', () => {
    expect(toSubscriberRow({ ...row, source: null }).source).toBeNull();
  });
});

describe('LIST_SELECT', () => {
  it('chở ĐÚNG năm cột của contract — không có `updatedAt`', () => {
    expect(Object.keys(LIST_SELECT).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'source',
      'unsubscribedAt',
    ]);
  });
});

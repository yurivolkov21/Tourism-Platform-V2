import { pruneRemovedIds } from './removed-ids';

describe('pruneRemovedIds', () => {
  it('id đã vắng khỏi danh sách server thì bỏ khỏi tập ẩn', () => {
    const removed = new Set(['t1', 't2']);

    const next = pruneRemovedIds(removed, [{ tourId: 't2' }, { tourId: 't3' }]);

    expect([...next]).toEqual(['t2']);
  });

  // F4 (review 06/10): bỏ lưu xong, list refetch không còn t1 → t1 phải rời
  // tập ẩn; lưu lại ở tour detail → list có t1 trở lại → PHẢI hiện.
  it('bỏ lưu rồi lưu lại: lần refetch thứ hai hiện lại tour', () => {
    const afterRemove = pruneRemovedIds(new Set(['t1']), [{ tourId: 't2' }]);
    expect(afterRemove.size).toBe(0);

    const afterResave = pruneRemovedIds(afterRemove, [{ tourId: 't1' }, { tourId: 't2' }]);
    expect(afterResave.has('t1')).toBe(false);
  });

  it('server còn trả id (mutation chưa xong) thì vẫn giữ ẩn', () => {
    const removed = new Set(['t1']);

    expect(pruneRemovedIds(removed, [{ tourId: 't1' }]).has('t1')).toBe(true);
  });

  it('không có gì để dọn thì trả lại CHÍNH tập cũ (không gây render thừa)', () => {
    const removed = new Set(['t1']);

    expect(pruneRemovedIds(removed, [{ tourId: 't1' }])).toBe(removed);
  });
});

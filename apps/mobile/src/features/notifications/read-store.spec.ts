import { parseReadIds, serializeReadIds } from './read-store';

describe('parseReadIds', () => {
  it('đọc mảng chuỗi JSON thành tập', () => {
    expect(parseReadIds('["a","b"]')).toEqual(new Set(['a', 'b']));
  });

  it('thiếu, rỗng, hỏng hoặc không phải mảng → tập rỗng, không ném', () => {
    expect(parseReadIds(null)).toEqual(new Set());
    expect(parseReadIds('')).toEqual(new Set());
    expect(parseReadIds('{not json')).toEqual(new Set());
    expect(parseReadIds('{"a":1}')).toEqual(new Set());
  });

  it('bỏ phần tử không phải chuỗi', () => {
    expect(parseReadIds('["a",1,null,"b"]')).toEqual(new Set(['a', 'b']));
  });
});

describe('serializeReadIds', () => {
  it('ghi qua rồi đọc lại ra đúng tập', () => {
    const ids = new Set(['x', 'y']);
    expect(parseReadIds(serializeReadIds(ids))).toEqual(ids);
  });

  it('chỉ giữ 300 id mới nhất để khoá không phình mãi', () => {
    const ids = new Set(Array.from({ length: 350 }, (_, i) => `id-${i}`));
    const back = parseReadIds(serializeReadIds(ids));
    expect(back.size).toBe(300);
    expect(back.has('id-0')).toBe(false);
    expect(back.has('id-349')).toBe(true);
  });
});

import { toggleWishedId } from './wishlist';

describe('toggleWishedId', () => {
  it('chưa có: thêm vào', () => {
    const result = toggleWishedId(new Set(), 'a');
    expect(result.has('a')).toBe(true);
  });

  it('đã có: bỏ ra', () => {
    const result = toggleWishedId(new Set(['a']), 'a');
    expect(result.has('a')).toBe(false);
  });

  it('không sửa tập cũ (bất biến)', () => {
    const original = new Set(['a']);
    toggleWishedId(original, 'b');
    expect(original.has('b')).toBe(false);
  });
});

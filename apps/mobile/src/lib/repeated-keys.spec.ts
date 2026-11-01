import { repeatedKeys } from './repeated-keys';

describe('repeatedKeys', () => {
  it('chỉ trả khoá lặp lại', () => {
    expect(repeatedKeys(['a', 'b', 'a', 'c', 'a'], (x) => x)).toEqual(new Set(['a']));
  });

  it('không lặp → rỗng', () => {
    expect(repeatedKeys(['a', 'b'], (x) => x).size).toBe(0);
  });
});

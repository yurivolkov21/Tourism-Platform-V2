import { escapeLike } from './like.js';

describe('escapeLike', () => {
  it('che %, _ và \\ để chúng khớp NGUYÊN VĂN thay vì làm wildcard', () => {
    expect(escapeLike('john_doe')).toBe('john\\_doe');
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    // `\` nhân đôi TRƯỚC, nên `\%` gõ tay thành `\\\%` (dấu chéo thật + % thật).
    expect(escapeLike('\\%')).toBe('\\\\\\%');
  });

  it('chuỗi không có ký tự đặc biệt đi qua nguyên vẹn', () => {
    expect(escapeLike('ada@example.com')).toBe('ada@example.com');
    expect(escapeLike('')).toBe('');
  });
});

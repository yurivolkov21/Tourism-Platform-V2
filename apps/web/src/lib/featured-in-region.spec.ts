import { describe, expect, it } from 'vitest';
import { featuredInRegion } from './regions';

// Fixture tối giản — chỉ cần 2 field hàm dùng.
const d = (name: string, tourCount: number) => ({ name, tourCount });

describe('featuredInRegion', () => {
  it('chọn top theo tourCount giảm dần, cap đúng count', () => {
    const input = [d('E', 1), d('A', 5), d('C', 3), d('B', 4), d('D', 2), d('F', 1), d('G', 6)];
    expect(featuredInRegion(input, 6).map((x) => x.name)).toEqual(['G', 'A', 'B', 'C', 'D', 'E']);
  });

  it('tie-break theo name tăng dần (ổn định, không phụ thuộc thứ tự gặp)', () => {
    const input = [d('Sa Pa', 2), d('Cát Bà', 2), d('Hà Giang', 2)];
    expect(featuredInRegion(input, 2).map((x) => x.name)).toEqual(['Cát Bà', 'Hà Giang']);
  });

  it('count lớn hơn độ dài → trả hết, không ném lỗi; không sửa mảng gốc', () => {
    const input = [d('A', 1), d('B', 2)];
    const snapshot = [...input];
    expect(featuredInRegion(input, 6)).toHaveLength(2);
    expect(input).toEqual(snapshot);
  });

  it('mặc định count = 4 (user chốt 3-4 địa danh chính)', () => {
    const input = Array.from({ length: 9 }, (_, i) => d(`D${i}`, i));
    expect(featuredInRegion(input)).toHaveLength(4);
  });
});

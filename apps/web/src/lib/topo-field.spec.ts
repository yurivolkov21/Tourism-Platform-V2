import { describe, expect, it } from 'vitest';
import { createNoiseField, marchingSquares, sampleField } from './topo-field.js';

describe('createNoiseField', () => {
  it('cùng seed cho cùng trường (vân không nhảy mỗi lần tải)', () => {
    expect(Array.from(createNoiseField(11, 8, 4).values)).toEqual(
      Array.from(createNoiseField(11, 8, 4).values),
    );
  });

  it('seed khác cho trường khác', () => {
    expect(Array.from(createNoiseField(11, 8, 4).values)).not.toEqual(
      Array.from(createNoiseField(12, 8, 4).values),
    );
  });

  it('mọi giá trị nằm trong [0,1) và đủ số ô', () => {
    const field = createNoiseField(3, 6, 5);
    expect(field.values).toHaveLength(30);
    expect(field.values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('sampleField', () => {
  const field = createNoiseField(7, 8, 6);

  it('tại đúng nút lưới thì trả giá trị của nút đó', () => {
    expect(sampleField(field, 3, 2)).toBeCloseTo(field.values[2 * 8 + 3] ?? 0, 5);
  });

  it('quấn vòng theo trục x — mẫu tại cols trùng mẫu tại 0', () => {
    expect(sampleField(field, 8, 2)).toBeCloseTo(sampleField(field, 0, 2), 5);
  });

  it('kẹp theo trục y thay vì đọc ra ngoài mảng', () => {
    expect(Number.isFinite(sampleField(field, 2, 99))).toBe(true);
    expect(Number.isFinite(sampleField(field, 2, -5))).toBe(true);
  });

  it('giá trị nội suy nằm giữa hai nút kề', () => {
    const left = sampleField(field, 1, 1);
    const right = sampleField(field, 2, 1);
    const mid = sampleField(field, 1.5, 1);
    expect(mid).toBeGreaterThanOrEqual(Math.min(left, right));
    expect(mid).toBeLessThanOrEqual(Math.max(left, right));
  });
});

describe('marchingSquares', () => {
  it('trường phẳng không cắt mức nào thì không sinh đoạn nào', () => {
    const flat = new Float32Array([0.2, 0.2, 0.2, 0.2]);
    expect(marchingSquares(flat, 2, 2, 0.5)).toEqual([]);
  });

  it('một góc vượt mức thì sinh đúng một đoạn cắt góc đó', () => {
    // Góc trên-trái = 1, còn lại 0 → ca 8: đoạn nối cạnh trên với cạnh trái.
    const grid = new Float32Array([1, 0, 0, 0]);
    const segments = marchingSquares(grid, 2, 2, 0.5);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ x1: 0.5, y1: 0, x2: 0, y2: 0.5 });
  });

  it('nửa trên vượt mức thì đường cắt chạy ngang qua ô', () => {
    // a,b = 1 ; c,d = 0 → ca 12: nối cạnh trái sang cạnh phải.
    const grid = new Float32Array([1, 1, 0, 0]);
    expect(marchingSquares(grid, 2, 2, 0.5)).toEqual([{ x1: 0, y1: 0.5, x2: 1, y2: 0.5 }]);
  });

  it('ca yên ngựa sinh hai đoạn', () => {
    // Mảng xếp theo hàng: hàng 0 = [a, b], hàng 1 = [d, c]. Muốn hai góc ĐỐI
    // nhau vượt mức (a và c) thì phải là [1,0, 0,1] → ca 10.
    const grid = new Float32Array([1, 0, 0, 1]);
    expect(marchingSquares(grid, 2, 2, 0.5)).toHaveLength(2);
  });

  it('mức càng cao càng ít đoạn trên cùng một trường', () => {
    const field = createNoiseField(5, 24, 16);
    const low = marchingSquares(field.values, 24, 16, 0.2).length;
    const high = marchingSquares(field.values, 24, 16, 0.9).length;
    expect(low).toBeGreaterThan(high);
  });
});

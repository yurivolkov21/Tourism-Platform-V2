// Sinh vân đường đồng mức bằng thuật toán — CÙNG HỌ với script đã sinh
// topo-wide.svg tĩnh: value-noise cho trường độ cao, marching squares cắt
// trường đó thành các đường iso. Tách riêng khỏi canvas để test được bằng
// Vitest (không cần DOM) và để component chỉ còn việc vẽ.

/** Trường độ cao: lưới `cols × rows` giá trị trong [0,1], lặp lại được theo trục x. */
export type NoiseField = {
  cols: number;
  rows: number;
  values: Float32Array;
};

/** PRNG mulberry32 — cùng seed cho cùng vân, để vân không nhảy mỗi lần tải trang. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Làm mượt kiểu smoothstep — nội suy tuyến tính để lộ hình vuông của lưới. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Dựng trường noise ngẫu nhiên tất định từ seed. */
export function createNoiseField(seed: number, cols: number, rows: number): NoiseField {
  const random = mulberry32(seed);
  const values = new Float32Array(cols * rows);
  for (let i = 0; i < values.length; i++) values[i] = random();
  return { cols, rows, values };
}

/**
 * Lấy mẫu trường tại toạ độ thực (x, y) với nội suy song tuyến tính đã làm mượt.
 * Trục x quấn vòng (wrap) nên khi trôi ngang, vân chạy liên tục không có mối nối.
 */
export function sampleField(field: NoiseField, x: number, y: number): number {
  const { cols, rows, values } = field;
  const cy = Math.max(0, Math.min(rows - 1.001, y));

  const x0 = Math.floor(x);
  const y0 = Math.floor(cy);
  const tx = smooth(x - x0);
  const ty = smooth(cy - y0);

  const xa = ((x0 % cols) + cols) % cols;
  const xb = (xa + 1) % cols;
  const ya = y0;
  const yb = Math.min(y0 + 1, rows - 1);

  const v00 = values[ya * cols + xa] ?? 0;
  const v10 = values[ya * cols + xb] ?? 0;
  const v01 = values[yb * cols + xa] ?? 0;
  const v11 = values[yb * cols + xb] ?? 0;

  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;
  return top + (bottom - top) * ty;
}

/** Một đoạn thẳng của đường đồng mức, toạ độ tính theo ô lưới. */
export type Segment = { x1: number; y1: number; x2: number; y2: number };

/** Nội suy vị trí cắt mức trên một cạnh giữa hai giá trị góc. */
function cut(v0: number, v1: number, level: number): number {
  const d = v1 - v0;
  return d === 0 ? 0.5 : Math.max(0, Math.min(1, (level - v0) / d));
}

/**
 * Marching squares: cắt lưới giá trị `grid` (cols × rows) tại một mức `level`,
 * trả về các đoạn thẳng tạo thành đường đồng mức. Hai ca yên ngựa (5 và 10)
 * giải theo một hướng cố định — với vân trang trí thì chọn hướng nào cũng được,
 * miễn nhất quán để đường không nhấp nháy giữa các khung hình.
 */
export function marchingSquares(
  grid: Float32Array,
  cols: number,
  rows: number,
  level: number,
): Segment[] {
  const segments: Segment[] = [];
  const at = (col: number, row: number) => grid[row * cols + col] ?? 0;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const a = at(col, row);
      const b = at(col + 1, row);
      const c = at(col + 1, row + 1);
      const d = at(col, row + 1);

      const index =
        (a > level ? 8 : 0) + (b > level ? 4 : 0) + (c > level ? 2 : 0) + (d > level ? 1 : 0);
      if (index === 0 || index === 15) continue;

      const top = { x: col + cut(a, b, level), y: row };
      const right = { x: col + 1, y: row + cut(b, c, level) };
      const bottom = { x: col + cut(d, c, level), y: row + 1 };
      const left = { x: col, y: row + cut(a, d, level) };

      const push = (p: { x: number; y: number }, q: { x: number; y: number }) =>
        segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });

      switch (index) {
        case 1:
        case 14:
          push(left, bottom);
          break;
        case 2:
        case 13:
          push(bottom, right);
          break;
        case 3:
        case 12:
          push(left, right);
          break;
        case 4:
        case 11:
          push(top, right);
          break;
        case 6:
        case 9:
          push(top, bottom);
          break;
        case 7:
        case 8:
          push(top, left);
          break;
        case 5:
          push(top, left);
          push(bottom, right);
          break;
        case 10:
          push(top, right);
          push(left, bottom);
          break;
      }
    }
  }

  return segments;
}

/// <reference types="node" />
// Spec này chạy phía Node (đọc file nguồn) nên cần type của Node — khai
// TẠI ĐÂY thay vì mở `types: ["node"]` cho cả package: component RN không
// được phép thấy API Node.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Canh luật tokens-only (CLAUDE.md #6, ADR-0040 §3) BẰNG MÁY. Luật nào người
 * hay quên thì để máy nhớ — cùng tinh thần `scripts/check-admin-prerender.mjs`.
 *
 * Chỉ quét file nguồn (bỏ `*.spec.*`): spec được phép nhắc hex vì nó ĐỐI CHIẾU
 * với giá trị trong cầu token, còn component thì không bao giờ.
 */
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.spec\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

describe('tokens-only', () => {
  it('không file nguồn nào trong src/lib chứa chuỗi hex viết tay', () => {
    const offenders = sourceFiles(__dirname)
      .map((path) => ({ path, lines: readFileSync(path, 'utf8').split('\n') }))
      .flatMap(({ path, lines }) =>
        lines
          .map((line, i) => ({ line, number: i + 1 }))
          .filter(({ line }) => HEX.test(line))
          .map(({ line, number }) => `${path}:${number}: ${line.trim()}`),
      );

    expect(offenders).toEqual([]);
  });

  it('chính nó bắt được hex khi có — không phải test rỗng luôn xanh', () => {
    expect(HEX.test("const brand = '#2e6e66';")).toBe(true);
    expect(HEX.test('const brand = theme.colors.primary;')).toBe(false);
  });
});

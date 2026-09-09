// Cấu hình Jest cho app mobile. Preset `jest-expo` là ngoại lệ đã được cấp
// phép từ P0 (ADR-0001, CLAUDE.md) và đóng khung ở ADR-0040 §4: Jest CHỈ sống
// trong `apps/mobile` + `libs/mobile/ui`, không có config Jest nào ở root, mọi
// package khác vẫn Vitest.
const preset = require('jest-expo/jest-preset');

// `@orpc/*` chỉ xuất bản ESM (`"type": "module"`, file `.mjs`, không có nhánh
// `require` trong exports) và app kéo nó vào GIÁN TIẾP:
// `@tourism/i18n` → `@tourism/contract` → `@orpc/contract`.
// Phải nới hai chỗ, thiếu chỗ nào cũng vẫn chết ở token `import`:
//   1. `transformIgnorePatterns` — danh sách của jest-expo không có `@orpc`.
//   2. `transform` — mẫu `\.[jt]sx?$` của jest-expo KHÔNG khớp đuôi `.mjs`.
// Sửa bằng cách map lại preset thay vì chép tay, để lần nâng jest-expo sau
// không phải đồng bộ lại danh sách.
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.includes('(?!(') ? pattern.replace('(?!(', '(?!(@orpc|') : pattern,
);

const transform = Object.fromEntries(
  Object.entries(preset.transform).map(([pattern, transformer]) =>
    pattern === '\\.[jt]sx?$' ? ['\\.[cm]?[jt]sx?$', transformer] : [pattern, transformer],
  ),
);

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns,
  transform,
  // Trần 5s mặc định của Jest KHÔNG đủ cho `renderRouter`: lần gọi đầu nạp cả
  // cây route qua babel-jest, và trên runner CI (chậm hơn, cache jest nguội)
  // riêng test đầu tiên đã vượt 5s — đo được 09/09: cả suite 126s trên CI so
  // với ~3s ở máy dev, và ĐÚNG một test hỏng, 28 cái sau xanh vì cache đã ấm.
  // Đây là chi phí thật của việc dựng navigator, không phải test treo.
  testTimeout: 60_000,
};

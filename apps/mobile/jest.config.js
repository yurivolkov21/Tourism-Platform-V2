// Cấu hình Jest cho app mobile. Preset `jest-expo` là ngoại lệ đã được cấp
// phép từ P0 (ADR-0001, CLAUDE.md) và đóng khung ở ADR-0040 §4: Jest CHỈ sống
// trong `apps/mobile` + `libs/mobile/ui`, không có config Jest nào ở root, mọi
// package khác vẫn Vitest.
const preset = require('jest-expo/jest-preset');

// `@orpc/*` VÀ cả cây phụ thuộc runtime của `better-auth` (ADR-0017 §9,
// `lib/auth-client.ts`) chỉ xuất bản ESM (`"type": "module"`, không có nhánh
// `require` trong exports) — nhưng cây `better-auth` sâu và xuyên nhiều gói
// (`@noble/*`, `jose`, `nanostores`, `better-call` → `rou3`, …), thêm gói nào
// mai kia auth-client kéo theo là lại thêm một lỗi `import`/`export` mới. Thay
// vì liệt kê tay từng gói (đợt trước đúng vậy: sửa xong lỗi này lộ lỗi kế),
// BỎ HẲN danh sách allowlist của jest-expo (pattern có `(?!(` — chỉ chừa cho
// vài gói RN/Expo được nêu tên) để Jest transform MỌI THỨ dưới `node_modules`.
// Hai pattern còn lại (reanimated plugin, `@react-native/babel-preset` — file
// nội bộ build tool, không phải code chạy) giữ nguyên, không đụng.
// Phải nới hai chỗ, thiếu chỗ nào cũng vẫn chết ở token `import`:
//   1. `transformIgnorePatterns` — bỏ allowlist hẹp của jest-expo.
//   2. `transform` — mẫu `\.[jt]sx?$` của jest-expo KHÔNG khớp đuôi `.mjs`.
const transformIgnorePatterns = preset.transformIgnorePatterns.filter(
  (pattern) => !pattern.includes('(?!('),
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

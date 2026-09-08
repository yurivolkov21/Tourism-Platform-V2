// Cấu hình Jest cho app mobile. Preset `jest-expo` là ngoại lệ đã được cấp
// phép từ P0 (ADR-0001, CLAUDE.md) và đóng khung ở ADR-0040 §4: Jest CHỈ sống
// trong `apps/mobile` + `libs/mobile/ui`, không có config Jest nào ở root, mọi
// package khác vẫn Vitest.
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
};

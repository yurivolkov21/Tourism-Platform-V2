// Jest cho `@tourism/mobile-ui`. Preset `jest-expo` — ranh giới cứng của
// ADR-0040 §4: Jest CHỈ sống ở đây và `apps/mobile`, mọi package khác vẫn
// Vitest. Không có config Jest nào ở root repo.
module.exports = {
  preset: 'jest-expo',
};

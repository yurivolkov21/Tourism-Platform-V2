// Jest cho `@tourism/mobile-ui`. Preset `jest-expo` — ranh giới cứng của
// ADR-0040 §4: Jest CHỈ sống ở đây và `apps/mobile`, mọi package khác vẫn
// Vitest. Không có config Jest nào ở root repo.
module.exports = {
  preset: 'jest-expo',
  // Reanimated chạy native nên không nạp được ở Node: dùng bản thay thế tối giản.
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest/reanimated-entry.js',
    '^react-native-reanimated/mock$': '<rootDir>/jest/reanimated-mock.js',
  },
  // Cùng lý do như `apps/mobile`: render component RN lần đầu trên runner CI
  // (cache jest nguội) vượt trần 5s mặc định của Jest.
  testTimeout: 60_000,
};

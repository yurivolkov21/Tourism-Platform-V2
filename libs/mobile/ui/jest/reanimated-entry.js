// Điểm vào của `react-native-reanimated` trong Jest. Tách khỏi `reanimated-mock.js` (ánh xạ cho
// `react-native-reanimated/mock`) vì `expo-router/testing-library` tự `jest.mock` tên gói bằng
// bản `/mock`: hai tên mà trỏ cùng một file thì mock tự gọi lại chính nó.
module.exports = require('./reanimated-mock');

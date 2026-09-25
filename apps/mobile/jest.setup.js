// `react-native-gesture-handler` (ADR-0040 AMEND 3) cần mock native chính chủ
// của gói — thiếu dòng này thì `GestureHandlerRootView`/`GestureDetector` gọi
// `RNGestureHandlerModule.install()` (native thật) và vỡ trong Jest. Đây là
// setup CHÍNH THỨC gói tự tài liệu, không phải mock tự chế.
import 'react-native-gesture-handler/jestSetup';

// Env cho môi trường test. Metro nội tuyến `EXPO_PUBLIC_*` lúc bundle, còn Jest
// chạy trên Node thuần nên phải nạp tay — giá trị khớp `.env.example`. Spec nào
// cần kiểm nhánh THIẾU biến thì gọi thẳng `readEnv()` với nguồn rỗng, không
// đụng tới `process.env`.
process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3001';
process.env.EXPO_PUBLIC_WEB_URL ??= 'http://localhost:3000';

// Jest chạy trên Node nên `globalThis.fetch` là fetch THẬT của Node (18+),
// không phải chưa polyfill — thiếu chặn này, mọi test dựng `orpc.*.queryOptions()`
// (ADR-0047 §2, tiêu thụ đầu tiên ở P5b-2 T1) bắn request THẬT ra
// `EXPO_PUBLIC_API_URL`, ăn bất kỳ thứ gì đang nghe ở đó trên máy dev — đo
// được: một tiến trình khác chiếm cổng 3001 trả response không phải JSON,
// oRPC parse ra `undefined` và TanStack Query la làng "Query data cannot be
// undefined" hàng loạt. Test không được phụ thuộc mạng thật; màn nào cần dữ
// liệu thật cho spec riêng thì tự mock `global.fetch` cục bộ trong file đó.
global.fetch = jest.fn(() => Promise.reject(new Error('network calls are not allowed in tests')));

// `@better-auth/expo` gọi `storage.getItem()` KIỂU ĐỒNG BỘ (không `await`) —
// đúng hợp đồng API thật của `expo-secure-store` (`getItem` là bản sync, chạy
// blocking trên native). Nhưng auto-mock native module của jest-expo bọc MỌI
// method (kể cả bản sync) thành `jest.fn()` trả về Promise, nên
// `storage.getItem(key)` trả về chính đối tượng Promise thay vì string/null —
// `better-auth` gọi tiếp `stored.startsWith(...)` trên Promise đó thì vỡ.
// Mock tay ở đây bằng Map trong bộ nhớ, giữ đúng chữ ký sync/async thật của
// `expo-secure-store` để test không đụng SecureStore thật.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    deleteItem: (key) => {
      store.delete(key);
    },
    getItemAsync: async (key) => store.get(key) ?? null,
    setItemAsync: async (key, value) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key) => {
      store.delete(key);
    },
  };
});

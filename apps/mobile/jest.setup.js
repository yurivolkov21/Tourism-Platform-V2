// Env cho môi trường test. Metro nội tuyến `EXPO_PUBLIC_*` lúc bundle, còn Jest
// chạy trên Node thuần nên phải nạp tay — giá trị khớp `.env.example`. Spec nào
// cần kiểm nhánh THIẾU biến thì gọi thẳng `readEnv()` với nguồn rỗng, không
// đụng tới `process.env`.
process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3001';
process.env.EXPO_PUBLIC_WEB_URL ??= 'http://localhost:3000';

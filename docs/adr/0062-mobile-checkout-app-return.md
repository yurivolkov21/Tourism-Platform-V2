# ADR-0062 — Thanh toán trên app mobile: cổng trả về trang web chuyển tiếp, rồi mới về app

- **Trạng thái:** Accepted (2026-10-26). Đề xuất 20/10; code lên `main` cùng PR #71 ngày 26/10, web và API
  deploy chung một lần push. Thứ tự hai bên không quan trọng: chỉ bản app build từ đợt này gửi `appReturnUrl`.
- **Bối cảnh thi hành:** user báo 20/10 (thử máy thật): trả xong Stripe/PayPal thì khách kẹt ở
  trình duyệt, phải tự đóng tab mới quay lại app. User chọn hướng "trang web chuyển tiếp" cùng ngày.
  Đi trước code theo luật CLAUDE.md #5.
- **Liên quan:** [ADR-0006](0006-pending-lifecycle.md) (vòng đời PENDING, `reCheckout`) ·
  [ADR-0017](0017-web-session-better-auth.md) §10 (scheme `nexora://`, Expo Go `exp://`) ·
  [ADR-0040](0040-mobile-app-expo.md) (app mobile, Expo Go và bản EAS) ·
  [ADR-0001](0001-tech-stack.md) AMEND 1 (mobile mở checkout bằng trình duyệt, không PaymentSheet)

## Bối cảnh

1. `bookings.create` và `bookings.checkout` dựng `successUrl` là
   `${FRONTEND_URL}/checkout/success?code=…` và `cancelUrl` là `/checkout/cancel?code=…` — trang của web.
2. App mở checkout bằng `WebBrowser.openBrowserAsync`: trả xong, cổng đưa khách về trang success của
   web **bên trong tab trình duyệt của app**. Trang này cần phiên web (`requireSession`), mà khách
   trên app không có cookie web, nên khách gặp trang đăng nhập web thay vì quay về app.
3. Stripe Checkout và PayPal chỉ nhận URL `https` cho `success_url`/`return_url` — không đưa thẳng
   `nexora://` hay `exp://` vào cổng được.
4. Đường về app phải chạy được ở cả bản EAS (`nexora://…`) lẫn vòng dev Expo Go
   (`exp://<IP LAN>:<cổng>/--/…`). App tự biết URL của chính nó qua `Linking.createURL`.

## Quyết định

1. **Contract:** `CreateBookingInputSchema` và input của `bookings.checkout` thêm trường tuỳ chọn
   `appReturnUrl`. Hàm thuần `isAllowedAppReturnUrl` ở `@tourism/contract` là luật DUY NHẤT về URL nào
   được phép, dùng chung cho API và web:
   - `nexora://…` (scheme của bản build) — luôn được;
   - `exp://` hoặc `exps://` với host là `localhost`, `127.0.0.1` hoặc IPv4 mạng riêng
     (`10.*`, `172.16–31.*`, `192.168.*`) — URL Expo Go của vòng dev;
   - mọi URL khác bị từ chối (input lỗi 400 ở API, trang web không chuyển).
2. **API:** có `appReturnUrl` hợp lệ thì `successUrl` và `cancelUrl` trỏ trang chuyển tiếp mới của web
   `${FRONTEND_URL}/checkout/app-return?code=…&status=success|cancelled&to=<appReturnUrl đã encode>`.
   Không có thì giữ nguyên URL cũ — web và mọi client cũ không đổi hành vi.
3. **Web:** route `/checkout/app-return` KHÔNG cần phiên, kiểm lại `to` bằng `isAllowedAppReturnUrl`
   (không tin query string), gắn `code` và `status` vào URL app rồi chuyển hướng ngay; kèm nút
   "Return to the app" phòng trình duyệt chặn chuyển hướng tự động. `to` không hợp lệ thì hiện trang
   báo lỗi chung kèm đường về `/account/bookings`, không chuyển đi đâu.
4. **Mobile:** gửi `appReturnUrl = Linking.createURL('/bookings/new/verify')` khi tạo đơn và khi tạo
   lại checkout; mở cổng bằng `WebBrowser.openAuthSessionAsync(url, appReturnUrl)` để tab trình duyệt
   tự đóng khi cổng trả về app. Kết quả `success` đưa khách tới màn xác nhận B6 — màn đó vẫn hỏi lại
   `bookings.byCode`, không tin lời của trình duyệt (giữ nguyên ADR-0006: chỉ webhook mới đổi trạng thái).

## Hệ quả

- Khách trên app trả xong là về thẳng màn xác nhận, không còn kẹt ở trang đăng nhập web.
- `reCheckout` trả lại session còn hạn thay vì tạo mới (ADR-0006 AMEND 2b): session tạo trước đợt này
  vẫn mang `successUrl` cũ của web. Chỉ session mint mới mang đường về app.
- Thêm một trang công khai ở web. Nó chỉ chuyển tới hai scheme đã liệt kê, nên không thành
  open redirect tới trang web lạ.
- Đường `exp://` chỉ nhận host mạng riêng nên không dùng được để mở bundle Expo từ máy ngoài.
- Cần deploy cả API lẫn web cùng lúc mới có tác dụng; thuộc bước gộp sau review (CLAUDE.md luật 15).

## Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Đưa thẳng `nexora://` vào `success_url` | Stripe và PayPal chỉ nhận `https`. |
| Android App Links / iOS Universal Links cho domain web | Cần file xác minh domain và build EAS mới; quá rộng sát freeze 31/10. |
| Để trang `/checkout/success` hiện nút "Mở app" | Trang đó cần phiên web; khách app không có cookie nên vẫn bị đẩy sang đăng nhập. |
| Stripe PaymentSheet trong app | Module native ngoài Expo Go (ADR-0001 AMEND 1). |

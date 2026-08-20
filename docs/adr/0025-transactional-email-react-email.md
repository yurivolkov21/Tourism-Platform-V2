# ADR-0025 — Template email giao dịch bằng react-email (in-code), không dùng Resend Templates dashboard

- **Ngày:** 2026-08-20
- **Trạng thái:** Chấp nhận
- **Liên quan:** [ADR-0024](0024-deploy-targets.md) (Resend là deliverer prod),
  spec deploy v1 §10 (sổ nợ "template email in-code — quyết bằng ADR"),
  [ADR-0006](0006-outbox-email.md) nếu có / spec P2 §3 W5 (outbox → deliverer).

## Bối cảnh

13 loại email giao dịch (OTP, booking, enquiry, newsletter…) đang render vài
dòng HTML trần trong `resend.deliverer.ts` — comment gốc P2 ghi rõ "template
đẹp để P3 lo". Sau deploy v1, user xem mail thật trong Gmail và chốt: mail
"trắng, chán", cần thiết kế hoàn chỉnh mang nhận diện Nexora.

Hai đường custom, đối chiếu docs chính thức Resend (20/08/2026):

1. **Resend Templates (dashboard)** — tạo/sửa template trên dashboard, gửi bằng
   `template: {id, variables}`. Loại vì ba điểm chết với hệ mail này:
   (a) chỉ thay biến `{{{VAR}}}` đơn thuần, **không if/else** — 13 loại mail
   đầy khối tuỳ chọn (amount, reason, note, unsubscribe, OTP vs URL) sẽ bùng nổ
   tổ hợp template con; (b) **thiếu biến không fallback = validation error,
   mail không gửi** — outbox row FAILED âm thầm; (c) template sống ở dashboard,
   NGOÀI repo — trái "code là nguồn sự thật", không unit test, không qua
   review/CI. Kèm trần 20 biến/template và tên biến bị reserve.
2. **react-email (in-code)** — thư viện của chính Resend: component React
   render ra HTML chuẩn email-client (table-based, style inline — Gmail/Outlook
   không nuốt `<style>` như web). Giữ trọn if/else, escape (React tự escape
   text), unit test, git history.

## Quyết định

- Dùng **react-email v6** (package `react-email` duy nhất — v6 gộp
  `@react-email/components` + `@react-email/render` vào một) trong
  `apps/api`, kèm `react` + `react-dom` (render thuần server, không client).
- `renderEmail` chuyển **async** (render() của react-email dùng streaming API
  của React, trả Promise) — deliverer `await`; chữ ký switch theo `EmailType`
  và chốt exhaustiveness giữ nguyên.
- **Hệ visual: port "Barebone" từ Nexora tiền nhiệm** (chốt vòng 2, 20/08 —
  vòng 1 tự dựng layout tối giản bị user loại vì "không hợp ý"; vòng 2 khảo
  mẫu theo đúng nếp design-research: gallery react.email + kho Nexora cũ, và
  phát hiện `email.templates.ts` của repo cũ chính là port template "Barebone"
  MIT của react.email do user duyệt 13/07). Cấu trúc port nguyên: khung trắng
  640px (mini-header N-square + wordmark) → card xám căn giữa (monogram/
  heading serif) → data card nhãn/giá trị + hairline, quote card, pill, nút
  CTA → footer tagline + "why you got this" + unsubscribe. Copy lấy lại bản
  cũ; field bản cũ có mà payload v2 thiếu (ảnh hero tour, rating sao, URL
  review) degrade về nhánh monogram, KHÔNG bịa dữ liệu. URL nút bấm derive từ
  `FRONTEND_URL` (route thật: `/account/bookings` · `/tours` · `/blog` ·
  `/contact`) — không đụng producer. Mỗi mail gửi kèm bản plain-text
  (`toPlainText`, 2 part như bản cũ — deliverability).
- **Màu lấy từ `@tourism/tokens/theme`** (export hex sinh cho RN) — email cần
  hex inline nên đây là cách duy nhất vừa inline vừa giữ luật tokens-only:
  hex trong output nhưng NGUỒN là token, không hardcode tay.
- Copy user-facing giữ English-only (luật #7); email copy sống tại component
  (như hiện trạng — không kéo vào `@tourism/i18n` vì i18n lib là của web/UI).

## Hệ quả

- `apps/api` thêm dependency `react`, `react-dom`, `react-email` (pin exact
  theo khuyến nghị react-email); build swc cần nhận `.tsx` (cấu hình `.swcrc`
  theo `test` per-extension để file `.ts` giữ parser cũ), tsconfig api thêm
  `"jsx": "react-jsx"`.
- `escapeHtml` tự chế bỏ được ở phần HTML (React escape text node); riêng
  SUBJECT vẫn plain text + cắt CR/LF chống header injection (giữ nguyên).
- Preview thiết kế đi theo quy trình duyệt visual hiện có (render mẫu 13 loại
  cho user duyệt trước khi merge); KHÔNG cài preview server `@react-email/ui`
  — thêm dev-dep nặng cho việc artifact demo làm được.
- Resend Templates dashboard không dùng — mail vẫn gửi qua `POST /emails` với
  `html` như cũ, pipeline outbox/worker không đổi một byte.

## Lựa chọn đã bỏ

- **Resend Templates dashboard**: xem Bối cảnh — hợp với đội marketing sửa mail
  không cần deploy, không hợp capstone một người có CI chặt.
- **Tự viết `wrapLayout()` HTML tay, không dep mới**: rẻ nhất nhưng tự gánh
  tương thích Gmail/Outlook (table layout, inline style, quirks) — đúng việc
  react-email sinh ra để khỏi làm.
- **jsx-email / mjml**: tương đương về sức, nhưng react-email là của chính
  Resend — khớp deliverer đang dùng, docs một nhà.

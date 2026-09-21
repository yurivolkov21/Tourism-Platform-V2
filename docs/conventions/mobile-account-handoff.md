# Bàn giao cụm tài khoản mobile (P5b-4) — tour đã lưu · hồ sơ · bảo mật

> Viết cho thành viên dựng màn. Đọc [mobile-browse-handoff.md](mobile-browse-handoff.md)
> trước — luật chung, cách đọc bản vẽ và quy ước code nằm ở đó; tài liệu này chỉ nói phần
> KHÁC.

Bản vẽ: `docs/design/mockups/mobile-account-screens.src.html` (14 khung) ·
Phiên và mật khẩu: [ADR-0017](../adr/0017-web-session-better-auth.md) §7a ·
Ảnh đại diện: [ADR-0021](../adr/0021-media-write-surface.md) ·
Cụm auth đã dựng: [mobile-auth-handoff.md](mobile-auth-handoff.md).

## 1. Điểm riêng của cụm này

1. **Ba tab chặn giống hệt nhau.** Saved · Trips · Account khi chưa đăng nhập dùng CHUNG một
   component (icon vuông + một câu lợi ích + Sign in / Create account). Đừng viết ba lần, và
   **đừng đá khách sang màn Sign in** — đăng nhập xong phải quay lại đúng tab đang đứng. Đây
   là mục CÒN TREO "chặn tab khi chưa đăng nhập" của P5b-1, đóng luôn ở đợt này.
2. **Hồ sơ đi qua Better Auth, không qua oRPC.** Đổi tên và ảnh: `authClient.updateUser`.
   Đổi mật khẩu: `authClient.changePassword` **kèm `revokeOtherSessions: true`** (ADR-0017
   §7a — web đang làm đúng vậy, có test canh).
3. **Ảnh đại diện phải đi đường đã có.** Xin chữ ký ở `account.setAvatar` → tải lên
   Cloudinary → `authClient.updateUser({ image })`. Không tự dựng đường upload khác.
4. **Xoá tài khoản là việc một chiều.** Bắt nhập mật khẩu, nói rõ booking đã thanh toán vẫn
   được giữ (hồ sơ kế toán), và để dòng này trong "Personal details" — KHÔNG đặt cạnh nút
   đăng xuất.

## 2. Việc phải làm trước

- **T0 của P5b-2** (tầng dữ liệu mobile) và phần nối Better Auth của cụm auth phải chạy thật:
  mọi màn ở đây đều cần phiên đăng nhập.
- `expo-image-picker` cho việc chọn ảnh đại diện — dependency mới thì ghi vào
  [ADR-0040](../adr/0040-mobile-app-expo.md) trước, kèm hai quyền máy ảnh và thư viện ảnh.

## 3. Chia việc đề xuất

| # | Việc | Khung | Phụ thuộc |
| --- | --- | --- | --- |
| V1 | Component chặn tab dùng chung cho Saved · Trips · Account | S3, A2 (và T3 của P5b-3) | phiên đăng nhập |
| V2 | Tab Saved: danh sách, rỗng, bỏ lưu | S1, S2 | V1 |
| V3 | Tab Account: hồ sơ + danh sách việc | A1 | V1 |
| V4 | Sửa tên và ảnh đại diện | A3, A4 | V3 |
| V5 | Đổi mật khẩu | A6 | V3 |
| V6 | Đăng xuất và xoá tài khoản | A5, A7 | V3 |
| V7 | Cụm bài viết: danh sách, tìm, đọc bài | G1–G4 | V3 (chỉ cần dòng ở tab Account) |

V7 KHÔNG cần đăng nhập — `posts.*` là route công khai. Nó nằm trong cụm này chỉ vì cửa vào
là dòng "Travel stories" ở tab Account (user chốt 21/09), không phải vì nó thuộc về tài khoản.

## 4. Endpoint cho từng màn

| Màn | Gọi gì | Ghi chú |
| --- | --- | --- |
| S1 | `wishlist.list` | Trả kèm cờ `unavailable` cho tour đã gỡ publish — làm mờ, gắn nhãn, không cho bấm |
| S1 (bỏ lưu) | `wishlist.set` | Lạc quan: tim tắt ngay, lỗi thì bật lại |
| A1 | phiên Better Auth | `name`, `email`, `image`; chưa có ảnh thì hiện chữ cái đầu |
| A3 | `authClient.updateUser({ name })` | Kiểm ở máy bằng `validateProfileName` của `@tourism/core` |
| A4 | `account.setAvatar` + `updateUser({ image })` | Theo ADR-0021 |
| A6 | `authClient.changePassword` | Kèm `revokeOtherSessions`; kiểm bằng `validateChangePassword` của `@tourism/core` |
| A5 | `authClient.signOut()` | Xoá phiên trong `expo-secure-store`, về Home ở tư cách khách |
| A7 | xoá tài khoản (Better Auth) | Cần mật khẩu hiện tại, như web |
| G1 | `posts.list` + `posts.tags` | `PostsListQuerySchema`: phân trang, `sort: publishedAt` `order: desc`, `tag` (**một tag một lúc** — API không nhận mảng), `search` ≤160 |
| G2 | `posts.list` với `search` | Gọi trễ ~300ms sau nhịp gõ cuối; đừng lọc ở máy vì danh sách có phân trang |
| G3, G4 | `posts.bySlug` | `PostDetailSchema` — `content` là markdown, `relatedTours` dùng lại `TourCardSchema` nên không phải gọi thêm |

**Năm** trang mở bằng **trình duyệt ngoài**, đúng cách màn Create account đang làm: ba trang
pháp lý (huỷ/hoàn tiền, quyền riêng tư, điều khoản) cộng **Help & FAQ** và **About Nexora**
(user chốt 21/09). Đường ghép trên `EXPO_PUBLIC_WEB_URL`: `/faq`, `/about`,
`/cancellation-policy`, `/privacy`, `/terms` — **đừng ghi cứng tên miền**.

Vì sao không dựng lại trong app: cả năm là nội dung biên tập đổi theo thời gian, dựng lại là
có hai bản nói hai kiểu và bản trong app luôn là bản cũ hơn. FAQ theo TỪNG TOUR thì khác —
cái đó là dữ liệu (`faqs[]`) và đã nằm trong màn P3 của cụm P5b-3.

## 5. Chữ

`mobile.saved`, `mobile.account`, `mobile.authPrompts` có sẵn gần đủ (kể cả câu rỗng của
Saved và ba cặp chữ chặn tab). Khoá mới: nhãn "No longer available"; ba dòng của tấm chọn
ảnh; tiêu đề và cảnh báo của màn đổi mật khẩu; toàn bộ chữ của tấm xoá tài khoản; nhãn
"Personal details", "Password", "Delete account"; câu xác nhận đăng xuất.

Câu lỗi mật khẩu **dùng chung với web** qua `authForms.errors` và `formErrors`, và đặt đúng
kênh bằng `placeAuthError` của cụm auth — đừng viết câu lỗi mới.

Cụm bài viết: khoá mới gồm "Travel stories", "Search stories", câu rỗng khi tìm không thấy,
"Clear search", "Trips in this story", "Read this on {domain}". Nội dung bài là DỮ LIỆU.

## 6. Ba chỗ dễ làm sai ở cụm bài viết

1. **Markdown phải tự vẽ.** Web dùng `react-markdown` (`article-markdown.tsx`) — thư viện đó
   trả thẻ HTML nên KHÔNG chạy trên React Native, đừng cố import. Đã đếm toàn bộ 9 bài seed
   (21/09): chỉ có `##` (43 lần), đoạn văn, và `- ` (19 lần) — không link, không ảnh chèn,
   không chữ đậm. Một bộ vẽ ~30 dòng cho ba kiểu ấy là đủ. Nhưng admin CÓ THỂ đăng markdown
   giàu hơn sau này, nên cú pháp lạ phải rơi về đoạn-văn-thường, tuyệt đối không in ký hiệu
   thô kiểu `**đậm**` ra giữa bài.
2. **Đừng in `count` của tag.** `PostTagSchema.count` là tổng TOÀN CỤC; sau lần lọc đầu nó
   nói sai ngay — đúng bài học đã ghi ở vòng thiết kế `/blog` của web.
3. **`cover` và `excerpt` đều nullable.** Thiếu ảnh thì thẻ lớn tụt xuống thành hàng gọn,
   thiếu excerpt thì bỏ hẳn dòng đó — đừng chừa chỗ trống.

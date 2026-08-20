# Khảo sát admin Nexora cũ — mở màn P4 (20/08/2026)

Khảo sát read-only tại `/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`
(repo tham chiếu, KHÔNG sửa), theo luật #10: rà CẢ endpoint/trang LẪN hạ tầng
xuyên suốt. Số đếm bằng `find`/`grep` trong ngày, không lấy từ trí nhớ.
Đây là bản đối chiếu đầu vào cho ADR + spec P4; chưa quyết gì ở đây.

## 1. Toàn cảnh bản cũ

**App riêng `apps/admin`** (Next.js) — **40 trang** (`find page.tsx`), 18 vùng
chức năng, khoảng **60 endpoint admin** rải trong 18 controller `admin-*` của
API. Đăng nhập Supabase SSR: middleware (`proxy.ts`) refresh session mọi
request và đá về `/login?redirect=…`; check vai trò ADMIN sau sign-in; API
chặn bằng `roles.guard` + `@Roles`.

## 2. Bảng đối chiếu theo vùng

Cột "v2 đã có": đo trên contract/API v2 hiện tại. Phân loại theo luật #10:
**[V]** thụt lùi cần vá trong P4 · **[S]** để sau (không thuộc P4) ·
**[=]** v2 đã tương đương/tốt hơn.

| Vùng (trang cũ) | Endpoint cũ | v2 đã có | Loại |
| --- | --- | --- | --- |
| Dashboard | `GET admin-stats/dashboard` (bookings theo status + revenue, top tour theo doanh thu, review chờ duyệt, enquiry NEW, lọc khoảng ngày; UI: section cards + chart area recharts + needs-attention + pipeline) | — | [V] |
| Tours (list/detail/new/edit) | GET·GET:slug·POST·PATCH·PUT media·DELETE | **0 endpoint ghi catalog** — dữ liệu v2 vào bằng seed | [V] |
| Departures (nested dưới tour) | GET·POST·PATCH·DELETE | 0 | [V] |
| Categories CRUD | GET·GET:slug·POST·PATCH·DELETE | 0 | [V] |
| Destinations CRUD + media | GET·GET:slug·POST·PATCH·PUT media·DELETE | 0 | [V] |
| Posts (list/tags/detail/edit + trang new) | GET·GET tags·GET:slug·PATCH·PUT media·DELETE (⚠ controller cũ KHÔNG có `@Post` create — trang `posts/new` tồn tại; xem lại khi viết spec) | 0 | [V] |
| Reviews (queue/edit/new-curated) | GET·PATCH moderation·PATCH feature·PATCH:id·DELETE·POST curated | `GET /api/admin/reviews` + `PATCH …/moderate` (queue + duyệt đã sống, bảng `review_moderation_events` ghi vết) | [V] phần feature/curated/edit/delete |
| Bookings (list/detail) + refund | GET·GET:code·POST refund | ĐỦ cả 3 (`/api/admin/bookings…` + ledger refund ADR-0009, advisory lock) | [=] |
| Cancellation requests | GET·POST deny | ĐỦ và **tốt hơn**: `GET` + `POST …/decide` (approve/deny một cửa, hoàn ghế + refund + outbox atomic) | [=] |
| Enquiries (list/status/notes) | GET·PATCH status·GET notes·POST notes | 0 endpoint — nhưng DB v2 đã có sẵn bảng `enquiry_notes` + cột status | [V] |
| Subscribers | GET·DELETE | 0 (DB có `subscribers` + HMAC token) | [V] |
| Outbox (hàng kẹt/FAILED) | GET·POST retry·DELETE | 0 endpoint — nhu cầu ĐÃ chứng minh: vụ Resend key 20/08 phải soi outbox bằng SQL tay | [V] |
| Payment events | GET | 0 endpoint (bảng `payment_events` có, đã dùng để smoke) | [V] |
| Media library + rác | GET·PATCH·POST bulk-delete·GET garbage·POST reconcile·DELETE | 0 endpoint admin; **nợ ghi sẵn từ ADR-0021**: bảng `media_garbage` + cron reconcile "để P4" | [V] |
| Appearance (site media theo khe) | GET·PUT:key/media | web chỉ ĐỌC khe (`siteMedia`); ghi = script `media:upload` chạy tay | [V] |
| Users (list/detail/me/role) | GET·GET me·GET:id·PATCH role·DELETE | 0 endpoint admin (promote ADMIN tự động qua SEC-1 `afterEmailVerification`) | [V] |
| Uploads ký URL | POST signed-url | `media.signUpload` ĐÃ có (ADR-0021) — mở rộng purpose cho admin là đủ | [=] gần |
| Login + ui-check | — | Better Auth sẵn (xem §3) | [=] |

Ngoài phạm vi P4: module `chat` của bản cũ (concierge) thuộc P6 theo roadmap.

## 3. Hạ tầng xuyên suốt — bản cũ có gì, v2 đứng đâu

| Mảnh | Nexora cũ | v2 hiện tại |
| --- | --- | --- |
| Gate đăng nhập admin app | Supabase SSR middleware mọi request → redirect `/login` | **Lợi thế lớn**: Better Auth + `crossSubDomainCookies` (`.nexora-travel.agency`, ADR-0024 đã bật trên prod) — `admin.` dùng CHUNG session với web, không cần hệ auth riêng; cần middleware check role ADMIN + trang login riêng cho admin app |
| RBAC phía API | `roles.guard` + `@Roles` | ĐÃ CÓ `AuthGuard` + `@Roles(UserRole.ADMIN)` (đang chặn 7 endpoint admin sống) |
| Bộ CRUD dùng lại | `components/crud/` 19 file: table shell · facet filter · pagination server/client · columns menu (+ persist visibility) · row actions · media-field · library-picker dialog · repeatable-cards · lightbox · list header · tab pills · error alert | 0 — nhưng v2 có `@tourism/ui` (shadcn) làm nền; bộ CRUD kit là khối hạ tầng LỚN NHẤT của P4, quyết định tốc độ 15 vùng còn lại |
| Shell | app-shell + nav-main + nav-user (sidebar) | 0 |
| Chart | recharts 3.8 | chưa có — chọn lại khi làm dashboard (shadcn charts cũng bọc recharts) |
| Motion/feedback | thư mục riêng | v2 có sẵn vocabulary motion (RevealItem…) tái dùng được |
| Audit vết | `review_moderation_events` (chỉ reviews) | v2 CÓ bảng này + `enquiry_notes`; các vùng khác cũ cũng không có audit — không thụt lùi |

## 4. Kết luận cho ADR/spec P4

1. **Khoảng cách lớn nhất là bề mặt GHI catalog** (tours/departures/categories/
   destinations/posts): v2 chưa có endpoint ghi nào — toàn bộ nội dung đang vào
   bằng seed. Đây là phần nặng nhất cả API lẫn UI (form phức tạp: itinerary,
   policies, faq, media picker).
2. **Ba vùng ăn sẵn**: bookings + cancellations + reviews-moderation đã có API,
   chỉ cần UI — ứng viên tốt để dựng SHELL + CRUD KIT trước rồi lắp vùng dễ.
3. **Nhu cầu vận hành đã chứng minh bằng chính đợt deploy 20/08**: outbox
   (soi/retry hàng FAILED — vụ Resend key), payment events (smoke), media
   garbage (nợ ADR-0021). Đáng xếp sớm hơn cảm giác.
4. **Quyết định cần ADR** (chưa quyết ở đây): app admin RIÊNG `apps/admin`
   (như cũ, subdomain đã chừa + cookie chung sẵn) hay khu `/admin` trong
   apps/web; bộ bảng (TanStack Table như kit cũ?); chart lib; phạm vi users
   (PATCH role thủ công có đá nhau với SEC-1 auto-promote không); posts create
   (bản cũ thiếu `@Post` — v2 làm đủ hay giữ nguyên).
5. Thứ tự đề xuất cho spec: **shell + auth gate + CRUD kit → 3 vùng ăn sẵn
   (bookings/cancellations/reviews) → vận hành (outbox/payment-events/
   enquiries/subscribers) → dashboard → catalog CRUD (nặng nhất) → media
   library + appearance → users**.

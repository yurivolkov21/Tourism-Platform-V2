# Spec P3a — API khách hàng

- **Ngày:** 2026-07-19 · **Branch:** `feat/p3-customer` · **Trạng thái:** chờ user duyệt
- **Phụ lục:** [ADR-0001](../adr/0001-tech-stack.md) (lộ trình vertical slice) ·
  [API parity map](../analysis/2026-07-19-api-parity-upgrade-map.md) (nguồn của A1–A14, S1–S10) ·
  [Schema audit](../analysis/2026-07-18-schema-audit-nexora.md) ·
  [outbox-dedupe-key](../conventions/outbox-dedupe-key.md)

## 1. Mục tiêu & phạm vi

Xây 6 module API phía khách hàng để P3b (Web Next.js) có contract ổn định mà
tiêu thụ: **reviews · wishlist · enquiry · newsletter · posts (public) ·
site-media (public)**. Không chỉ port Nexora — áp luôn các nâng cấp đã chốt ở
parity map.

**Vì sao tách P3a/P3b:** P3 gộp cả API lẫn Web to gấp đôi P1+P2 cộng lại
(~30 endpoint + một web app từ số 0). Tách ra để mỗi nửa có spec riêng, review
được, và sống sót qua giới hạn phiên (đã đứt 3 lần ở P1/P2 — mỗi lần chỉ mất
phần dở của một workstream nhờ commit theo cụm).

**Ngoài phạm vi (nói rõ để không trôi):** UI web → P3b · admin CRUD đầy đủ +
media upload/GC → P4 · smoke Stripe/PayPal thật → P3b (khi có trang checkout) ·
delta schema S2/S3/S4/S8/S9/S10 → P4 cùng module của chúng.

## 2. Quyết định đã chốt (brainstorm 19/07)

| # | Quyết định | Lý do |
| --- | --- | --- |
| D1 | **Tách P3a (API) → P3b (Web)** | Quy mô gấp đôi P1+P2; mỗi nửa review được riêng |
| D2 | **Migration chỉ 4 delta cần cho P3a** (S1, S5, S6, S7) + bảng mới | Không thêm constraint cho bảng chưa có code dùng — không verify được thì dễ sai mà không ai biết |
| D3 | **Recompute rating TRONG transaction duyệt review** | Rating không bao giờ lệch với trạng thái duyệt; chỉ 1 aggregate cho 1 tour, hiếm khi chạy |
| D4 | **Kéo moderation tối thiểu về P3a** (`admin.reviews.{list, moderate}`) | Nếu để P4, review tạo ra sẽ nằm chờ vĩnh viễn — không demo được vòng đời, không test được D3 |
| D5 | **Siết điều kiện review: phải đi xong tour** (A7) | Nexora chỉ cần PAID → khách trả tiền hôm nay, tour 3 tháng nữa vẫn review được |
| D6 | **Có bảng `ReviewModerationEvent` append-only** (A8) | Đã kéo moderation về thì làm luôn; Nexora last-write-wins không trả lời được "ai unapprove, vì sao" |
| D7 | **Token hủy newsletter dùng HMAC** (`subscriberId` + secret) | Stateless, không thêm cột, không cần lookup; thu hồi toàn bộ bằng xoay secret |

## 3. Kiến trúc

### W0 — Nền dùng chung

`libs/shared/contract/src/schemas/common.ts`: `PageQuerySchema` ·
`SortQuerySchema(keys)` · `SearchQuerySchema`. Mọi list endpoint sau này
`= PageQuery.extend(Sort).extend(Search).extend(<filter riêng>)` — hạng mục B6
(Nexora có 3 biến thể `Paginated*` gần giống nhau).

Migration `p3a_customer`:

- **S1** `Enquiry.email` → `@db.Citext` — vá bug repeat-lead hỏng âm thầm
  (Nexora không lowercase email nhưng `groupBy` so khớp chính xác)
- **S5** `Review`: CHECK bất biến VERIFIED (đủ 3 FK) / CURATED (null cả 3) +
  `featuredRank Int?` — bỏ phụ thuộc thứ tự alphabet enum khi sort testimonial
- **S6** `Tour`: `ratingAvg Decimal(2,1)?` + `ratingCount Int @default(0)`
- **S7** `Subscriber`: `unsubscribedAt DateTime?` + `updatedAt`
- **Bảng mới `ReviewModerationEvent`**: `id · reviewId · actorId · fromApproved ·
  toApproved · note? · createdAt` + index `[reviewId, createdAt]`

### W1–W6 — Module (khó → dễ)

| W | Module | Endpoint | Điểm đáng chú ý |
| --- | --- | --- | --- |
| W1 | `reviews` | `reviews.{listByTour, mine, create}` · `admin.reviews.{list, moderate}` | Gate điều kiện (D5) · transaction 4-trong-1 (D3+D6) · `authorDeleted` |
| W2 | `wishlist` | `wishlist.{set, list, check}` | `set` idempotent thay cặp add/remove · cờ `unavailable` (A10) · `check` batch (A11) |
| W3 | `enquiry` | `enquiries.create` | Honeypot **không reject** · throttle 5/60s · 2 outbox (ack khách + alert admin — A13 mới) |
| W4 | `newsletter` | `newsletter.{subscribe, unsubscribe}` | **unsubscribe là endpoint MỚI** (A1 — rủi ro GDPR ở Nexora) |
| W5 | `posts` | `posts.{list, bySlug, tags}` | Helper bắt buộc `publishedPostWhere()` (ADR-0012) |
| W6 | `site-media` | `siteMedia.list` | Nhẹ nhất; chỉ trả slot có media |

Cấu trúc thư mục theo đúng pattern `catalog/` và `bookings/` đã có: mỗi module
một dir trong `apps/api/src/modules/` với `*.service.ts` · `*.controller.ts` ·
`*.module.ts` · `*.int.spec.ts`.

## 4. Luồng dữ liệu (các chỗ tinh vi)

### 4.1 Vòng đời review

```text
create:  booking PAID  ∧  departure.endDate < now()   ← siết mới (D5)
         ∧ chưa có review cho booking này (unique bookingId → P2002 = 409)
         → row PENDING (isApproved = false)

moderate (admin): MỘT transaction gồm 4 việc
  ① flip isApproved + moderatedById/moderatedAt
  ② INSERT ReviewModerationEvent (append-only)
  ③ recompute Tour.ratingAvg / ratingCount  ← 1 aggregate, scope đúng tour đó
  ④ enqueue outbox REVIEW_APPROVED — CHỈ khi false→true,
     dedupeKey `review-approved:<reviewId>` (unapprove rồi approve lại KHÔNG gửi lần hai)
```

③ nằm trong transaction nên rating không bao giờ lệch với trạng thái duyệt.
Nexora tính live mỗi page load (`summarize()` scan toàn bảng reviews).

**Phạm vi của ③ (nói rõ để khỏi hiểu hai kiểu):** aggregate lọc
`{ tourId: <tour của review>, isApproved: true }`. Review CURATED có `tourId`
null nên **không bao giờ ảnh hưởng rating của tour nào** — testimonial admin
viết là social proof, không phải đánh giá chuyến đi. Khi moderate một review
CURATED thì bỏ qua bước ③.

### 4.2 `authorDeleted`

Public list: `orderBy [authorDeleted asc, createdAt desc]`, chạy thẳng trên
index `[tourId, isApproved, authorDeleted, createdAt desc]` đã có từ P1. Render
`authorDeleted ? "Deleted account" : authorName`.

⚠️ Ràng buộc: flow tombstone (đã có ở P1) phải **cùng transaction** vừa bật
`authorDeleted` vừa **scrub `authorName`** — bật cờ mà quên scrub thì tên vẫn
nằm trong DB.

### 4.3 Enquiry — outbox kép

```text
create → MỘT transaction: insert enquiry
                        + outbox ENQUIRY_RECEIVED     dedupeKey enquiry-received:<id>
                        + outbox ENQUIRY_ADMIN_ALERT  dedupeKey enquiry-admin-alert:<id>  (MỚI — A13)
```

Honeypot `website`: Zod `.optional()` **không refine reject**; có giá trị →
controller trả 201 giả và **không ghi DB** (reject là bot biết ngay).

### 4.4 Newsletter

```text
subscribe:   upsert theo citext email; outbox welcome dedupeKey newsletter-welcome:<email>
             (ô "một lần vĩnh viễn cho mỗi địa chỉ" — ngoại lệ hợp lệ duy nhất của quy ước)
unsubscribe: token = HMAC-SHA256(subscriberId, NEWSLETTER_UNSUBSCRIBE_SECRET)
             GET hiện xác nhận · POST thực thi (tránh prefetch của email client tự hủy)
worker:      deliverer bỏ qua subscriber có unsubscribedAt ≠ null
admin xóa:   → soft-unsubscribe, KHÔNG hard-delete (giữ bằng chứng consent)  [phần admin ở P4]
```

**Env mới:** `NEWSLETTER_UNSUBSCRIBE_SECRET` — optional ở dev (có default như
`BETTER_AUTH_SECRET`), **bắt buộc ở production** qua `superRefine` của `env.ts`.
Cố ý **không dùng chung `BETTER_AUTH_SECRET`**: xoay secret auth (việc bảo mật
bình thường) sẽ làm chết mọi link hủy đăng ký đã gửi đi — hai vòng đời khác
nhau thì tách secret.

### 4.5 Wishlist

`set({tourId, wished})` idempotent thay cặp add/remove. `list` trả cờ
`unavailable` cho tour đã unpublish — Nexora rò rỉ cột `isPublished` rồi để FE
tự đoán, hậu quả là item chết click ra 404.

### 4.6 Blog

[ADR-0004](../adr/0004-post-visibility-helper.md): Nexora không có cổng chặn
tập trung, mọi path public tự mang `publishedAt <= now()` nên dễ sót. v2 biến
thành **helper bắt buộc** `publishedPostWhere()` dùng ở cả 3 path (list, bySlug,
tags) thay vì rà tay.

## 5. Error code (khai trong `.errors({})` của contract)

| Module | Code | HTTP |
| --- | --- | --- |
| reviews | `BOOKING_NOT_FOUND` · `BOOKING_FORBIDDEN` (403 cố ý, không 404 — khách đã thấy code trong list của mình) · `REVIEW_NOT_ELIGIBLE` · `REVIEW_TRIP_NOT_COMPLETED` (mới) · `REVIEW_ALREADY_EXISTS` | 400/403/409 |
| admin.reviews | `REVIEW_NOT_FOUND` · `REVIEW_NOT_CURATED` (không sửa/xóa review thật của khách) | 404/409 |
| wishlist · enquiry | `TOUR_NOT_FOUND` | 404 |
| newsletter | `INVALID_UNSUBSCRIBE_TOKEN` | 400 |
| posts | `POST_NOT_FOUND` | 404 |

## 6. Test

**Unit (TDD trước)** cho logic thuần: ma trận điều kiện review (PAID × ngày khởi
hành × đã review chưa) · sinh/verify HMAC token · `publishedPostWhere()` · phân
loại `unavailable`.

**Integration trên Postgres thật** (`tourism_test`), mỗi module một suite:

- Review: chưa đi tour → `REVIEW_TRIP_NOT_COMPLETED` · review người khác → 403 ·
  **duyệt → `Tour.ratingAvg` đổi đúng trong cùng transaction + đúng 1
  `ReviewModerationEvent` + đúng 1 outbox** · unapprove rồi approve lại →
  **không gửi mail lần hai**
- Wishlist: `set` hai lần cùng giá trị → 1 row · tour unpublish sau khi lưu →
  `unavailable: true`
- Enquiry: honeypot có giá trị → **201 nhưng DB rỗng** · tạo thật → đúng **2** outbox
- Newsletter: subscribe 2 lần → 1 row + 1 welcome · unsubscribe token hợp lệ →
  `unsubscribedAt` set · token sai → 400 · **đã hủy thì worker bỏ qua**
- Posts: bài PUBLISHED có `publishedAt` tương lai → **không hiện** ở cả 3 path

**Regression có chủ đích**: test khẳng định **không có dữ liệu trust giả** —
Nexora từng hiện 4 reviewer bịa khi chưa có review thật, phải gỡ rồi viết test
chặn nó sống lại. Ta viết ngay từ đầu.

## 7. Nghiệm thu

| W | Xong khi |
| --- | --- |
| W0 | Migration chạy sạch trên DB mới · `pnpm gate` xanh · schema chung dùng được ở ≥1 endpoint |
| W1 | Vòng đời review chạy thật qua API: tạo → duyệt → hiện ở list công khai, `Tour.ratingAvg` đổi đúng |
| W2–W6 | Mỗi module: contract có type · integration suite xanh · các bất biến ở §6 được kiểm |
| Cuối | `pnpm gate` + `pnpm test:int` toàn bộ xanh · CI xanh · CHANGELOG + docs sweep · merge rebase+ff |

Mỗi W một commit cụm rõ ràng (bài học 3 lần đứt phiên ở P1/P2).

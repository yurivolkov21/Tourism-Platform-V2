# API Parity + Upgrade Map — Nexora → v2

- **Ngày:** 2026-07-19 · **Trạng thái:** chờ duyệt (sẽ thành phụ lục cho các spec P3+)
- **Phương pháp:** 4 lượt audit độc lập (reviews/wishlist · enquiry/newsletter/blog ·
  media/GC · admin surface), đọc controller + service + CHANGELOG 1630 dòng + ADR.

## 0. Con số

| | Nexora | v2 hiện tại | Còn thiếu |
|---|---|---|---|
| Module API | 22 | 4 | 18 |
| Endpoint | 105 | 21 | ~64 |

Schema v2 (30 model) đã phủ **toàn bộ** tính năng — thiếu là thiếu *bề mặt API*,
không phải thiếu dữ liệu. Kiểm kê chi tiết theo module nằm trong transcript của
4 agent; tài liệu này giữ phần **quyết định**.

## 1. Phân bổ theo phase (vertical slice — mỗi phase demo được trọn vẹn)

| Phase | API | UI | Ghi chú |
|---|---|---|---|
| **P3** Khách hàng | reviews (public+mine+create) · wishlist · enquiry (create) · newsletter (subscribe + **unsubscribe mới**) · posts (public) · site-media (public) · catalog đã có | Web Next.js 16 (chức năng, chưa polish) | Smoke Stripe/PayPal thật (D2) |
| **P4** Quản trị | admin CRUD tours/destinations/categories · departures · media library + GC ops · users · reviews moderation · enquiry CRM · posts authoring · subscribers · stats | Admin SPA (Vite + TanStack) | |
| **P5** Mobile | (dùng lại contract) | Expo | |
| **P6** AI concierge | chat + tool `submitEnquiry` | | |
| **P7** Polish UI | — | Thiết kế lại toàn bộ | Trước freeze 15/10 |

Nguyên tắc: **API và UI của cùng một lát cắt đi chung phase** — contract oRPC
được UI thật kiểm chứng ngay, không xây API "mù".

## 2. Nâng cấp giá trị CAO (v2 phải làm khác Nexora)

### 2.1 Sửa lỗi/thiếu sót thật của Nexora

| # | Vấn đề ở Nexora | Cách v2 làm |
|---|---|---|
| A1 | **Newsletter không có unsubscribe công khai** — rủi ro pháp lý GDPR/CAN-SPAM | `Subscriber.unsubscribedAt` + token HMAC, endpoint public; admin "xoá" → soft-unsubscribe (giữ bằng chứng consent) |
| A2 | **`Enquiry.email` không lowercase** trong khi repeat-lead `groupBy` so khớp chính xác → tính năng phát hiện lead trùng **hỏng âm thầm** | `@db.Citext` (giống Subscriber) |
| A3 | **Rò rỉ Cloudinary im lặng**: `MediaGarbage.publicId` unique toàn cục + `resourceType` free-string → destroy sai resource type → `'not found'` → coi là thành công | `@@unique([publicId, resourceType])` + enum hoá `resourceType` |
| A4 | **Upload trước / lưu sau** → mọi lỗi validate để lại file rác vĩnh viễn (đã dính 2 lần) | Ký thêm `resource_type`/`max_file_size` + `notification_url` webhook → asset không attach tự vào GC |
| A5 | **Reconcile không có max-attempts** → row lỗi vĩnh viễn chiếm slot batch mỗi ngày (starvation) | pg-boss job **từng asset** với retryLimit/backoff/dead-letter |
| A6 | **DoS-by-search**: 4 query `contains` không `take`, nhồi `IN` không giới hạn | `take` + pg_trgm |
| A7 | **Review được viết khi chưa đi tour** (chỉ cần PAID) | Siết: `departure.endDate < now()` |
| A8 | **Moderation không có lịch sử** (last-write-wins) | Bảng `ReviewModerationEvent` append-only |
| A9 | **Rating tính live mỗi page load** (`summarize()` scan toàn bảng) | Denormalize `ratingAvg`/`ratingCount` lên Tour + bảng site stats |
| A10 | **Wishlist giữ tour đã unpublish** rồi đẩy FE tự xử → item chết click ra 404 | Contract trả cờ `unavailable` tường minh |
| A11 | **Thiếu endpoint "tour này đã lưu chưa"** → FE tải cả list 100 item rồi lookup | Nhúng `isWishlisted` vào tour detail/list khi có auth |
| A12 | **Admin blog routes khoá theo `slug`** mà PATCH đổi được slug → bookmark gãy | Admin dùng `:id` (uuidv7), public giữ `:slug` |
| A13 | **Không có email báo admin khi có lead mới** | Outbox `ENQUIRY_ADMIN_ALERT` |
| A14 | Sort testimonial dựa vào **thứ tự alphabet enum** (`CURATED < VERIFIED`) — đổi tên value là hỏng ngầm | Cột `featuredRank` tường minh |

### 2.2 Tận dụng năng lực mới của v2

| # | Nội dung |
|---|---|
| B1 | **Tombstone thay hard-delete user**: bỏ được guard `ACCOUNT_HAS_BOOKINGS`/`USER_HAS_POSTS` (Nexora phải từ chối xoá user có booking) — v2 xoá được **mọi** user mà không mất record tài chính. ⚠️ Đổi lại: **mọi query admin users phải filter `deletedAt: null`** (rủi ro regression rõ nhất khi port) |
| B2 | **Revalidation qua contract chung**: Nexora duy trì taxonomy tag ở **2 nơi** phải sửa lockstep (đã sót 1 surface). v2 đưa vào `libs/shared/contract/src/cache-tags.ts` — một nguồn sự thật + `z.enum` để web validate allow-list tự động |
| B3 | **Zod output schema thay `stripCostPrice()` runtime**: schema public không khai `costPrice` ⇒ **không thể leak**, thay vì dựa vào việc nhớ gọi helper |
| B4 | **Enum exhaustive**: bug "38-vs-37 drift" (UI liệt kê 4/5 booking status) sẽ thành **compile error** khi `bookingsByStatus` là `Record<BookingStatus, number>` sinh từ Zod enum |
| B5 | **Phân trang cursor bằng uuidv7** cho list theo thời gian — hết `count(*)` đắt + hết bug "overshot page dead-end" |
| B6 | **Schema Zod dùng chung** `PageQuery`/`SortQuery`/`SearchQuery` — Nexora có 3 biến thể `Paginated*` gần giống nhau |

## 3. Bất biến PHẢI port nguyên (Nexora đã trả giá)

1. **Locking-CTE cho last-admin demote** (ADR-0009) — read-then-write từng để admin pool về 0. Bổ sung `deleted_at IS NULL` cho v2.
2. **Delete user có điều kiện role** (`updateMany where {id, role: CUSTOMER}`) — chặn bypass promote→demote→delete.
3. **`TOUR_CURRENCY_LOCKED`** khi đã có booking PAID; **`TOUR_HAS_ACTIVE_BOOKINGS`** khi unpublish.
4. **Cụm 3 guard departure** (auto-refund khi CANCELLED · past-date · seats-below-booked) — port cả cụm hoặc để lỗ hổng.
5. **ADR-0010 per-currency, không FX** — Nexora từng cộng thẳng amount qua currency (latent vì seed toàn USD).
6. **Honeypot `website`**: Zod **tuyệt đối không reject** khi field có giá trị — reject là bot biết ngay.
7. **Ref-safe GC 3 lớp** (ADR-0011): guarded enqueue → destroy-time backstop → re-attach defuse.
8. **`preserveRoles` carve-out** khi set cover (không quét mất ảnh body).
9. **`seatsBooked` không bao giờ nhận từ client.**
10. **Không fake dữ liệu trust** — thà ẩn section (Nexora từng hiện 4 reviewer bịa, phải gỡ + viết regression test).

## 4. Delta schema MỚI (bổ sung cho audit 18/07)

Phát hiện trong đợt audit API này, chưa có trong `2026-07-18-schema-audit-nexora.md`:

| # | Thay đổi | Nguồn |
| --- | --- | --- |
| S1 | `Enquiry.email` → `@db.Citext` | A2 |
| S2 | `MediaGarbage`: `@@unique([publicId, resourceType])` + `resourceType` → enum | A3 |
| S3 | `MediaAsset.bytes` là **column chết thứ hai** (audit cũ khẳng định chỉ có `User.locale` — sai). Quyết: ghi thật (Cloudinary trả `bytes`, admin library hiện dung lượng là hữu ích) | |
| S4 | Partial unique `tour_destinations(tour_id) WHERE is_primary` — "đúng 1 primary" hiện chỉ do app đảm bảo | M7 |
| S5 | `Review`: CHECK bất biến VERIFIED (đủ 3 FK) / CURATED (null cả 3) + `featuredRank Int?` | A14 |
| S6 | `Tour`: `ratingAvg`/`ratingCount` denormalized | A9 |
| S7 | `Subscriber`: `unsubscribedAt` + `updatedAt` | A1 |
| S8 | `Post`: CHECK `status <> 'PUBLISHED' OR publishedAt IS NOT NULL` (hiện có thể tạo row PUBLISHED + publishedAt null = "publish nhưng vô hình") | |
| S9 | `MediaAsset`: CHECK `type = 'VIDEO' OR poster_id IS NULL` | |
| S10 | **Wishlist sống sót tombstone**: FK `Cascade` không bao giờ kích hoạt vì row user không bị xoá → phải hard-delete wishlist trong `beforeDelete` hook |

⚠️ **Cảnh báo index (A3 kèm theo)**: audit cũ đề xuất `[publicId]` + `[posterId]`
cho hot-path GC, nhưng query thật là `WHERE publicId IN (...) OR posterId IN (...)`
— Postgres với `OR` trên 2 cột **thường không dùng được 2 index riêng**. Phải tách
2 query rồi union, hoặc verify `EXPLAIN` cho ra BitmapOr. Tương tự
`excludeUserOwned` sinh `ownerType != USER` — **inequality không dùng index prefix**,
nên đổi thành `ownerType IN (...)`.

## 5. Endpoint gộp/bỏ (không port 1-1)

| Nexora | v2 |
| --- | --- |
| `DELETE /admin/media/:id` + `POST bulk-delete` | Một `media.delete({ids})` trả `{deleted, skipped}` |
| `POST /admin/media/garbage/reconcile` | `admin.jobs.trigger({job})` chung cho mọi cron |
| `GET /admin/posts/tags` + `GET /posts/tags` | Một procedure `posts.tags.list({includeDrafts})` |
| `GET /admin/users/me` | Trùng `users.me` |
| `POST /users/me/avatar/sign` + `POST /admin/uploads/sign` | Một `uploads.sign`, `purpose` derive từ role |
| `PATCH departure {status: CANCELLED}` | Tách `admin.departures.cancel` riêng (thao tác động tới tiền, cần audit/rate-limit riêng) |
| `DELETE subscriber` (hard) | `newsletter.admin.unsubscribe` (soft) + purge riêng cho GDPR erasure |

# Tài liệu — tourism-v2

Đây là **cửa vào duy nhất**. Mọi tài liệu của dự án đều nằm dưới `docs/` và
được liệt kê ở đây — không có spec nào nằm chỗ khác.

## Bốn thể loại, đừng lẫn

| Thư mục | Trả lời câu hỏi | Viết khi nào |
| --- | --- | --- |
| [`adr/`](adr/) | **Vì sao** chọn thế này? | TRƯỚC khi code (luật CLAUDE.md #5) |
| [`specs/`](specs/) | **Sẽ xây gì** ở phase này? | Đầu mỗi phase, user duyệt rồi mới code |
| [`plans/`](plans/) | **Làm theo bước nào** để hiện thực spec? | Sau khi spec được duyệt, trước khi code |
| [`analysis/`](analysis/) | **Học được gì** từ Nexora? | Khi cần dữ liệu để ra quyết định |
| [`conventions/`](conventions/) | Quy tắc **áp dụng mãi mãi** | Khi một bài học cần thành luật |

Ngoài ra: [`CHANGELOG.md`](CHANGELOG.md) — lịch sử mỗi merge ·
[`skills.md`](skills.md) — skill đã cài & dùng khi nào ·
[`../CLAUDE.md`](../CLAUDE.md) — hợp đồng vận hành.

## ADR — quyết định kiến trúc

| # | Nội dung |
| --- | --- |
| [0001](adr/0001-tech-stack.md) | Tech stack + lộ trình vertical slice + chiến lược UI |
| [0002](adr/0002-payment-gateway-refund-ledger.md) | PaymentGateway interface · Refund ledger · atomic claim thế hệ 2 |
| [0003](adr/0003-auth-fail-closed.md) | Auth mặc định fail-closed — global guard + `@Public()` |
| [0004](adr/0004-post-visibility-helper.md) | Post visibility — helper bắt buộc `publishedPostWhere()` (status + publishedAt<=now) |
| [0005](adr/0005-media-read-build-url.md) | Media đọc — API dựng & trả Cloudinary URL (chỉ cần cloud name công khai) |
| [0006](adr/0006-pending-lifecycle.md) | **Proposed** — vòng đời PENDING: hết hạn/tự-hủy/re-checkout (gói pending-expiry, chờ duyệt) |
| [0008](adr/0008-admin-bootstrap-verified.md) | Admin bootstrap — promote gated `emailVerified` + reconcile lúc boot (SEC-1/AUTH-1/AUTH-2) |
| [0009](adr/0009-refund-correctness.md) | Đúng đắn refund — advisory-lock serialize + trigger `SUM≤total` + gate re-derive orphan (BK-R1/PAY-R1/TOCTOU) |

## Specs — theo phase

| Phase | Spec | Trạng thái |
| --- | --- | --- |
| P1 API lõi | [2026-07-18-p1-api-core](specs/2026-07-18-p1-api-core.md) | ✅ đã merge |
| P2 Money-path | [2026-07-18-p2-money-path](specs/2026-07-18-p2-money-path.md) | ✅ đã merge |
| P3a API khách hàng | [2026-07-19-p3a-customer-api](specs/2026-07-19-p3a-customer-api.md) | ✅ đã merge (A+B+C) |
| P3a closeout (C1·R1·R2) | [2026-07-21-p3a-contract-closeout-design](specs/2026-07-21-p3a-contract-closeout-design.md) | 🚧 đang làm |
| P3b Web · P4 Admin · P5 Mobile · P6 AI · P7 Polish UI | — | ⬜ chưa mở |

## Plans — kế hoạch triển khai (task-by-task)

| Kế hoạch | Phủ | Trạng thái |
| --- | --- | --- |
| [P3a-A: Nền chung + Reviews](plans/2026-07-19-p3a-a-foundation-reviews.md) | W0 + W1 (6 task) | ✅ đã merge |
| [P3a-B: Wishlist · Enquiry · Newsletter](plans/2026-07-19-p3a-b-wishlist-enquiry-newsletter.md) | W2–W4 + hạ tầng rate limiting (6 task) | ✅ đã merge |
| [P3a-C: Posts · Site-media](plans/2026-07-21-p3a-c-posts-site-media.md) | W5–W6 + hạ tầng media-đọc (7 task) | ✅ đã merge |
| [Admin bootstrap emailVerified + AUTH-2](plans/2026-07-21-admin-bootstrap-verified.md) | SEC-1/AUTH-1/AUTH-2 (5 task) | ✅ đã merge |
| [Refund correctness](plans/2026-07-21-refund-correctness.md) | BK-R1/PAY-R1/TOCTOU (5 task) | ✅ đã merge |

## Analysis — nghiên cứu từ Nexora

| Tài liệu | Dùng để |
| --- | --- |
| [Schema audit](analysis/2026-07-18-schema-audit-nexora.md) | Soi 27 model + quyết định tối ưu (H/M/LOW) |
| [API parity + upgrade map](analysis/2026-07-19-api-parity-upgrade-map.md) | Kiểm kê ~64 endpoint còn thiếu + 14 nâng cấp + 10 delta schema |
| [Infra parity](analysis/2026-07-19-infra-parity-nexora.md) | 8 lỗ hạ tầng xuyên suốt — thứ API parity map bỏ lọt |
| [Quét sâu Nexora](analysis/2026-07-19-nexora-deep-sweep.md) | **Bảng theo dõi A1–A11** + quy tắc nghiệp vụ W2–W6 + kiến trúc P3b |
| [Kiểm kê env keys](analysis/2026-07-19-env-keys-inventory.md) | Key nào đã lấy/còn thiếu, rủi ro ngày bảo vệ |
| [Đối chiếu lại P3a-B](analysis/2026-07-21-p3a-b-parity-recheck.md) | Rà song song wishlist·enquiry·newsletter — không thụt lùi Quan trọng, chỉ 2 điểm Nhỏ |
| [Rà soát độc lập toàn API](analysis/2026-07-21-independent-review.md) | **Parity + review defect toàn `apps/api`** — 4 High (refund/spam), chùm Medium, 19 invariant canh mạnh; tiền-RA là điểm yếu |
| [Sweep parity toàn code trước P3a-B](analysis/2026-07-21-full-parity-sweep-pre-p3ab.md) | Đối chiếu parity 7 vùng (catalog·reviews·bookings·payments·cancel/refund·auth·worker), 7 agent — 1 Quan trọng (C1 catalog destination phụ) + 4 Nên có + 3 Nhỏ + nợ; invariant money/security lõi sạch. *Snapshot 21/07; B2·C3 đã vá sau (CAT-4/BK-3)* |

## Conventions — luật áp dụng mãi

| Tài liệu | Nội dung |
| --- | --- |
| [booking-states](conventions/booking-states.md) | Ledger kể chuyện tiền, status kể chuyện ghế — 4 trạng thái terminal |
| [outbox-dedupe-key](conventions/outbox-dedupe-key.md) | `<event>:<entityId>[:<state>]` — chống bug nuốt email 16/07 |
| [read-then-write-races](conventions/read-then-write-races.md) | Bẫy EvalPlanQual — đã cắn dự án 2 lần, kèm cách sai đã thử |

## Quy tắc viết

- **ADR trước code**; spec được user duyệt trước khi triển khai.
- **CHANGELOG là nơi duy nhất** giữ lịch sử và tiến trình số test.
- Doc hiện-trạng giữ NGẮN, chỉ phản ánh hiện tại; chuyện đã qua để CHANGELOG lo.
- Spec của skill `superpowers:brainstorming` cũng ghi vào `specs/` — **không tạo
  `docs/superpowers/`** (skill cho phép override đường dẫn mặc định).

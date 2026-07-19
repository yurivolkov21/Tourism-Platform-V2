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

## Specs — theo phase

| Phase | Spec | Trạng thái |
| --- | --- | --- |
| P1 API lõi | [2026-07-18-p1-api-core](specs/2026-07-18-p1-api-core.md) | ✅ đã merge |
| P2 Money-path | [2026-07-18-p2-money-path](specs/2026-07-18-p2-money-path.md) | ✅ đã merge |
| P3a API khách hàng | [2026-07-19-p3a-customer-api](specs/2026-07-19-p3a-customer-api.md) | 🔨 đang làm |
| P3b Web · P4 Admin · P5 Mobile · P6 AI · P7 Polish UI | — | ⬜ chưa mở |

## Plans — kế hoạch triển khai (task-by-task)

| Kế hoạch | Phủ | Trạng thái |
| --- | --- | --- |
| [P3a-A: Nền chung + Reviews](plans/2026-07-19-p3a-a-foundation-reviews.md) | W0 + W1 (6 task) | 🔨 sẵn sàng thực thi |
| P3a-B: W2–W6 | wishlist · enquiry · newsletter · posts · site-media | ⬜ viết sau khi W1 đóng đinh pattern |

## Analysis — nghiên cứu từ Nexora

| Tài liệu | Dùng để |
| --- | --- |
| [Schema audit](analysis/2026-07-18-schema-audit-nexora.md) | Soi 27 model + quyết định tối ưu (H/M/LOW) |
| [API parity + upgrade map](analysis/2026-07-19-api-parity-upgrade-map.md) | Kiểm kê ~64 endpoint còn thiếu + 14 nâng cấp + 10 delta schema |

## Conventions — luật áp dụng mãi

| Tài liệu | Nội dung |
| --- | --- |
| [booking-states](conventions/booking-states.md) | Ledger kể chuyện tiền, status kể chuyện ghế — 4 trạng thái terminal |
| [outbox-dedupe-key](conventions/outbox-dedupe-key.md) | `<event>:<entityId>[:<state>]` — chống bug nuốt email 16/07 |

## Quy tắc viết

- **ADR trước code**; spec được user duyệt trước khi triển khai.
- **CHANGELOG là nơi duy nhất** giữ lịch sử và tiến trình số test.
- Doc hiện-trạng giữ NGẮN, chỉ phản ánh hiện tại; chuyện đã qua để CHANGELOG lo.
- Spec của skill `superpowers:brainstorming` cũng ghi vào `specs/` — **không tạo
  `docs/superpowers/`** (skill cho phép override đường dẫn mặc định).

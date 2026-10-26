# Đọc rồi ghi dưới Read Committed: cái bẫy EvalPlanQual

Lỗi này đã xảy ra hai lần trong dự án. Đọc trang này trước khi viết bất kỳ đoạn
code nào theo kiểu "đọc trạng thái, tính toán, rồi ghi lại" trên dữ liệu mà nhiều
người có thể ghi cùng lúc.

## Bẫy

Postgres chạy ở **Read Committed** (mặc định, và là mức dự án này dùng).
Trong một transaction, mỗi **statement** lấy snapshot riêng lúc nó bắt đầu.
Hai transaction chạy chồng nhau **không thấy thay đổi chưa commit của nhau**.

Nên mẫu này luôn sai khi có concurrency:

```ts
const agg = await tx.review.aggregate({ where: { tourId }, _count: true }); // đọc
await tx.tour.update({ where: { id: tourId }, data: { ratingCount: agg._count } }); // ghi
```

A và B cùng tính ra `5`, cả hai ghi `5`, trong khi đúng phải là `6`. **Lost update.**

## Cái bẫy bên trong cái bẫy: EvalPlanQual

Phản xạ tự nhiên là gộp thành một statement để "atomic":

```sql
UPDATE tours t
SET rating_count = s.cnt
FROM (SELECT COUNT(*) cnt FROM reviews WHERE tour_id = $1 AND is_approved) s
WHERE t.id = $1
```

**Vẫn sai.** Khi statement này phải chờ row-lock trên `tours` rồi chạy tiếp
qua **EvalPlanQual**, Postgres chỉ đọc lại đúng *row đích* bị khoá — nó
**không tính lại subquery**. Snapshot của cả statement đã chốt lúc statement
bắt đầu. Kết quả y hệt bug gốc.

Đã kiểm chứng bằng tay: hai `psql` session chồng nhau, `rating_count` vẫn
thiếu 1. **Đừng tin lập luận — đo.**

## Cách đúng

Khoá row đích ở **một statement riêng** trước, rồi ghi ở statement sau:

```sql
SELECT id FROM tours WHERE id = $1 FOR UPDATE;   -- statement 1: block ở đây
UPDATE tours t SET rating_count = s.cnt          -- statement 2: snapshot MỚI
FROM (SELECT COUNT(*) cnt FROM reviews WHERE tour_id = $1 AND is_approved) s
WHERE t.id = $1;
```

Statement 2 là statement mới nên có snapshot mới, thấy đủ mọi thứ đã commit —
kể cả của transaction vừa nhả lock. Đây là biến thể của ADR-0009: tinh thần
là "đừng để khoảng hở giữa đọc và ghi", không phải "nhồi mọi thứ vào một câu".

## Nơi đã áp dụng

| Chỗ | Lần dính | Cách xử lý |
| --- | --- | --- |
| Giành ghế khi webhook thanh toán về (gói việc W2 của spec P2) | Lần 1 | Bookings-first conditional claim + CHECK constraint abort (23514) |
| Tính lại `Tour.ratingAvg/ratingCount` khi duyệt đánh giá (đợt P3a) | Lần 2 | `SELECT … FOR UPDATE` rồi `UPDATE … FROM (SELECT …)` |
| Đổi trạng thái câu hỏi khách và ghi lịch sử (`enquiries/admin-enquiries.service.ts`) | — | Cùng khuôn: `SELECT … FOR UPDATE` đọc `status` rồi mới ghi; dùng lại thay vì nghĩ lại |

Từ đợt quản trị catalog (P4e), khuôn này thành nếp chung của trang quản trị. Kiểm
lại ngày 14/10/2026, ngoài ba chỗ trên còn dùng ở các file sau (trong
`apps/api/src/modules/`):

- `SELECT … FOR UPDATE` trên hàng đích: sửa chuyến và huỷ chuyến
  (`catalog/admin-departures.service.ts`, `catalog/departure-cancel.service.ts`),
  bật bán tour (`catalog/admin-catalog.service.ts`), xoá điểm đến
  (`catalog/admin-destinations.service.ts`), sửa và rút review
  (`reviews/reviews.service.ts`), đổi quyền và khoá tài khoản
  (`users/admin-users.service.ts`).
- `SELECT … FOR SHARE` hàng tour khi tạo hay sửa chuyến, để không chen được
  lúc tour đang hạ số khách tối đa (`catalog/admin-departures.service.ts`).
- `pg_advisory_xact_lock`: một khoá theo booking cho mọi luồng hoàn tiền
  (`bookings/refund-lock.ts`) và một khoá chung cho thứ tự danh mục
  (`catalog/admin-categories.service.ts`).

## Checklist khi review

- [ ] Có đoạn nào đọc giá trị rồi ghi lại giá trị dẫn xuất từ nó không?
- [ ] Hai request đồng thời trên **cùng row đích** thì sao?
- [ ] Đã khoá row đích **trước** khi đọc dữ liệu dùng để tính chưa?
- [ ] Có test integration chạy hai thao tác song song trên cùng row không?

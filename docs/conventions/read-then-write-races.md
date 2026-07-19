# Read-then-write dưới Read Committed — cái bẫy EvalPlanQual

> Đã cắn dự án này **hai lần**. Đọc trước khi viết bất kỳ đoạn nào
> "đọc trạng thái → tính → ghi lại" trên dữ liệu có nhiều người ghi.

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

## Cái bẫy TRONG cái bẫy — EvalPlanQual

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
| Claim seat khi webhook thanh toán (P2-W2) | Lần 1 | Bookings-first conditional claim + CHECK constraint abort (23514) |
| Recompute `Tour.ratingAvg/ratingCount` khi duyệt review (P3a-A) | Lần 2 | `SELECT … FOR UPDATE` rồi `UPDATE … FROM (SELECT …)` |

## Checklist khi review

- [ ] Có đoạn nào đọc giá trị rồi ghi lại giá trị dẫn xuất từ nó không?
- [ ] Hai request đồng thời trên **cùng row đích** thì sao?
- [ ] Đã khoá row đích **trước** khi đọc dữ liệu dùng để tính chưa?
- [ ] Có test integration chạy hai thao tác song song trên cùng row không?

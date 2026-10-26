# Soft 404 vì `loading.tsx` trên route động

Lỗi này được phát hiện khi dựng cụm trang Tours ngày 27/07/2026 và ảnh hưởng thẳng
tới sitemap. Đọc trang này trước khi thêm `loading.tsx` vào bất kỳ route App Router
nào có `notFound()` phía dưới nó.

## Hiện tượng

Slug lạ trả **HTTP 200 kèm giao diện 404** — không phải 404 thật. Trình duyệt
và mắt người thấy đúng trang lỗi nên dễ tưởng "đã đúng", nhưng crawler nhận 200
rồi đem trang lỗi đi index — nguy hiểm hơn khi route đó nằm trong sitemap.

## Cơ chế

`loading.tsx` tạo Suspense boundary cho segment **và mọi route con**. Next
stream shell (skeleton) ra trước, nên HTTP 200 đã gửi xong **trước khi** thân
trang kịp render và gọi `notFound()`. `notFound()` chỉ đổi được nội dung stream
sau đó, không đổi được status code đã gửi.

Đã đo ở cả `next dev` lẫn bản build production, nên đây không phải hiện tượng
riêng của dev server.

## Luật

**Không đặt `loading.tsx` trên bất kỳ route động (`[slug]`, `[id]`…) nào có
gọi `notFound()`.** Muốn skeleton cho route đó, tách route group riêng
(`(listing)/`) để `loading.tsx` chỉ bọc phần listing tĩnh, không bọc segment
động — URL không đổi vì route group không xuất hiện trong path.

Cách sau đã thử và không có tác dụng, đừng thử lại: `export const dynamicParams = false`.
404 sinh từ cấu hình này vẫn đi qua cùng Suspense boundary — đo vẫn ra 200. Nó
còn gài thêm một bẫy khác: tour/bài viết mới publish sẽ 404 tới lần build kế
tiếp.

**Bẫy tái phát khi trang tĩnh chuyển sang gọi API** (đã xảy ra lúc nối web vào API):
trang detail cần skeleton thật cho lúc fetch, và thêm `loading.tsx` lúc đó là
soft-404 quay lại. Bất cứ lần nào một route động đổi model render (SSG → ISR,
tĩnh → fetch), phải đo lại status của slug lạ ngay trong cùng lần thay đổi đó,
không để sau.

## Cách đo

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/tours/slug-khong-ton-tai
```

Phải ra `404`. Ra `200` nghĩa là có `loading.tsx` (hoặc Suspense boundary
tương đương) đang bọc route động phía trên `notFound()`. Đo trên cả `next dev`
và sau `next build && next start` — hai runtime stream khác nhau, một trong
hai xanh không đủ để kết luận.

## Tham chiếu

- [`docs/plans/2026-07-27-tours-pages.md`](https://github.com/yurivolkov21/Tourism-Platform-V2/blob/6785326e69949d4ef566c5eaf7c3eaa3706859c8/docs/plans/2026-07-27-tours-pages.md)
  §"Soft 404 vì `loading.tsx`" — bản ghi phép đo gốc (Task 8), giữ nguyên văn
  làm lịch sử.
- [ADR-0016](../adr/0016-web-data-layer.md) — chốt luật này thành mặc định
  toàn site: mặc định không có `loading.tsx` trên route động; muốn skeleton thì
  đặt trong route group tách riêng.

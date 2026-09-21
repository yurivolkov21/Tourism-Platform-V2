# ADR-0044 — Prerender thử lại khi API hắt hơi, và docs không dựng lại API

- **Trạng thái:** Accepted (2026-09-21, ADR đi trước code)
- **Bối cảnh:** ba lượt build web liên tiếp trên Vercel chết vì API trả lỗi tạm
  thời trong lúc prerender, trong khi chính endpoint đó gọi tay vẫn 200 dưới
  0,6 giây.
- **Liên quan:** [ADR-0016](0016-web-data-layer.md) (quyết định "build với
  API sống", `settle` là lưới an toàn) · [ADR-0024](0024-deploy-targets.md) (Vercel +
  Render, `warm-api.mjs` đánh thức API trước `next build`)

## Bối cảnh

### Triệu chứng đo được

Ba lượt build production ngày 21/09, **ba mã lỗi khác nhau, cùng một nguyên
nhân họ hàng** — tất cả đều là lỗi thượng nguồn trên đường tới API:

| Deploy | Trang chết | Lỗi |
| --- | --- | --- |
| `f4809d3f` | `/tours/bana-hills-golden-bridge-day` (trang 57/75) | `TimeoutError` — quá 10s |
| `659a48fc` | `/blog/what-to-pack-for-the-mist-season` (trang đầu) | HTTP **502**, header `x-render-routing: dynamic-free-error` |
| redeploy `659a48fc` | `/blog/what-to-pack-for-the-mist-season` | HTTP **520**, trang lỗi HTML của Cloudflare |

Cùng lúc đó, gọi tay `GET /api/posts/what-to-pack-for-the-mist-season` trả
**200 trong 0,58s**, và `/api/health` trả 200 trong 0,3s.

### Hai nguyên nhân chồng nhau

**1. Mỗi push lên `main` dựng lại CẢ HAI nơi cùng lúc.** Service Render đặt
`autoDeploy: yes` theo mọi commit, không lọc đường dẫn. Log Render lượt
`659a48fc` nói thẳng: `03:22:59 ==> Deploying…` → `03:23:34 Starting Nest
application…`, còn build web gọi API lúc `03:23:48` và nhận 502. Commit đó chỉ
sửa **hai file trong `docs/`** — không có lý do gì API phải dựng lại.

**2. Instance free của Render không chịu nổi loạt 75 request prerender.** Build
chạy ở vùng IAD của Vercel, service nằm ở Singapore, gói **free** một instance.
Cloudflare đứng trước trả 520/502 khi origin nghẹn. Lượt redeploy (không có
push kèm theo, API đã tỉnh ổn định 11 phút) vẫn chết — nên riêng nguyên nhân 1
không giải thích hết.

### Vì sao `settle` không cứu

ADR-0016 §4 có `settle()` để page không sập khi API hắt hơi, nhưng
`fetchPostDetail` **cố ý ném lại** mọi lỗi khác `POST_NOT_FOUND` để error
boundary xử lý. Đổi nó thành `settle` là sai hướng: build sẽ XANH trong khi
xuất bản một trang bài viết rỗng. Thà đỏ còn hơn đăng trang thiếu nội dung mà
không ai biết.

## Quyết định

### 1. Tầng vận chuyển thử lại, không phải từng hàm fetch

Bọc `fetch` của `OpenAPILink` (một chỗ duy nhất trong `client.ts`) bằng một lớp
thử lại. Mọi route hưởng lợi mà không đụng ngữ nghĩa lỗi của từng hàm đọc.

**Bốn ràng buộc, không thương lượng:**

1. **CHỈ `GET`.** `bookings.create` là POST; thử lại một POST là nguy cơ đặt
   trùng chỗ và thu tiền hai lần. Method khác GET đi thẳng, không thử lại.
2. **CHỈ phía server.** Trình duyệt giữ nguyên hành vi hiện tại: người dùng
   đang ngồi trước màn hình, im lặng thử lại ba lượt chỉ làm họ chờ lâu hơn mà
   không biết vì sao. Lỗi ở trình duyệt vẫn đi thẳng vào ba kênh lỗi đã có.
3. **Tạm thời mới thử lại.** Lỗi mạng/timeout, hoặc status trong
   `{408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524}`. **404 và mọi
   lỗi 4xx nghiệp vụ khác đi thẳng** — `POST_NOT_FOUND` phải tới được nhánh
   `notFound()`, thử lại nó là ba lần chậm rồi vẫn 404.
4. **Ba lượt, giãn dần 400ms rồi 1200ms.** Đủ để vượt một lần thay instance của
   Render (đo: Nest boot xong trong ~1,5s sau khi container chạy), không đủ để
   giấu một sự cố thật — API chết hẳn thì build vẫn đỏ sau ~2 giây phụ trội.

### 2. Hạn chót mỗi lượt: server 20s, trình duyệt giữ 10s

10s là hạn hợp lý cho trình duyệt. Với prerender bắn hàng loạt từ IAD sang một
instance free ở Singapore thì nó quá chặt — chính là lỗi `TimeoutError` của
`f4809d3f`. Nới riêng phía server lên 20s; trình duyệt **không đổi**.

### 3. Commit chỉ đụng `docs/` không dựng lại API

Bật Build Filter của Render với `docs/**` ở *Ignored Paths*. Đây là thao tác
trên dashboard Render — API của Render (và MCP) chưa mở cấu hình này, nên nó là
**việc tay, ghi vào CHANGELOG mục CÒN TREO** chứ không tự động hoá được.

Không tắt hẳn `autoDeploy`: khi `apps/api/**` đổi thật thì tự dựng lại vẫn là
hành vi đúng, và tắt đi là mời gọi quên deploy.

## Hệ quả

- Build web chịu được một lần thay instance hoặc một cú 520 lẻ của Cloudflare.
- Sự cố thật vẫn làm build đỏ — chỉ chậm thêm ~1,6 giây trên đường đỏ.
- Đường tiền không đổi hành vi: POST không bao giờ được gửi lại.
- Phần lớn lượt deploy sau này không còn cuộc đua, vì đợt mockup/tài liệu —
  loại commit nhiều nhất của dự án lúc này — sẽ không chạm tới API nữa.

## Đã cân và bỏ

- **Tăng gói Render lên starter.** Giải đúng gốc (hết bóp CPU, không ngủ) nhưng
  dự án không doanh thu và đang trong cửa freeze; tốn tiền thật cho một bài
  capstone.
- **Bỏ prerender, chuyển hết sang dynamic.** Mất lợi thế lớn nhất của bản web
  hiện tại và làm mọi trang chậm đi vì một lỗi hạ tầng hiếm.
- **Chỉ nới timeout, không thử lại.** Không cứu được 502/520 — hai trong ba ca
  đo được trả lỗi NGAY, không phải chờ lâu.
- **`settle` cho trang chi tiết bài viết.** Xanh giả: xuất bản trang rỗng.

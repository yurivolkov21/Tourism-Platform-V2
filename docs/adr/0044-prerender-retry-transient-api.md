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

## AMEND 1 — Lúc build chờ lâu hơn, lúc chạy giữ nguyên (29/09)

Bản deploy web của `962d6090` (lượt push merge F18) vẫn ERROR dù đã có lớp thử lại.
Log build trên Vercel:

- `warm-api.mjs` gọi `/api/health` ba lượt đều `TimeoutError` (5 giây mỗi lượt), tới
  lượt thứ tư mới được trả lời, sau 24 giây.
- 27 giây sau, prerender `/tours/phu-quoc-honeymoon-4d` ném `TypeError: fetch failed`
  với nguyên nhân `ECONNRESET`, sau khi đã dùng hết ba lượt của §1.4 (tổng chờ 1,6
  giây).
- Lượt push kế tiếp (`47b8dc64`) READY mà không đổi gì phía web.

Lượt push ấy mang cả các commit sửa `apps/api` của F18, nên API dựng lại đúng luật và
chạy cùng lúc với build web — đúng loại ca mà Build Filter của §3 (user bật 21/09 với
`docs/**`) không chặn và không được chặn. Lần thay instance này kéo dài hơn con số ~1,5
giây mà §1.4 dựa vào.

**Quyết định:** ràng buộc 4 của §1 tách thành hai lịch chờ; ba ràng buộc kia giữ
nguyên.

- **Lúc build** (`process.env.NEXT_PHASE === 'phase-production-build'`): sáu lượt,
  chờ 1s, 2s, 4s, 8s, 15s giữa các lượt, tổng 30 giây. Next 16.3.4 gán biến này
  trong tiến trình `next build` ngay trước khi tạo worker thu thập dữ liệu trang và
  prerender, và worker nhận nguyên `process.env` của tiến trình cha (đọc trong
  `next/dist/build/index.js` và `next/dist/lib/worker.js`).
- **Lúc chạy** (ISR, SSR, route handler): giữ 400ms rồi 1200ms như §1.4.
- Mỗi lần thử lại ghi một dòng cảnh báo (đường dẫn, lượt thứ mấy, chờ bao lâu, vì
  sao). Trước đây thử lại im lặng, nên log build không cho biết lớp này đã cứu hay
  chưa từng chạy.

Chỉ lúc build mới chờ lâu, vì lúc đó không có ai đứng chờ trang, còn build đỏ thì mất
một bản deploy và phải push lại. Lúc chạy có người đang chờ, nên lỗi thật phải lộ
nhanh. Sự cố thật vẫn làm build đỏ, chỉ muộn thêm khoảng 30 giây chờ. Mỗi lượt vẫn
chịu hạn 20 giây của §2, nên ca xấu nhất một lượt gọi mất khoảng hai phút rưỡi trước
khi build đỏ.

**Đã cân và bỏ:**

- **Chờ API deploy xong rồi mới build** (so commit API đang chạy với commit đang
  build): API phải lộ commit, mỗi lượt build web chờ thêm đúng thời gian Render dựng
  image, và sẽ treo tới hết hạn mỗi khi API không dựng lại — tức mọi lượt push mà
  Build Filter của §3 đã chặn.
- **Nới chung cho cả lúc chạy:** người xem trang phải chờ tới 30 giây khi API sập
  thật.
- **Siết thêm Build Filter của §3:** đã bật cho `docs/**` từ 21/09, và thêm
  `apps/web/**`, `apps/admin/**`, `apps/mobile/**` vẫn là việc tay để dành. Không
  mức siết nào cứu được lượt push có sửa `apps/api/**` hay `libs/**`, vốn phải dựng
  lại API.

## AMEND 2 — Lượt ghi của trình duyệt chờ bằng trần của API (20/10)

Review F3 (vỏ web) theo phát hiện L3-20 của review L3. §2 cho trình duyệt hạn 10 giây
cho MỌI lượt gọi. Với lượt đọc thì đúng. Với lượt ghi thì sai, vì hai đầu không bỏ
cuộc cùng lúc:

- API cho một route chạy tới trần `handlerTimeout` 60 giây (`apps/api/src/bootstrap.ts`).
  `bookings.create` gọi Stripe hoặc PayPal, mỗi lượt gọi nhà cung cấp được tới 15 giây
  (`PROVIDER_HTTP_TIMEOUT_MS`), PayPal lúc nguội gọi hai lượt.
- API không huỷ việc đang làm khi client đóng kết nối. Đo trên máy thi công: một lượt
  `POST /api/bookings` thường và hai lượt client đóng socket sau 2 ms và 10 ms, cả hai
  lượt bỏ ngang đều không nhận được byte trả lời nào, vẫn sinh đủ ba đơn `PENDING` cho
  cùng một khách và một chuyến.
- Render free ngủ khi rảnh. Lượt gọi đầu tiên sau giấc ngủ phải chờ API dậy (đo ở
  AMEND 1: 24 giây), rồi vẫn được chuyển tới API sau khi trình duyệt đã bỏ cuộc.

Hệ quả cũ: khách bấm "Reserve", sau 10 giây thấy câu lỗi "không mở được thanh toán",
trong khi đơn đã được tạo. Bấm lại là thêm một đơn nữa. App admin đã gặp đúng lớp này
từ review F2 (31/08) và cho lượt ghi tiền 30 giây
(`apps/admin/src/lib/api/bookings.ts`).

**Quyết định:** §2 tách theo method, chỉ phía trình duyệt.

- Trình duyệt, `GET` và `HEAD`: giữ 10 giây.
- Trình duyệt, mọi method khác: 60 giây, bằng `handlerTimeout` của API. Tới lúc đó API
  đã tự trả 503 nếu vẫn chưa xong, nên khách nhận câu trả lời thật thay vì một lần bỏ
  cuộc phía mình.
- Server: giữ 20 giây cho mọi method. Server web hiện chỉ gọi `GET`.
- Không thử lại lượt ghi nào, như §1.1.

Hạn đặt một chỗ, hàm `requestTimeoutMs` trong `apps/web/src/lib/api/retry-fetch.ts`, và
áp cho mọi lượt gọi qua client oRPC của web. Đăng nhập (Better Auth client) và khung
chat không đi qua client này nên không đổi.

**Còn lại, không giải ở đây:** khách bấm lại sau một lỗi THẬT vẫn sinh đơn thứ hai, vì
`bookings.create` không chống trùng. Chống trùng thật (khoá idempotency do client sinh,
hoặc trả lại đơn `PENDING` còn hạn của cùng khách và cùng chuyến) là việc của luồng đặt
tour (L3), ghi thành đề xuất trong báo cáo F3.

**Đã cân và bỏ:**

- **30 giây như admin:** PayPal lúc nguội đã tới 30 giây chỉ riêng phần nhà cung cấp,
  cộng giấc ngủ của Render là vượt.
- **Chỉ nới cho `bookings.create`:** lượt huỷ đơn (hoàn tiền), mở lại thanh toán, gửi
  đánh giá, gửi yêu cầu tour riêng đều cùng một kiểu lỗi; một luật theo method gọn hơn
  một danh sách endpoint phải nhớ cập nhật.

## AMEND 3 — Lúc chạy không thử lại 429, tra phiên phía server có hạn 30 giây (09/11)

Sự cố 08/11: API, admin và web treo nhiều giờ dù không có commit nào hỏng. Đo được:

- Lớp định tuyến của Render từ chối đánh thức service free đang ngủ: trả 429 kèm header
  `x-render-routing: hibernate-rate-limited` (bắt được trong lỗi runtime của web trên
  Vercel lúc 08:11 và 08:57 UTC). Log Render không có instance nào khởi động từ 07/11
  23:41 UTC tới 08/11 11:29 UTC, rồi lại từ 13:11 tới 20:23 UTC. Chỉ một lần Manual
  Deploy mới dựng được instance trong lúc bị chặn. Render không công bố ngưỡng của lệnh
  chặn này và không gửi `Retry-After`.
- Web vẫn thử lại 429 hai lượt theo §1.3, mà mỗi trang gọi nhiều endpoint, nên mỗi lượt
  vào web lúc API ngủ thành một chùm request tới đúng cổng đang chặn. Chùm request có
  kéo dài lệnh chặn hay không là suy đoán; chắc chắn là thử lại trong 1,6 giây không vượt
  được một lệnh chặn kéo dài hàng giờ, cũng không vượt được cửa sổ một phút của bucket
  đọc 300 lượt theo IP của chính API (`apps/api/src/config/throttle.ts`).
- Admin quay tới trần 300 giây của Vercel ("Task timed out after 300 seconds" trên `/`,
  6 lần): `lookupServerSession` gọi `get-session` không đặt hạn, nên khi Render giữ kết
  nối trong lúc định đánh thức, trang không bao giờ trả lời. `readServerSession` của web
  cùng khuôn. Hai hàm này không đi qua client oRPC nên §2 không phủ (AMEND 2 đã ghi).

**Quyết định:**

1. **Lúc chạy** (ISR, SSR, route handler), 429 rời danh sách thử lại của §1.3. **Lúc
   build** giữ nguyên danh sách cũ cùng lịch 30 giây của AMEND 1: không ai đứng chờ, và
   nếu prerender bắn hàng loạt vượt bucket đọc theo IP của API thì chờ theo lịch dài là
   qua. Hàm `transientStatusesFor(phase)` chọn danh sách một lần lúc nạp module, cùng
   khuôn `retryDelaysFor`.
2. **Tra phiên phía server** của web và admin có hạn 30 giây (`SESSION_LOOKUP_TIMEOUT_MS`).
   Hết hạn được xếp như mọi lỗi mạng đã có: admin trả `unreachable`, web ném
   `SessionUnavailableError`. 30 giây phủ một lần đánh thức bình thường (AMEND 1 đo 24
   giây) và vẫn ngắn hơn mười lần trần 300 giây của Vercel.

**Hệ quả:**

- Khi Render chặn, mỗi lượt vào web chỉ gửi một request cho mỗi endpoint thay vì ba.
- Admin khi API không trả lời: sau 30 giây layout coi như không có phiên và chuyển về
  `/login`, đúng hành vi `getServerSession` đã có cho ca `unreachable`, thay vì quay 5
  phút rồi lỗi.
- Một lần đánh thức chậm hơn 30 giây làm admin chuyển về `/login` dù phiên còn; tải lại
  sau khi API dậy là vào được. Chấp nhận, vì đổi lại là không bao giờ quay 5 phút.

**Đã cân và bỏ:**

- **Chỉ bỏ 429 mang header `hibernate-rate-limited`:** 429 do throttle của API lúc chạy
  cũng không qua được trong 1,6 giây; một luật theo status gọn hơn soi header.
- **Bỏ 429 cả lúc build:** chưa có lượt build nào đo được dính cổng chặn của Render, còn
  throttle của API lúc prerender là đúng ca mà lịch dài cứu được.
- **Hạn 10 giây như client oRPC của admin:** tra phiên là lượt đầu tiên chạm API vừa
  ngủ dậy; 10 giây biến mọi lần đánh thức bình thường thành một lần chuyển về `/login`.
- **Giữ API thức để khỏi phải đánh thức:** cần gói trả phí hoặc ping giữ thức. Nhân
  viên Render gọi việc giữ service free thức là lạm dụng, còn mỗi giờ thức tốn khoảng
  12 đến 15 MB băng thông của hạn 5 GB một tháng.

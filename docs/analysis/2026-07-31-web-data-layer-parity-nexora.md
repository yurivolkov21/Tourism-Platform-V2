# Đối chiếu Nexora — tầng dữ liệu của frontend web (trước ADR-0016)

Ngày 31/07/2026 · phục vụ [ADR-0016](../adr/0016-web-data-layer.md) · rà theo
luật CLAUDE.md #10 TRƯỚC phase nối API. Repo tham chiếu
`/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform` đọc-only, không sửa gì.

Bốn nhãn phân loại: **thụt lùi cần vá** · **cố ý bỏ (ghi lý do)** ·
**làm khác mà tương đương** · **v2 tốt hơn**.

## Nexora làm thế nào (bản đồ đo được)

- **Client:** KHÔNG axios, KHÔNG React Query/SWR ở web. Typed client
  `openapi-fetch` sinh từ OpenAPI schema (~7.000 dòng generated), dùng chung
  web/admin/mobile: `libs/shared/core/src/lib/api/client.ts` —
  `createApiClient({baseUrl, getToken?})`, 2 middleware (gắn Bearer mỗi
  request; non-2xx parse envelope rồi throw `ApiRequestError(status, code,
  message)`). Web wrapper 14 dòng tạo client public không token.
- **Nơi fetch:** chủ đạo Server Component (Next 16.2.6 App Router) + ISR;
  mutations qua Server Actions (5 file `lib/*/actions.ts`, form
  `useActionState`). Client-side fetch đúng 5 chỗ có lý do ghi chú — trong đó
  **enquiry + newsletter gửi từ browser vì API throttle per-IP** (đi qua
  server là dồn mọi khách vào 1 IP).
- **Cache:** không cache layer JS; toàn bộ là Next Data Cache — `export const
  revalidate = 300` trên mọi trang catalogue/blog (contact 3600, account
  `force-dynamic`), mọi fetch gắn tag từ taxonomy MỘT module
  `lib/revalidate.ts` (`TAGS.*` + `tourTag(slug)`/`postTag(slug)`), và
  **on-demand bust**: API NestJS POST vào `app/api/revalidate/route.ts` của
  web (secret so constant-time, tag lạ reject 400) — ADR-0013 + spec riêng
  của repo cũ. React `cache()` bọc fetch detail chống double-fetch
  metadata↔body.
- **Loading/error:** `loading.tsx` + skeleton theo shape từng route;
  3 tầng lỗi — route boundary (`error.tsx` tái dùng `ErrorState`),
  **tri-state section-level** `lib/resilience.ts` (`settle()` không throw +
  `contentState()` failed-thắng-empty) render `LoadErrorState` (retry =
  `router.refresh()`), và toast sonner + flash-param cho action redirect.
  Quy ước: lỗi validate field inline, toast chỉ cho kết quả thao tác.
- **Auth:** Supabase Auth qua `@supabase/ssr`, token trong cookie; proxy
  (middleware) matcher **cố tình hẹp** `['/account/:path*',
  '/tours/:slug/book']` để trang public giữ static; Bearer đọc per-call từ
  server session; refresh flow không tự viết.
- **Retry/timeout:** KHÔNG timeout, KHÔNG AbortSignal ở bất kỳ đâu (đã grep
  cả `apps/web` lẫn `libs/shared/core`). Retry chỉ theo ngữ cảnh: retry-once
  sau `USER_NOT_SYNCED`, `Promise.race` 2.5s cap cho mirror user, polling
  booking bounded 8 lần có backoff, còn lại retry là user bấm.
- **Env:** `NEXT_PUBLIC_API_BASE_URL` (origin trần) — **lặp tay ở 8 file**,
  không có module config tập trung (điểm đau họ không sửa).
- **Envelope:** `{data, meta}` cho list nhưng KHÔNG đồng nhất cho single
  resource → mọi call site phải cast; comment trong client của họ tự ghi là
  nợ deferred.
- **Pagination:** chủ đạo client-side sau khi tải `pageSize:100` (để trang
  static) — không mở rộng được quá 100 tour.

## Bảng phân loại (luật 10)

| Hạng mục Nexora | v2 (theo ADR-0016) | Phân loại |
| --- | --- | --- |
| Typed client codegen `openapi-fetch` ~7.000 dòng | oRPC `OpenAPILink` + `@tourism/contract` — type thẳng từ Zod, không codegen | **v2 tốt hơn** |
| Envelope không đồng nhất, cast ở mọi call site | Envelope thống nhất toàn API (ADR-0010) + typed errors | **v2 tốt hơn** |
| Server-first RSC + ISR 300s + tag taxonomy 1 module | Giữ nguyên mô hình | làm khác mà tương đương (kế thừa) |
| `settle()`/`contentState()`/`LoadErrorState` — lỗi ≠ rỗng | Port khái niệm, có test | làm khác mà tương đương (kế thừa) |
| On-demand revalidation (API gọi web, secret, tag whitelist) | Chưa có phía API — bước riêng sau bước nối 1–4 | **thụt lùi cần vá** (nợ có kế hoạch; tag cắm sẵn từ đầu) |
| `loading.tsx` + skeleton mọi route | Mặc định KHÔNG — bẫy soft-404 đã đo ở v2 | cố ý bỏ (ghi lý do; Nexora không dính vì cấu trúc segment khác) |
| Server Actions cho mutations (token Supabase nằm server) | Better Auth cookie-session → hướng browser-direct; chốt bước 7 | làm khác — tiền đề token đổi |
| Enquiry/newsletter gửi từ browser (per-IP throttle) | Giữ nguyên bài học — v2 có đúng cùng throttle | làm khác mà tương đương (kế thừa) |
| Không timeout/AbortSignal | `AbortSignal.timeout(10s)` mặc định trong custom fetch | **v2 tốt hơn** |
| Env base-URL lặp tay 8 file | Một module `lib/api/env.ts` | **v2 tốt hơn** |
| Pagination client-side sau `pageSize:100` | Server-side từ contract | **v2 tốt hơn** |
| React `cache()` dedupe metadata↔body | Port | làm khác mà tương đương (kế thừa) |
| Client island cho per-user state trên trang static (wishlist) | Port pattern | làm khác mà tương đương (kế thừa) |
| Toast sonner + flash-param | Chưa cài — quyết ở form đầu tiên (bước 5) | chưa quyết, có ghi trong ADR |
| Optimistic update wishlist (tự quản state + rollback) | Xét ở bước 8 | khi tới bước |
| Signed direct-to-CDN upload avatar (3 bước, bytes không qua Next) | P4/khu tài khoản | khi tới bước |
| Chat AI streaming SSE + conversation id localStorage | P6 | khi tới phase |
| Polling booking bounded + backoff (`poll.ts` có test) | Bước 10 — mẫu đáng port | khi tới bước |

## Bài học đáng giữ nguyên văn (đã kiểm chứng ở repo cũ)

1. **"File fetch chỉ fetch + map; mọi nhánh quyết định nằm ở hàm pure có
   test"** — `lib/api/*` của Nexora đi kèm dàn spec (`paginate`, `resilience`,
   `revalidate`, `poll`, `review-mapper`…). Đây chính là chỗ luật TDD #4 của
   v2 áp vào tầng dữ liệu.
2. **Empty-state khi API lỗi là nói dối** — Nexora ghi thẳng trong comment
   `app/tours/page.tsx:16-18` của họ; `settle()` sinh ra từ bài học đó.
3. **Map DTO → view-model ngay cạnh fetch** (`toTourCard`, `toTourDetail`) —
   component không biết DTO, đổi contract chỉ sửa một chỗ.
4. **Matcher middleware hẹp có chủ đích** để trang public giữ static — nguyên
   tắc giữ cho bước 7 (session), bất kể cơ chế session chọn gì.

## Điểm mù — không kết luận được

1. Không chạy build/dev repo Nexora — mọi kết luận thuần đọc mã.
2. Không đọc phía API Nexora của flow revalidation ngoài service được trỏ tới
   (`web-revalidation.service.ts`) — contract tag whitelist suy từ phía web.
3. Mobile (TanStack Query `retry: 2, staleTime: 5m`) chỉ ghi nhận làm tham
   chiếu cho P5, chưa đối chiếu sâu.

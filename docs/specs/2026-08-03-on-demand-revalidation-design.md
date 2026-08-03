# Spec — On-demand revalidation: API bust cache-tag của web (2026-08-03)

- **Trạng thái:** Approved 03/08 (design + spec cùng ngày; quyết định kèm:
  ghi cơ chế bằng **khối amend ADR-0016 §3**, không mở ADR mới)
- **Nền:** [ADR-0016](../adr/0016-web-data-layer.md) §3 — tag cắm sẵn toàn
  site từ bước 1 đúng để hôm nay "chỉ còn thêm endpoint"; nợ này đã thành
  QUÁ HẠN theo khối cập nhật 03/08. Blueprint đã đối chiếu:
  [parity Nexora 31/07](../analysis/2026-07-31-web-data-layer-parity-nexora.md)
  (route web + secret constant-time + tag whitelist + một service phía API).
- **Branch:** `feat/on-demand-revalidation`. Amend ADR + spec commit thẳng
  `main` TRƯỚC khi mở branch (luật 5 "ADR đi trước code" + luật 1 docs-nhỏ).

## 1. Phạm vi

| # | Bề mặt | Ghi chú |
| --- | --- | --- |
| A | Route MỚI `POST /api/revalidate` (web) | Route handler đầu tiên của `apps/web` |
| B | `WebRevalidationService` (API) + móc `reviews.moderate` | Module mới, KHÔNG controller |
| C | Env 2 bên: `REVALIDATE_SECRET` (web+API) + `WEB_URL` (API) | Theo nếp `DEV_*_SECRET` default |
| D | Docs: khối "Chốt 2026-08-03" vào ADR-0016 §3 | Đi trước code |

Nguyên tắc xuyên suốt: **ISR 300s vẫn là lưới đúng đắn** — on-demand chỉ là
tối ưu độ tươi. Mọi lỗi trên đường này không được phép lan vào nghiệp vụ gốc.

## 2. A — Route handler phía web

- File: `apps/web/src/app/api/revalidate/route.ts` — chỉ export `POST`
  (method khác Next tự trả 405). Node runtime mặc định (cần `node:crypto`).
- **Auth:** header `x-revalidate-secret`, so bằng `crypto.timingSafeEqual`
  (độ dài lệch → fail sớm nhưng vẫn qua một nhánh so sánh cố định — hàm
  wrapper thuần có test). Sai/thiếu → **401**, body không nói gì thêm.
- **Body:** `{ tags: string[] }`. Whitelist khớp taxonomy
  [`lib/api/tags.ts`](../../apps/web/src/lib/api/tags.ts) — hợp lệ là:
  `posts` · `tours` · `post:<slug>` · `tour:<slug>` với slug
  `/^[a-z0-9-]{1,100}$/`. Ngoài ra: tối đa **20 tag/call**, mảng rỗng → 400.
  Tag lạ → **400** kèm danh sách tag bị loại (giúp debug phía API, không lộ
  thông tin gì — taxonomy vốn public trong bundle).
- Hợp lệ → `revalidateTag(tag)` từng cái → **200** `{ revalidated: <số> }`.
- Logic parse + validate tách hàm thuần `parseRevalidateBody()` (TDD trước);
  route chỉ là vỏ: đọc header → so secret → gọi hàm thuần → gọi `next/cache`.
- Route handler không vào sitemap/robots (không phải page — tự nhiên đứng
  ngoài, nghiệm thu xác nhận).

## 3. B — Phía API: một service, không rải fetch

- Module mới `apps/api/src/modules/web-revalidation/` (service + module,
  export service; không controller, không contract — đây là hạ tầng nội bộ).
- `revalidate(tags: string[]): Promise<void>` — **fire-and-forget đúng
  nghĩa**: `fetch(`${WEB_URL}/api/revalidate`, …)` với
  `AbortSignal.timeout(3000)`; response non-200, network error, timeout →
  `logger.warn` (kèm tags + lý do) và **không bao giờ throw**. Call-site gọi
  `void service.revalidate(…)` — không await trong đường nghiệp vụ.
- **Điểm móc duy nhất hôm nay:** `reviews.moderate`. Điều kiện bust:
  review có `tourId` **và** `isApproved` thực sự đổi (old ≠ new — old đã có
  sẵn trong `locked`, cùng transaction). Tags: `['tours', 'tour:<slug>']` —
  slug lấy từ kết quả trả của chính `moderate()` (đã `include tour.slug`).
- **Gọi SAU khi transaction commit** — bust trước commit là race: web
  regenerate đọc data cũ rồi cache lại 300s, tệ hơn không bust.
- KHÔNG móc `reviews.create` (tạo PENDING — vô hình với public). Posts chưa
  có endpoint ghi (P4) — route web đã nhận sẵn `post:*`, P4 chỉ việc gọi.

## 4. C — Env (theo nếp sẵn có, xem CLAUDE.md §env)

| Biến | Ở đâu | Giá trị |
| --- | --- | --- |
| `REVALIDATE_SECRET` | API `config/env.ts` + web (server-only, **KHÔNG** `NEXT_PUBLIC_`) | default dev `dev-revalidate-secret-change-me` cả hai bên (nếp `DEV_UNSUBSCRIBE_SECRET`) — dev chạy liền không cần khai; prod PHẢI set thật |
| `WEB_URL` | API `config/env.ts` | `z.string().url()` default `http://localhost:3000` |

Cập nhật `.env.example` cả hai app (file env duy nhất được commit).

## 5. Bust thủ công sau khi đổi seed (không xây endpoint)

```bash
curl -X POST http://localhost:3000/api/revalidate \
  -H 'x-revalidate-secret: dev-revalidate-secret-change-me' \
  -H 'content-type: application/json' \
  -d '{"tags":["tours","posts"]}'
```

Người cầm secret là operator — YAGNI với endpoint admin trung gian (đã cân
nhắc và loại trong design 03/08, cùng lý do loại đường outbox: cache tự lành
sau ≤300s, không cần at-least-once).

## 6. Test

- **Thuần (TDD trước):** `parseRevalidateBody` (whitelist, slug regex, max
  20, rỗng, không phải mảng, phần tử không phải string) · wrapper so secret
  (đúng/sai/lệch độ dài). Phía API: hàm quyết định "có bust không + tags nào"
  từ (tourId, oldApproved, newApproved, slug) — thuần, tách khỏi service.
- **Route (project node):** mock `next/cache` — 401 sai secret · 400 tag
  lạ/body hỏng · 200 đếm đúng số `revalidateTag` được gọi.
- **API:** service unit — fetch mock cho non-200/network/timeout → warn,
  không throw. Int test `moderate`: spy service — approve lần đầu gọi đúng
  `['tours','tour:<slug>']`; moderate không đổi trạng thái → KHÔNG gọi;
  review không gắn tour → KHÔNG gọi.
- **Nghiệm thu sống** (production build web + API + DB thật, §7 dưới).

## 7. Nghiệm thu (production build; dev Data Cache giữ last-success — gotcha đã ghi, không đo trên dev)

1. Build + start web production, API sống. Lấy 1 review PENDING (hoặc tạo
   qua flow thật/SQL), gọi endpoint admin moderate approve → **curl trang
   tour thấy review + ratingAvg mới NGAY**, không đợi hết cửa sổ 300s
   (đo trước-sau bằng `curl -s <tour-url> | grep`).
2. Log API có dòng bust (tags đúng); tắt web rồi moderate tiếp → API vẫn
   200, log warn xuất hiện, không crash.
3. Curl route: sai secret → 401; tag lạ → 400 kèm tên tag; `["tours"]` đúng
   secret → 200 `{revalidated:1}`.
4. `GET /api/revalidate` → 405; route không xuất hiện trong sitemap.xml.
5. `pnpm gate:int` xanh (build web trong gate cần API sống — nếp có sẵn).

## 8. Ngoài phạm vi

- Trigger cho posts/tours CRUD (P4 admin — sẽ gọi cùng service).
- Reliability hơn fire-and-forget (outbox/retry) — ISR 300s là lưới.
- Rate-limit route revalidate — secret là đủ cho bề mặt nội bộ.
- Wishlist/account (không ISR, bước 8–10).

## 9. Rủi ro

- **Prod quên set `REVALIDATE_SECRET` thật** → secret dev đoán được, người
  lạ bust cache = DoS nhẹ (ép regenerate, không đổi data). Cùng lớp misconfig
  `BETTER_AUTH_SECRET` — ghi vào checklist deploy, không chặn ở code.
- **Bust trước commit** → cache 300s giữ data cũ (điều khoản §3 chốt: gọi
  sau commit; int test canh thứ tự bằng spy).
- Dev không mở web: mỗi lần moderate có 1 dòng warn sau ≤3s — chấp nhận,
  không phải lỗi.

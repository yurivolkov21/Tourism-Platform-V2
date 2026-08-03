# Spec — Bước 5+6 nối API: form Contact + Newsletter + trang unsubscribe (2026-08-03)

- **Trạng thái:** Approved 03/08 (2 quyết định UX chốt cùng ngày: **sonner
  toast toàn site** — user chọn khác khuyến nghị, mount Toaster từ cụm này ·
  trang unsubscribe theo khuôn utility sẵn, không vòng demo riêng)
- **Nền:** [ADR-0016](../adr/0016-web-data-layer.md) §2 — ranh giới đã chốt
  TRƯỚC: hai bề mặt GHI công khai này **browser gọi thẳng API** (throttle
  `PUBLIC_WRITE_THROTTLE` tính theo IP — đi qua server Next là dồn mọi khách
  vào 1 IP); lỗi validate field hiển thị **inline**; đây là hai bước ĐẦU TIÊN
  site có hành vi ghi.
- **Branch:** `feat/contact-newsletter-api`.

## 1. Phạm vi

| # | Bề mặt | Procedure | Ghi chú |
| --- | --- | --- | --- |
| A | Form contact "lá thư" (`contact-split.tsx`) | `enquiries.create` | UI đã duyệt GIỮ NGUYÊN — chỉ thêm state/validate/submit |
| B | Newsletter footer (`site-footer.tsx`, input no-op sẵn chỗ) | `newsletter.subscribe` | Luôn `{subscribed: true}` (anti-enumeration) |
| C | Trang MỚI `/newsletter/unsubscribe` | `unsubscribeConfirm` (GET) · `unsubscribe` (POST) · `resubscribe` (POST) | Khuôn utility (ContentHero + panel); vào từ link email |
| D | Hạ tầng feedback | — | Mount `<Toaster />` (sonner từ `@tourism/ui`) ở root layout; copy toast/form vào `@tourism/i18n` |

## 2. A — Form contact

- **Client island:** phần form của `contact-split.tsx` thành client có state
  (component vốn đã client vì motion — kiểm khi thi công); **không đổi một
  pixel** layout "lá thư" đã duyệt. Thêm MỘT field ẩn honeypot `website`
  (kỹ thuật ẩn: wrapper `aria-hidden` + `tabIndex={-1}` + `autocomplete="off"`
  + CSS đẩy khỏi viewport — KHÔNG `display:none` để bot ngây thơ vẫn điền).
- **Validate client bằng CHÍNH schema contract:** import
  `CreateEnquiryInputSchema` từ `@tourism/contract` (zod chạy client được —
  không khai lại rule; message lỗi thân thiện map từ issue path, copy ở i18n,
  hiển thị inline dưới field). Không đủ min (name 2, message 10) thì chặn
  submit tại client; server vẫn là chốt cuối.
- **Mapping field → payload** (giữ UI, không ép người dùng theo schema):
  `name`→`name` · `email`→`email` · textarea "loves"→`message` · "count"→
  `groupSize` (parse int; rỗng/không phải số → bỏ field) · select "region"→
  `interests: [<region>]` · **"dates" (text tự do "next April")→ GHÉP vào cuối
  `message` dạng "\n\nPreferred dates: <text>"** — KHÔNG gửi `travelDate`
  (schema đòi ISO date, ép parse text tự do là bịa dữ liệu; hàm build payload
  là hàm thuần TDD).
- **Kết quả:** thành công → toast success + reset form; lỗi mạng/5xx → toast
  error (parse envelope ADR-0010, một parser) + GIỮ dữ liệu form; **429
  throttle → toast riêng** lời lẽ thân thiện ("bạn gửi hơi nhanh, thử lại sau
  một phút"). Honeypot dính → server trả 200 giả → phía client cứ toast
  success như thường (đúng thiết kế bẫy).

## 3. B — Newsletter footer

- Input sẵn có + nút submit thành form client nhỏ: validate email client
  (zod `SubscribeInputSchema`), honeypot `website` cùng kỹ thuật ẩn, gọi
  `newsletter.subscribe` browser-direct.
- Response LUÔN `{subscribed: true}` → toast success một kiểu duy nhất
  ("Check your inbox…") — **không phân biệt email đã tồn tại** (giữ đúng
  anti-enumeration của contract; client không được thêm nhánh nào khác).
  Lỗi mạng/429 → toast error/throttle như form contact.

## 4. C — Trang `/newsletter/unsubscribe?id=…&token=…`

- Route trong `(site)` (có navbar/footer), khuôn utility: ContentHero nhỏ +
  panel giữa trang. **Render động** (đọc `searchParams`, nội dung per-token —
  KHÔNG ISR, fetch không cache/tag; comment ghi rõ khác biệt với các trang
  catalogue). Meta `robots: noindex` (trang tiện ích từ email, không có giá
  trị index).
- **GET `unsubscribeConfirm`** ở server component (settle): token hợp lệ →
  panel hiện email (masked như API trả) + nút "Unsubscribe me" ; token hỏng/
  thiếu param → panel lỗi thân thiện + link về Home (KHÔNG 404 — người thật
  bấm link email cũ xứng đáng một lời giải thích). LƯU Ý contract: GET không
  side effect (email client prefetch) — trang này TUYỆT ĐỐI không tự POST khi
  load.
- **Nút "Unsubscribe me"** (client) → POST `unsubscribe` → panel đổi sang
  trạng thái đã huỷ + toast + hiện nút **"Re-subscribe"** (POST `resubscribe`,
  dùng lại đúng token — contract thiết kế sẵn cho undo). Mọi lỗi POST → toast
  error, panel giữ nguyên.
- Sitemap/robots: KHÔNG thêm vào sitemap.

## 5. D — Toaster + i18n (quyết định user 03/08)

- Mount `<Toaster position="bottom-right" richColors />` (sonner đã vendor
  trong `@tourism/ui`) tại root layout — bề mặt UI mới toàn site, user duyệt
  visual lúc nghiệm thu. Toast CHỈ cho kết quả thao tác; lỗi validate field
  vĩnh viễn inline (nếp đã ghi).
- Toàn bộ copy mới (label lỗi validate, toast success/error/throttle, trang
  unsubscribe) vào `@tourism/i18n` khối `contactForm` / `newsletterForm` /
  `unsubscribePage` — tiếng Anh (luật 7).

## 6. Kỹ thuật chung

- Client `api` (OpenAPILink) dùng được từ browser — `NEXT_PUBLIC_API_URL` đã
  có từ cụm Blog; call KHÔNG truyền context ISR (mutation không cache).
  Timeout 10s sẵn có; **không auto-retry mutation** (ADR-0016).
- CORS đã mở (`TRUSTED_ORIGINS` chứa localhost:3000; credentials chưa cần —
  hai endpoint public).
- TDD thuần: `buildEnquiryPayload(formState)` (mapping + honeypot passthrough)
  · parse-groupSize · masked-email hiển thị. Component jsdom: validate inline
  hiện đúng field, submit gọi đúng client (mock module `lib/api/client`),
  honeypot không render vào accessibility tree, unsubscribe page 3 trạng thái.
- **Không đụng** migrations/contract/API server (mọi procedure đã có từ P3a).

## 7. Nghiệm thu (production build + API sống; DB đọc bằng psql qua docker)

1. Gửi enquiry thật từ form → `select count(*) from enquiries` tăng 1, row
   đúng name/email/message (kèm "Preferred dates:"), groupSize/interests đúng
   mapping; honeypot điền tay → response 200 giả, **DB không tăng**.
2. Spam >5 request/phút (đúng ngưỡng `PUBLIC_WRITE_THROTTLE`) → 429 + toast
   throttle; nghỉ rồi gửi lại được.
3. Newsletter: subscribe email mới → row `subscribers`; subscribe LẠI cùng
   email → vẫn toast success y hệt (đo response không phân biệt); lấy
   `id`+`token` thật từ DB → mở `/newsletter/unsubscribe` → confirm hiện email
   masked → POST unsubscribe → row `unsubscribedAt` set → resubscribe → clear.
   Token rác → panel lỗi thân thiện, không crash.
4. Toaster hiện đúng vị trí, không che element tương tác nào đã duyệt (đo
   nhanh cả mobile viewport); trang unsubscribe có `noindex`, không vào
   sitemap.
5. `pnpm gate` 18/18 + `pnpm test:int` 145/145; các trang cũ không đổi (diff
   layout chỉ thêm Toaster).

## 8. Ngoài phạm vi

- EnquiryCta component dùng chung (nợ cụm pháp lý) — trang contact hiện đủ.
- Email templates/outbox phía API (đã có từ P3a); bước 7+ (auth/session).
- Toast cho các trang catalogue (đọc) — không có thao tác nào cần.

## 9. Rủi ro

- **Toaster là bề mặt visual mới toàn site** — theme sonner phải ăn token
  (kiểm bản vendor trong `@tourism/ui` đã wire token chưa; nếu chưa, wire
  bằng CSS variables — tokens-only, không hex).
- Form "lá thư" có motion phức tạp — thêm state không được phá stagger đã
  duyệt; diff component phải khoanh vào handler/validate.
- 6 component vendor còn `z-50` (nợ CHANGELOG 30/07): toast của sonner nằm
  NGOÀI danh sách đó nhưng cùng lớp rủi ro stacking — nghiệm thu 4 phải kiểm
  toast không bị navbar đè (z-index toast phải ≥ `--z-toast` 1700).

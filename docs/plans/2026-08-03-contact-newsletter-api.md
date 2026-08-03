# Plan — Bước 5+6: form Contact + Newsletter + trang unsubscribe

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** Hai bề mặt GHI đầu tiên của site hoạt động thật (enquiry + newsletter,
browser-direct theo ADR-0016) + trang unsubscribe 4 trạng thái + Toaster toàn
site — theo [spec](../specs/2026-08-03-contact-newsletter-api-design.md)
(Approved 03/08; chi tiết mapping/UX nằm TRONG spec §2–§5, plan không lặp lại).

**Architecture:** mutations browser-direct qua client `api` sẵn có (không
context ISR); phân loại lỗi submit một chỗ (`classifySubmitError` — envelope
ADR-0010 một parser); mọi copy vào i18n; form logic thuần tách khỏi component
để TDD.

**Tech Stack:** như các cụm trước; sonner đã vendor + token-wired trong
`@tourism/ui` (kiểm lại khi mount). Không dep mới.

## Global Constraints (áp cho MỌI task)

- **Branch `feat/contact-newsletter-api`** từ `main`. Conventional Commits.
  ⚠️ SAU MỖI COMMIT chạy `git log -1 --format='%B'`; NẾU output chứa
  "Co-Authored-By" THÌ `git commit --amend` message sạch rồi kiểm lại; NẾU
  không thì xong (lệnh một chiều — bài học fixer đọc ngược).
- Comment/JSDoc tiếng Việt; copy user-facing TIẾNG ANH và CHỈ trong
  `@tourism/i18n`; tokens-only; import không đuôi.
- **KHÔNG đổi visual các bề mặt đã duyệt** (form "lá thư", footer) ngoài
  đường state/handler + field honeypot ẩn; KHÔNG đụng API server/contract/
  migrations; KHÔNG loading.tsx.
- TDD logic thuần (skill `superpowers:test-driven-development`); jsdom
  ADR-0014. Đo tri-state/dev: `rm -rf apps/web/.next` trước (gotcha đã ghi).
- Cổng 3000 trống trước build/dev (curl `000`); API 3001; kill đúng PID;
  container Postgres để nguyên; DB đọc qua `docker exec … psql` khi nghiệm thu.

---

### Task 1: i18n + Toaster + `classifySubmitError`

**Files:**
- Modify: `libs/shared/i18n/src/lib/messages.ts` (3 khối MỚI chèn thuần:
  `contactForm` · `newsletterForm` · `unsubscribePage` — copy đủ cho spec
  §2–§4: label lỗi validate từng field, toast success/error/throttle, 4 trạng
  thái trang unsubscribe kể cả `alreadyUnsubscribed`)
- Modify: `apps/web/src/app/layout.tsx` (mount `<Toaster position="bottom-right" richColors />` từ `@tourism/ui`)
- Create: `apps/web/src/lib/api/submit.ts` + `submit.spec.ts`

**Interfaces:**
- Produces: `classifySubmitError(error: unknown): 'throttle' | 'error'` —
  thuần; nhận error từ oRPC client, soi envelope/status: 429 → 'throttle',
  còn lại 'error'. (Kiểm shape error thật của `@orpc/client` 1.14.8 khi lỗi
  HTTP không-defined — đọc `.d.ts`/thử; đừng đoán field.) Kèm
  `submitToast(kind, messages)` mỏng gọi sonner `toast.success/error` — copy
  từ i18n truyền vào, helper không hardcode chuỗi.

- [ ] Step 1: i18n 3 khối (chèn thuần — `git diff` chỉ hiện khối mới).
- [ ] Step 2 (TDD): `submit.spec.ts` — 429 → throttle; 500/network/timeout →
  error; RED→GREEN.
- [ ] Step 3: Mount Toaster; kiểm bản vendor `sonner.tsx` token-wired (đã thấy
  `var(--popover)` — xác nhận đủ, KHÔNG hex) và z-index: toast phải dùng
  `--z-toast` (1700) hoặc mặc định sonner cao hơn navbar 1100 — nếu bản vendor
  để z thấp, wire token (đúng nợ CHANGELOG 30/07 cùng lớp).
- [ ] Step 4: test + typecheck + biome; commit
  `feat(web): i18n form copy + Toaster + classifySubmitError`.

---

### Task 2: `buildEnquiryPayload` + wire form Contact

**Files:**
- Create: `apps/web/src/lib/enquiry-form.ts` + `enquiry-form.spec.ts`
- Modify: `apps/web/src/components/contact/contact-split.tsx` (+spec mới nếu
  chưa có)

**Interfaces:**
- Produces: `buildEnquiryPayload(state: ContactFormState): CreateEnquiryInput`
  — mapping ĐÚNG spec §2 (dates ghép message "\n\nPreferred dates: …";
  groupSize parse-int-hoặc-bỏ; region → interests[1]; honeypot passthrough) ·
  `validateEnquiry(state)` → map issue→field message (dùng CHÍNH
  `CreateEnquiryInputSchema` từ `@tourism/contract`).

- [ ] Step 1 (TDD): spec cho build/validate — đủ case: dates rỗng/có; count
  "4"/"bốn"/rỗng; region chọn/không; message ngắn <10 → lỗi field đúng key;
  honeypot giữ nguyên giá trị. RED→GREEN.
- [ ] Step 2: Wire `contact-split.tsx`: state + validate inline (copy i18n,
  hiện dưới field theo khuôn lỗi hiện có của form nếu có — đọc component
  trước) + honeypot ẩn đúng kỹ thuật spec §2 + submit
  `api.enquiries.create(payload)` (KHÔNG context) → toast theo Task 1; thành
  công reset form, lỗi GIỮ data. Diff khoanh vào handler/validate — motion/
  markup "lá thư" nguyên vẹn (so hunk).
- [ ] Step 3: jsdom spec: validate inline hiện đúng; submit gọi client đúng
  payload (mock `@/lib/api/client`); honeypot không vào accessibility tree
  (`getByRole` không thấy); success → form reset. Test + typecheck + biome;
  commit `feat(web): form contact gui enquiries.create — validate contract + honeypot`.

---

### Task 3: Newsletter footer

**Files:**
- Modify: `apps/web/src/components/site-footer.tsx` (hoặc tách
  `newsletter-form.tsx` client nhỏ NẾU footer đang là một client component
  lớn — chọn đường diff nhỏ nhất, ghi lý do)
- Create: spec jsdom tương ứng

- [ ] Step 1: form hoá input sẵn có (markup giữ) + honeypot + validate email
  (SubscribeInputSchema) + submit `newsletter.subscribe` → toast MỘT kiểu
  success (anti-enumeration — cấm nhánh phân biệt); 429/lỗi → toast theo
  classify. TDD phần thuần nếu phát sinh (validate wrapper), jsdom cho hành vi.
- [ ] Step 2: test + typecheck + biome; commit
  `feat(web): newsletter footer subscribe — anti-enumeration + honeypot`.

---

### Task 4: Trang `/newsletter/unsubscribe` (4 trạng thái)

**Files:**
- Create: `apps/web/src/app/(site)/newsletter/unsubscribe/page.tsx` +
  `apps/web/src/components/newsletter/unsubscribe-panel.tsx` (+spec jsdom)

- [ ] Step 1: Page server ĐỘNG (đọc `searchParams`; KHÔNG revalidate/tag —
  comment vì sao khác trang catalogue; metadata `robots: { index: false }`).
  Thiếu param/`settle` fail với INVALID_UNSUBSCRIBE_TOKEN → panel lỗi thân
  thiện + link Home (KHÔNG 404). GET `unsubscribeConfirm` KHÔNG side effect —
  ghi comment cảnh báo prefetch (spec §4).
- [ ] Step 2: `unsubscribe-panel.tsx` (client): nhận `{id, token, email,
  alreadyUnsubscribed}`; 4 trạng thái: confirm (nút "Unsubscribe me") ·
  already-unsubscribed (copy riêng + nút Re-subscribe) · post-unsubscribe
  thành công (toast + đổi copy + nút Re-subscribe) · sau re-subscribe (toast +
  copy welcome-back). POST lỗi → toast, panel giữ. Khuôn visual: ContentHero +
  panel giữa trang theo vết trang 404/legal (đọc `not-found-body`/LegalArticle
  làm mẫu — KHÔNG sáng tạo layout mới).
- [ ] Step 3: jsdom 4 trạng thái + mock client; test + typecheck + biome;
  kiểm `find … loading.tsx` không mới; commit
  `feat(web): trang xac nhan unsubscribe newsletter — 4 trang thai + noindex`.

---

### Task 5: Nghiệm thu spec §7 (production + DB thật + throttle)

- [ ] Step 1: DB/API sống; production build (cổng sạch trước). Đo và DÁN
  NGUYÊN VĂN — đủ 5 mục spec §7:
  1. Enquiry thật → `docker exec <pg> psql -U tourism -c "select name,email,left(message,80),group_size,interests from enquiries order by created_at desc limit 1"` khớp mapping (message chứa "Preferred dates:"); honeypot điền tay → 200 giả + count không tăng.
  2. Spam quá ngưỡng (đọc số thật trong `apps/api/src/config/throttle.ts`
     TRƯỚC khi đo) → 429 + toast throttle; chờ hết cửa sổ gửi lại OK.
  3. Vòng newsletter trọn: subscribe → row; subscribe lại → response y hệt;
     lấy id+token từ DB (cột token? — token HMAC sinh từ secret: xem
     `unsubscribe-token.ts` phía API để biết cách LẤY token hợp lệ cho test —
     nếu token chỉ nằm trong email outbox thì đọc `select payload from outbox
     order by created_at desc limit 1`) → unsubscribe → `unsubscribed_at` set
     → resubscribe → clear; token rác → panel lỗi.
  4. Toast: hiện đúng vị trí, KHÔNG bị navbar đè (đo z thật bằng devtools/
     playwright headless — bài học stacking 4 lần); mobile viewport nhanh.
  5. `pnpm gate` 18/18 + `pnpm test:int` 145/145; sitemap KHÔNG có
     /newsletter/unsubscribe; `curl -s <page> | grep -i noindex` có.
- [ ] Step 2: Kill PID, cổng sạch. Commit chốt (nếu có sửa vụn):
  `test(web): nghiem thu cum contact-newsletter`. DỪNG — final review →
  user quyết merge → docs sweep luật 13 (CHANGELOG nhớ luật dấu `+`; cập nhật
  hàng nợ "toast quyết ở form đầu tiên" → ĐÃ CHỐT sonner toàn site).

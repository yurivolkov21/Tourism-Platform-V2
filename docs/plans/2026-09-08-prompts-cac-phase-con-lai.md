# Prompt sẵn cho các phase còn lại (từ 08/09/2026)

Mỗi tính năng còn lại của roadmap có **một prompt "session gốc"** ở dưới — mở
session Claude Code mới trong `~/projects/tourism-v2`, dán nguyên khối là chạy.
Session gốc sẽ hỏi lại vài điểm, viết spec + ADR, rồi **tự sinh prompt cho
session thi công** (bạn mở session thứ hai dán vào), và khi thi công xong bạn
quay lại session gốc nói "xong rồi, review nhé" → nó review 8 mũi, vá, chờ bạn
"duyệt merge" rồi merge. Đây là nếp đã chạy ổn từ P4c tới W4 (memory
`ban-giao-sau-w4-08-09`, `merge-can-review-session-rieng`).

Thứ tự đề nghị: **0 → 1a → 1b → 1c → 2a → 2b → 2c → (3 · 4 · 5)** trước freeze
15/10/2026. Mỗi khối là một nhánh, một đợt merge.

## Khối mở đầu dùng chung (đã nằm trong mọi prompt bên dưới)

```text
Bạn là session GỐC của tourism-v2 (~/projects/tourism-v2). Đọc theo thứ tự:
CLAUDE.md (15 luật + gotcha), memory ban-giao-sau-w4-08-09 (nếp session
gốc/thi công, việc hạ tầng, nợ treo), docs/README.md (bản đồ doc — doc không
trong bản đồ coi như không tồn tại), rồi các doc tôi liệt kê ở dưới. Luật bất
di bất dịch: hỏi tôi trước khi bắt đầu; spec → plan → execute; ADR đi TRƯỚC
code; một feature = một nhánh, merge rebase + ff-only; commit Conventional
tiếng Việt CÓ DẤU, KHÔNG AI attribution; tokens-only, copy tiếng Anh trong
@tourism/i18n, comment tiếng Việt; không subagent; bạn không tự bật/tắt dev
server của tôi; add file theo path tường minh, không bao giờ stage docs/navel.
Việc của bạn ở session này: (1) hỏi tôi những chỗ cần chốt, (2) viết spec
trong docs/specs + ADR/AMEND cần thiết + README map, commit docs thẳng main,
(3) sinh PROMPT cho session thi công (nhánh mới từ main; không merge, không
push, không subagent, KHÔNG chạm hạ tầng sống — CLAUDE.md §15; mỗi mục một
commit TDD; kết thúc bằng pnpm gate:int trọn với API tạm :3001 trên docker,
check-rls, entry CHANGELOG "CHƯA merge" + README), (4) khi tôi báo thi công
xong: /code-review <nhánh> high theo tầng (8 finder theo MIỀN + 3 verifier),
ReportFindings ≤10, chờ tôi duyệt rồi vá theo cụm, (5) chờ tôi "duyệt merge":
deploy migration mới lên Supabase TRƯỚC push, ff-only, docs sweep, push, liếc
CI, probe prod, xoá nhánh, cập nhật memory.
```

## 0. TRUST_PROXY sau Cloudflare (nhỏ, làm đầu tiên)

```text
[dán khối mở đầu dùng chung]

Tính năng: sửa TRUST_PROXY cho Render đứng sau Cloudflare — ADR-0037 AMEND 4
(+ ADR-0024 nếu cần). Đọc: docs/adr/0037-default-write-throttle.md (AMEND 3),
apps/api/src/config/env.ts (TRUST_PROXY, expandTrustProxyToCidrs),
apps/api/src/modules/health/health.controller.ts, entry CHANGELOG 08/09 mục
CÒN TREO. Đã đo 08/09: GET /health prod trả clientIp = 162.158.193.59 (IP
Cloudflare), forwardedFor = "<ip khách>, 162.158.193.59, 10.30.141.2" — mặc
định loopback,linklocal,uniquelocal dừng ở hop Cloudflare nên MỌI trần theo IP
trên prod (auth, form public, đọc) gộp khách vào một nhúm IP Cloudflare.
Chốt cách làm với tôi: (a) tin thêm dải Cloudflare (ips-v4 + ips-v6) qua
TRUST_PROXY — kèm cách cập nhật dải khi Cloudflare đổi; hoặc (b) ưu tiên header
cf-connecting-ip khi hop gần nhất thuộc dải Cloudflare. Cả hai phải áp cho CẢ
Fastify trustProxy lẫn Better Auth trustedProxies (một biến, hai người tiêu
thụ). Đầu ra: unit test cho hàm dịch dải, int test /health với XFF ba hop,
runbook đo lại từ hai mạng, và SAU khi đo đúng mới đổi
PUBLIC_READ_THROTTLE_MODE=enforce trên Render (tôi làm, không phải session).
```

## 1. P4e — catalog CRUD (chia ba nhánh)

### 1a. Tours + departures

```text
[dán khối mở đầu dùng chung]

Tính năng: P4e-1 admin CRUD tours + departures (đợt khởi hành). Đọc:
docs/adr/0026-p4-admin-app.md (P4e, kit), docs/analysis/2026-08-20-admin-parity-nexora.md
(đối chiếu Nexora — luật 10 CLAUDE.md: rà cả endpoint lẫn hạ tầng),
docs/specs/2026-09-02-p4c-operations-design.md (khuôn spec vùng admin gần nhất),
memory bang-admin-dong-bo-mot-kieu (mọi bảng vùng lắp vào kit dashboard-01, cấm
fork), ADR-0033 AMEND 1 (dời lịch chuyến phải cập nhật bookings.departure_end_date
cùng tx — nợ ghi cho phase này), ADR-0020/0021/0035 (media). Phạm vi cần chốt
với tôi: form tour (đủ field theo schema Tour + itinerary days + FAQ + cost items
ADR-0033), trạng thái published/unpublished + bust cache tour:<slug>/tours qua
WebRevalidationService, departures (tạo/sửa/dời lịch/đóng bán, ràng buộc ghế
đã bán), media picker CHỈ chọn từ media_assets có sẵn (upload thư viện là
P4f-1). Mọi route admin mới tự có trần (ADR-0037) và CSP nonce (ADR-0038) —
không thêm decorator lặp. Đối chiếu Nexora trước khi spec.
```

### 1b. Destinations + categories

```text
[dán khối mở đầu dùng chung]

Tính năng: P4e-2 admin CRUD destinations (3 miền + địa danh) và tour
categories. Đọc: docs/adr/0026-p4-admin-app.md, spec P4e-1 vừa merge (kế thừa
kit form/bảng), docs/adr/0015 (tint vùng), docs/analysis/2026-07-30-docs-audit-progress.md
(mocks/regions.ts CỐ Ý còn — khung 3 miền không có endpoint), schema.prisma
Destination/TourDestination/TourCategory. Chốt với tôi: slug bất biến sau
publish hay đổi được kèm redirect; xoá địa danh đang gắn tour thì chặn hay
gỡ liên kết; gallery địa danh qua media picker; bust cache destinations/
region:<slug>. Web đang ISR + sitemap đọc từ đây — spec phải nói rõ tag nào bust.
```

### 1c. Posts (blog) — làm ĐỦ create

```text
[dán khối mở đầu dùng chung]

Tính năng: P4e-3 admin CRUD posts + tags. Đọc: docs/adr/0026-p4-admin-app.md
(Hệ quả: Nexora thiếu @Post create — v2 làm ĐỦ), docs/adr/0004 (published-quá-khứ),
apps/api/src/modules/posts, web /blog + rss.xml + sitemap, ADR-0016 tags
(`posts`, `post:<slug>`). Chốt với tôi: editor nội dung (markdown hay rich
text — tokens-only, không kéo thư viện nặng sát freeze), lịch xuất bản
(publishedAt tương lai = nháp công khai chưa hiện), ảnh bìa qua media picker,
tag CRUD, preview trước publish, bust cache posts/post:<slug>/rss. Bao gồm luôn
nợ W3 "producer bust posts/site-media" nếu còn.
```

## 2. P4f — media · users · appearance (chia ba nhánh)

### 2a. Media library + GC reconcile

```text
[dán khối mở đầu dùng chung]

Tính năng: P4f-1 thư viện media admin + trả nợ ADR-0021/ADR-0035. Đọc:
docs/adr/0021-media-write-surface.md (AMEND 1+2: chữ ký, fl_force_strip,
overwrite:false, nợ lưu `version`), docs/adr/0035 (GC ảnh mồ côi, Giới hạn #6
backfill trước ngày deploy — script một lần), memory backlog-sau-p4c-polish-2
mục 3, apps/api/src/lib/upload-signing.ts, scripts media:tree/fetch/scan/upload
(CHANGELOG 14/08). Chốt với tôi: upload từ admin (signed, purpose mới SITE/
CATALOG, folder theo purpose), lưu `version` Cloudinary vào media_assets, gắn
ghi công (author/license — bốn khoá bắt buộc ADR-0020), reconcile Cloudinary ↔
DB (liệt kê mồ côi hai chiều, đưa vào hàng GC 7 ngày, KHÔNG destroy trực
tiếp), MEDIA_GC_ENABLED chỉ prod. Nhắc: dev và prod DÙNG CHUNG Cloudinary cloud
— mọi đường xoá phải qua hàng GC, có test canh.
```

### 2b. Users + audit log + thu hồi phiên

```text
[dán khối mở đầu dùng chung]

Tính năng: P4f-2 vùng users admin: danh sách, xem chi tiết, đổi role, thu hồi
phiên, AdminAuditLog, freshAge trước hành vi tiền. Đọc: docs/adr/0026-p4-admin-app.md
(AMEND 1: bất biến không tự hạ chính mình, không hạ admin cuối; SEC-1 bốn điều
kiện; runbook SQL thu hồi phiên chờ P4f), ADR-0017 §7/§8 (xoá tài khoản, sessions),
ADR-0003 (auto-promote ADMIN_EMAILS là đường lên admin duy nhất — quyết PATCH
role thủ công có song song không), Better Auth 1.6 admin/session API. Chốt
với tôi: bảng audit (ai làm gì lúc nào — mọi lệnh ghi admin từ đây qua một
interceptor, không rải tay), yêu cầu nhập lại mật khẩu/OTP trước refund/đổi
role (freshAge), thu hồi mọi phiên của một user, khoá tài khoản. Migration
mới: bảng audit + index; RLS bật cùng migration (check-rls).
```

### 2c. Appearance — khe ảnh site + copy

```text
[dán khối mở đầu dùng chung]

Tính năng: P4f-3 admin "Appearance": quản trị site-media slots (28+ khe ảnh
hero/about/region…) và những chuỗi copy nào đang sống trong DB (nếu có). Đọc:
apps/api/src/modules/site-media, web SlotImage/slot-image.tsx, ADR-0016 tag
site-media, CHANGELOG 14/08 và 17/08 (danh sách khe, khe seed-only), P4f-1 vừa
merge (media picker). Chốt với tôi: gán/gỡ ảnh cho khe, preview kích thước
đúng tỉ lệ khe, bust cache site-media; KHÔNG mở cửa sửa layout — chỉ nội dung
khe. Đây là nhánh nhỏ, ưu tiên thấp hơn 2a/2b.
```

## 3. Nợ dữ liệu cần ADR riêng (làm khi rảnh, trước freeze)

```text
[dán khối mở đầu dùng chung]

Tính năng: snapshot P&L theo kỳ đã đóng — ADR mới. Đọc: docs/adr/0033 (Giới
hạn #5), ADR-0028 AMEND 3 (review sửa làm kỳ đóng đổi số), memory
backlog-sau-p4c-polish-2 mục 1–2, apps/api/src/modules/stats. Chốt với tôi:
bảng report_months (đóng kỳ thủ công hay job đầu tháng), số nào đóng băng, số
nào vẫn sống, hiển thị "kỳ đã khoá" ở /reports. Trước đó nhắc tôi seed giá
vốn lên Supabase (db:seed idempotent, kiểm count tour_cost_items) nếu /reports
còn $0.00.
```

## 4. P5 mobile · 5. P6 AI concierge · P7 polish (mở sau khi P4 khép)

```text
[dán khối mở đầu dùng chung]

Tính năng: P5 mobile — mở phase. Đọc: docs/adr/0001-tech-stack.md (Expo,
jest-expo), docs/analysis/2026-07-31-web-data-layer-parity-nexora.md (mẫu để
dành cho P5), docs/navel/ là tài liệu thiết kế mobile của tôi (untracked, chỉ
ĐỌC, không bao giờ add/xoá), ADR-0016/0017 (oRPC client + session cookie —
mobile cần bearer/secure store, quyết ở ADR mới), ADR-0037/0038 (trần + CORS
cho origin mobile). Bắt đầu bằng brainstorm phạm vi MVP mobile (xem tour, đặt,
tài khoản) và ADR kiến trúc app Expo trong monorepo; chưa viết code trước khi
tôi duyệt ADR + spec.
```

```text
[dán khối mở đầu dùng chung]

Tính năng: P6 AI concierge — mở phase. Đọc: docs/adr/0001-tech-stack.md, ADR-0016
(tầng dữ liệu web), ADR-0037/0038 (trần ghi + CSP connect-src cho endpoint
mới), docs/analysis/2026-09-05-web-security-audit.md (bề mặt kẻ lạ — chat
công khai là kênh vào MỚI, cùng lớp với form liên hệ: throttle, honeypot,
suppression, không lộ PII). Brainstorm với tôi: concierge trả lời từ catalogue
thật (tour/đợt/giá) qua API nội bộ, model Claude mới nhất, streaming, giới
hạn chi phí, log/redact; ADR trước, spec sau, chưa code.
```

```text
[dán khối mở đầu dùng chung]

Tính năng: P7 polish UI trước freeze 15/10. Đọc: docs/analysis/2026-08-06-backlog-no-ky-thuat.md
(mục A/A′/A″ ảnh hưởng giao diện), CHANGELOG mục CÒN TREO các đợt (LazyMotion,
4 <img> chưa qua loader, use-mobile chép đôi), memory design-by-visual-demo và
design-research-before-decorating. Lập danh sách theo trang, tôi chốt từng
món; báo cáo text sau mỗi vòng, tôi tự kiểm localhost (không playwright trừ
khi tôi nhờ).
```

# Đại tu docs 03/08 — audit đối chiếu docs ↔ code toàn cục

Yêu cầu user 03/08: dọn thông tin lỗi thời, cập nhật đúng tiến độ, đối chiếu
song song với source code, xử lý file >500–1000 dòng. Ba auditor read-only
chạy song song (ADR ↔ code · bản đồ README + specs/plans · CHANGELOG + file
dài); mọi phát hiện đều kèm bằng chứng `file:line` từ code thật. Ranh giới
tôn trọng xuyên suốt: **CHANGELOG entry cũ + specs/plans đã merge là lịch sử
bất biến** — chỉ dán cảnh báo trong bản đồ, không sửa nội dung; doc HIỆN-TRẠNG
(README, conventions, skills.md, CLAUDE.md, ADR-khối-cập-nhật) sửa thẳng.

## 1. Kết quả audit (tóm tắt — chi tiết bằng chứng trong 3 report phiên làm việc)

### 1.1 ADRs (15 file): 9 cần amend, 6 sạch

| ADR | Phát hiện chính | Loại |
| --- | --- | --- |
| 0001 | Bảng stack ghi "Cache Components" (ADR-0016 đã loại), React Compiler chưa bật, oxlint + dependency-cruiser chưa từng vào repo, TS 7 mới phủ root/api (web + ui còn 5.9.3) | lỗi thời |
| 0003 | "catalog 6 endpoint" — thật là 5 (sai từ đầu); thiếu 4 controller public P3a (posts/site-media/enquiries/newsletter) | sai + lỗi thời |
| 0005 | Media: hợp đồng đã đặt nhưng web CHƯA có consumer nào; mốc "P3b/P4" nay chỉ còn P4 | lỗi thời nhẹ |
| 0006 | Status thiếu "đã thi hành 22/07" (5/5 mục có code); dòng cuối ghi nhầm branch `feat/refund-hardening` (copy-paste, sai từ đầu) | sai + thiếu |
| 0008 | Thiếu "đã thi hành"; anchor test trỏ lệch dòng | nhẹ |
| 0009 | Tham chiếu "ADR-0006 Proposed, làm sau" đã lỗi thời; đánh đổi #3 chuyển từ giả-định sang RỦI RO SỐNG (pending-sweep đang chạy) — đáng cảnh báo | lỗi thời |
| 0011 | §5 lời hứa oRPC client đã thành hiện thực ở ADR-0016 — nên trỏ | nhẹ |
| 0013 | Thiếu dấu "bị ADR-0015 đảo một phần"; hệ quả "data-region là ăn tint" không còn đúng | lỗi thời |
| 0016 | 4 chỗ: on-demand revalidation thành NỢ QUÁ HẠN (bước 1–6 xong, 0 dòng code) · sonner đã chốt+cài 03/08 · danh sách mock sống thiếu `mocks/auth.ts` · bảng `lib/api/` thiếu `resilience.ts`/`submit.ts` | lỗi thời |
| 0002·0004·0010·0012·0014·0015 | Sạch (0002 có 2 nợ P3 đến hạn — PayPal capture-on-return, smoke provider thật — ghi nhận, không phải lệch doc) | — |

### 1.2 Bản đồ README + specs/plans + conventions + skills

- **0 link chết** (74 link kiểm tự động); ADR-0007 là reserve có chủ ý.
- **Sai ngày:** cụm Tours đợt 2 + robots/sitemap là 28/07 (README ghi 27/07 ×2);
  10 commit code bước 4 mang ngày 01/08 (README ghi "merge 03/08" — 03/08 là
  docs sweep); navbar 4-link ghi 2 ngày khác nhau trong cùng file (đúng:
  thiết kế lại 30/07, tái xác nhận 01/08).
- **Nợ đã trả mà bản đồ còn ghi mở:** spec pháp lý (robots/sitemap trả 28/07 —
  còn EnquiryCta + FAQ-API); spec Blog (cả 3 nợ trả hết 28/07 + 31/07).
- **Cần THÊM cảnh báo lệch (khuôn hàng Destinations/Wuling):** spec P3a
  (bất biến rating ĐẢO 31/07 — spec chốt ngược với code hiện tại!); spec Blog
  + Tours tĩnh (tả thế giới mock đã khai tử); spec Destinations (số 68→16 nay
  là 30); 2 analysis (docs-audit 30/07 "0 trang gọi API", tours-parity 27/07)
  cần mốc "snapshot — đã lỗi thời một phần"; hàng ADR-0013 thiếu ⚠ ADR-0015
  + font đã đổi trong chính ADR.
- **"Thuần API" cần chú thích:** `mocks/regions.ts` vẫn là nguồn cố ý cho
  khung 3 miền (code tự khai "lệch tạm CHỦ ĐÍCH").
- **Conventions:** `color-system.md` §4 mô tả lớp tint vùng "90/10" như luật
  sống — ADR-0015 đã rút toàn site (test khoá `not.toContain('--region-')`);
  `booking-states.md` tiêu đề "Ba ngữ nghĩa terminal" trên bảng 5 dòng;
  `outbox-dedupe-key.md` + `read-then-write-races.md` sạch.
- **skills.md:** khai 15 skill, đĩa có 13 (`prisma-compute` +
  `prisma-mongodb-upgrade` chỉ còn rác trong `skills-lock.json`); mô tả kênh
  "`.agents/skills/` + link sang `.claude/skills/`" sai cấu trúc thật (chỉ
  turborepo ở `.agents/`); phần plugin (14) đúng.
- Doc thiếu khỏi bản đồ: chỉ `docs/design/**` (đồ user đang làm dở — không xử).

### 1.3 CHANGELOG (1.824 dòng, 43 entry) + 10 file >500 dòng

- **Đề án tách CHANGELOG:** cắt tại ranh giới phase 30/07 (dòng 542) → file
  chính 541 dòng (7 entry phase nối API, giữ mọi nợ đang được trỏ tới);
  2 archive `docs/changelog/2026-07-p3b-static.md` (862d/22 entry) +
  `2026-07-p0-p3a-backend.md` (421d/14 entry) — DI CHUYỂN byte-không-đổi,
  verify bằng `cmp` + đếm entry 7+22+14=43. `docs-freshness.sh` chỉ grep
  heading ngày ĐẦU TIÊN → không sửa script; CI/hooks không đụng file này.
  2 link bắt buộc trỏ lại archive (spec tours-pages-design:471, spec
  destinations-pages-design:5). Bonus: 4 dòng-`+` (bẫy formatter) dồn hết vào
  archive; CLAUDE.md ghi "còn 6 chỗ" — số thật là 4 (cột 0).
- **10 file dài: đúng MỘT hành động** — nhấc §"Soft 404 vì `loading.tsx`"
  (plan Tours, được trỏ từ ADR-0016 + 2 plan + README + 3 file code) thành
  `docs/conventions/soft-404-loading-tsx.md` (đúng thể loại "bài học thành
  luật"), giữ nguyên bản gốc trong plan (bản ghi phép đo). 9 file còn lại
  GIỮ NGUYÊN lịch sử — bản đồ README đã làm đúng việc tóm tắt (2 ô mẫu tốt:
  :80, :85); tiền lệ tách-đúng đã có (`read-then-write-races.md`).

## 2. Kế hoạch fix (3 nhóm, chờ user duyệt trước khi áp)

**Nhóm A — sửa thẳng doc hiện-trạng:** README (≈14 điểm §1.2) ·
`color-system.md` §4 viết lại theo ADR-0015 · `booking-states.md` tiêu đề ·
`skills.md` 3 điểm · CLAUDE.md ("còn 6 chỗ" → 4 + đường archive) · 9 ADR thêm
khối "**Cập nhật 2026-08-03**" có đánh dấu (quyết định gốc giữ nguyên văn).

**Nhóm B — tái cấu trúc file:** tách CHANGELOG theo đề án §1.3 (kèm bộ verify
byte) · nhấc Soft-404 thành conventions mới + retarget 3 pointer chính.

**Nhóm C — không đụng:** nội dung mọi spec/plan đã merge · 9 file dài lịch sử ·
entry CHANGELOG (chỉ di chuyển nguyên văn) · `docs/design/**` của user.

## 3. Điểm mù

- Audit chạy trên snapshot 03/08 sau merge bước 5+6; các con số test/route đo
  tại thời điểm đó.
- Không kiểm chính tả/văn phong — chỉ kiểm ĐÚNG/SAI so với code.
- 2 nợ ADR-0002 (PayPal capture, smoke provider) là nợ code chứ không phải
  lệch doc — chuyển cho backlog phase, không thuộc đại tu này.

# Rà soát tài liệu 14/10/2026 — đợt thứ ba

> Ảnh chụp một thời điểm, đừng sửa cho khớp hiện trạng. Đợt trước:
> [21/09](2026-09-21-docs-audit.md). Nhánh `docs/docs-reorg-2026-10-14`, PR #15.

Yêu cầu của user (14/10): kiểm lại thông tin trong `docs/`, sắp file vào thư mục
cho hợp lý, chia nhỏ file quá dài. Đo trên `main` `89afda5`.

## Quy mô lúc bắt đầu

| Thứ | Đo |
| --- | --- |
| `docs/` | 318 file, 246 file Markdown, khoảng 15 MB |
| `CHANGELOG.md` | 470 KB, 6.009 dòng, 110 entry — lần tách 21/09 đưa về 60 KB, nay phình gấp 8 |
| `open-items.md` | 69 KB; 42/56 dòng bảng nợ đã đóng mà vẫn chiếm hơn nửa file; dòng dài nhất 2.744 ký tự |
| `docs/README.md` | 380 dòng, 29 KB — bảng ADR, danh sách spec, plan, analysis nằm hết ở cửa vào |
| Gốc `docs/` | 5 file review và hướng dẫn của nhánh mobile nằm lẫn với tài liệu chung |
| `analysis/` | 29 file một tầng: đối chiếu Nexora, báo cáo tiến độ, tóm tắt nhánh mobile trộn nhau |
| `plans/` | 6 file prompt thi công lẫn với plan; 18 plan đã xong không có dòng trạng thái |

## Đã làm

**Sắp thư mục** (`git mv`, giữ lịch sử từng file):

- `reviews/` mới — 11 file soát, review, tóm tắt nhánh và hướng dẫn test lỗi đã
  sửa của năm cụm màn mobile.
- `guides/` mới — hướng dẫn test máy thật và ba tài liệu luồng đăng nhập.
- `analysis/nexora-parity/` (11 bản đối chiếu tháng 7–8) và `analysis/progress/`
  (báo cáo tiến độ, các đợt rà tài liệu).
- `plans/prompts/` — 6 prompt thi công.
- Mọi link trỏ tới file đã dời được viết lại bằng máy (đối chiếu đường dẫn gốc,
  tính lại đường tương đối); comment trong code trỏ đường cũ sửa theo
  (`schema.prisma` dòng 2, `auth-actions.ts`, `auth-media.ts`, ADR-0047, 0048).
- `huong-dan-test-may-that.md` dời sang `guides/` nhưng **giữ tên**: entry
  CHANGELOG bất biến gọi đích danh nó (cùng lý do với sáu file tên cũ khác).

**Chia nhỏ:**

- `CHANGELOG.md` 470 KB → 55 KB (13–14/10). 16/09–12/10 thành 7 file lưu trữ ở
  `changelog/` (50–90 KB mỗi file), theo đúng cách tách 21/09: chép nguyên văn,
  chỉ sửa đường dẫn tương đối, kiểm bằng máy rằng ghép lại ra đúng bản gốc trừ
  các dòng đã đổi link. `changelog/README.md` thêm bảy dòng và đoạn kể.
- `open-items.md` 69 KB → 24 KB. Mục đã đóng chép nguyên văn sang
  `open-items-closed.md`; luật đóng mới và mã G kế tiếp (G54) ghi ở đầu file.
- `docs/README.md` 380 dòng → 77 dòng. Mỗi thư mục có `README.md` làm mục lục;
  bản đồ chỉ trỏ tới các mục lục.
- **Không chia** các plan lớn (có file 753 KB): bản ghi thi công đã đóng, chia ra
  làm gãy liên kết "Task N" bên trong mà người đọc không được gì.

**Dòng trạng thái:** 18 plan và 4 prompt đã thi công xong có dòng "ĐÃ ĐÓNG" trỏ
đúng file lưu trữ CHANGELOG; plan một hạn chót trỏ archive 16–21/09 (còn Bước 8);
prompt các phase còn lại ghi chỉ còn dùng cho P6.

## Thông tin lỗi thời đã sửa (đối chiếu với code)

| Chỗ | Sai | Đúng (đo 14/10) |
| --- | --- | --- |
| README gốc | thương hiệu "chưa chốt"; "Chín gói"; admin "P4e–P4f chưa làm"; mobile "4 cụm mới có bản vẽ"; Git Bash `C:\Programming\…` | Nexora chốt 19/08; mười gói; P4a–P4e và P4f Users; đủ năm cụm và Google native; `C:\Devs\Git\bin\bash.exe` |
| `overview.md` | số liệu 21/09 (12 trang admin, 35 bảng, 3.689 test…) | 26 trang admin, 36 bảng, 96 route trong contract, 6.515 Vitest và 907 Jest và 838 int (CHANGELOG 14/10) |
| `glossary.md` | outbox gửi bằng "một tiến trình riêng" | worker chạy chung tiến trình API (`WORKER_INLINE=true`, `render.yaml`) |
| `handoff/` | P5b-2, P5b-4 "mới có bản vẽ"; bàn giao auth "việc còn lại là nối Better Auth" | cả năm cụm gộp 09/10–12/10; `createBetterAuthActions` và `createSecureStoreOnboardingStore` đã dùng ở `_layout.tsx` |
| `guides/` luồng đăng nhập | mobile "chưa kết nối" đăng nhập thật | plugin Expo, cookie trong SecureStore, Google native qua `signIn.social` với ID token (ADR-0056) |
| `conventions/outbox-dedupe-key` | thiếu 7 khoá | thêm `booking-cancelled`, ba khoá hoàn tự động, `orphan-refund`, `review-approved`, `review-rejected` |
| `conventions/read-then-write-races` | chỉ ba chỗ áp dụng | thêm các chỗ khoá ở admin (FOR UPDATE, FOR SHARE, advisory lock) |
| `conventions/booking-states` | "Overbooked claim" | claim trượt có ba nguyên nhân (`DEDUPE_PREFIX` của `payments.service.ts`) |
| `conventions/color-system` | nền trang tối `0.25` | `0.275` từ 06/08 (`tokens.mjs`) |
| `conventions/mobile-dev-loop` | không có icon tab; `expo start`; thiếu `@tourism/contract` | icon tab đã có; `expo start --go`; Metro cần cả `dist` của contract |
| `design/claude-design-brief` | rating `#D99A3D`; dặn vẽ ô placeholder; book, checkout "chưa tồn tại"; account "dựng tạm" | `#BB7E17` (tối `#E8AA4E`, quy đổi từ token); ảnh thật từ 14/08; các trang ấy đã có |
| `design/mockups/README` | P5b, P7 B và C, G40 "chờ thi công"; `booking-receipt.tsx` | đã dựng; G42 thay bằng `pending-card.tsx` |
| `open-items` | G2 "23 bản chép"; F1 chưa có gì; G47 "chưa soát"; lệnh dev `expo start` | 29 bản; webhook nhận bounced và complained từ W4; hai chỗ dùng làm màu chữ; `expo start --go` |
| Sổ nợ | A13 và F4 chưa gạch; A5 trỏ dòng 237; mục "Đã trả" dặn ngược luật gạch tại chỗ | gạch A13 (vá 14/08) và F4 (hết từ 14/09); dòng 251; mục "Đã trả" ghi không dùng |

## Kiểm bằng máy sau khi xong

- **Link tương đối** trong `docs/`, README gốc và CLAUDE.md: 1.285 link, 22 link
  không tới được — **đều có từ trước** (cùng 22 link trên `main`; link
  `.superpowers/…` của open-items đổi thành chữ thường). Gồm: 9 link kiểu
  `file.ts:24` trong bản đối chiếu 21/07 (file có 37 dòng `+` cột 0, không mở ra
  sửa), 7 link có ngoặc đơn trong đường dẫn mà bộ kiểm cắt sai (file có thật),
  5 chuỗi mẫu trong văn bản bị bộ kiểm hiểu nhầm là link (hai ở ADR-0051 và spec
  P4e-4, ba ở archive CHANGELOG bất biến), và 1 link thật sự chết ở ADR-0055
  (dưới).
- **Mục lục:** mọi file `.md` trong `docs/` có mặt ở ít nhất một `README.md`.
- **Dòng `+` cột 0:** 55 dòng ở 11 file, y như trước — không file nào bị
  formatter đổi.

## Chưa làm hoặc không kiểm được

- **ADR-0055 dòng 162** trỏ `apps/mobile/src/components/app-image.tsx`, file
  không còn: các màn truyền thẳng `transformUrl={cloudinaryUrl}` vào `AppImage`
  của `@tourism/mobile-ui`. ~~Đây là lệch giữa quyết định và code, cần AMEND chứ
  không phải sửa đường dẫn — để lại cho người viết ADR.~~ Sửa 14/10 (PR #19):
  không cần AMEND, AMEND 2 ngày 06/10 của ADR-0055 đã ghi việc gỡ wrapper đó;
  dòng 162 nằm trong AMEND 1, là bản ghi có ngày.
- **Không đọc hạ tầng sống:** số bảng bật RLS trên Supabase (tài liệu ghi 36/36
  đo 09/09; `user_events` thêm 13/10 có lệnh bật RLS trong migration), trạng thái
  thật của bộ dọn ảnh và tám file thử F18 trên Cloudinary, lỗi build Vercel
  09/10 (ghi là nghi cùng gốc G23, chưa đọc log).
- **Đường dẫn máy Windows** (`C:\Devs\…`) lấy theo CLAUDE.md, không kiểm được từ
  session cloud. DB Docker `tourism_ui` sau khi cài lại máy 12/10: chưa kiểm.
- **Mod `tourism-status`:** nằm ngoài kho mã, không entry nào ghi đã dựng xong;
  plan ghi "chưa rõ trạng thái".
- **Số test** ở overview lấy từ entry CHANGELOG mới nhất lúc rebase (G23,
  `gate:int` trên `b15239d`); đợt này chỉ đổi tài liệu nên không đổi số.
- **CLAUDE.md** sửa theo sau khi user duyệt (14/10): luật 13 nay nói thêm doc vào
  `README.md` của thư mục nó nằm; dòng Test của bảng toolchain ghi mobile và
  mobile-ui chạy Jest + jest-expo (ADR-0040 §4); link đối chiếu Nexora trỏ
  `docs/analysis/nexora-parity/`.

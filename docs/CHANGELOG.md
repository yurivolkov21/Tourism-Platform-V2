# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

> **File này chỉ giữ đợt đang chạy** (từ 13/10/2026). Toàn bộ lịch sử trước đó
> nằm ở [`changelog/`](changelog/) — 19 file theo giai đoạn, có
> [mục lục kể lại từng giai đoạn](changelog/README.md).
> Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`) — archive là di chuyển
> nguyên văn, không sửa một ký tự.

## 2026-10-14 — Merge W-09 chữ cứng của web vào `@tourism/i18n`, "1 tour", G15 một bản tải ảnh cho web và admin (`4b5f4ef`..`8102039`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-6`, [PR #17](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/17),
thi công trên session cloud. Không migration, không env, không đổi contract, không thêm hay nâng
dependency ngoài. Thư viện dùng chung bị sửa: `@tourism/i18n` (`messages.ts`, `resilience.ts`,
`index.ts`, ba module trang mới), `@tourism/ui` (module `cloudinary-upload` mới, `package.json` thêm
phụ thuộc workspace `@tourism/contract`), cùng `pnpm-lock.yaml` (3 dòng link workspace).

- W-09 (`4b5f4ef`..`21a038d`): khoảng 300 chữ khách đọc hoặc trình đọc màn hình đọc (tiêu đề, đoạn
  văn, nút, nhãn ảnh, `aria-label`, placeholder, title và description) rời component web về
  `@tourism/i18n` theo luật 7: trang chủ, About, Contact, navbar, footer, top bar, menu tài khoản, nút
  về đầu trang, trang 404, blog, tours. Ba module `home-page.ts`, `about-page.ts`, `contact-page.ts`
  export thẳng từ barrel và CỐ Ý không gắn vào `messages`: component của ba trang là client
  component, gắn vào `messages` thì chữ của một trang chui vào chunk client dùng chung của mọi trang
  (cùng lý do đã tách `resilience.ts`). Chữ trùng nghĩa dùng lại khoá sẵn có; khoá mồ côi cùng nghĩa
  (`pageMeta.about/tours/destinations/contact`, chín khoá của `blog`) căn theo chữ đang chạy rồi nối
  vào trang. Cố ý để nguyên: logo chữ "Nex"/"ora" và watermark ở footer, ba tên nguồn ghi công bản
  đồ (ADR-0018), dữ liệu biên tập trong `apps/web/src/mocks/` (ADR-0016), chuỗi `sizes`, lỗi dành
  cho developer. Đóng mục "`user-menu` label literal", mục cuối còn mở của E5 trong
  [sổ nợ kỹ thuật](analysis/2026-08-06-backlog-no-ky-thuat.md).
- "1 tour" `b70b1a7`: thẻ điểm đến ở trang chủ và About in "1 tours" khi điểm đến chỉ có một tour; ba
  hàm đếm chia số ít như mọi bộ đếm tour khác trong `messages`. Lỗi có từ bản chữ cứng, W-09 cố ý
  giữ nguyên khi dời chữ.
- G15: ADR `7275271` ([ADR-0021](adr/0021-media-write-surface.md) AMEND 3) đi trước code `8102039`.
  Phần chung của web và admin (đuôi file, form đã ký, khung XHR có hạn giờ 5 phút và huỷ qua
  `AbortSignal`) vào `libs/shared/ui/src/lib/cloudinary-upload.ts`; khung XHR nhận hàm `parse` vì web
  chỉ cần `public_id` còn admin cần thêm số đo ảnh. `apps/web/src/lib/media-upload.ts` và
  `apps/admin/src/lib/photo-upload.ts` thành lớp mỏng giữ nguyên tên hàm. Web nay có hạn giờ: mạng
  chết giữa lúc tải avatar hay ảnh review thì báo lỗi thay vì ô tải quay mãi. Chọn `ui` vì ADR-0042
  §3 cấm API DOM trong `core`. Mobile giữ bản riêng (React Native gửi `{uri, name, type}`), nên danh
  sách tham số ký còn hai nơi thay vì ba. Phần ký phía API của G15 đã gom từ P4e-4, nên G15 đóng
  hẳn: dòng chuyển sang `open-items-closed.md`.
- Mục lục ADR: 0021 ghi 3 AMEND; 0024 sửa thành 4 AMEND (AMEND 4 của G23 vào sau khi mục lục được
  viết lại ở đợt rà docs).

**Review.** Không có lượt review độc lập. User bảo merge 14/10 07:09 UTC. Rebase lên `6da00d2` (đợt
rà docs, trên G23 `572eb6f`) không xung đột: hai bên không chung file code nào.

Tests after (`gate:int` trên `8102039`, 14/10 xong 07:19 UTC, session cloud theo các bước của CI):
unit 7432 — web 2273, admin 2215, api 1139, mobile 771, contract 709, mobile-ui 136, i18n 58,
ui 57, core 48, tokens 26 — và int 838. Trừ api và mobile, các gói trúng cache turbo vì đầu vào y
hệt lượt chạy thật trước rebase (06:23 UTC); api và mobile chạy lại. W-09: chữ trong HTML server
trả về của 40 route (bản build production, gồm 9 trang cần đăng nhập và các trang 404) khớp từng ký
tự trước và sau; JS nén gzip tăng 0,67 KB ở `/`, 1,17 KB ở `/about`, 0,64 KB ở `/contact`, 0,03 tới
0,11 KB ở route khác. G15: module chung 10 test với XHR giả; test hạn giờ của web đỏ trước khi sửa
và xanh sau; admin bớt 2 test vì test phần chung chuyển về `ui`.

**CÒN TREO:**

- [ ] Thử tay production một lần: đổi avatar ở web và tải một ảnh tour ở admin. Môi trường cloud
  không có key Cloudinary (luật 15) nên G15 mới chỉ qua test giả lập; lỗi thì revert riêng `8102039`.
- Dọn sau merge: nhánh `fix/web-open-items-6` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge rà soát và sắp xếp lại `docs/`: thư mục mới, tách CHANGELOG và open-items, sửa thông tin lỗi thời (`90b1236`..`e0e40bb`)

User yêu cầu 14/10: kiểm lại thông tin trong `docs/`, sắp file vào thư mục cho hợp lý, chia nhỏ file
quá dài. Nhánh `docs/docs-reorg-2026-10-14`,
[PR #15](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/15), thi công trên session cloud.
Chỉ đổi tài liệu, `CLAUDE.md` và ba comment trỏ đường dẫn tài liệu; không migration, không env,
không dependency. Số đo và bảng sai/đúng ở
[báo cáo rà tài liệu 14/10](analysis/progress/2026-10-14-docs-audit.md).

- Dời thư mục `90b1236`: `reviews/`, `guides/`, `analysis/nexora-parity/`, `analysis/progress/`,
  `plans/prompts/`, bằng `git mv` để giữ lịch sử. Link tương đối viết lại bằng máy; comment trong
  `schema.prisma` và hai file `apps/mobile/src/features/auth/` sửa theo đường dẫn mới.
- Tách CHANGELOG `67a7a36`: entry 16/09–12/10 sang bảy file lưu trữ trong `changelog/`, chép nguyên
  văn, chỉ đổi đích link (ghép lại khớp 5.999 dòng, đủ 110 entry). File này giữ đợt từ 13/10.
- Mục lục `f844f6d`: `docs/README.md` từ 380 còn 77 dòng, chỉ trỏ tới `README.md` của từng thư mục;
  18 plan và 4 prompt đã xong có dòng "ĐÃ ĐÓNG" ở đầu trỏ đúng file lưu trữ.
- open-items `a27bf10`: `open-items.md` chỉ giữ việc còn mở (69 KB còn 24 KB), mục đã đóng chép
  nguyên văn sang `open-items-closed.md`. Cùng commit sửa thông tin lỗi thời đối chiếu với code:
  README gốc, overview, glossary, handoff, guides, sáu file conventions, brief thiết kế, mockups,
  sổ nợ.
- Báo cáo `6a4a4b3`; `CLAUDE.md` `edae037` (user duyệt 06:27 UTC): luật 13 nay nói doc mới thêm vào
  `README.md` của thư mục nó nằm, dòng Test của bảng toolchain ghi mobile và mobile-ui chạy Jest và
  jest-expo, link đối chiếu Nexora trỏ `analysis/nexora-parity/`. `e0e40bb`: số test ở overview theo
  entry G23.

**Cách làm từ nay:** đóng một mục open-items là ghi kết quả vào dòng, chuyển cả dòng sang
`open-items-closed.md` rồi ghi vào CHANGELOG, không gạch tại chỗ nữa. Mã G kế tiếp: G54.

**Review.** Không có lượt review độc lập. Kiểm bằng máy sau khi rebase: 1.287 link tương đối, 22 link
không tới được và cả 22 đều có sẵn trên `main`; mọi file `.md` nằm trong ít nhất một mục lục; dòng `+`
cột 0 vẫn 55 dòng ở 11 file. Rebase lên `572eb6f` (G23): dòng G23 đã gạch chuyển nguyên văn sang
`open-items-closed.md`. User bảo merge 14/10 07:08 UTC.

Tests after (`gate:int` trên `ab244b0`, 14/10 xong 06:04 UTC, session cloud theo các bước của CI):
unit 7416 — web 2273, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. Lượt đầu `@tourism/contract` chết vì EPIPE của Vitest lúc
máy quá tải, chạy riêng 709/709, chạy lại cả lượt thì xanh. Sau rebase, CI `gate` của PR trên
`e0e40bb` xanh cả hai lượt (gồm test G23). Đợt này không thêm hay bớt test.

**Đóng CÒN TREO của entry G23:** sau deploy `572eb6f` (Render live 06:34 UTC), thread admin đọc chỉ-đọc
log Supavisor: phiên Prisma mang tên `tourism-api`, pg-boss mở đúng 2 phiên, không còn
`EMAXCONNSESSION` sau lần cuối 06:25 UTC (máy cũ, cấu hình cũ). GitHub đã tự xoá nhánh
`fix/api-g23-pool` khi PR #16 merge.

**CÒN TREO:**

- [ ] ADR-0055 dòng 162 trỏ `apps/mobile/src/components/app-image.tsx`, file không còn (các màn truyền
  thẳng `transformUrl={cloudinaryUrl}` vào `AppImage` của `@tourism/mobile-ui`): cần AMEND, không chỉ
  sửa đường dẫn.
- Dọn sau merge: nhánh `docs/docs-reorg-2026-10-14` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G23 trần pool kết nối của API để vừa Session pooler 15 client (`edace31`..`b15239d`)

Thread việc tồn đọng vùng admin nhận G23 ngày 14/10 (user muốn đóng càng nhiều open-items càng tốt
trước freeze 15/10). Nhánh `fix/api-g23-pool`,
[PR #16](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/16), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi contract, không thư viện dùng chung nào
bị sửa.

- Đo trước khi sửa, đọc chỉ-đọc log Supavisor (Supabase giữ 24 giờ): Session pooler nhận 15 client,
  client thứ 16 nhận `EMAXCONNSESSION`. Lúc 02:01:15 UTC một instance duy nhất vừa thức, không deploy
  nào chạy, giữ 9 phiên Prisma và 6 phiên pg-boss, phiên Prisma thứ 10 bị từ chối (preview web của
  PR #13 đỏ). Lúc 05:12:19 UTC, cũng một instance, Vercel build web sau push `89afda5`: Prisma 8,
  pg-boss 7, hai request oRPC trả 500. Trong 24 giờ: 22 phiên bị từ chối, 18 của pg-boss (lượt poll
  hỏng) và 4 của Prisma (request 500). Ghi chú cũ của G23 đoán đúng (hai pool mặc định 10), giờ có số.
- ADR `edace31`: [ADR-0024](adr/0024-deploy-targets.md) AMEND 4 chốt ràng buộc
  `2 × (Prisma + pg-boss) + 1 ≤ 15` (hai instance chồng nhau lúc Render deploy, chừa một phiên chạy
  tay) và hệ quả: request xếp hàng chờ kết nối thay vì 500; giao dịch tương tác chờ lấy kết nối tối
  đa 2 giây (`maxWait` mặc định) nên đợt dồn tải rất lớn có thể hỏng một giao dịch, cùng loại rủi ro
  mà hiếm hơn. Nâng Pool Size của Supavisor là đường thứ hai, không chọn vì nằm ngoài repo.
- API `b15239d`: trần gom ở `apps/api/src/config/db-pool.ts`, Prisma 5 (tên phiên `tourism-api`,
  trước đó log ghi tên mặc định `Supavisor`) và pg-boss 2; `auth.config.ts` và `start-worker.ts`
  dùng lại. CLAUDE.md bỏ câu "pool ~10" ở mục Postgres và trỏ về file này.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 06:27 UTC). Nhánh dựng trên `89afda5`
và main không đổi từ đó, nên không cần rebase.

Tests after (`gate:int` trên `b15239d`, 14/10 xong 05:40 UTC, session cloud theo các bước của CI):
unit 7422 — web 2273, admin 2217, api 1139, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 838. So với main `89afda5`: api thêm 6 ca (`db-pool.spec.ts`
khoá ràng buộc và hai hàm cấu hình), int thêm 2 (`db-pool.int.spec.ts` đếm phiên thật trong
`pg_stat_activity` lúc dồn việc: Prisma đúng 5 phiên với 15 câu cùng lúc, pg-boss không quá 2 với
sáu hàng đợi; cấu hình cũ đo được 10 và 8, cả hai ca đỏ). CI `gate` của PR xanh cả hai lượt.

**Đóng CÒN TREO `media-gc` của entry PR #13:** lượt 14/10 04:00 UTC chạy xong trong 18 ms, không row
nào tới hạn nên không in dòng `Dọn media: …` (sweep trả sớm khi không có row tới hạn,
`media-garbage.service.ts`). `media_garbage` còn 6 row, cả 6 trong vùng tải lên theo đúng vị từ
`isUploadZonePublicId`, không row nào có lỗi; tới hạn sớm nhất ở lượt 19/10 04:00 UTC. Nhánh
`fix/admin-open-items-3` của entry ấy GitHub đã tự xoá lúc merge.

**CÒN TREO:**

- [ ] Sau deploy: đọc log Supavisor, phiên Prisma phải mang tên `tourism-api` và không còn
  `EMAXCONNSESSION`. Lượt deploy của chính commit merge còn instance cũ (pool cũ) phục vụ build web,
  nên lượt đó vẫn có thể gặp G23 một lần; build web đỏ thì bấm Redeploy.
- Dọn sau merge: nhánh `fix/api-g23-pool` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge W-10 ảnh xin Cloudinary đúng cỡ, D1 nâng input-otp lên 1.5.0 (`bedfaff`..`860a501`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-5`, [PR #14](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/14),
thi công trên session cloud. Không migration, không env, không đổi contract. **Có nâng dependency**
trước freeze: `input-otp` ^1.4.2 lên ^1.5.0. Thư viện dùng chung bị sửa: `@tourism/ui`
(`package.json`), cùng `pnpm-lock.yaml`.

- W-10 ảnh `bedfaff`: hàm `thumbnailSrc` (`apps/web/src/lib/cloudinary-thumb.ts`) xin Cloudinary bề
  ngang gấp ba khung hiển thị qua `cloudinaryLoader` có sẵn; URL ngoài Cloudinary (ảnh xem trước
  `blob:`, avatar Google) trả nguyên. Dùng ở `review-card` (64px), `region-reviews` (112px),
  `passport-card` (112px), `avatar-upload` (96px). Ảnh bìa ở `checkout-summary` đổi sang `SlotImage`,
  ở `travel-log` sang `next/image`, cả hai có `sizes` đúng khung. Trước đó các ô 64 tới 112px tải bản
  gốc `f_auto,q_auto`. Đóng mục CÒN TREO "Bốn bề mặt `<img>` trần" của W3 (archive
  `changelog/2026-09-security-w1-w4.md`): `booking-receipt` không còn từ P7. Hai `<img>` còn lại là cố
  ý: ảnh bìa bản in (ADR-0057 §4) và preview Object URL ở form ảnh review.
- W-10 LazyMotion: **không làm, có số đo.** Đổi 47 file sang `LazyMotion` và `m` rồi build production,
  đếm JS nén mỗi route bằng `next start`: tăng 3,6 tới 4,3 KB trên cả 14 route thay vì giảm. Entry
  `motion/react` vẫn kéo `motion` đầy đủ (gồm drag và layout) vào chunk đầu, `optimizePackageImports`
  không đổi được điều đó; lợi thật cần import thẳng `framer-motion`, tức đổi dependency sát freeze.
- D1 `860a501`: `input-otp` 1.5.0 trả cleanup cho effect hẹn ba timer; type chỉ thêm prop tuỳ chọn
  `nonce`. Lockfile sửa đúng ba khối của `input-otp` (10 dòng) vì `pnpm add` phân giải lại peer của cả
  repo (334 dòng churn, đổi cả `@types/node` của mobile); `pnpm install --frozen-lockfile` xác nhận.
  `otp-form.spec.tsx` gỡ đoạn đợi thật 150ms sau mỗi test (`adaedf3`), thêm test đồng hồ giả gỡ form
  rồi đếm timer: đỏ với 1.4.2 (6 timer), xanh với 1.5.0; chạy spec 20 lần liền không lần nào lỗi.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 05:06 UTC). Nhánh dựng trên `0d747a7`
và main không đổi từ đó, nên không cần rebase lại. A5 (tem "Hà Nội · Sa Pa") bỏ qua vì user đã chốt
giữ ngày 06/08. Rà sổ nợ thấy E5 "Load-more cap 50" đã hết từ P7 Phần A (phân trang 10 đơn), gạch luôn.

Tests after (`gate:int` trên `860a501`, 14/10 xong 02:36 UTC, session cloud theo các bước của CI):
unit 7416 — web 2273, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. So với main `0d747a7`: web thêm 4 ca (hai của
`thumbnailSrc`, một cỡ ảnh avatar, một timer của OtpForm). CI `gate` của PR xanh cả hai lượt.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-open-items-5` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G16 bộ dọn media chỉ xoá ảnh trong vùng tải lên, G22 data:reset dọn ảnh review, G14 dọn code ảnh tour (`7da26ee`..`3a6c450`)

Nhánh thứ ba của việc tồn đọng vùng admin, sau PR #11. Nhánh `fix/admin-open-items-3`,
[PR #13](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/13), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi contract. Thư viện dùng chung bị sửa:
`@tourism/i18n` (chữ ảnh của admin dựng từ hằng contract).

- G16 ADR `7da26ee`, API `3deca5e`: [ADR-0035](adr/0035-media-lifecycle.md) AMEND 3. Bộ dọn media
  chỉ destroy ảnh trong bốn thư mục mà server ký upload vào (`avatars/<id user>`,
  `reviews/<booking code>`, `tours/<id tour>`, `posts/<id bài>`). Vị từ thuần
  `isUploadZonePublicId` ở `apps/api/src/lib/upload-signing.ts` soi cả dạng chủ sở hữu, vì thư mục
  cũ `tourism/tours/hero/` nằm ngay trong `tours`. Ảnh ngoài vùng bị từ chối trước mọi bước khác,
  kể cả khi còn được dùng: row ở lại với `attempts` bằng trần và `last_error` ghi lý do, dòng log
  mỗi lượt có thêm số ảnh ngoài vùng. Trước đó luật "không dọn ảnh catalog hay thư viện" chỉ nằm ở
  từng nơi gọi.
- G22 `059ca9f`: `data:reset` xoá dòng `media_assets` của review và xếp publicId vào
  `media_garbage` với đồng hồ mới trong cùng transaction, kèm bất biến đếm riêng. Đo trên DB nháp
  (seed và 4 ảnh review): main dừng ở `ROLLBACK: 4 ảnh mồ côi`, bản sửa `COMMIT`; ba đột biến cấy
  vào script đều `ROLLBACK` với lý do rõ.
- G14 `d551634`, `a1bae80`, `3a6c450`: phần còn lại của đợt dọn F18, người dùng không thấy gì
  khác. Chữ "JPG, PNG, WebP, AVIF or GIF", "10 MB" và trần 30 ảnh dựng từ
  `ALLOWED_IMAGE_EXTENSIONS`, `TOUR_PHOTO_MAX_BYTES`, `TOUR_PHOTOS_MAX`
  (`libs/shared/i18n/src/lib/photo-upload-copy.ts`), chữ in ra giữ nguyên từng ký tự. `ListEditor`
  nhận đúng một trong hai: nút thêm (`newItem` cùng `addLabel`) hoặc `emptyFocus`. Fixture tải ảnh
  của bốn spec gom về `apps/admin/src/test/photo-upload.ts`.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 02:20 UTC). Nhánh dựng thẳng trên
`27bc40c` và main không đổi từ đó, nên không cần rebase. Preview web của Vercel trên `3a6c450` đỏ vì
G23 (API production hết chỗ kết nối DB đúng lúc build), không do nhánh; CI `gate` xanh cả hai lượt.

Tests after (`gate:int` trên `3a6c450`, 14/10 xong 01:58 UTC, session cloud theo các bước của CI):
unit 7412 — web 2269, admin 2217, api 1133, mobile 771, contract 709, mobile-ui 136, i18n 56,
core 48, ui 47, tokens 26 — và int 836. So với main `27bc40c`: api thêm 6 ca, i18n thêm 5, admin
thêm 1, int thêm 2 (bộ dọn từ chối ảnh ngoài vùng, kể cả ảnh catalog đang được dùng).

**Đóng CÒN TREO thử tay của hai entry trước** (PR #8 và PR #11): user thử trên production 14/10
02:14 UTC (`/users`, "View bookings" ra đúng booking của một tài khoản kèm chip "Account",
`/subscribers`), không gặp lỗi. Ảnh chụp không có lượt thu hẹp cửa sổ, "Export N rows" và lọc
ngày của `/subscribers`; ghi đóng theo lời user.

**CÒN TREO:**

- [ ] Sau lượt `media-gc` kế tiếp (04:00 UTC hằng ngày), đọc dòng `Dọn media: …` trong log Render;
  số "ngoài vùng tải lên" khác 0 thì xem `last_error` của các row ấy trong `media_garbage`.
- Dọn sau merge: nhánh `fix/admin-open-items-3` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G45 lọc /bookings theo tài khoản, G50 tới G53 focus sau lệnh ghi, nút Export và login không WebGL (`a935fc4`..`a39d59d`)

Nhánh thứ hai của việc tồn đọng vùng admin (user giao 13/10 02:17 UTC; G45 user chọn "Làm luôn",
G50 tới G53 là lỗ thấy lúc đo PR #8). Nhánh `fix/admin-open-items-2`,
[PR #11](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/11), thi công trên session cloud.
Không migration, không env, không dependency mới. Contract đổi: `admin.bookings.list` nhận `userId`
(uuid, tuỳ chọn). Thư viện dùng chung bị sửa: `@tourism/contract` (trường ấy), `@tourism/i18n` (chữ
của G45), `@tourism/ui` (`GradientWaves`).

- G45 spec `a935fc4`, API `ced4c47`, admin `44188f3`:
  [spec](specs/2026-10-13-g45-bookings-account-filter.md). "View bookings" ở `/users/[id]` mở
  `/bookings?user=<id>&dates=all`: đúng các booking của tài khoản ấy (lọc cột `bookings.user_id`, có
  sẵn index), kể cả booking đặt bằng email liên hệ khác. Trước đó link tìm theo email nên lẫn booking
  của người khác. Hàng điều khiển có chip "Account: <email>" gỡ được (Staff hay tài khoản không còn
  thấy "One account"), Clear filters gỡ cả nó, file Excel ghi tài khoản ở đầu trang. Id không ứng với
  ai cho trang rỗng, chuỗi không phải uuid trả 400.
- G52 `2fd26df`: ô tiêu đề mang nút Export ghim mép phải ở `/subscribers` và `/bookings`. Đánh đổi:
  ở 1024px trở xuống ô ghim che chữ tiêu đề của cột đang trôi dưới nó cho tới khi cuộn bảng.
- G51 `a45455b`, `7d68ff5`: nút gửi và Cancel của hộp ghi khoá bằng `aria-disabled` lúc chờ
  (`ConfirmWriteDialog`, năm form dialog, hộp bác review, hộp hoàn tiền); lệnh hỏng mà hộp ở lại thì
  focus về chỗ cũ. Nút Staff access và Lock của `/users/[id]` theo khuôn G6.
- G50 `6c9406c`, `9e48d97`, `c6cc9ed`: `DataTableBody` cứu focus khi nút trong hàng biến mất sau
  lệnh ghi thành công: ô cùng cột của hàng cũ, rồi hàng thế chỗ, hàng phía trên, cuối cùng là chính
  bảng; chỉ cứu khi focus thật sự lạc từ thân bảng. Sign out everywhere, Reopen, đổi trạng thái
  enquiry, Add note và Sign in không còn đánh rơi focus.
- G53 `a39d59d`: `/login` của admin không sập cả trang khi trình duyệt không tạo được WebGL; nền sóng
  bỏ trống, form đăng nhập vẫn dùng được.

**Đo trên bản build (Chromium headless của session cloud, DB dev local).** G50: 10 ca, vết focus mỗi
5 ms, không ca nào chạm `<body>`. Lượt đo đầu bắt được điều jsdom không có: Chromium bắn `focusout`
ngay trước khi gỡ nút, lúc nút còn trong DOM; test mới giả đúng hành vi ấy (`c6cc9ed`). G51: request
giữ 1,5 giây, focus nằm trên "Saving…" suốt lúc chờ. G52: nút Export trong khung ở 768, 1024, 1280,
1366, 1440 và 1600px, lúc bảng ở đầu lẫn khi cuộn hết. G45: email dài từng làm trang tràn ngang 322px
ở 390px, khe hành động của `DataTableFrame` thêm `min-w-0`. G53: Chromium headless không có WebGL,
trang login hiện đủ form.

**Review.** Không có lượt review độc lập. User bảo merge (14/10 01:09 UTC). Rebase lên `33df9d4`
(PR #12 của web) sạch, không xung đột.

Tests after (`gate:int` trên `a39d59d`, 14/10 xong 01:24 UTC, session cloud theo các bước của CI):
unit 7400 — web 2269, admin 2216, api 1127, mobile 771, contract 709, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 834. So với main `33df9d4`: admin thêm 57 ca, contract thêm 5,
int thêm 3 (lọc theo tài khoản của `admin.bookings.list`).

**CÒN TREO:**

- [ ] Thử tay production: ở `/users/[id]` bấm "View bookings" (chỉ booking của tài khoản ấy, chip
  "Account" gỡ được), và ở `/subscribers` thu hẹp cửa sổ rồi xem nút Export vẫn thấy được.
- Dọn sau merge: nhánh `fix/admin-open-items-2` trên origin nếu GitHub không tự xoá.

## 2026-10-14 — Merge G49 nút đỏ ở chân hộp thoại, G36 chặn review chuyến bị huỷ, G34 giờ chốt trong email (`9dcfc15`..`38934c9`)

Làm tiếp open-items phía khách theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze
15/10). Nhánh `fix/web-open-items-4`, [PR #12](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/12),
thi công trên session cloud. Không migration, không env, không dependency mới, không đổi contract.
Thư viện dùng chung bị sửa: `@tourism/tokens` (giá trị cả hai theme của `destructive-emphasis`).

- G34 `9dcfc15`: email xác nhận đặt tour (`render-email.tsx`) lấy giờ chốt hạn huỷ từ
  `DEADLINE_CUTOFF_COPY` của `@tourism/i18n` thay vì gõ tay. Chữ in ra không đổi.
- G49 ADR trước code: [ADR-0019](adr/0019-color-token-roles.md) AMEND 3 `c97e4da`, token và test
  `5b105d8`. Đo lại cho G49 thì thấy phần lớn nút đỏ đứng ở chân hộp thoại (`bg-muted/50` phủ lên
  popover): nút xoá tài khoản ở web, bỏ thay đổi chưa lưu và từ chối review ở admin. AMEND 2 (G46) chỉ
  đo nền và card nên bỏ sót bề mặt này; lúc hover ở đó theme sáng chỉ 3.96, theme tối 4.27.
  `destructive-emphasis` sáng xuống `oklch(0.47 0.136 27.3)` (≈ #98342D), tối lên `oklch(0.80 0.11
  26.7)` (≈ #FDA298); `destructive` (vai bề mặt) không đổi. Chỗ yếu nhất nay là 4.83 (sáng) và 4.78
  (tối). `tokens.spec.ts` thay ca chỉ đo nút ở theme tối bằng ca đo cả hai theme trên nền, card và chân
  hộp thoại, lúc nghỉ và lúc hover; ca này đỏ với giá trị cũ. Mobile đọc cùng token nên chữ đỏ của app
  đổi theo ở lần build sau.
- G36 `38934c9`: `checkReviewEligibility` có lý do mới `DEPARTURE_CANCELLED`, xét sau `NOT_OWNER` và
  `NOT_PAID`, trước `TRIP_NOT_COMPLETED`. `reviews.create` và `media.signUpload` nạp thêm trạng thái
  chuyến và rơi về `ReviewNotEligibleError` sẵn có (400 `REVIEW_NOT_ELIGIBLE`). Hai ca int mới đỏ khi bỏ
  dòng kiểm.

**Đo.** Bảng màu trước và sau dựng từ `generated/tokens.css` thật (Chromium headless của session
cloud): `reports/2026-10-13-g49/g49-truoc-sau.png` trong thư mục dự án. Đo lại tương phản từ pixel của
ảnh chụp lệch số tính toán không quá 0.05 (chỗ yếu nhất đo được 4.79 sáng, 4.82 tối).

**Review.** Không có lượt review độc lập. User xem bảng màu và bảo merge (14/10 00:50 UTC). Tự bắt lúc
thi công: G46 đã merge bỏ sót chân hộp thoại (sửa luôn trong G49 như trên). G30 (xác minh số điện
thoại bằng OTP) không làm: cần nhà cung cấp SMS có phí.

Tests after (`gate:int` trên `38934c9`, 13/10 xong 10:34 UTC, session cloud theo các bước của CI):
unit 7338 — web 2269, admin 2159, api 1127, mobile 771, contract 704, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 831. So với main `cd589e6`: api thêm 4 ca, int thêm 2, tokens giữ
26 (một ca được thay).

**CÒN TREO:**

- [ ] Nhìn chữ đỏ trên production ở hai theme, ví dụ nút "Discard changes" của hộp "Discard unsaved
  changes?" ở khu sửa tour của admin: sửa một ô rồi bấm Back, xem xong chọn "Keep editing".
- Dọn sau merge: nhánh `fix/web-open-items-4` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge việc tồn đọng của admin: G43, G24, G6, G19, G3, G44, G7 (`ff825b3`..`dc95a68`)

User giao 13/10 02:17 UTC: làm luôn các việc còn tồn đọng của admin. Nhánh `fix/admin-open-items`,
[PR #8](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/8), thi công trên session cloud.
Không migration, không dependency mới. Env: admin có thêm biến TUỲ CHỌN `NEXT_PUBLIC_WEB_URL` (G19),
production không cần khai. Contract đổi: `admin.subscribers.list` nhận `from` và `to`. Thư viện dùng
chung bị sửa: `@tourism/contract` (hai trường ấy), `@tourism/i18n` (chữ của G43 và G7), `@tourism/ui`
(ô tích ở trạng thái một phần).

- G43 spec `ff825b3`, API `6effec6`, admin `49f1957`:
  [spec](specs/2026-10-13-g43-subscribers-selection-dates.md). `/subscribers` có cột ô tích như
  `/bookings`: tích vài hàng rồi "Export N rows" để tải đúng các hàng ấy (gom một trang; thiếu hàng thì
  409, API hỏng thì 502, audit ghi `mode: 'selection'`; URL mang `id`, không mang email). Hàng điều
  khiển có khoảng ngày đăng ký (ngày UTC, biên nửa mở qua `createdAtRange`, khoảng ngược trả 400). Phần
  dùng chung với `/bookings/export` lên `lib/export-selection.ts`.
- Ô tích dùng chung `0d08859`: trạng thái một phần đổ nền và vẽ dấu gạch. Trước đó nó vẽ dấu tích không
  nền, nên ô tiêu đề lúc mới tích vài hàng nhìn như đã chọn hết. Chỉ `/bookings` và `/subscribers` dùng.
- G24 `e35535e`: `/tours`, `/reviews`, `/outbox` và `/subscribers` không còn dựng lại cả cột hành động
  sau mỗi lần ghi — cột là hằng của module, lệnh ghi đi qua context như danh mục, điểm đến và chuyến.
- G6 `c15fb56`: năm nút mở hộp (Unsubscribe, Retry, Refund, cụm Approve/Reject, ba nút của hàng chuyến)
  khoá bằng `focusableWhenDisabled` khi bảng làm mới, nên Base UI trả focus về được.
- G19 `5e118d5`: "View on site" đọc `NEXT_PUBLIC_WEB_URL`. Không khai thì dev và test dùng
  `http://localhost:3000`, production dùng origin thật; khai sai thì `next.config.ts` làm build đỏ.
- G3 `bb58b0f`: lỗi của chuyến là `ContractError` (`admin-departure-errors.ts`), controller dùng
  `toContractError`, form dùng `lib/form-errors.ts`. Không đổi hành vi.
- G44 `50e5e4a`: cột tiêu đề của `/posts` và `/tours` có sàn `min-w-48` theo khuôn bảng Users.
- G7 `dc95a68`: Back, Forward và menu giữ chuột của trình duyệt mở hộp "Discard unsaved changes?" ở khu
  sửa tour và trình sửa bài viết.

**Đo trên bản build (Chromium headless của session cloud, DB dev local).** G6: lưu hộp Edit của một
chuyến thì hộp đóng ở 124 ms, focus nằm trên nút Edit đang `aria-disabled` tới lúc mở khoá ở 233 ms.
G7: có hỏi, giữ chữ và vị trí cuộn, Discard đi đúng mục lịch sử đã bấm. G44: tiêu đề giữ 192px ở 390
và 768px, trang không tràn ở 390, 768 và 1600px. G43: không tràn từ 390 tới 1600px; 22/22 đột biến cấy
vào phần admin của G43 (query, route xuất, bảng, file Excel) đều bị test bắt.

**Review.** Không có lượt review độc lập. User bảo merge (13/10 09:54 UTC). Phát hiện lúc đo, ghi thành
G50 tới G53 và đang vá ở nhánh `fix/admin-open-items-2`: focus rơi về `<body>` khi nút mở hộp biến mất
sau lệnh ghi thành công (G50), nút gửi và Cancel của hộp ghi khoá bằng `disabled` thật lúc chờ (G51),
nút Export ra ngoài khung khi bảng cuộn ngang (G52), trang `/login` sập khi trình duyệt không có WebGL
(G53).

Tests after (`gate:int` trên `dc95a68`, 13/10 xong 10:09 UTC, session cloud theo các bước của CI):
unit 7334 — web 2269, admin 2159, api 1123, mobile 771, contract 704, mobile-ui 136, i18n 51,
core 48, ui 47, tokens 26 — và int 829. So với main `df97df2`: admin thêm 76 ca, api thêm 5,
contract và i18n mỗi gói thêm 3, int thêm 4.

**CÒN TREO:**

- [ ] Thử tay production `/subscribers`: tích vài hàng rồi "Export N rows" (file chỉ có các hàng ấy),
  và lọc một khoảng ngày đăng ký.
- Dọn sau merge: nhánh `fix/admin-open-items` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge G46 chữ đỏ theme tối và G48 timer của auth-client.spec (`77e9e44`..`c75dee9`)

Làm tiếp open-items của web theo yêu cầu của user 13/10 (đóng càng nhiều càng tốt trước freeze 15/10).
Nhánh `fix/web-open-items-3`, [PR #10](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/10),
thi công trên session cloud. Không migration, không env, không dependency mới, không đổi API hay
contract. Thư viện dùng chung bị sửa: `@tourism/tokens` (giá trị tối của `destructive-emphasis`).

- G48 `77e9e44`: `apps/web/src/lib/auth-client.spec.tsx` thêm `afterAll` đợi thật 1100ms để timer
  1000ms của nanostores (cleanup của better-auth, đụng `window`) nổ trước khi Vitest tháo jsdom; cùng
  cách vá `otp-form.spec` ở `adaedf3`. Tái hiện bằng cách xếp spec ấy trước một file giả lập lúc
  `window` đã mất: chưa vá thì `ReferenceError: window is not defined` và thoát 1, có vá thì 3/3 lượt
  xanh.
- G46 ADR trước code: [ADR-0019](adr/0019-color-token-roles.md) AMEND 2 `3a8e7f5`, token và test
  `c75dee9`. `destructive-emphasis` tối từ `oklch(0.72 0.148 26.7)` lên `oklch(0.77 0.13 26.7)`
  (≈ #FC9287); sáng giữ nguyên. Soát chỗ dùng không thấy câu lỗi nào đặt thẳng trên `bg-muted`, nhưng
  thấy chữ của nút và huy hiệu biến thể `destructive` ở `@tourism/ui` (lớp tô `dark:bg-destructive/20`)
  chỉ 4.21:1, lúc hover 3.82:1 — gồm nút xoá tour, xoá bài viết, từ chối review, bỏ thay đổi ở admin và
  xoá tài khoản ở web. Giá trị mới: nền 6.75, card 5.99, muted 4.77, nút 5.09, hover 4.62.
  `tokens.spec.ts` thêm `destructive-emphasis` vào phép thử 4.5:1 trên nền, card, muted và thêm phép
  thử nút đỏ (trộn alpha 20% và 30% trong sRGB); hai test này đỏ với giá trị cũ. Mobile đọc cùng token
  nên chữ đỏ theme tối của app đổi theo khi build lại.

**Đo.** Bảng màu trước và sau dựng từ `generated/tokens.css` thật (Chromium headless của session
cloud): `reports/2026-10-13-g46/g46-truoc-sau.png` trong thư mục dự án.

**Review.** Không có lượt review độc lập. User xem bảng màu và bảo merge (13/10 09:54 UTC). Phát hiện
kèm: nút `destructive` lúc hover ở theme sáng chỉ 4.40 trên card và 4.19 trên nền, ghi thành G49.

**Đóng CÒN TREO của entry G42 ngay dưới:** user thử tay production 13/10 09:27 UTC (đơn BK-NYMOTOYZ,
huỷ ở trang Stripe về `/checkout/cancel`): thẻ chờ và Pay now đúng như mong đợi.

Tests after (`gate:int` trên `c75dee9`, 13/10 xong 09:44 UTC, session cloud theo các bước của CI):
unit 7247 — web 2269, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 26 — và int 825. So với main `2ef92ef`: tokens thêm 2 ca.

**CÒN TREO:**

- Dọn sau merge: nhánh `fix/web-open-items-3` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge G42 màn hoá đơn chờ cho đơn chưa trả, phương án A (`2e84458`..`18e5ebd`)

User giao 13/10 07:16 UTC: làm G42 trước freeze 15/10 nếu kịp; chọn phương án A "Voucher chờ" trên
thẻ quyết định lúc 07:32 UTC (B là bản in B1 đưa lên màn hình). Nhánh `feat/g42-pending-receipt`,
[PR #9](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/9), thi công trên session cloud.
Không migration, không env, không dependency mới, không đổi API hay contract. Thư viện dùng chung bị
sửa: `@tourism/i18n` (thêm khối `pendingReceipt`, gỡ 13 khoá chỉ hoá đơn cũ dùng ở `booking.success`
và `booking.cancel`).

- Spec, bản vẽ, plan `2e84458`, `1bdd7a6`:
  [spec](specs/2026-10-13-g42-pending-receipt-design.md), bản ghi nguyên văn
  `design/mockups/pending-receipt.src.html`, [plan](plans/2026-10-13-g42-pending-receipt.md).
- Bảng quyết định `bf78b15`: `pendingView(booking, now, page)` ở `lib/pending-receipt.ts` cho bốn
  trạng thái — `payable` (trang huỷ, còn trả được), `confirming` (trang success, chờ webhook),
  `notPaid` (quá hạn chót), `closed` (đơn đã đóng, kể "Charged $0" hoặc khoản hoàn).
- Ảnh bìa dùng chung `23cbe61`: `VoucherPhoto` tách khỏi `VoucherOverview`, `InfoCell` có biến thể
  cảnh báo cho ô hạn trả.
- Thẻ chờ `426d833`: `PendingCard` cùng lưới hai cột với voucher, cột phải mảng `muted` có ô mã viền
  đứt, dải gạch chéo thay mã vạch (mã của đơn chưa trả không phải giấy vào cổng), Receipt overview,
  Trip journal, hành động chính. Hành động vẽ hai lần (ô gọn dưới `xl`, cột phải từ `xl`) nhưng chỉ
  một bộ hẹn giờ tự làm tươi.
- Hai trang `18e5ebd`: `/checkout/cancel` và nhánh chưa trả của `/checkout/success` dựng thẻ chờ;
  breadcrumb "Checkout". Gỡ `BookingReceipt` cùng `checkoutMood`, `cancelPageNote`, `receiptNote`
  (thay bằng `closedNote`). Pay now dùng lại `BookingActions` của trang chi tiết đơn.

**Đo trên bản build (Chromium headless của session cloud).** Sáu đơn thử chèn vào DB dev local (còn
trả được, chờ webhook PayPal, quá hạn chót, quá mốc 60 phút, đã huỷ chưa thu, đã huỷ sau khi bị thu
và hoàn tự động), đo xong đã xoá. 6 bề rộng (320, 375, 768, 1024, 1280, 1440) nhân sáng và tối: 72/72
lượt không cuộn ngang, không chữ ra ngoài thẻ, ảnh có `sizes`; tương phản thấp nhất của chữ trong thẻ
4.62:1 (sáng) và 4.69:1 (tối), kể cả chữ trên dải gạch chéo. Một lượt bị đẩy về `/login` giữa chừng,
đo lại thì đạt.

**Review.** Không có lượt review độc lập. User xem ảnh tổng hợp ba cặp trạng thái và bảo merge (13/10
08:20 UTC). Lỗi tự bắt lúc thi công: lớp Tailwind ghép động không được quét (đổi sang chuỗi viết
sẵn); `pending-card` và `pending-pass` import vòng (tách `pending-action.tsx`); `ButtonLink` nhận
`data-slot` thì đè slot `button` (bỏ).

Tests after (`gate:int` trên `18e5ebd`, 13/10 xong 08:14 UTC, session cloud theo các bước của CI):
unit 7245 — web 2269, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 24 — và int 825. So với main `8af423d`: web thêm 32 ca mới (`pending-receipt` 23,
`pending-card` 9) và gỡ các ca của `BookingReceipt`, `checkoutMood`, `cancelPageNote`, ròng bớt 1.

**CÒN TREO:**

- [ ] Thử tay production: đặt một tour, bấm huỷ ở trang Stripe để về `/checkout/cancel` (thẻ chờ, Pay
  now trả tiếp được), và trả xong mà về trước webhook để thấy nhánh "Checking with Stripe…".
- Dọn sau merge: nhánh `feat/g42-pending-receipt` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge việc tồn đọng của web, lô 1 và lô 2: 15 mục open-items (`5fd101b`..`d154a26`)

User giao 13/10 04:46 UTC: làm các mục còn mở của web từ dễ tới khó, đóng được càng nhiều càng tốt.
Bản phân tích đầu vào đặt mã tạm `W-01` tới `W-11` cho mục chưa có dòng trong open-items; các mã ấy
không phải mã chính thức. Một nhánh `fix/web-open-items`, mỗi mục một commit,
[PR #7](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/7). Thi công trên session cloud.
Lô 1 được rebase lên `7429bdc` sau khi P4f merge; không xung đột. Không migration, không env, không
dependency mới. Thư viện dùng chung bị sửa: `@tourism/i18n` (G38, G37, W-05, W-01, W-09) và
`@tourism/tokens` (G32). Admin bị sửa ba file cho G20.

**Lô 1 (chín mục).**

- G38 `5fd101b`: gỡ năm khoá i18n mồ côi của `booking.success`; JSDoc `TICKET_BARCODE_BAR_COUNT`
  thôi tả cuống vé đã xoá.
- G35 `588e339`: ô thả ảnh của form review hết dùng `h3`; vé dùng `tripLengthDays` của contract;
  `sizes` ảnh bìa voucher đi cùng lề trang `/checkout/success` (`voucher-layout.ts`, có test đối
  chiếu).
- W-02 `a0c3d07`: ba nút Reserve gửi `?departure=<id>`, trang đặt chỗ chọn sẵn đợt đó nếu còn mở;
  `proxy.ts` giữ query trong `?redirect=` nên đợt không mất khi khách phải đăng nhập giữa chừng.
- W-01 `d9ca015`: `/privacy` nói đúng là mật khẩu lưu dạng hash trong DB của dự án, Google là tuỳ
  chọn, Supabase là nơi đặt DB (trước đó nói Supabase lo đăng nhập).
- W-07 `ff6e778`: lượt đọc tour phụ của trang chi tiết đơn và voucher có trần 8 giây; quá trần thì
  trang vẫn hiện đơn, chỉ thiếu phần lấy từ tour (trước có thể chờ tới khoảng 62 giây).
- G37 `37f1464`: `/checkout/cancel` thôi nói "still open" với đơn đã đóng (dùng câu "settled" của
  hoá đơn), và câu `heldNote` gọi đúng "My bookings" thay vì "Trips".
- W-05 `34aebf3`: tài khoản chỉ có Google được chỉ đường "Forgot password?" rồi tự xoá, thay vì bảo
  liên hệ support. Int test mới (`account-delete.int.spec.ts`, ca `2d`): tài khoản chỉ OAuth đặt
  mật khẩu qua reset, đăng nhập lại, `DELETE /api/account` trả 204.
- G31 `04beaa7`: hộp xoá tài khoản có ô `username` ẩn, chỉ đọc, mang email ngay trước ô mật khẩu, để
  trình quản lý mật khẩu của Edge có chỗ điền thay vì ô gõ DELETE.
- G33 `e59cfa6`, `3def7d8`: Lenis buông quán tính (`stop()` rồi `start()`, vì `reset()` là private)
  mỗi khi đường dẫn đổi, kể cả `router.push` trong mã; bỏ qua lúc có modal mở.

**Lô 2 (sáu mục).**

- G39 `c8ace93`: Passport phân loại đơn theo `bookingPhase` (ADR-0054 AMEND 1) thay vì tông riêng.
  User chọn 13/10 05:30 UTC: đơn hoàn tiền trọn mà khách vẫn đi thì vẫn đóng tem (`travelled`).
  Chuyến công ty huỷ không được đếm, đơn `lapsed` không có tem ghost.
- G28 `d82d446`: tour từ 24 chỗ thì thanh ghế vẽ một thanh liền theo tỉ lệ ghế còn; tới 23 chỗ giữ
  một đốt một ghế như bản duyệt. Dữ liệu hiện tối đa 22 chỗ nên khách chưa thấy khác.
- G29 `64ee41a`: dưới 640px và từ 1024 tới 1151px, bảy ảnh nhỏ thành một hàng ô vuông dưới ảnh
  chính (custom variant `gallery-row` ở `globals.css`); 640–1023 và từ 1152 giữ bố cục cột đã duyệt.
- W-09 `4a8b1de`: chữ cứng của cụm đăng nhập (6 trang auth, 8 component, nhãn logo ở header và
  footer) vào `messages.authForms` và `messages.a11y.homeLink`. Chữ khách thấy không đổi.
- G32 và G20: [ADR-0019](adr/0019-color-token-roles.md) AMEND 1 `70aaa0e` đi trước code `d154a26`.
  Hai token vai mực `warning-emphasis` (sáng `oklch(0.47 0.095 75)`, tức #79520A nâu hổ phách) và
  `success-emphasis`; bề mặt giữ nguyên. 14 chỗ ở web và 4 ở admin đổi sang token mới, gỡ cặp tạm
  `text-warning-foreground dark:text-warning`. Thay đổi nhìn thấy: ở theme sáng mộc "AWAITING
  PAYMENT" và chữ "N seats left" từ vàng sang nâu hổ phách; mộc và chữ thành công đậm hơn. Theme tối
  gần như không đổi.

**Đo trên bản build (Chromium headless của session cloud).** G29 ở 14 khổ từ 320 tới 1440px: không
hở cạnh ảnh nhỏ, không tràn, ảnh chính thẳng hàng cột đặt chỗ từ 1024 (dữ liệu local không có ảnh
tour nên đo với ô giữ chỗ). W-09: 80/81 chuỗi cũ hiện y nguyên qua các trạng thái; chuỗi còn lại
("Resend the code", chỉ hiện sau 60 giây) có test ở `otp-form.spec.tsx`. G33 bằng con lăn giả lập rồi
`router.push`: bản sửa đúng 10/10 lượt; bản đối chứng build tạm không có bản sửa sai 5/10 lượt (dừng
ở 2000 thay vì 0 hoặc 1135). G32: tương phản tính từ token bằng culori và có test 4.5:1 trên nền,
card, muted ở cả hai theme (`tokens.spec.ts`).

**Review.** Không có lượt review độc lập. User đọc báo cáo lô 1 và lô 2 kèm ảnh G29 và bảng màu G32
trước và sau rồi bảo merge (13/10 07:16 UTC). Lỗi tự bắt lúc thi công: G33 gọi `Lenis.reset()` là
hàm private (tsc bắt, đổi sang `stop()` rồi `start()`); ảnh chính G29 lệch 25px ở 1024 vì lưới kéo
giãn chiều cao (vá bằng `justify-end`); L của `warning-emphasis` hạ từ 0.5 xuống 0.47 vì mộc mờ 85%
chỉ đạt 4.36:1.

Tests after (`gate:int` trên `d154a26`, 13/10 xong 06:54 UTC, session cloud theo các bước của CI):
unit 7246 — web 2270, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, i18n 48, core
48, ui 47, tokens 24 — và int 825. So với main `7429bdc`: unit thêm 40 ca (web 32, i18n 5, tokens 3),
int thêm 1 ca (W-05). CI của PR xanh ở cả hai lượt chạy của `d154a26`. Một lượt `pull_request` của
`64ee41a` đỏ dù 2270/2270 test web PASS: Vitest đếm một unhandled error `window is not defined` từ
timer 1000ms của nanostores gọi cleanup của better-auth sau khi jsdom bị tháo
(`auth-client.spec.tsx`, file nhánh không đụng). Lượt `push` của cùng commit xanh. Đã tái hiện bằng
cách xếp spec ấy trước một file giả lập lúc `window` đã mất; ghi G48.

**CÒN TREO:**

- [ ] G31: thử trên Edge có lưu mật khẩu cho www, mở hộp xoá tài khoản, ô "Type DELETE to confirm"
  phải còn trống. Chưa ai thử trên trình duyệt thật.
- [ ] W-08: một lượt PayPal sandbox qua giao diện `www` trên production (việc tay của user).
- [ ] W-09 còn phần ngoài cụm đăng nhập: bản quét trước thấy khoảng 283 chuỗi cứng trong 55 file, đa
  số trang marketing (họ "i18n sweep" của sổ nợ B1 và E5).
- [ ] W-06 (ảnh Google ở host khác `lh3`) không làm: `google-avatar.spec` cố ý từ chối `lh5`, chưa có
  bằng chứng Google trả host khác cho ảnh hồ sơ, và đổi thì phải nới CSP ở web lẫn admin.
- Phát hiện mới ghi vào open-items: G46 (`destructive-emphasis` theme tối trên `muted` 3.94:1), G47
  (mobile vẫn dùng `success` và `warning` làm mực), G48 (timer rò của `auth-client.spec.tsx`).
- Dọn sau merge: nhánh `fix/web-open-items` trên origin nếu GitHub không tự xoá.

## 2026-10-13 — Merge P4f vùng Users: hai bậc Owner và Staff, khoá tài khoản (`8b453c6`..`26746d3`)

Admin có hai bậc: Owner (role `ADMIN`, chỉ từ `ADMIN_EMAILS`) và Staff (role `STAFF`, Owner cấp cho
khách đã xác minh). Bảng quyền `ADMIN_ACCESS` ở contract quyết 64 thủ tục admin: Staff dùng 48, 16 là
của riêng Owner. Owner có `/users`: danh sách, chi tiết, cấp và thu Staff, khoá và mở khoá, đăng xuất
mọi nơi, lịch sử theo người. Quyết định ở [ADR-0052](adr/0052-admin-staff-tier.md), hợp đồng ở
[spec](specs/2026-10-02-p4f-users-staff-design.md), các bước ở
[plan](plans/2026-10-02-p4f-users-staff.md). Một migration chỉ thêm
(`20261013022702_p4f_users_staff`: giá trị `STAFF`, cột `users.locked_at`, bảng `user_events` có
RLS); không env. Thi công và review trên session cloud 13/10,
[PR #6](https://github.com/yurivolkov21/Tourism-Platform-V2/pull/6).

**API.** `@AdminImplement` thay `@Implement` ở mọi handler admin của 14 controller: gắn route như cũ
cộng `@Roles(...)` suy từ bảng quyền (`owner` → ADMIN, `staff` → ADMIN và STAFF); lưới
`@Roles(ADMIN)` cấp class giữ nguyên. Test quét quyền gọi mọi thủ tục admin: khách nhận 403 ở tất
cả, Staff nhận 403 ở thủ tục của Owner và qua cổng ở thủ tục của Staff. Khoá tài khoản: hook
`session.create.before` ném 403 `ACCOUNT_LOCKED` ở mọi đường tạo phiên (mật khẩu, OTP email, Google
trên web và app), AuthGuard trả 401 cho phiên sót của tài khoản đang khoá, `lockedAt` đi kèm
get-session. Sáu route `admin.users.*` (`list`, `byId`, `setRole`, `lock`, `unlock`,
`revokeSessions`): mỗi lệnh ghi một transaction giành hàng bằng `SELECT … FOR UPDATE` rồi mới hỏi
`userActions`, xoá phiên trong cùng transaction khi khoá hay thu Staff, ghi đúng một dòng
`user_events`. Trần ghi 60/60s của bề mặt admin áp cho cả Staff (trước chỉ Owner). Từ vòng vá
review: hook tạo và sửa user chặn email dài hơn 254 ký tự, `revokeSessions` trả số phiên còn hạn, ô
tìm của outbox không còn khớp `dedupeKey` của bốn loại email auth.

**Web.** Đăng nhập bị khoá hiện câu `accountLocked` (`mapAuthError` của core nhận
`ACCOUNT_LOCKED`); nút Google gửi `errorCallbackURL` về `/login` và form đọc `?error=`; phiên có
`lockedAt` coi như không đăng nhập.

**Admin.** Cổng nhận Staff; `AdminAccessProvider` và `useCanAccess` cho component client hỏi nút
nào hiện (không provider thì true); `requirePageAccess` chặn `/reports`, `/payment-events`, `/users`
và `/users/[id]` trước khi fetch, route xuất của thủ tục chỉ Owner trả 403 cho Staff kèm câu
`exportOwnerOnly`; trang `/not-authorized` có biến thể "Owner only". Sidebar lọc theo bậc, menu tài
khoản ghi Owner hay Staff. Staff không thấy sáu nút: hoàn tiền, huỷ chuyến, xoá tour, xoá bài, xoá
danh mục, xoá điểm đến. `/users`: tab All, Staff, Locked, tìm theo tên hay email, phân trang.
`/users/[id]`: Profile, Activity (link sang bookings đã lọc), Staff access, Account lock, Sessions,
History; bốn thao tác qua hộp xác nhận (khoá bắt buộc ghi lý do). Card Staff access nói theo đúng
trạng thái, kể cả Staff đang khoá và Staff chưa có mật khẩu (chỉ đường "Forgot password?").

**Lệch plan.** (1) Spec của `@AdminImplement` import `@nestjs/common/constants.js` và các method
thăm dò trả `never` để tsc 7 nhận dưới ESM. (2) Throttler gọi `isAdminAppRole(user.role ?? '')` vì
`role` của user phiên có thể vắng theo kiểu. (3) Test quét quyền đỏ hai ca từ Task 3 tới Task 5:
`admin.users.*` có trong contract từ Task 1 nhưng route tới Task 5 mới có, nên trả 404 thay vì 403.
(4) Ca get-session của Task 4 kiểm `user.lockedAt` là chuỗi, chặt hơn plan. (5) `loginDestination`
(G40 Phần 3 thêm sau khi plan viết) nhận cả Staff, nên Staff đã đăng nhập mở link mã đơn trong Excel
cũng vào thẳng trang đơn. (6) Spec của provider truyền role qua helper `renderAs` vì luật a11y
`useValidAriaRole` của Biome bắt prop `role="STAFF"`. (7) Gate đầy đủ chạy ở hai mốc (sau Task 6 và
ở Task 14) thay vì cuối mỗi task; task nào cũng chạy unit test của gói đã chạm, typecheck và đột
biến. (8) Ghi chú mobile (Task 14 B3) viết theo đường ID token của ADR-0056: lỗi khoá về thẳng 403,
không qua redirect như plan tả. (9) Grep của Task 14 B2 trúng ba chỗ đúng: JSDoc của
`@AdminImplement` nhắc `@Implement(contract.admin.…)`, và `users-view.ts` so
`detail.role === 'ADMIN'` hai lần (role của tài khoản đang xem, code của chính plan Task 11). (10)
Session cloud nên nhánh được đẩy lên origin sau mỗi task; docs của Task 14 đi hai commit. (11) Nhánh
rebase lên `1ca92f5` sau merge Google native; commit CHANGELOG viết sớm bị bỏ và dòng attribution bị
gỡ theo chỉ dẫn dự án 13/10; int test khoá cho hai đường Google thêm sau rebase (`4a35107`). Lúc
merge nhánh rebase thêm một lần lên `59af46c` (commit docs thử tay Google): xung đột chỉ ở docs, mã
không đổi.

**Soi bố cục (CSS build thật; Chromium headless qua CDP vì session cloud không có Browser
pane).** `/users/[id]` với tên, email và lý do khoá dài: 1600px không cuộn ngang, Profile và Activity
cùng hàng, ba card Staff access, Account lock, Sessions cùng hàng, không card nào tràn; 390px không
cuộn ngang, ba card xếp chồng, không card nào tràn. Đo thêm trang của một Staff đang hoạt động: cùng
kết quả. `/users` 1600px không cuộn ngang; 390px trang không tràn (đạt tiêu chí plan) nhưng cột User
chỉ còn ảnh đại diện: link tên rộng 0px ở 390px, 33px ở 768px. Vá bằng sàn `min-w-48` cho lưới tên
(`711c9e6`); đo lại: tên 192px ở 390px và 768px, bảng cuộn ngang trong khung, trang không tràn. Bảng
Posts và Tours đang chạy prod có cùng tật: ghi G44, không sửa ở nhánh này.

**Review 13/10 trên session cloud** (hai lượt review độc lập trên `38fe4fe`: một lượt rà API,
contract và Better Auth; một lượt rà admin, web và copy): 11 phát hiện, vá 9, ghi 1, giữ 1.

1. Ô tìm của outbox khớp `contains` trên `dedupeKey` thô, mà khoá của email auth nhúng OTP và link
   reset. Review xếp Thấp; đo lại là Cao: Staff gửi OTP đăng nhập tới email Owner (route ẩn danh),
   dò đủ sáu số sau 26 lượt `GET /api/admin/outbox`, đăng nhập thành Owner và gọi được
   `/api/admin/users`. Lỗ sinh ra từ P4f, vì trước đó chỉ Owner vào được outbox. Vá ở `e4c46c3`:
   vế `dedupeKey` loại bốn loại email auth, tìm theo người nhận vẫn ra; đo lại sau vá, 60 lượt dò
   không ra số nào.
2. Email tài khoản không có trần, nên một email 330 ký tự (đăng ký ẩn danh được) làm
   `admin.users.list` và `byId` trả 500 ở bước kiểm output. Vá ở `f752d17`: hook tạo và sửa user chặn
   email dài hơn 254 ký tự (400 `INVALID_EMAIL`), schema đọc bỏ trần để hàng cũ vẫn hiện.
3. Toast "N sessions ended." đếm cả phiên đã hết hạn, lệch ô Active sessions. Vá ở `5d8347e`.
4. Card Staff access của một Staff đang khoá vẫn nói dùng được back office. Vá ở `682b7ce`.
5. Khách vừa khoá vừa chưa xác minh được bảo mở khoá trước, như thể mở khoá là đủ. Vá ở `682b7ce`.
6. "View bookings" tìm bằng `contains` nên có thể kéo booking của tài khoản khác. Ghi G45: vá cần lọc
   `userId` cho `admin.bookings.list`, tức thêm tính năng.
7. Staff mở thẳng link xuất báo cáo nhận câu "no longer has admin access". Vá ở `7830e8c`.
8. Ca test chip của bảng Users không thể đỏ; ca "ba nút ba card" và ca Owner đang khoá không kiểm nút
   nằm ở card nào. Vá ở `42823ea`: soi trong đúng hàng và đúng card.
9. Lớp gác giao diện của Staff (provider ở layout, `requirePageAccess` ở bốn trang) không test nào
   canh. Vá ở `bdc5f38`: `owner-gates.spec.tsx`, Vitest admin thêm glob `src/app/**`.
10. Staff chỉ có tài khoản Google không vào được form admin (form cần mật khẩu) và form báo sai mật
    khẩu. Vá ở `682b7ce` và `b35175e`: card chỉ đường đặt mật khẩu bằng "Forgot password?", int test
    đo đường đó với tài khoản chỉ có Google; spec §8.4 và §11 ghi giới hạn. Suy luận chưa đo: trên
    production `COOKIE_DOMAIN` chia phiên giữa www và admin, nên phiên Google ở www có thể vào thẳng
    admin.
11. Hook khoá thêm một lượt đọc mỗi lần tạo phiên. Giữ: đọc theo khoá chính.

Tests after (`gate:int` 13/10 04:17–04:29, session cloud theo đúng các bước của CI, trên đầu nhánh
khi còn đặt trên `1ca92f5`; lần rebase lên `59af46c` sau đó chỉ kéo thêm docs nên mã y hệt `26746d3`):
unit 7206 — web 2238, admin 2083, api 1118, mobile 771, contract 701, mobile-ui 136, core 48, ui 47,
i18n 43, tokens 21 — và int 824 ở 50 file. So với main `1ca92f5`: unit thêm 129 ca (admin 85,
contract 26, api 11, web 5, core 2), int thêm 34 ca (ba file mới `account-lock`, `admin-access`,
`admin-users`, và ca mới ở `google-sign-in`, `auth-hardening`, `admin-outbox`). Lượt gate đầu đỏ ở
`@tourism/contract#test` vì container hết RAM (dmesg: kernel giết một tiến trình node 4,4 GB đúng lúc
worker test chết); contract chạy riêng 701/701, lượt chạy lại xanh. CI của PR #6 xanh trước lần
rebase đó. Đột biến tay lúc thi công 66 lần, 64 lần test đỏ. Hai lần sống sót: `=== 'ACCOUNT_LOCKED'`
thành `includes('LOCK')` ở `mapAuthError` (plan chấp nhận: không mã Better Auth nào khác chứa LOCK), và
gỡ `requirePageAccess` ở trang, lúc thi công không test nào bắt, nay `owner-gates.spec.tsx` bắt.

**Migration lên Supabase:** user chạy tay từ máy mình 13/10, khoảng 05:08–05:12 UTC, trước lượt push
main (Git Bash, thư mục `apps/api`, checkout của nhánh, `DATABASE_URL` lấy từ `.env.production`).
`migrate status` báo thiếu đúng `20261013022702_p4f_users_staff`, `migrate deploy` áp xong, rồi
`migrate status` báo 31 migration và "Database schema is up to date!". Thread không ghi vào Supabase
(chỉ dẫn dự án 13/10).

**CÒN TREO:**

- [ ] Thử tay trên production theo spec §8.4, từng bước. Cần một tài khoản khách thật thứ hai mà
  user giữ hộp thư (khách seed không đăng nhập được).
- [ ] G45 chờ user quyết: thêm lọc `userId` cho `admin.bookings.list` là thêm tính năng.
- Dọn sau merge: nhánh `feat/p4f-users-staff` trên origin (session cloud không xoá được nhánh trên
  GitHub).

## 2026-10-13 — Thử tay đăng nhập Google native trên production 4/4 bước

**Thử tay** (ba mục thử trong CÒN TREO của entry merge bên dưới, chia thành bốn bước; sau push
`1ca92f5`: Actions main xanh, Render deploy API live 03:51 UTC; user làm trên máy mình và điện
thoại Android, gửi ảnh hoặc báo kết quả, session gốc đối chiếu):

1. Web production, cửa sổ ẩn danh, một tài khoản Google chưa có trên Nexora (Workspace, chưa đặt
   ảnh): tài khoản tạo xong, khung hộ chiếu và avatar đầu trang hiện ảnh mặc định chữ cái của
   Google (nền tím, chữ trắng). Khi không có ảnh, app vẽ ô xám nhạt với chữ serif
   (`passport-card.tsx`), nên URL ảnh Google đã được lưu.
2. `curl -i` vào `expo-authorization-proxy` từ máy user: `HTTP/1.1 400 Bad Request`, body
   `{"message":"Invalid authorizationURL"}`, không có `set-cookie`.
3. Build lại APK `preview` từ `main` (`1ca92f5`, build EAS `e0a6f244`) rồi cài lại. Checkout trên
   máy user lúc đó còn ở nhánh cũ, thiếu 6 commit của vòng review, nên phải chuyển sang `main` và
   pull trước khi build.
4. Trên APK mới: bấm Google hiện bảng chọn; tắt hẳn app, mở lại, Sign out, bấm Google lần nữa vẫn
   hiện bảng chọn và chọn được tài khoản khác. Đây là ca phát hiện 1 và 2 của review nhắm tới (bản
   cũ gọi `signOut` khi chưa `configure` sau khi mở lại app). Avatar trên app đúng ảnh tài khoản
   Google; user không gặp lỗi nào khác.

User đã xoá nhánh `feat/mobile-google-native-signin` trên origin và ở máy mình.

**CÒN TREO:**

- Nút Google ẩn ở bản iOS thiếu client iOS mới có unit test, chưa thử trên máy: cần bản iOS, tức
  là cần tài khoản Apple Developer. Ghi cùng Credential Manager ở open-items mục 4 (sau v1).
- Docs, không đổi mã; không migration, không env.

## 2026-10-13 — Merge đăng nhập Google native trên mobile (ADR-0056), đóng proxy Expo trên API (`b6dacdc`..`2d6f6c7`)

App mobile đăng nhập Google bằng SDK gốc `@react-native-google-signin/google-signin` 16.1.5: bảng
chọn tài khoản của hệ điều hành cho ID token, app gửi `POST /api/auth/sign-in/social` kèm `idToken`
rồi lưu cookie phiên như đăng nhập email. Luồng cũ qua trình duyệt và proxy
`expo-authorization-proxy` bỏ hẳn. Expo Go không nạp được module gốc nên nút Google ẩn ở đó (và ở
bản iOS thiếu client iOS); thử Google cần APK `preview` hoặc dev build của EAS
([runbook §7](conventions/mobile-dev-loop.md)). [ADR-0056](adr/0056-mobile-google-native-signin.md)
cùng AMEND 1, [spec](specs/2026-10-09-mobile-google-native-signin-design.md).

API, deploy theo merge này:

- `b6dacdc`: before-hook trả 400 cho mọi `GET /expo-authorization-proxy`, ở mọi môi trường — vá
  chuỗi chiếm phiên qua deep link đang mở trên production (ghi chú 09/10 ở ADR-0017 §11) — và cho
  `/sign-in/social`, `/link-social` không kèm `idToken` mà có callback là deep link. Provider Google
  nhận `clientId` dạng mảng: client web, rồi client iOS nếu có `GOOGLE_IOS_CLIENT_ID`.
- `c3bca63`: tài khoản MỚI tạo bằng Google, cả web lẫn app, không còn bị guard avatar chặn. Trên
  `/sign-in/social` và `/callback/:id`, ảnh `lh3.googleusercontent.com` được giữ, ảnh host khác bị
  bỏ (user chọn giữ ảnh Google 13/10). Trước bản này mọi tài khoản mới bằng Google bị từ chối, kể cả
  trên web production — kết luận từ đọc mã và int test, chưa đối chiếu log production.

Mobile `2b26e55` (seam SDK ở `google-native.ts`, nút ẩn khi không dùng được) và `245958e` (nối dự án
EAS `@yuri-volkovs-team/nexora-travel`): `eas.json` có profile `preview` (APK trỏ API production,
client ID web và iOS trong khối `env`) và `development`, script `eas-build-post-install` build các
package workspace trên EAS, `expo-dev-client` nên ba script dev thêm `--go`. Docs `f189183` và
`8d302da`. Không migration, không đổi env API; hai dependency mobile mới đã có trong ADR-0056.

**Google Cloud và EAS** (user làm 13/10): client iOS và client Android cùng dự án với client web
đang chạy, trang OAuth Publish ("In production"), build `preview` đầu tiên trên EAS xanh với khoá ký
sinh trên EAS.

**Thử trên máy thật 13/10** (APK `preview`, API production chưa có nhánh này): Google vào đúng tài
khoản email có sẵn (không ảnh là đúng thiết kế, Better Auth không chép ảnh khi liên kết); đóng bảng
chọn thì màn đứng yên; đăng xuất rồi chọn lại tài khoản được; bấm tim khi chưa đăng nhập rồi đăng
nhập Google quay về đúng chỗ.

**Review 13/10 trên session cloud** (code-review mức high trên `d0d7b88..245958e`): 10 phát hiện, vá
8, giữ 2.

1. Đăng xuất khỏi app gọi `signOut` của SDK khi SDK chưa cấu hình trong tiến trình (sau khi mở lại
   app), Android từ chối và lỗi bị nuốt, nên lần sau Android tự vào lại tài khoản cũ. Vá ở
   `0d46574`: đăng xuất cấu hình SDK trước.
2. API từ chối token thì SDK vẫn nhớ tài khoản vừa chọn. Vá ở `0d46574`: app `signOut` trước mỗi
   lần mở bảng chọn, nên lần nào cũng được chọn tài khoản.
3. Bản iOS thiếu client iOS hiện nút mà bấm vào chỉ ra lỗi. Vá ở `0d46574`: ẩn nút.
4. Khoá deep link chỉ bắt `nexora:`, trong khi plugin `expo()` tự tin `exp://` ở development và gắn
   cookie cho mọi deep link tin cậy. Vá ở `9d512f6`: chặn mọi URL tuyệt đối có scheme khác
   http/https, parse bằng `new URL` như plugin (hoa thường, tab, ký tự điều khiển không lách được).
5. Ngoại lệ ảnh Google chưa có int test qua đường thật của Better Auth. Vá ở `430f9c7`: 5 ca với
   JWKS và token endpoint Google giả; chạy trên `auth.config.ts` trước bản vá ảnh thì 3 ca tài khoản
   mới đỏ.
6. Mọi lỗi của SDK gộp thành lỗi chung. Vá ở `0d46574`: máy không có Google Play Services báo
   "not available" (bấm lại không chữa được); các lỗi còn lại vẫn là lỗi chung.
7. Scheme `nexora` lặp lại ở API ngoài `env.ts`. Hết theo mục 4: API không còn hằng scheme.
8. Before-hook so path lần hai để chọn thông điệp. Vá ở `9d512f6`: guard trả lý do.
9. `GOOGLE_IOS_CLIENT_ID` bị cho là cấu hình chết. Giữ: ID token cấp cho app iOS mang audience là
   client iOS (suy từ tài liệu Google, chưa đo được khi chưa có bản iOS); thừa thì vô hại.
10. Ảnh Google ở host `lh4`–`lh6` bị bỏ. Giữ: nới host phải sửa cả `img-src` của CSP web và admin;
    ghi ở open-items mục 4.

Tests after (`gate:int` trên `2d6f6c7`, 13/10 03:11–03:20, chạy trên cloud theo đúng các bước
của CI): unit 7077 — web 2233, admin 1998, api 1107, mobile 771, contract 675, mobile-ui 136, ui 47,
core 46, i18n 43, tokens 21 — và int 790/47. So với main: api 1097 → 1107 (guard 12 ca, ảnh Google
5, env 1, trừ 8 ca của spec proxy cũ đã gỡ), mobile 738 → 771 (seam Google 16, hành động auth 5,
cấu hình EAS 3, env 3, hai màn auth 4, đăng xuất 2), int 782 → 790 (proxy và khoá deep link 3, đăng
nhập Google qua Better Auth thật 5). Lượt gate đầu đỏ ở typecheck mobile vì spec mới so
`invocationCallOrder[0]`, kiểu `number | undefined` dưới `noUncheckedIndexedAccess` (jest vẫn
xanh); vá ở `2d6f6c7`, lượt sau chạy lại từ bước build API vì int đã xanh trên cùng mã API.

**CÒN TREO:**

- [ ] Sau khi Render deploy: đăng nhập bằng một Gmail chưa có tài khoản, trên web production và trên
  app, thấy tài khoản tạo xong kèm ảnh Google.
- [ ] Gọi proxy từ máy, thấy 400 và không có `set-cookie`:
  `curl -i "https://api.nexora-travel.agency/api/auth/expo-authorization-proxy?authorizationURL=https%3A%2F%2Faccounts.google.com"`.
- [ ] Build lại APK `preview` (JS của vòng review chưa có trong APK đang cài), cài lại, thử: bảng
  chọn hiện mỗi lần bấm, đăng xuất rồi đăng nhập lại chọn được tài khoản khác.
- [ ] Sau v1: Credential Manager thay Google Sign-In cũ trên Android; iOS khi có tài khoản Apple
  Developer (lúc đó thêm `GOOGLE_IOS_CLIENT_ID` vào env Render). Đã ghi ở open-items mục 4.
- Dọn sau merge: nhánh `feat/mobile-google-native-signin` trên origin (session cloud không xoá được
  nhánh trên GitHub).

# CHANGELOG — lưu trữ: khu sửa tour dạng thanh bước, quản trị bài viết (28/09–05/10/2026)

F19 khu sửa tour dạng thanh bước, báo cáo tháng chỉ ghi nhận chuyến đã kết
thúc (G21), lý do bác đánh giá chọn từ danh sách, P4e-4 quản trị bài viết, và
hook dựng môi trường cho session cloud.

Tách khỏi [`../CHANGELOG.md`](../CHANGELOG.md) ngày 14/10/2026.
⚠️ Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`). **Nội dung nguyên văn —
không một chữ nào đổi.** Chỗ duy nhất được đụng là đường dẫn tương đối: file
xuống sâu một cấp nên link tới `adr/`, `specs/`, `plans/`… phải thêm `../`, và
link tới tài liệu dời thư mục cùng ngày 14/10 trỏ sang chỗ mới. Đừng
mở-rồi-save bằng editor có markdownlint: nó đổi `+` đầu dòng thành `-` và nói
sai con số test đã ghi.

## 2026-10-05 — Hook session cloud dọn pid containerd sót lại khi resume (`c0ab2ec2`, nhánh `claude/nice-rubin-moffft`)

Lần resume đầu tiên của một session cloud sau khi hook vào `main`, hook báo "Postgres KHÔNG
lên được". Log dockerd ghi `containerd is still running pid=540` rồi `timeout waiting for
containerd to start`: file `/var/run/docker/containerd/containerd.pid` từ trước lúc container
được khôi phục vẫn còn, pid trong đó đã bị tiến trình khác dùng lại, nên dockerd tưởng
containerd còn sống. Hook chỉ dọn `docker.pid`.

Sửa: khi không có tiến trình `containerd` nào đang chạy thì xoá luôn `containerd.pid` trước khi
khởi động dockerd (7 dòng trong `.claude/hooks/session-start.sh`).

**Review findings:** không mở vòng review riêng. Kiểm chứng bằng cách dựng lại đúng tình huống:
dockerd và containerd tắt, `containerd.pid` trỏ vào một tiến trình `sleep` đang sống. Bản cũ
trên `main` báo Postgres KHÔNG lên được, bản sửa dựng Postgres 17 thành công. Hai ca hồi quy:
chạy lại khi Docker đang sống mất 2,6 giây; dockerd bị `kill -9` vẫn dựng lại được. Bản sửa
cũng chạy được ngay trên trạng thái hỏng thật của lần resume (13,6 giây).

Nhánh rebase lên `cfad94b6` (3 commit P4e-4 mới, không đụng `.claude/`). CI của nhánh xanh
(run #387). Không migration, không env, không webhook; thay đổi chỉ chạy trong session cloud.

Tests after: không đổi so với entry ngay dưới — hook nằm ngoài phạm vi `gate`.

## 2026-10-05 — Hai lỗi nhỏ lộ ra ở lượt thử tay P4e-4 (nhánh `fix/post-banner-toc-label`)

Lượt thử tay P4e-4 trên prod (entry ngay dưới) lộ hai lỗi nhỏ ngoài phạm vi vòng review. User
duyệt vá trên một nhánh riêng.

- **Dải "còn thiếu" theo bản đang soạn** (`3b4ecf69`). Dải vàng "A published post needs
  these…" là ảnh chụp lúc bấm Save: quay về Draft vẫn đứng, và vẫn liệt kê mục đã điền. Giờ
  dải tính lại mỗi lần vẽ từ bản đang soạn — chỉ hiện khi đang chọn Published và còn thiếu thật.
- **Mục lục bài viết in nhãn text thuần** (`4c2e61ff`). "On this page" lấy chữ thô của heading,
  nên heading in đậm hiện nguyên `**…**`. Lỗi có từ 31/07, lộ ra vì admin nay tạo được heading
  in đậm bằng hàng nút. Nhãn dùng cùng text thuần với id.

**Review findings:** không mở vòng review riêng; test viết trước cho cả hai, đỏ đúng chỗ rồi
mới vá. Không migration, không env.

Tests after: unit 5316 — web 1594, admin 1718, api 1039, contract 611, mobile 159, mobile-ui
86, core 46, ui 27, tokens 18, i18n 18 — và int 747/747.

## 2026-10-05 — Thử tay P4e-4 trên production (`2d5b3c76`): 8/8 bước đạt

Theo spec §8, từng bước: user làm và chụp màn hình, session gốc kiểm DB bằng SQL chỉ đọc và
gọi thẳng API.

1. `/posts`: chín bài seed, tab trạng thái, tìm theo tiêu đề.
2. Bài nháp `p4e-4-test-post`; chọn Published khi còn thiếu thì dải vàng liệt kê ba mục và không
   gửi lệnh nào; ngày tự điền đúng giờ server (02:00 UTC).
3. Hàng nút và tab Preview; `![x](y)` bị chặn ngay ở form; lưu nháp được khi còn thiếu ảnh bìa.
4. Ảnh bìa tải lên; hộp thư viện nói "Choose a cover photo"; tag theo thứ tự Food → P4e-4 test
   tag → P4e-4 pending tag (tag gõ dở được thêm khi lưu); hai tour giữ thứ tự. DB khớp cột
   `order` của cả hai bảng nối.
5. Hẹn 02:50 UTC → chip Scheduled; API và web trả 404 trước giờ hẹn.
6. API trả bài lúc 02:50:06 giờ server, web sau khoảng một phút; thẻ `/blog` mang chip Food; giá
   tour trong bài khớp `/tours` (Bà Nà $69, gạch $79).
7. Tắt bán Bát Tràng → trang bài bỏ thẻ ấy (G9); bật lại → thẻ về.
8. Xoá bài → web 404; DB không còn bài, dòng ảnh, liên kết tag hay tour; ảnh tải lên vào hàng
   dọn và không còn gì trỏ tới nó.

Dọn sau lượt thử: hai tag thử (`P4e-4 test tag`, `P4e-4 pending tag`, 0 bài) user tự xoá bằng
SQL; kiểm lại còn 14 tag và 17 liên kết tag, đúng như trước lượt thử. Còn treo: ảnh bìa thử
trên Cloudinary do bộ dọn xoá sau hạn bảy ngày. Hai lỗi nhỏ lộ ra: entry ngay trên.

## 2026-10-05 — Merge P4e-4 quản trị bài viết lên main (`fb64ca45`)

Nội dung và vòng review đã kể ở entry nhánh ngay bên dưới (thi công 02/10, review max 02/10,
vá 05/10). Entry này chỉ ghi sự kiện merge.

Nhánh rebase lên `caefdc79` — main có thêm hai commit SessionStart hook cho session cloud.
Một xung đột ở CHANGELOG: entry của nhánh và entry mới của main cùng chen vào đầu file; gỡ
bằng cách đặt entry nhánh lên trên, cả hai giữ nguyên văn (nếp merge F18). Ba mươi sáu commit
còn lại áp sạch. `gate:int` chạy lại trên đỉnh đã rebase: build, typecheck và unit trúng cache
turbo (code y hệt lượt vừa xanh), lint xanh, int 747/747.

**Hạ tầng.** Migration `20261005003043_post_tag_links_order` chạy lên Supabase TRƯỚC khi push
(05/10, user duyệt; `prisma migrate deploy` qua Session pooler cổng 5432). Kiểm lại bằng SQL
chỉ đọc: cột `order` INTEGER NOT NULL DEFAULT 0, bản ghi migration xong, 17 dòng tag cũ nhận 0
— chúng sắp theo tên cho tới lần lưu kế hoặc lượt seed lại ~03/11. Không env, không webhook.
Khe deploy: admin lên Vercel trước API trên Render, nên `/posts` của admin lỗi tới khi API mới
lên (API cũ chưa có `admin.posts.*`); web không đổi đường gọi API nào.

Tests after: unit 5315 — web 1594, admin 1717, api 1039, contract 611, mobile 159, mobile-ui
86, core 46, ui 27, tokens 18, i18n 18 — và int 747/747 ở 46 file.

## 2026-10-02 — P4e-4 quản trị bài viết (nhánh `feat/p4e-4-posts-admin`)

Admin quản trị được bài viết: bảng `/posts` (tab Published · Scheduled · Drafts, tìm theo
tiêu đề), hộp New post, trang sửa một bài với một nút Save — trình soạn markdown có hàng nút
và tab Preview, card Publish (nháp, đăng, hẹn giờ theo UTC, danh sách ba mục cần để đăng),
ảnh bìa tải lên hoặc chọn từ thư viện, tag gõ thẳng, tối đa 3 tour liên quan, vùng xoá.
Quyết định ở ADR-0051, hợp đồng ở spec 02/10. Không env; một migration từ vòng review (cột
`post_tag_links.order`).

**API.** Bảy route `admin.posts.*` (`list`, `get`, `create`, `update`, `delete`,
`signCoverUpload`, `tags` ở `/api/admin/post-tags`). Lệnh sửa và lệnh xoá giành hàng bài
bằng `claimPost` (so phiên bản trong cùng câu `UPDATE`, khuôn `claimTour`), câu ghi bài sau
đó đặt `updatedAt` bằng phiên bản vừa giành. Cổng "đủ mới được đăng" tính từ chính input
(`postReadiness` của contract) nên bài đang đăng không thể lưu thành thiếu. Tag thay trọn,
`createMany skipDuplicates` giữ tên của người tạo đầu tiên; tour liên quan giữ thứ tự gửi,
khoá ngoại hỏng bắt ngay ở câu ghi (`P2003`). Ảnh bìa thuộc đúng một trong ba nguồn (ảnh hiện
có, thư mục tải lên của chính bài có metadata, dòng thư viện địa danh); chỉ ảnh trong thư mục
tải lên của chính bài vào lại hàng dọn khi bị thay hay khi bài bị xoá. Bust `posts` và
`post:<slug>` sau commit, lệnh hỏng thì không bust. Đường ký của tour và bài viết gom về
`signUploads` (một phần G15).

**Web.** `ArticleMarkdown` và `slugify` dời sang `@tourism/ui` (web re-export `slugify`, test
của bộ render ở lại web); trang bài có khối "Tours in this story" sau thân bài; G9 đóng bằng
tag `tours` trên lượt đọc chi tiết bài; `fetchPosts` đi hết các trang (`collectAllPages`).
Lockfile chỉ thêm hai mục `react-markdown`, `remark-gfm` vào importer `libs/shared/ui`.

**Phần dùng chung tách từ F17/F18.** `PhotoLibraryDialog` sang `components/kit/` với
`tourDestinationIds` tuỳ chọn, copy sang `messages.admin.photoLibrary`, kiểu lệnh tải kho
ảnh sang `lib/photo-library.ts`; lõi `useVersionedForm` tách khỏi `useTourFormState`. Test
F18 xanh nguyên, admin 1584 thành 1585 ca (đúng một ca mới).

**Lệch plan.** (1) `pnpm install` muốn đổi cả peer `@types/node` của jest trong
`apps/mobile`; lockfile được khôi phục rồi chỉ thêm hai mục của `libs/shared/ui`,
`--frozen-lockfile` chấp nhận. (2) Ca "chip trạng thái" của `posts-table.spec.tsx` soi
trong `table` vì chữ "Scheduled" cũng là nhãn tab lọc. (3) `post-tags-card.tsx` gọi
`g.useSuggestion` qua tên `suggestionLabel` vì Biome coi mọi lời gọi `use…()` là hook.
(4) File soi bố cục tạm của Task 13 gọi `await AdminShell(...)` (shell là async server
component). Phép grep của Task 14 trúng đúng câu JSDoc mà plan bắt viết ở `messages.ts`
("Dời nguyên văn từ `tours.editor.photos.dialog`").

**Soi bố cục (CSS build thật).** 1600px: không cuộn ngang, hai cột, card Publish ngang card
tiêu đề (lệch 1px), hàng nút không tràn; bảng `/posts` không cuộn ngang. 390px: một cột, cột
phải nằm dưới form, không cuộn ngang, hàng nút không tràn; bảng không cuộn ngang. Ghi nhận
cho review: `Textarea` của `@tourism/ui` có `field-sizing: content` nên `rows={18}` của ô
Content không có tác dụng — nháp rỗng chỉ cao 64px.

**Review findings (review max 02/10, vá 05/10).** 11 góc tìm, 7 nhóm kiểm chứng và một lượt
quét lỗ hổng cho 15 mục báo cáo (5 mức Vừa) cùng 8 mục nhỏ, không mục nào mức Cao. User chốt
vá hết trên nhánh, kể cả hai script media nằm ngoài diff. Mỗi mục có test đỏ trước khi vá;
đột biến tay thêm ở ba chỗ (dòng hero so với mọi dòng, Reload của dải báo, chặn "đủ 3 tour").

- Mức Vừa: (1) chữ gõ trong lúc đang lưu bị `adopt` ghi đè — `useVersionedForm` thêm `settle`,
  chỉ thay giá trị form khi nó vẫn là thứ đã gửi (`4f1222c3`); (2) tour liên quan hiện
  `basePrice` thay giá "from" — `priceFromByTour` dùng chung với `listTours` (`c430fd16`);
  (3) luật cấm ảnh lách được bằng ảnh dạng tham chiếu hay dạng tắt, regex chạy O(n²) (đo
  80k ký tự 0,9 s) và `max` của Zod 4 không chặn refine — chặn mọi `![` trong một lượt quét,
  `max` dừng hẳn, `ArticleMarkdown` in alt thay cho ảnh (`12e3624c`); (4) Bold/Italic bọc cả
  dấu cách mép thành `**pho **` (`3029efe4`); (5) `media-upload` và `apply-alt-text` coi ảnh
  bìa bài là của seed, chạy lại là ghi đè; `seed:verify` thêm bất biến readiness của bài,
  ADR-0051 giới hạn 4 sửa cách gỡ vì `media-inbox/` không còn trên máy (`472528ce`);
  (6) `lib/api/posts.ts` và `post-banner` chưa có spec (`f66a0f7a`, `2122d9e4`).
- Mức Thấp: Ctrl+Z mất sau nút định dạng — chèn đúng đoạn đổi qua `execCommand('insertText')`;
  tab Preview gỡ `#post-content`, id heading trùng id card ảnh bìa, link rời trang sửa
  (`c22d88fd`); đường ghi và đường đọc chọn khác dòng hero (`379b53af`); ngày tự điền lấy
  đồng hồ máy — `useServerClock` neo giờ server (`a92ae3b6`) — và lọt vào nháp chưa từng có
  ngày (`1edb2ce8`); lỗi tour đã xoá không chỉ tour nào — lỗi mang `data.tourIds`, form gỡ
  đúng tour và nói tên (`886fe20c`, `420cae1d`); xoá không rõ kết quả ra 404 (`99af1fed`);
  thứ tự tag không cố định nên chip danh mục đổi — user chọn cột `order` thay vì sắp theo
  tên (`dc5e7553`); tag gõ dở bị bỏ khi lưu và Enter của bộ gõ IME (`94fa605b`); card ảnh
  bìa không huỷ được upload lúc đang ký, giữ kho cũ sau lỗi, copy "Add" (`51be2f62`);
  Reload làm rơi tiêu điểm (`ac5c2228`); slug xét độ dài trước hình dạng (`ec094752`).
- Dọn: trần contract và tag ref một nguồn (`81873bc9`), một lớp lỗi upload chưa cấu hình
  cho ba nơi ký (`09db2546`), một server action kho ảnh (`0800163d`), ba test không thể đỏ
  (`c9b68dd4`), ô chọn tour cảnh báo khi cắt ở trần 10 trang.
- Không đổi: "markdown parse lại mỗi phím" — tab Preview vốn không mount khi đang gõ; lượt
  vá chỉ giữ tab Write luôn mount. Bác ở bước kiểm chứng: refresh thừa sau lưu, định danh
  tag, đột biến `updatedAt`, export-snapshot thiếu `post_tours`, test tag trùng theo slug,
  `PostThumb`, map copy hộp xoá, `PostTourOption`, `fetchPosts` của web.

**CÒN TREO cho lúc merge (session gốc):** migration `20261005003043_post_tag_links_order`
mới chạy ở Postgres local — chạy lên Supabase TRƯỚC khi push main (hỏi user), không thì API
mới đọc cột chưa có.

Tests after (sau lượt vá 05/10, `gate:int` xanh trên đỉnh nhánh): unit 5315 — web 1594, admin
1717, api 1039, contract 611, mobile 159, mobile-ui 86, core 46, ui 27, tokens 18, i18n 18 —
và int 747 ở 46 file. Lượt vá thêm 50 ca unit và 5 ca int. Số của lượt thi công 02/10 giữ
nguyên ngay dưới để đối chiếu.

Tests after (lượt thi công 02/10): Vitest 5265 — web 1593, admin 1678, api 1037, contract 603, mobile 159, mobile-ui 86, core 46, ui 27, tokens 18, i18n 18 — và int 742 ở 46 file. Ca mới: contract 41, api 22 (luật thuần, thư mục ảnh bìa, `signUploads`, tag cache), admin 120, web 5 (cộng 4 ca `slugify` dời sang ui), int 34 trong `admin-posts.int.spec.ts`. Đột biến: 105 lượt thử, 98 giết, 7 sống — sáu cái plan đã dự báo là tương đương hay chưa phủ, một cái ngoài plan (bỏ `updatedAt: version` ở câu ghi bài không ca nào bắt vì `update` đọc lại DB).

## 2026-10-05 — SessionStart hook dựng môi trường cho session cloud (`eafb1eca`, nhánh `claude/nice-rubin-moffft`)

User mở session cloud (claude.ai/code) để review các nhánh mobile của nhóm và hỏi có phải
khai biến môi trường ở cloud không. Đo trên container thật: KHÔNG cần secret nào, cái thiếu
là toolchain. Image chỉ có Node 20–22 trong khi repo đòi 24, chưa có `node_modules`, không
Postgres nào chạy, không `.env.local`.

- **`.claude/hooks/session-start.sh`** (đăng ký ở `.claude/settings.json` mới), chỉ chạy khi
  `CLAUDE_CODE_REMOTE=true` nên máy Windows bỏ qua. Cài Node 24 qua nvm có sẵn trong image
  và ghi PATH qua `CLAUDE_ENV_FILE`; pnpm đúng `packageManager`; `pnpm install
  --frozen-lockfile` như CI; chép `.env.example` thành `.env.local` cho từng app (giá trị
  dev trỏ localhost, luật 15); dựng Postgres 17 bằng `docker compose up -d --wait postgres`,
  cùng image với CI. Postgres 16 có sẵn trong image cố ý không dùng vì khác major với
  dev/CI. Phần Postgres hỏng chỉ cảnh báo; phần bắt buộc hỏng thì exit 2 kèm stderr.
- **CLAUDE.md** thêm một gotcha: hook chỉ chạy trên nhánh CÓ nó, và build web trong `gate`
  vẫn cần API sống như CI.

Hook làm ở nhánh riêng thay vì `feat/mobile-browse-screens` vì đó là nhánh feature của
thành viên khác (luật 1). Lúc merge, bốn nhánh `feat/mobile-*` tách từ `80e36099`, chậm
`main` 167 commit và đã xung đột với `main` ở `apps/api/package.json`, `pnpm-lock.yaml`,
`docs/CHANGELOG.md`, `docs/README.md` (booking và review thêm `docs/open-items.md`). Mô
phỏng `git merge-tree` có và không có hook ra cùng một danh sách: hook không thêm xung đột.

**Review findings:** không mở vòng review riêng. Kiểm chứng trên container cloud mô phỏng
session mới: chạy lạnh 17 giây, chạy lại 2,6 giây và PATH không ghi trùng; pid file dockerd
sót lại sau `kill -9` được dọn; thiếu nvm thì exit 2; Docker hỏng thì chỉ cảnh báo. Chưa
thử trong một session cloud mở thật, nên việc `CLAUDE_ENV_FILE` áp PATH mới dựa trên tài
liệu.

Không cần rebase: `main` đứng ở `ffae9c50` suốt lúc làm. CI của nhánh (run #378) xanh.
Không migration, không env, không webhook.

Tests after: unit 5077 — web 1592, admin 1558, api 1015, contract 562, mobile 159, mobile-ui
86, core 46, ui 23, i18n 18, tokens 18 — và int 708/708.

## 2026-10-01 — Merge lý do bác review lên main (`14b631a3`)

Nội dung đã kể ở entry ngay bên dưới (28/09). Entry này chỉ ghi sự kiện merge.

User dừng merge hôm 28/09 vì còn định góp ý. 01/10 user xem lại bằng một trang tĩnh dựng
từ chính component của nhánh (jsdom ghép CSS bản build admin, bốn trạng thái của hộp
Reject: lần bác đầu, lần chung cuộc với review đang hiện, Other thiếu chi tiết, tìm
"photo") và duyệt nguyên trạng, không góp ý thêm.

Nhánh rebase lên `bc99671e`, chậm 76 commit. Một xung đột ở CHANGELOG: entry của nhánh và
các entry mới của `main` cùng chen vào đầu file; gỡ bằng cách đặt entry nhánh lên trên, cả
hai giữ nguyên văn (nếp merge F18). Năm commit còn lại áp sạch, kể cả `messages.ts`.
`gate:int` chạy lại trên đỉnh đã rebase: xanh sau 737 giây.

Không migration, không env, không webhook. API đổi (`reviews.service`, mail
`REVIEW_REJECTED`) nên Render dựng lại API; payload xếp hàng trước lúc deploy không có hai
trường mới nên mail in như cũ.

Tests after: unit 5077 — web 1592, admin 1558, api 1015, contract 562, mobile 159, mobile-ui
86, core 46, ui 23, i18n 18, tokens 18 — và int 708/708.

## 2026-09-28 — Bác review bằng lý do chọn từ danh sách; dialog và email nói đúng đường sửa (nhánh `feat/review-reject-reasons`)

Góp ý của giáo viên hướng dẫn (qua user): lý do bác gõ tay thì mỗi admin một kiểu,
câu gửi khách không đồng nhất. User đề xuất một danh sách lý do kèm ô tìm ở bên
trái dialog Reject, bấm là điền vào ô "Why it was rejected". Quyết định ghi ở
ADR-0031 AMEND 1 (`c8e58545`, viết trước code).

- **Lý do chọn từ danh sách, câu chuẩn khoá** (`a474cca7`). Dialog Reject rộng ra
  hai cột: trái là ô tìm và chín lý do soạn sẵn (tìm theo cả tên lẫn câu, nhiều từ
  thì phải khớp đủ); phải là ngữ cảnh review, ô "Why it was rejected" hiện nguyên
  văn câu khách sẽ đọc, và ô "Add a detail" tuỳ chọn. User chọn phương án khoá câu
  thay vì điền vào ô sửa được: điền rồi sửa được thì admin vẫn gõ đè cả câu. Mục
  "Other" bắt buộc có chi tiết. Câu chuẩn chỉ nói VÌ SAO, không hứa đường sửa; danh
  sách cố ý không có lý do kiểu "đánh giá tiêu cực". Note gửi server vẫn là một
  chuỗi (câu chuẩn cộng chi tiết), trần 500 lấy từ hằng mới
  `REVIEW_MODERATION_NOTE_MAX` của contract (`27dbd770`); ô chi tiết tính trần theo
  câu dài nhất nên đổi lý do sau khi gõ không bao giờ vượt. Không migration, không
  đổi hình dạng contract. Dialog dựng trên hook `useConfirmWrite`; kit
  `ConfirmWriteDialog` không đổi, ba lệnh Approve, Unpublish, Reopen vẫn đi qua nó.
- **Dialog nói theo lần bác.** Rà lúc thiết kế thấy copy dialog Reject vẫn nói như
  trước ADR-0032: "The author cannot rewrite this review… no way to edit it",
  "closes the review for good", nhắc một nút "Unapprove" không tồn tại. Nay câu mở,
  hệ quả và câu cuối đổi theo `canAuthorEdit` của contract với số lần bác sau lần
  này: lần đầu nói tác giả còn một cơ hội sửa rồi gửi lại (câu cuối giọng trung
  tính), lần chung cuộc thì cảnh báo đỏ, và chỉ nhắc Unpublish với review đang hiện.
  Review CURATED hay tài khoản đã xoá thì không có ai để sửa, nên nói chung cuộc.
  Chữ "once" đổi thành "one more chance" (`1c62f51e`): luật đếm lần bác, không đếm
  lần sửa.
- **Hết hứa "gỡ khỏi trang tour" với review chưa lên site.** Bác một review đang
  chờ, bản trước vẫn in "Removes the review from the tour page." — đúng câu trong ảnh
  user gửi. Nay review chưa duyệt in "not on the site right now, so nothing comes
  down".
- **Email bác nói đường sửa** (`0661a20d`). Payload `REVIEW_REJECTED` thêm `canEdit`
  (service tính bằng `canAuthorEdit` với số lần bác vừa đếm trong transaction) và
  mã booking. Còn sửa được thì mail mời sửa, báo lần bác thứ hai là chung cuộc, kèm
  nút "Edit your review" tới `/account/bookings/<code>`; hết đường thì nói đã xem hai
  lần. Payload xếp hàng trước lúc deploy không có hai trường này nên mail in như cũ.

**Review findings:** không mở vòng review riêng; test viết trước cho từng tầng.
25 đột biến đều làm test đỏ: bảy ở logic danh sách (Other hết bắt buộc chi tiết,
ghép thiếu dấu cách, không trim, trần chi tiết quên dấu cách nối, tìm một từ là đủ,
tìm chỉ theo tên, chi tiết toàn khoảng trắng coi là có), năm ở câu hệ quả (quên
cộng một khi đếm lần bác, CURATED vẫn hứa sửa, chung cuộc không nhắc Unpublish,
review chờ vẫn hứa gỡ khỏi trang tour, email luôn hứa đường sửa), bảy ở dialog
(bắn khi thiếu chi tiết, gửi bỏ chi tiết, trần ô chi tiết 500, nhãn không đổi với
Other, ô không báo invalid, câu cuối luôn đỏ, nút Reject quay về dialog kit), một
ở contract (trần 499), ba ở mail (payload cũ bị coi là còn sửa, nút về danh sách
booking, payload cũ in câu hết đường) và hai ở service (canEdit luôn true, thiếu
mã booking).
Bố cục jsdom không đo được, nên soi bằng CSS của bản build admin (DOM từ jsdom đổ
ra trang tĩnh): khổ 1400px hai cột, cột lý do 272px, danh sách cuộn trong khung
26rem, mục đang chọn có viền nhấn; lần chung cuộc với review đang hiện thì câu cuối
đỏ kèm lời nhắc Unpublish; khổ 390px còn một cột, danh sách lên trên, không tràn
ngang.

**Không có việc hạ tầng:** không migration, không env, không webhook. Web không đổi:
trang booking đã hiện lý do và form sửa từ ADR-0032.

Tests after: Vitest **4617** (web 1576, admin 1391, api 997, contract 548, core 46,
ui 23, tokens 18, i18n 18), int **679 ở 45 file** (chạy trên DB riêng
`tourism_test_reasons` vì session F18 đang dùng chung `tourism_test`), jest mobile
159 và mobile-ui 86.


## 2026-10-01 — Merge G21 (`7844478c`), deploy API hỏng vì hết kết nối pooler, thử tay 2/2

Nhánh `fix/reports-recognised-to-date` fast-forward thẳng (4 commit, `main` không đi thêm);
CI xanh, Vercel lên admin và web.

**Render deploy hỏng.** Lượt tự deploy của `7844478c` (14:31–14:34 UTC) kết thúc
`update_failed`: instance mới chết lúc pg-boss của worker inline khởi động, log
`EMAXCONNSESSION — max clients reached in session mode, pool_size: 15`. Render chạy instance
cũ và mới song song, mà đúng lúc ấy build web của Vercel cùng lượt push đang prerender gọi dồn
vào API cũ — pool của nó sát trần 15 của Session pooler. Render giữ bản cũ (`aede381d`) chạy
tiếp, nên admin mới đọc báo cáo của API cũ: thiếu `recognizedThrough` thì nhãn kỳ rơi về trọn
tháng như thiết kế, chỉ số vẫn là số cũ — user chụp thấy và báo. Đo lúc yên: 3 kết nối qua
Supavisor. Deploy lại tay qua Render MCP (user duyệt) lúc 15:04:59, live 15:06:18. Ghi G23.
Bài học: dấu `timestamp − uptimeSec` của `/api/health` sau giờ push KHÔNG chứng minh bản mới đã
lên — gói free tự ngủ rồi thức (lần thức 14:35 trông y như một lần deploy); phải đọc trạng thái
deploy của Render.

**Thử tay trên production, 2/2 đạt.** Tháng 10 (đọc 15:07 UTC): "1 Oct 2026 – 1 Oct 2026 (to
date)" ở phụ đề và bốn card, doanh thu ghi nhận $0.00, biên "—", "0 departures ran this
month", câu mới ở "How to read these numbers"; Cash collected $2.00 là một booking thử trả
trong ngày (dưới đây). Tháng 9 y nguyên số đo trên prod trước khi vá: $40,635.80 · giá vốn
theo khách $25,737.54 · theo chuyến $3,952.00 · lãi gộp $10,946.26 (26.9%) · thuế $995.11 ·
phí cổng $1,199.42 · lãi ròng $8,751.73 · 15 chuyến, không có "(to date)".

**Phát hiện lúc thử:** tour `test-01` tạo 01/10 19:07 giờ VN bằng tài khoản admin, ĐANG BÁN,
một chuyến giá $2.00, booking `BK-9CSZWSFD` đã trả rồi huỷ trong hạn, hoàn đủ — không thuộc
lượt thử nào của session này; đã hỏi user. Có booking nên chưa xoá được; ghi vào mục "Trước
lượt seed lại 03/11" của open-items.

## 2026-10-01 — Báo cáo tháng chỉ ghi nhận chuyến đã kết thúc (nhánh `fix/reports-recognised-to-date`, đóng G21)

User thấy `/reports` tháng 10 ghi "Revenue recognised $33,296.00" ngay ngày 01/10 và hỏi có
phải chủ ý. Không phải: ADR-0033 §1 chốt ghi nhận "khi chuyến KẾT THÚC", nhưng cột kết quả
kinh doanh mượn khung tháng "không neo vào bây giờ" của cột dòng tiền, trong khi
`departure_end_date` nằm được ở tương lai. Giới hạn đã biết của ADR không nhắc ca này. Ghi
quyết định trước code ở ADR-0033 AMEND 3 (`8dbcadf4`).

- **API** (`7febc77e`): `recognitionWindow(month, now)` cắt khung tháng ở 00:00 UTC ngày mai;
  chuyến được tính khi ngày kết thúc ≤ hôm nay theo ngày UTC, cùng biên với cổng
  `checkReviewEligibility`. Cả hai vế — doanh thu, giá vốn biến đổi, phí cổng lẫn giá vốn cố
  định và `departuresRun` — đi cùng một cửa sổ. `monthly(month, now)`, `generatedAt` dùng
  chính mốc `now`. Contract thêm `recognizedThrough` (ngày, `null` khi cửa sổ rỗng).
- **Admin** (`ef0f4684`): nhãn kỳ đọc `recognizedThrough` — tháng đang chạy in "1 Oct 2026 –
  15 Oct 2026 (to date)" ở phụ đề, bốn card và dòng Period của file Excel; `?month=` sau tháng
  hiện tại rơi về tháng hiện tại; "How to read these numbers" thêm một câu. `currentMonth` của
  admin vốn theo UTC nên đầu tháng giờ VN không lệch với API.

Tháng đã đóng giữ nguyên số: int test so lời gọi có `now` với đường HTTP. Đột biến tay 14 ca
(cận ngày mai, biên đóng, kẹp tháng tương lai, cửa sổ của từng vế, `generatedAt`,
`recognizedThrough`, schema nullable, nhãn kỳ, chặn tháng tương lai), cả 14 bị giết.

Gate: int, build, typecheck và unit chạy dưới watchdog; watchdog tắt ngang giữa lượt (không
ghi `END`), rồi trình chạy `turbo` crash `setRawMode EPIPE` lúc khôi phục stdin SAU khi
`turbo run test` báo 15/15 tác vụ xanh — lỗi của cửa sổ ẩn, không phải của test. Dừng tay
bash của gate và API cổng 3001, chạy nốt Biome và kiểm token mobile: xanh.

Còn treo: thử tay trên production sau merge — tháng 10 phải về số tới hôm nay (01/10: $0.00,
"0 departures ran this month", nhãn "(to date)"), tháng 9 phải y nguyên: doanh thu ghi nhận
$40,635.80, giá vốn cố định $3,952.00, 15 chuyến đã chạy (đo trên prod trước khi vá).

Tests after: unit 5037 — web 1592, admin 1523 (thêm 6), api 1011 (thêm 6), contract 561
(thêm 1), mobile 159, mobile-ui 86, core 46, ui 23, i18n 18, tokens 18 — và int 707/707
(thêm 5).

## 2026-10-01 — Thử tay F19 trên production (`aede381d`): 12/12 bước đạt

User bấm từng bước, mình kiểm DB và web sau mỗi bước có ghi. Bước 1–8 trên
`vietnam-grand-journey-12d` (12 ngày, đang bán, 26 booking), không lưu gì; bước 9–11 trên
tour nháp `f19-test-tour` tạo rồi xoá; bước 12 ở khổ 320px.

- Thanh bước và phần đầu đúng spec; tooltip icon đầu và cuối không tràn mép; Tab qua icon có
  vòng tiêu điểm.
- Hộp hỏi lại bật ở cả icon bước, Next và Departures; Discard không lưu gì (`updated_at` vẫn
  18/09 03:29).
- Link Day 9 ở cột phải cuộn tới thẻ mà không thêm `#day-9`; Next rồi Back về đúng Itinerary.
- Bốn điểm bố cục của vòng review đều đạt: cột phải ở 1366×768 tự cuộn tới Tips và dòng giá;
  Costs ở 1280 và 1340 không cắt nút, cả khi sidebar thu gọn (bốn ô một hàng) lẫn mở rộng (hai
  cột); thanh bước 320px vừa một hàng; Back sau link Day như trên. Chế độ Responsive của
  DevTools báo màn cảm ứng nên dòng chữ dưới thanh bước hiện ở mọi khổ, đúng `pointer-coarse`.
- Bước Review: tắt bán thì chip thành Off sale ngay, View on site ẩn, vùng xoá bỏ câu "Take it
  off sale instead."; bật lại thì về như cũ. Tour ẩn khỏi web khoảng một phút; sau đó DB
  `is_published = true`, trang tour và `/tours` trả 200.
- Tour nháp: ba bước bắt buộc mang "!", dòng thiếu ghi "Missing — required to go on sale"; gõ
  tóm tắt thì cột phải xanh ngay còn thanh bước giữ "!" tới khi lưu. Công tắc khoá kèm câu lý
  do, Fix mở đúng bước; toast `TOUR_NOT_READY` ở `/tours` có Open tour mở bước Review; trang
  Departures có dòng báo kèm link Open Review & publish. Xoá tour: DB không còn dòng nào của
  `beb40994-…`, vẫn 29 tour, cả 29 đang bán.
- Console chỉ có thứ ngoài app: Tracking Prevention của Edge với ảnh Cloudinary, CSP
  `frame-src 'none'` chặn khung `vercel.live` (trình duyệt đang đăng nhập Vercel), cảnh báo
  Permissions-Policy không đến từ repo.

Cùng buổi, hai việc ngoài F19:

- **Báo cáo tháng 10 có số dù mới 01/10.** Cột kết quả kinh doanh neo `departure_end_date`
  (ADR-0033 §1): 79 booking đã trả từ tháng 6–9 cho 28 chuyến KẾT THÚC trong tháng 10 — tiền
  khách trả $33,779, đã hoàn $483, nên Revenue recognised $33,296.00; dòng tiền tháng 10 bằng 0.
  Từng dòng khớp tới xu, kể cả thuế trên margin 7,976.28 × 10/110 và phí cổng 2.9% × $33,779
  cộng $0.30 × 79. Chưa chuyến nào kết thúc nên với tháng đang chạy đây là số dự kiến — ghi
  G21.
- **Soát dữ liệu thử tay còn sót (user nhờ).** Sạch: các lượt F14, F15, F16, F17, F18 phía DB,
  F19. Còn trong DB, đều là giao dịch Stripe test: booking `BK-7WKW9ESB`, `BK-XKEHLSZL`,
  `BK-PY7IZMD4`, `BK-FLKQBQSS` (đã huỷ, hoàn đủ) cùng refund, payment_events và yêu cầu huỷ của
  chúng; chuyến 22/10 đã huỷ của lượt F13; booking seed `BK-9L93LTWH` bị đổi sang CANCELLED
  ngày 18/09; hai tài khoản khách thử; một review thử bị bác trên `BK-5YU9J339` (24/09); năm
  dòng outbox FAILED (Resend từ chối `@example.com`). User chốt: để lượt seed lại khoảng 03/11
  xoá (`data:reset` xoá đúng các bảng ấy và mọi user trừ một admin). Tài khoản
  `anc***@gmail.com` tạo 30/09 không thuộc lượt thử nào — để yên.
  Cloudinary: tám ảnh của tour thử F18 còn nguyên, bộ dọn tự xoá lúc 04:00 UTC ngày 07/10 (ba
  publicId còn lại chưa từng tải lên, trả 404); năm ảnh của review thử — một ảnh bộ dọn xoá
  02/10, bốn ảnh còn được review trỏ tới nên bị hoãn mãi, user xoá tay thư mục
  `tourism/reviews/BK-5YU9J339`. Kẽ hở khiến bốn ảnh ấy không bao giờ được dọn ghi ở G22.

Không đổi code, không đổi hạ tầng.

## 2026-10-01 — CI main đỏ vì hai ca test lịch phụ thuộc ngày (nhánh `fix/admin-date-range-spec-clock`)

Lượt CI của `aede381d` (merge F19) đỏ ở bước gate: hai ca của
`apps/admin/src/components/bookings/bookings-date-range.spec.tsx` không tìm được nút
"September 10th, 2026"; bước int không chạy vì bước trước đỏ. Không liên quan F19: URL chưa
có khoảng ngày thì lịch của `toolbar-date-range.tsx` (`defaultMonth` rỗng) mở ở tháng hiện
tại, hai tháng một lúc. Hai ca ấy bấm cứng ngày tháng 9 nên xanh suốt tháng 9 và đỏ từ
01/10, khi lịch sang tháng 10–11; `gate:int` ngày 30/09 xanh vì chạy trước lúc sang tháng.
CI đỏ không chặn deploy: Vercel vẫn lên admin và web của `aede381d`.

Vá: hai ca vào một nhóm ghim đồng hồ ở 15/09/2026, chỉ giả `Date` (khuôn
`booking-receipt.spec.tsx` của web) để popover và userEvent vẫn chạy timer thật. Đột biến:
ghim sang 15/10 thì đúng hai ca ấy đỏ lại. Rà các spec khác có bấm ngày trên lịch: chỉ còn
`private-trip-form.spec.tsx` của web, vốn chọn ngày theo hôm nay.

Tests after: admin 1517/1517 ở 134 file, typecheck và Biome xanh trên máy. Chỉ đổi một spec
admin nên không chạy lại `gate:int` ở máy; CI chạy đủ gate và int sau push.

## 2026-10-01 — Merge F19 lên main (`0eac550e`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F19 và bản vá" và "F19 khu sửa
tour dạng thanh bước". Entry này chỉ ghi sự kiện merge.

Nhánh `feat/p4e-3c-tour-workspace-steps` đã rebase lên `8fd51b54` từ 30/09, trước vòng
vá, và `main` không đi thêm từ đó, nên fast-forward thẳng: 14 commit — 11 của đợt thi
công, 3 của vòng review. Gate không chạy lại: đỉnh đem merge chính là đỉnh đã chạy
`gate:int` xanh trong entry vòng review.

Không migration, không đổi env, không đụng API hay web: ngoài `apps/admin` chỉ có
`libs/shared/i18n` (chữ của admin). Không có bước hạ tầng nào.

Cùng commit: spec F19 thôi ghi "chờ user đọc"; hàng P6 ở open-items ghi thư viện AI đã
ghim từ 29/09 (`3f646ace`) thay cho dòng nhắc "trước 15/10" đã cũ.

Việc còn lại: thử tay F19 trên production sau khi Vercel deploy admin, gồm bốn điểm bố
cục mới kiểm bằng test DOM — Costs ở 1280px, cột phải ở 1366×768, thanh bước ở 320px,
Back sau khi bấm link Day ở cột phải.

Tests after: như entry vòng review bên dưới — unit 5024 (admin 1517), int 702/702.

## 2026-09-30 — Vòng review F19 và bản vá (nhánh `feat/p4e-3c-tour-workspace-steps`)

Review max (skill `code-review`) trên nhánh đã rebase lên `main` (`8fd51b54`; đụng
CHANGELOG và open-items, giữ cả hai phía, entry F19 bên dưới mang hash sau rebase): mười
góc soát, 26 ứng viên, kiểm chứng từng ứng viên, một lượt quét sót ra thêm sáu. Loại năm:
công tắc On sale "không đẩy vào provider" (Next 16.3.4 xử lý `router.refresh()` đồng bộ,
điều hướng kế tiếp vẫn nhận dữ liệu mới — chỉ còn chip phần đầu trễ một vòng, vẫn vá), bảo
dòng ảnh bìa và dấu ngày tự suy luật (trùng hẳn `projectedReadiness`), đếm chính sách
CANCELLATION (không đường nào tạo được), `activeTourStep` gọi hai lần, và phần "hồi quy" của
vùng thả ảnh (vùng mới rộng hơn F18). Báo 15, vá cả 15 cùng phần dọn dẹp rẻ trong
`604aae0b`; docs `5b1b223f` (ADR-0049 AMEND 1, spec F19 đính chính).

Bốn mục nặng nhất:

- **Link nhảy ở cột phải làm hỏng Back.** `<a href="#day-N">` (và `#faq`, `#policies`) tạo
  mục lịch sử `state` null mà Next 16 bỏ qua popstate (`app-router.js`): bấm Day 5, Next,
  rồi Back thì URL đổi mà form vẫn ở bước sau; sửa gì rồi bấm icon bước thì hộp hỏi lại bị
  lách (so pathname với URL hiện tại) và bản sửa mất. `AsideJumpLink` nay cuộn tới đích và
  dời tiêu điểm, không đổi hash.
- **Hàng dòng chi phí bị cắt nút ở 1280–1348px** (màn 1920×1080 đặt 150%): lưới bốn cột
  theo cửa sổ nằm trong cột form hẹp và Card `overflow-hidden`. Nay theo `@container`.
- **Cột phải dính cao hơn cửa sổ giấu phần dưới** (1366×768 mất Tips và dòng giá của thẻ
  xem trước; tour 30 ngày mất các ngày sau). Tiền đề spec §4.6 sai; nay trần `100svh` và tự
  cuộn bên trong.
- **Bước Review vứt lượt đọc mới**, dựng từ bản cũ của layout: hộp xoá có thể đếm "0
  departures" khi người khác vừa thêm chuyến (xoá cascade). Nay dùng bản trang, đẩy lên
  `TourDetailProvider`; ngoài provider vẫn dựng được.

Còn lại: toast `TOUR_NOT_READY` ở `/tours` mở bước Review (`reviewHref`); dòng báo
Departures chỉ tới bước Review kèm link; "Off sale" thay "Not on sale" (user chốt, cùng chữ
bộ lọc `/tours`); "this step" thay "this tab" ở banner lệch phiên bản và hộp hỏi lại; dòng
thiếu ghi "Missing — required to go on sale"; checklist Photos có mô tả riêng và chỉ hiện
dòng alt khi có ảnh; "Take it off sale instead." chỉ khi tour còn bán (`DeleteTourZone` tự
lo tour đã có booking); năm card có lại tên nhóm, Totals là heading; link Fix mang tên
bước; máy cảm ứng có dòng chữ bước đang mở; thanh bước nhỏ lại dưới `sm` để không tràn ở
320px; giá thẻ xem trước làm tròn đô như card web. Dọn dẹp: `ISSUE_STEP` khoá theo mục
readiness, `nextTourStep` và thứ tự `tourSteps` lấy từ `TOUR_EDITOR_STEPS`,
`OptionalStepCard`/`NoteCard` dùng chung, bỏ prop `lead`, `aside` bắt buộc, `ButtonLink` và
`data-icon`, số câu hỏi và chính sách một bản, comment cũ về khung readiness và thanh tab.
Ghi open-items, không vá: G18 thứ tự tab ở bước Review, G19 `tourPageUrl` cứng origin prod,
G20 tương phản icon cảnh báo. Đột biến tay: 22 ca trên các chỗ vá, cả 22 bị giết.

Thử tay trên production sau merge cần soi thêm bố cục: Costs ở 1280px, cột phải ở 1366×768,
thanh bước ở 320px, và Back sau khi bấm link Day ở cột phải.

Tests after (`gate:int` trên đỉnh đã rebase, hết 677 giây): unit 5024 — web 1592, admin
1517 (thêm 20), api 1005, contract 560, mobile 159, mobile-ui 86, core 46, ui 23, i18n 18,
tokens 18 — và int 702/702 trên DB riêng.

## 2026-09-29 — F19 khu sửa tour dạng thanh bước (nhánh `feat/p4e-3c-tour-workspace-steps`)

Khu sửa tour `/tours/[slug]` bỏ hàng tab chữ: thanh bước chỉ có icon (tên bước và
trạng thái trong tooltip), mỗi bước là form bên trái và cột phải dính khi cuộn bên phải,
bước cuối Review & publish gom danh sách kiểm tra, công tắc On sale và vùng xoá tour.
Quyết định ở ADR-0049; mockup user duyệt (v7) ở `C:\Programming\Devs\Assets\mockups\2026-09-28-tour-workspace-steps\`.
Không đổi API, contract, DB, web, mobile; luật ghi giữ nguyên.

- **Bước là dữ liệu** (`e12e874b`). `tourSteps(detail)` suy trạng thái sáu bước từ
  readiness ĐÃ LƯU; thanh bước và bước Review cùng đọc nó nên không thể nói khác nhau.
  Bộ tên `TourEditorStep`, `TOUR_EDITOR_STEPS`, `tourStepHref`, `activeTourStep` (trả
  `null` ở Departures).
- **Khung hai cột** (`522957d3`). `EditorFormFrame` nhận `lead`, `aside`, `next`;
  `StepColumns` dựng lưới `minmax(0,1fr) 20rem` từ `xl`, cột phải `sticky`. Khối dùng
  chung ở `step-aside.tsx`: `StateMark`, `StepChecklist`, `StepTips`, `CoverPreviewCard`.
- **Bước Review & publish** (`7e964032`). Route mới `/tours/[slug]/review`: năm hàng
  kiểm tra (nút Fix mở chỗ thiếu đầu tiên), công tắc On sale khoá chiều bật kèm lý do,
  vùng xoá tour chỉ khi chưa từng có booking.
- **Thanh bước và phần đầu** (`5cc8851e`). Sáu icon có tooltip và chữ `sr-only`; phần
  đầu chỉ còn trạng thái: chip On sale / Not on sale, lần lưu cuối, View on site (chỉ khi
  đang bán), Departures (`aria-current="page"` ở trang của nó). Xoá `TourTabs`,
  `TourReadinessPanel` cùng spec; `SITE_URL` gom về `lib/site.ts` ở cả bốn chỗ; câu
  `publish.workspace.notReady` nói "the checklist".
- **Năm bước xếp lại** — Details (`519fe270`): ba card, việc cần làm tính trên giá trị
  đang gõ, thẻ xem trước card /tours, lưới 2×2 cho Good for và Badges. Photos
  (`4d767d63`): ô tải lên nét đứt trong vùng thả file bọc cả card, ảnh bìa bên phải.
  Itinerary (`4ba94a82`): thẻ ngày là Card `role="group"`, danh mục Days bên phải.
  FAQ & policies (`97ac53fa`): hai card `#faq`, `#policies`, chính sách huỷ chỉ in một
  lần ở cột phải. Costs (`bcbc947d`): Totals dời sang cột phải, giữ `role="region"` và
  `aria-live`. Mỗi bước có link "Next: …" cạnh Save.

Chỗ lệch plan, kèm lý do:

- Task 1 đổi `tabsLabel` thành "Tour steps" làm `tour-tabs.spec.tsx` (gõ cứng "Tour
  sections") đỏ giữa chừng; sửa chữ trong spec ấy, file bị xoá ở Task 4.
- Đoạn test thanh bước của plan dùng `forEach` trả giá trị; Biome
  (`useIterableCallbackReturn`) chặn, nên bọc thân hàm bằng ngoặc nhọn.
- Lệnh grep ở Task 4 B9 vẫn khớp `detail.readiness.ready`: đó là field của contract,
  không phải key i18n đã gỡ.
- Task 6 và Task 8 mỗi task có một đột biến sống sót (dòng ảnh bìa luôn xanh; đếm
  policies theo bản đã lưu). Thêm một ca "danh sách ảnh rỗng" và một bước "thêm policy"
  vào ca đếm; cả hai đột biến bị giết sau đó.
- Task 10: `AdminShell` nay là server component async (đọc cookie sidebar, 28/09), nên
  spec tạm của plan dựng ra trang rỗng. Spec tạm gọi `await AdminShell(...)` với
  `next/headers` giả. Máy chủ tĩnh là một script Node tạm thay cho `python -m http.server`
  — đổi vì tưởng nhầm `python` bị treo (thật ra do một lệnh Git Bash viết hỏng; Python
  3.14.7 chạy bình thường), hai cách tương đương cho phép đo.

Soi bố cục bằng CSS build thật (Task 10), sáu trang: ở 1600px hai cột, `topDelta` 0
(card đầu cột phải ngang card đầu form), `stepperOverflow` 0, không tràn ngang; trang
Itinerary cuộn hết (775px) thì cột phải dính ở `top` 16px. Ở 390px một cột, cột phải
nằm dưới form, thanh bước không tràn, không tràn ngang. Không có lỗi bố cục phải sửa.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **4743** (web 1576, api 1005, admin 1497, contract 560, core 46, ui 23,
tokens 18, i18n 18) và jest mobile 159, mobile-ui 86; int **702 ở 45 file**. Admin từ 1441
lên 1497 (đã trừ các ca của `TourTabs` và `TourReadinessPanel` bị xoá). 68 đột biến ở
chín task, cả 68 bị giết.

## 2026-09-29 — P6: ADR-0050 và spec trợ lý AI, ghim AI SDK trước freeze (nhánh `chore/p6-pin-ai-sdk`)

P6 chỉ lên ý tưởng lúc này (user dặn 29/09: admin xong trước mới thi công). Thiết kế
chốt qua brainstorm từng câu một, ba phần đều được duyệt:

- `8ecdef7c` (đã lên `main` trước nhánh): ADR-0050, spec
  `docs/specs/2026-09-29-p6-ai-concierge-design.md`, ADR-0001 AMEND 2 (AI SDK 7 thay 6),
  bản đồ docs, dòng P6 của open-items. Chat là module của API NestJS, lịch sử giữ ở
  server, `submitEnquiry` phải được khách bấm duyệt, trần chi phí bốn lớp, lưu hội thoại
  30 ngày, nút nổi trên web.
- `25952903`: ADR-0050 §7 và spec §7 ghi đúng bản ghim; web cần khai cả gói `ai` (cho
  `DefaultChatTransport`), không chỉ `@ai-sdk/react`.
- `3f646ace`: ghim `ai` 7.0.118 và `@ai-sdk/anthropic` 4.0.65 vào `apps/api`; `ai`
  7.0.118 và `@ai-sdk/react` 4.0.121 vào `apps/web`. Bản mới nhất ngày 29/09 (7.0.122,
  4.0.68, 4.0.125) chưa đủ một ngày nên cổng `minimumReleaseAge` của pnpm lấy bản liền
  trước; `@ai-sdk/react` 4.0.121 là bản kéo đúng `ai` 7.0.118, nên cả repo có một bản
  `ai`, một bộ `@ai-sdk/provider`, peer zod dùng 4.4.3 sẵn có. Lockfile trỏ cây jest và
  React Navigation của mobile sang bản trùng đã có sẵn trên `main` (`@types/node`
  26.6.2, `nanoid` 3.3.19, `react-is` 19.3.0), không thêm gói lạ. `pnpm audit --prod`:
  không advisory nào ở gói mới. Chưa có code nào import ba gói này.

**Review findings:** user duyệt spec; nhánh chỉ đổi dependency, chưa có vòng review
riêng.

Tests after (`gate:int` trên đỉnh nhánh, hết 667 giây): unit 4862 — web 1592, admin
1441, api 1005, contract 560, mobile 159, core 46, ui 23, i18n 18, tokens 18 — và int
702/702 trên DB riêng.

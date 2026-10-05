# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

> **File này chỉ giữ đợt đang chạy** (từ 15/09/2026). Toàn bộ lịch sử trước đó
> nằm ở [`changelog/`](changelog/) — 12 file theo kỷ nguyên, có
> [mục lục kể lại từng giai đoạn](changelog/README.md).
> Entry đã ghi là BẤT BIẾN (cùng luật `migration.sql`) — archive là di chuyển
> nguyên văn, không sửa một ký tự.

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

## 2026-09-29 — Web lấy đủ mọi trang tour, không dừng ở 50 (nhánh `fix/web-tours-all-pages`, đóng G10)

`fetchTours` từng chỉ đọc trang 1 `limit: 50` của `catalog.tours.list` (contract cho tối
đa 50), nên từ tour thứ 51 thì tour cũ nhất biến khỏi listing, sitemap, prerender và số
đếm ở trang chủ. F17 cho admin tạo tour nên ngưỡng này chạm được; hiện có 29 tour.

`38a3b25d`: hàm thuần `collectAllPages` (`apps/web/src/lib/api/collect-pages.ts`) đọc
trang 1 rồi lần lượt tới `totalPages`. Gọi tuần tự để không dồn loạt request vào instance
free của Render; bỏ tour trùng giữa hai trang (tour mới tạo giữa hai lượt gọi đẩy mọi tour
lùi một bậc); ném lỗi thay vì trả danh sách thiếu. Trần 20 trang (1000 tour), chạm trần
thì `console.warn`. Không đổi contract hay API; với 29 tour vẫn là một lượt gọi.

G9 (bust `post:<slug>` khi sửa hay xoá tour) chuyển vào phạm vi P4e-4 thay vì vá bây giờ:
hôm nay chưa có triệu chứng — web chưa hiện tour gắn trong bài viết, không seed hay màn nào
tạo `PostTour`, menu Posts của admin còn tắt.

**Review findings:** user duyệt thiết kế trong chat. Năm đột biến tay (bỏ trần, hụt trang
cuối, không bỏ trùng, báo `totalPages` đã cắt, nuốt lỗi trang sau) đều bị test bắt.

Tests after: xem entry dưới — hai nhánh chạy chung một lượt `gate:int`.

## 2026-09-29 — Lúc build thử lại lâu hơn khi Render dựng lại API (nhánh `fix/web-build-retry`, ADR-0044 AMEND 1)

Bản deploy web của `962d6090` (lượt push merge F18) ERROR dù đã có lớp thử lại: prerender
`/tours/phu-quoc-honeymoon-4d` nhận `ECONNRESET` cả ba lượt của lịch 400ms/1200ms, trong
lúc Render dựng lại API cho chính lượt push ấy. Build Filter `docs/**` (bật 21/09) không
chặn ca này, vì lượt push có sửa `apps/api`.

- `c3a3d5aa`: ADR-0044 AMEND 1 — ràng buộc 4 tách thành hai lịch chờ; bản đồ ADR ghi
  "1 AMEND".
- `a8b5aeb3`: `retryDelaysFor(process.env.NEXT_PHASE)` — lúc `next build` sáu lượt, chờ
  1s, 2s, 4s, 8s, 15s; lúc chạy giữ lịch ngắn. Mỗi lần sắp thử lại ghi một dòng
  `[retry-fetch] GET <đường dẫn> — lượt n/N lỗi … (ECONNRESET), thử lại sau …ms`, không
  kèm query, để log build cho biết lớp này đã cứu lượt nào.

Chỗ nối trong `client.ts` được kiểm bằng một test tạm (không commit) chạy qua client oRPC
thật: có `NEXT_PHASE` của build thì 6 lượt kèm 5 dòng cảnh báo, không có thì 3 lượt. Next
16.3.4 gán `NEXT_PHASE` trước khi tạo worker prerender, và worker nhận env của tiến trình
cha (đọc mã `next/dist`).

**Review findings:** user duyệt thiết kế trong chat. Bảy đột biến tay (đảo điều kiện pha,
gõ sai tên pha, lịch build thiếu lượt, không ghi log khi status tạm thời, bỏ mã nguyên
nhân, đếm sai tổng lượt, log kèm query) đều bị test bắt; ca tên pha so với hằng của
`next/constants`. Tự sửa trước khi push: bản AMEND đầu viết lượt push ấy chỉ sửa `docs/`
và Build Filter chưa bật — sai cả hai.

Tests after (một lượt `gate:int` trên trạng thái gộp hai nhánh; cây trùng `main` trừ file
ADR): unit 4862 — web 1592 (thêm 16), admin 1441, api 1005, contract 560, mobile 159, core
46, ui 23, i18n 18, tokens 18 — và int 702/702 trên DB riêng, hết 700 giây.

## 2026-09-29 — Bật bộ dọn ảnh mồ côi trên production; đính chính entry thử tay F18

**Đính chính.** Entry "Thử tay F18 trên production" bên dưới ghi mười một publicId của
tour thử "sẽ tự dọn sau bảy ngày". Sai ngay lúc viết: `MEDIA_GC_ENABLED` mặc định
`false` (ADR-0035 §6) và Render chưa từng đặt biến này, nên bộ dọn chưa chạy ở production.
Trên Cloudinary lúc ấy còn tám file của tour thử; ba lượt còn lại bị chặn ở bước 4 nên
không tạo file.

**Bật bộ dọn (user, 29/09).** Render thêm `MEDIA_GC_ENABLED=true` và
`MEDIA_GC_GRACE_DAYS=7`; lượt deploy lúc 11:15 UTC đăng ký lịch `media-gc` `0 4 * * *`
(đọc bảng `pgboss.schedule`). Trước khi bật đã chạy thử bằng SQL chỉ đọc: hàng có 17 dòng
(1 avatar, 5 ảnh review, 11 ảnh tour thử), và lượt đầu không xoá gì — ảnh còn dùng thì
hoãn, ảnh mồ côi chưa đủ bảy ngày. Ảnh review mồ côi tới hạn khoảng 01/10; tám file của
tour thử khoảng 07/10, trừ khi user xoá tay trên Cloudinary trước.

**Thuế và phí cổng (user, 29/09).** Render nhập `MARGIN_TAX_RATE=0.1`,
`PAYMENT_FEE_RATE=0.029`, `PAYMENT_FEE_FIXED=0.30`. Ba biến chỉ dùng ở báo cáo `/reports`
và file Excel (ADR-0033 §5–§6), không đổi số tiền khách trả.

**`apps/api/.env.production` (không commit) khớp lại Render**, vì từ nay nó là bản gốc để
import env lên Render. Ba chỗ lệch đã sửa: tên biến thuế từng gõ sai `MARGIN_TAX_RRATE`
(API bỏ qua biến lạ nên thuế âm thầm về 0), phí cổng đang 0, bộ dọn đang `false`. Hai
biến file có mà Render chưa đặt đều vô hại khi import: `ENQUIRY_RETENTION_MONTHS=18` trùng
mặc định; `CORS_ORIGINS` (www và admin) chặt hơn giá trị rơi về `TRUSTED_ORIGINS`, đúng
thiết kế của ADR-0026 AMEND 1, và tên miền gốc vốn chuyển hướng 308 sang www.

Tests after: không đổi — lượt này không đổi file nguồn.

## 2026-09-29 — Góp ý thử tay F18, dọn G13 và một phần G14 trước F19 (nhánh `fix/f18-thu-tay-gop-y`)

F19 chưa thi công, nên user cho vá luôn các mục còn treo của vùng tab Photos. Chỉ chọn
những mục không làm lệch plan F19: plan gọi `tourPhotoThumb` từ `tour-editor-view` và giữ
nguyên chỗ dùng `ListEditor`.

- **Góp ý #1: chữ "Added" bị cắt mất** (`7ab29b66`). Hộp thư viện nối "alt · Added" rồi
  cắt còn hai dòng; alt ảnh thư viện thật dài cả câu nên "Added" luôn rơi vào phần bị
  cắt. Nay "Added" là huy hiệu trên góc ảnh, cùng kiểu nhãn Cover; chú thích chỉ mang
  alt. Ca test mới dùng alt dài như dữ liệu thật.
- **Câu dải TOUR_NOT_READY** (`e4a4ae05`, đóng G13). "This change would leave it
  missing:" đổ lỗi cho lần sửa cả khi chỗ thiếu có từ trước. Nay "Saved like this, it
  would be missing:" — tả trạng thái của bản sẽ lưu. JSDoc giữ nguyên, vì bước B9 của
  F19 sửa đúng dòng ấy.
- **G14, ba mục** (`64d5ccae`, `a761d4f4`, `5890c602`):
  - `toDetail` dùng `pickCover` thay vì tự so `role === 'hero'`; `hasTourCover` bỏ
    export thừa, sửa JSDoc nói sai "`get` gọi nó".
  - Helper URL Cloudinary của admin gom về `lib/cloudinary-url.ts`
    (`withDeliveryTransform`, `cloudinaryImageUrl`). `reviewPhotoThumb`,
    `reviewPhotoLarge`, `tourPhotoThumb` dùng chung; `tourPhotoThumb` ở nguyên
    `tour-editor-view` vì plan F19 import từ đó.
  - Thanh tiến độ tải ảnh dùng `Progress` của `@tourism/ui`, vẫn mang `id` và
    `tabIndex={-1}` để giữ tiêu điểm của Retry.
- **Cố ý để sau F19** (open-items G14): `ListEditor` nhận `add` và `emptyFocus` bằng một
  union, copy đọc từ hằng, gom fixture test — F19 sửa đúng các file ấy.
- **Plan F19** (`1e4d88db`) có mục "Cập nhật 29/09 — code thật đã khác plan ở đâu";
  prompt cuối plan trỏ tới mục đó.

Lưu ý của entry fast-uri đã làm: chạy tay workflow `Audit` (run `36552822991`) — xanh;
hai alert Dependabot mới của fast-uri (#65, #66) tự đóng lúc push, không còn alert nào
mở.

**Đột biến:** năm cái, chết cả năm — nối "Added" lại vào chú thích; `get` luôn coi là
có bìa; bỏ transform khỏi URL Cloudinary; bỏ `id` và bỏ `tabIndex` của `Progress`.

**Review findings:** không mở vòng review riêng — các mục đều đến từ vòng review và lượt
thử tay F18.

Tests after: Vitest **4687** (web 1576, admin 1441, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86. Ca
mới ở admin: một ca "Added" với alt dài, ba ca của `cloudinary-url` (một ca dời từ
`tour-editor-view`).

## 2026-09-29 — Thử tay F18 trên production (`47b8dc64`): 11/11 bước đạt, một góp ý

User thử từng bước trên admin production; sau mỗi bước session gốc kiểm DB bằng SQL
chỉ đọc. Tour thử `f18-photo-test` tạo mới ở bước đầu và xoá ở bước cuối. Từ bước 2
trở đi chạy trong cửa sổ InPrivate, để extension không lẫn vào Console.

1. Tạo tour thử, điền đủ readiness trừ ảnh bìa. DB: tắt bán, 0 ảnh.
2. Tải hai ảnh (một bằng nút, một kéo thả), điền alt, lưu. DB: hai dòng trong thư mục
   tải lên của tour, ảnh đầu là `hero`; hàng dọn có đúng hai publicId đã ký. Console
   không có vi phạm CSP nào cho Cloudinary — lớp nghiệm thu thứ hai của ADR-0038
   AMEND 5 đạt.
3. Rời tab lúc đang tải (mạng giả Slow 4G): hộp "Discard unsaved changes?" hiện khi
   form còn sạch, tức phát hiện #8 của vòng review đã vá đúng. F5 thì trình duyệt
   hỏi lại.
4. Tải hỏng bằng cách chặn `https://api.cloudinary.com/*` trong DevTools (Request
   conditions): Retry bằng bàn phím giữ tiêu điểm trên dòng — hỏng lại thì về nút
   Retry, xong thì vào ô alt của ảnh mới; Remove dòng hỏng cuối thì về Upload photos.
5. Thêm ba ảnh thư viện Hội An: alt chép từ ảnh gốc, ghi công chép đủ (tác giả, giấy
   phép, source URL); mở lại hộp thì ba ảnh ấy bị khoá.
6. Alt trống chặn lưu, câu báo nằm dưới đúng ô; lưu 7 ảnh đúng thứ tự trên màn hình.
7. Bật bán: trang web hiện đúng ảnh bìa và 7 ảnh; sau mỗi lần lưu web theo kịp.
8. Gỡ ảnh rồi lưu: ảnh tải lên vào lại hàng dọn với đồng hồ mới (đúng lúc lưu), ảnh
   thư viện không vào hàng.
9. Tour đang bán gỡ hết ảnh: câu "A tour on sale needs a cover photo…", DB không đổi.
10. Tour có sẵn: ảnh bìa gốc ghi "Catalogue photo · … · Can’t be added back once
    removed.", ảnh mượn từ kho địa danh ghi "From the library".
11. Tắt bán rồi xoá tour thử: web trả 404; DB không còn tour, dòng ảnh, liên kết điểm
    đến, lịch trình; ảnh tải lên cuối vào hàng dọn; ba dòng thư viện Hội An còn
    nguyên. Mười một publicId của tour thử trong hàng dọn sẽ tự dọn sau bảy ngày.

**Hai dòng CSP không phải lỗi của site.** `frame-src` chặn `vercel.live`: thanh công cụ
Vercel khi người thử đang đăng nhập Vercel, ADR-0038 đã ghi. `eval` bị chặn: do một
extension ở cửa sổ thường — InPrivate không có, và Issues không ghi vị trí nguồn.

**Góp ý #1:** chữ "Added" trong hộp thư viện bị cắt mất. Nhãn nối "alt · Added" rồi
cắt còn hai dòng (`line-clamp-2`), mà alt ảnh thư viện thật dài cả câu — unit test dùng
alt ngắn nên không thấy. Vá ở nhánh `fix/f18-thu-tay-gop-y`.

**Lúc merge F18:** bản deploy web của `962d6090` ERROR — Render deploy lại API đúng
lúc Vercel prerender, lượt gọi API bị `ECONNRESET` (nguyên nhân 1 của ADR-0044). Site
không sập vì Vercel giữ bản READY cũ, và F18 không đổi gì phía web; lượt `47b8dc64`
READY.

Tests after: không đổi — lượt này không đổi file nguồn.

## 2026-09-29 — Vá fast-uri trên đường request của API, kèm undici và ip-address (nhánh `fix/fast-uri-advisory`)

Workflow "Dependabot Updates" hỏng hai lượt lúc 23:53 UTC ngày 28/09 với
`security_update_not_possible` cho `fast-uri`: nó báo `latest-resolvable-version`
3.1.7 và `lowest-non-vulnerable-version` 3.1.8 rồi dừng — đúng giới hạn đã ghi ở
`audit.yml`, Dependabot không mở được PR cho lock pnpm có override. Workflow `Audit`
xanh lượt 28/09 02:00 UTC, nhưng lượt 05/10 sẽ đỏ: năm advisory vào DB chung của
GitHub tối 28/09 (20:43–21:42 UTC).

- **fast-uri 4.1.3 lên 4.2.1, bản này đang chạy ở production.** Hai advisory high:
  GHSA-qw65-cvwx-89v3 (authority injection qua port không được kiểm trong
  `serialize`, dính `<4.1.4`) và GHSA-58mr-gqgx-xq4g (host confusion qua ngoặc
  vuông không đóng, dính ĐÚNG 4.1.3). Đường kéo: `@tourism/api` → fastify 5.12.1 →
  fast-json-stringify → fast-uri ^4. Bản vá 4.1.4 có từ 02/09 11:07 UTC; đợt vá
  03/09 dừng ở 4.1.3 chỉ vì commit `7e9fad87` lúc 02:58 UTC, khi 4.1.4 mới khoảng
  16 giờ tuổi — dưới cửa sổ `minimumReleaseAge` mặc định một ngày của pnpm 11 (đọc
  mã 11.9.0: `minimum-release-age: 24 * 60`). Override nay là
  `>=4.0.0 <4.1.5: ^4.1.5`, pnpm chọn bản cao nhất 4.2.1 (18/09). Release notes của
  4.2.0 và 4.2.1 chỉ sửa IPv6 zone id và chuẩn hoá `mailto`.
- **fast-uri 3.1.7 lên 3.1.8, vá trước khi audit kịp thấy.** 3.1.7 đã ngoài dải hai
  advisory 28/09, nhưng fastify công bố ở repo từ 15/09 GHSA-hrr3-gc8f-f4qj (medium,
  `>=3.0.0 <3.1.8`) mà DB chung chưa có (API trả 404 ngày 29/09), nên audit lẫn
  Dependabot còn mù. Độ trễ ấy không nhỏ: hai advisory 28/09 có bản vá từ 02/09,
  tức 26 ngày. Dòng 3.x cũng chạy ở production (fastify → `@fastify/ajv-compiler` →
  ajv). Cùng lý do, selector dòng 4.x lấy tới `<4.1.5` để trùm GHSA-hrr3 và
  GHSA-jvvf-x445-j334 (header injection ở `mailto`, `>=4.1.3 <4.1.5`), cũng mới chỉ
  có ở repo.
- **ip-address 10.4.0 lên 10.7.2** (GHSA-rpw4-54j3-4h4q, GHSA-2vr4-cq9g-pvrc,
  moderate; cộng hai advisory repo 15/09 dính `<=10.7.0`). Ba dòng override của đợt
  03/08 GỘP thành một `ip-address@<=10.7.0: ^10.7.1`: pnpm 11 áp override khi
  selector giao với spec của gói cha, và nhiều selector cùng khớp thì nó chỉ lấy MỘT
  (`pickMostSpecificVersionOverride`). Để dòng cũ lại thì spec có thể vẫn là
  `^10.2.2`, 10.4.0 thoả nên lock không nhúc nhích. Đường kéo dev-tooling: shadcn →
  `@modelcontextprotocol/sdk` → express-rate-limit.
- **undici 7.29.0 gộp về 7.29.1 vốn đã có trong lock** (GHSA-3wwx-pv8p-q78v,
  moderate; repo undici còn chín advisory 04/09 cho dòng 7.x, đều vá ở 7.29.1).
  Đường kéo dev-tooling: shadcn CLI và `@dotenvx/dotenvx`.
- `minimumReleaseAgeExclude` không đổi: mọi bản vá đã đủ tuổi, trẻ nhất là 4.2.1 với
  11 ngày. Lock chỉ đổi ba gói, không gói nào nhảy major. Lệnh
  `pnpm audit --audit-level=moderate` về 0, chỉ còn GHSA-vcc3-ghjq-m6fr đã ignore có
  chủ đích từ 21/09. Cảnh báo peer của `pnpm install` giống hệt main (Expo và React
  Native).

**Bài học:** DB advisory chung của GitHub, nơi `pnpm audit` và Dependabot đọc, trễ so
với advisory ở repo của chính gói — lượt này 26 ngày. Khi vá một gói, đọc thêm
`gh api repos/<owner>/<repo>/security-advisories` và release notes của bản vá mới
nhất, đừng dừng ở dải audit báo.

**Review findings:** chưa có vòng review riêng.

Không migration, không đổi env. Đẩy lên `main` thì Render tự deploy API với fast-uri
mới — đó là toàn bộ phần "hạ tầng" của lượt này. Việc còn lại: sau khi đẩy, chạy tay
workflow `Audit` (có `workflow_dispatch`) để thấy xanh ngay thay vì đợi 05/10, và
xem các alert Dependabot của ba gói có tự đóng không.

Tests after: không đổi so với entry G12/G13 ngay dưới, vì lượt này không đổi file
nguồn nào. Vitest **4684** (web 1576, admin 1438, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86.
`gate:int` chạy hai lượt, tách bước có hãm song song và watchdog: lượt đầu trên gốc
`962d6090` (671 giây), lượt hai sau khi rebase lên `47b8dc64` (624 giây), vì code
G12/G13 chưa từng chạy chung với lock mới. Int chạy trên DB riêng
`tourism_test_fasturi` và API cho build web ở cổng 3101, vì một session khác chạy gate
ở checkout gốc cùng lúc. Mỗi gói có dependency hoặc mã đổi (api, admin, web, ui) đều
chạy thật các task của nó ở ít nhất một lượt; các gói còn lại replay cache.

## 2026-09-29 — Vá G12 và phần thư viện của G13 sau F18 (nhánh `fix/tour-photo-int32-image-filter`)

Hai mục nhỏ mà vòng review F18 ghi vào open-items. User chọn vá ngay sau merge F18.
Nhánh chỉ đụng contract và API, không đụng file nào plan F19 sẽ sửa.

- **G12: metadata ảnh tải lên vượt INT4 ra 500** (`a5d39f1a`). `TourPhotoUploadSchema`
  dùng `z.int()` (tới 2^53) cho `width`, `height`, `bytes`, trong khi ba cột là INT4.
  Một request tự chế vượt 2^31 lọt schema rồi chết ở DB (P2020, ra 500; transaction
  rollback trọn nên không hỏng dữ liệu). Nay dùng `z.int32()`, request như vậy là 400
  `BAD_REQUEST`.
- **G13: thư viện nhận cả video** (`a5d39f1a`, ADR-0048 AMEND 2). Ba chỗ đọc thư viện
  (hộp Add from library, bước tra thư viện của `setPhotos`, nhãn nguồn của `get`) nhận
  mọi dòng `DESTINATION`, kể cả `VIDEO`. Nay cả ba dùng chung một định nghĩa
  `LIBRARY_PHOTO`: dòng `DESTINATION` loại `IMAGE`. Prod đo 29/09 (chỉ đọc): chưa có video
  nào của địa danh, nên đây là chặn trước. Phần còn lại của G13 vẫn ở open-items: ảnh
  của chính tour chưa lọc theo loại, và câu `banners.notReady` để sau F19.

Cùng lượt đẩy: CLAUDE.md ghi quyết định ở lại NestJS 11 tới hết capstone (`df1bec2e`,
user chốt 29/09).

Test mới: 1 ca contract (N và N+1 cho cả ba cột) và 4 ca int:
- thư viện bỏ video;
- `setPhotos` từ chối publicId chỉ có video;
- nhãn nguồn là `CATALOG` khi publicId chỉ trùng một video;
- metadata vượt INT4 ra 400.

Ba ca đỏ trước khi vá. Ca nhãn nguồn viết sau, nên kiểm bằng đột biến. Cả 7 đột biến
đều chết.

**Review findings:** không mở vòng review riêng — hai mục này đã được vòng review F18
kiểm chứng.

Tests after: Vitest **4684** (web 1576, admin 1438, api 1005, contract 560, core 46,
ui 23, tokens 18, i18n 18), int **702 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-29 — Merge F18 lên main (`a354c74b`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F18" và "F18 ảnh tour".
Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge nên chưa mang
hash.

Nhánh `feat/p4e-3b-tour-photos` rebase lên `fc397c32` rồi fast-forward: 29 commit —
14 của đợt thi công, 15 của vòng review. Từ lúc tách nhánh, `main` đã nhận nhánh
sidebar admin (bốn commit, 28/09) và hai commit tài liệu F19 chưa push. Một xung đột ở
CHANGELOG: entry sidebar và entry F18 cùng chen vào đầu file; gỡ bằng cách đặt entry
F18 lên trên, cả hai giữ nguyên văn.

Gate chạy lại trên đỉnh mới, vì code sidebar chưa từng chạy chung với F18. Lượt đầu
đỏ một ca của hộp thư viện: ca ấy tìm option của ô chọn địa danh ĐỒNG BỘ ngay sau khi
mở, trong khi popup của Select mở bất đồng bộ. Chạy riêng thì xanh 5/5, và mọi spec
khác trong repo đều chờ bằng `findByRole`. Vá ở `a354c74b`; lượt hai xanh đủ năm bước.

Cùng lượt đẩy có ADR-0049, spec và plan F19 (khu sửa tour dạng thanh bước), chỉ là
tài liệu. Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay F18 trên production theo spec §5 sau khi Vercel và Render
deploy xong (mục CÒN TREO của entry vòng review); đưa prompt thi công F19 cho một
session khác.

Tests after: Vitest **4683** (web 1576, admin 1438, api 1005, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-29 — Vòng review F18: 15 phát hiện, vá cả 15 (nhánh `feat/p4e-3b-tour-photos`)

Review chạy TRƯỚC merge, ở mức cao nhất: nhiều góc tìm độc lập, bảy nhóm agent kiểm
chứng từng ứng viên, rồi một lượt quét sót. Kết quả: 15 phát hiện đáng vá (1 Cao,
8 Vừa, 6 Thấp), vá cả 15 trên nhánh; ba ứng viên bị bác; các mục nhỏ còn lại (dọn
code, hiệu năng, nợ) ghi sang open-items G12–G17, vì user chưa chốt có làm trong nhánh
này không. Dữ liệu prod đo bằng SQL chỉ đọc (29/09): 29/29 tour đang bán có ảnh bìa,
nên điều kiện bán mới của F18 không làm tụt tour nào.

**Mức Cao.**

1. **Khe deploy làm mất sạch ảnh thật** (`1d0a2343`). Admin (Vercel) lên trước API
   (Render) thì `fetchAdminTour` lùi `photos` về `[]` mà vẫn giữ `version`; `setPhotos`
   thay trọn danh sách, nên thêm ảnh rồi lưu sau khi API lên là xoá hết ảnh cũ, kể cả
   ảnh bìa gốc không chọn lại được. Object lùi nay mang dấu "chưa biết ảnh"
   (`hasKnownPhotos`), tab Photos hiện câu mời tải lại thay cho form. Bốn lệnh ghi của
   F17 và `setPhotos` đi qua cùng lớp lùi, nên khung readiness hết báo sai "A cover
   photo" giữa hai lượt refresh.

**Mức Vừa.**

2. **Gõ số ngày khổng lồ làm treo tab Details** (`1c9ed1c7`). `tourReadiness` lặp theo
   số ngày, còn phép chiếu chạy trước kiểm trần 1–30 (cả với tour tắt bán): gõ
   `1000000000` rồi Save là tab treo hoặc sập, mất chữ chưa lưu. Nay chỉ chiếu với số
   ngày đã qua kiểm khoảng.
3. **Thả file hay Retry lúc đang Save làm mất ảnh vừa tải** (`97b0f8cd`): lượt adopt sau
   khi lưu ghi đè danh sách. Đang lưu thì hai đường ấy báo "Wait for the save to finish,
   then add more photos."
4. **Ảnh bìa gốc mang nhãn sai** (`a0fa6810`, `7926d5c9`; ADR-0048 AMEND 1, phương án
   (a) user chọn). 29 ảnh bìa catalog không có dòng `DESTINATION` nên không nằm trong hộp
   thư viện, mà vẫn ghi "From the library": admin tưởng gỡ ra còn chọn lại được. Nay là
   nguồn thứ ba `CATALOG`: dòng nguồn mở đầu bằng "Catalogue photo", kèm ghi công nếu
   có, và kết bằng "Can’t be added back once removed."; `get` hỏi thêm một câu để phân
   loại. Luật ghi của `setPhotos` không đổi.
5. **Chọn file lần hai trong lúc chờ ký vượt trần 30 ảnh** (`97b0f8cd`). Lượt chọn kế
   thấy sức chứa cũ; lúc lưu server trả lỗi schema kèm câu nhắc "payment provider". Dòng
   tải nay giữ chỗ trước khi ký, và form tự kiểm trần 30 cùng ảnh trùng trước khi gửi.
6. **Hộp thư viện giữ lựa chọn qua Cancel, lần mở sau Add vượt trần** (`3dac07e6`). Đóng
   hộp là xoá lựa chọn; Add chỉ gửi ảnh chưa có trong tour và kẹp theo chỗ trống.
7. **Rời tab lúc đang tải không hỏi lại, file vẫn tải ngầm** (`97b0f8cd`).
   `EditorFormFrame` nhận `busy`: còn file đang tải là trang có thay đổi chưa lưu. Rời
   hẳn thì huỷ lượt tải và hàng đợi (`AbortController`).
8. **Hai script `media:*` đè ảnh tour admin đã sửa** (`3098334a`). `media:alt` chỉ lấp
   alt còn trống ở dòng `TOUR`; `media:upload` bỏ qua hẳn tour đã có dòng ảnh và chặn
   Supabase trừ khi có cờ `--toi-biet-day-la-production`. DB mới dựng vẫn được lấp như
   cũ vì seed không ghi `media_assets`. Lệnh "không chạy lại" ở open-items gỡ bỏ.
9. **`seed:verify` không canh tour đang bán thiếu ảnh bìa** (`09b1754c`): thêm bất biến
   (chỉ kiểm khi DB đã có ảnh tour) và cảnh báo riêng cho DB trần, nơi lưu Details hay
   Itinerary của tour đang bán bị 409.

**Mức Thấp.**

10. **Lệnh ký ném làm dòng tải kẹt, khoá Save mãi** (`97b0f8cd`). Ném coi như lỗi chung:
    file vừa chọn rút khỏi danh sách kèm lý do, Retry ký hỏng trả dòng về Failed. XHR
    có thêm hạn giờ 5 phút.
11. **Hộp thư viện kẹt "Loading…" khi action ném, và nói một câu cho mọi mã**
    (`3dac07e6`). Nay ném coi như lỗi chung kèm Try again; hết phiên hay mất quyền nói
    đúng mã và không mời thử lại.
12. **Tiêu điểm rơi về `<body>` sau Retry hay Remove** (`97b0f8cd`). Retry chuyển tiêu
    điểm sang thanh tiến độ, xong thì sang ô alt, hỏng thì về nút Retry; Remove sang dòng
    hỏng kế, hết thì về nút Upload photos.
13. **Ba câu copy hứa điều code không làm** (`b3abe0c3`). PHOTO_NOT_ALLOWED thôi hứa
    Reload (tải lại cùng phiên bản không bỏ được ảnh hỏng) mà bảo gỡ ảnh thư viện vừa
    thêm, và kho ảnh tải lại ở lần mở hộp sau; câu "không vừa" nói thêm file đang tải
    hay tải hỏng cũng chiếm chỗ; hộp thư viện thôi hứa in ghi công. Kèm câu
    `INVALID_INPUT` chung của admin: bỏ "payment provider" lạc đề (có từ F17, F18 làm
    chạm tới được).
14. **Nghiệm thu CSP dời ra sau merge, trần ký lô trích sai** (`88c7e51a`). ADR-0038
    AMEND 5 từng hẹn DevTools trên production. Đã làm ở local trên bản build của admin:
    `fetch` tới `api.cloudinary.com` đi qua (HTTP 400 vì form rỗng, không tạo asset),
    origin ngoài danh sách bị chặn kèm đúng một vi phạm `connect-src`. Không tải file thật
    vì `.env.local` dùng chung cloud với production; lượt thử tay trên prod giữ làm lớp
    thứ hai. Route admin chịu `ADMIN_WRITE_THROTTLE` 60/60s chứ không phải 20/60s: sửa ở
    ADR-0048 §4 (kèm input thật `{ id, count }`), JSDoc contract, spec §2c. Câu cũ trong
    entry F18 ngay dưới giữ nguyên vì entry là bất biến.
15. **Test xanh giả** (`dd156b30`, `1d0a2343`). Ca int "31 ảnh" dùng publicId không
    nguồn nào nhận, nên bỏ `.max(30)` vẫn ra 400; nay 31 ảnh tải lên hợp lệ và khẳng
    định `BAD_REQUEST`. Thêm ca `photos: []` qua `fetchAdminTour` giữ `cover: false`. Gate
    cuối vòng bắt thêm một ca contract còn khẳng định nguồn chỉ có hai giá trị
    (`2955e313`).

**Đột biến.** Ghi được 37 đột biến trên các ca mới và chỗ vá, 34 cái chết ngay. Hai cái
sống lúc đầu, đã giết bằng ca thêm: `.slice(0, capacity)` của hộp thư viện (ca "sức chứa
co lại giữa lúc hộp mở") và tiêu điểm về Retry khi Retry ký hỏng (`fbf73fbf`). Một cái
tương đương: bỏ `if (signal.aborted) return` sau khi ký không đổi gì, vì
`runWithConcurrency` và `uploadPhoto` đã tự dừng khi lượt tải bị huỷ.

**Ba ứng viên bị bác.** Tiêu đề trang admin viết literal (khuôn chung toàn repo); ghi
công bốn cột bị thiếu khi chép từ thư viện (chép đủ, int test đã chốt); luật "không dọn
ảnh thư viện" nằm ở nơi gọi (hôm nay không phải lỗi, ghi thành G16).

**Không có việc hạ tầng.** Không migration, không env, không đổi thiết lập Cloudinary.

CÒN TREO:

- Merge F18: rebase lên `main`, gồm hai commit docs F19 đang nằm ở `main` local
  (`36e88d87`, `fc397c32`) — chờ user xác nhận.
- Thử tay F18 trên production theo spec §5: tải ảnh thật mà console sạch, log
  `csp-report` không có dòng nào cho `api.cloudinary.com`; thêm ba điều jsdom không canh
  được — hộp hỏi lại khi rời tab lúc đang tải, kéo thả file, tiêu điểm sau Retry.

Tests after: Vitest **4664** (web 1576, admin 1419, api 1005, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86. Ca
mới: admin 34, api 1; một ca contract và ba ca int sửa lại. Gate đầy đủ chạy tách bước
có watchdog, 12,2 phút: commit trống thấp nhất 5,47 GB, pagefile đứng yên 2560 MB.
Commit cuối `fbf73fbf` chỉ thêm một khẳng định vào spec tab Photos, chạy lại riêng file
ấy (23/23).

## 2026-09-28 — F18 ảnh tour (nhánh `feat/p4e-3b-tour-photos`)

Tab Photos trong khu làm việc tour: tải ảnh lên thẳng Cloudinary (ký theo lô),
lấy ảnh từ kho ảnh địa danh kèm ghi công, sắp thứ tự, chọn ảnh bìa (ảnh đầu), sửa
alt. Quyết định ở ADR-0048: một danh sách có thứ tự trong `media_assets`, một lệnh
`setPhotos` thay trọn và khoá phiên bản, chỉ ảnh tự tải lên mới vào lại hàng dọn.
Readiness thêm điều kiện ảnh bìa; luật "tour đang bán thì luôn đủ" phía admin suy
từ `projectedReadiness` (đóng G11). Xoá tour dọn luôn dòng ảnh. Không migration,
không sửa web.

**Tab Photos** (`/tours/[slug]/photos`, ngay sau Details). Mỗi dòng: thumbnail
`f_auto,q_auto,w_320` không cắt cúp (khung 3:2 do CSS), ô Alt text bắt buộc, dòng
nguồn "Uploaded" hoặc "From the library · Photo: tác giả, giấy phép". Dòng đầu mang
nhãn Cover; dòng khác có Make cover — ảnh lên đầu, tiêu điểm vào ô alt của nó. Gỡ
dòng cuối trả tiêu điểm về nút Upload photos. Kit `ListEditor` cho phép không có nút
thêm và nhận `emptyFocus`; `EditorFormFrame` nhận `blockedNote`.

**Tải lên.** Nút Upload photos hoặc kéo thả vào vùng danh sách. File sai đuôi, quá
10 MB hay vượt sức chứa 30 ảnh bị loại kèm lý do; phần còn lại ký MỘT lần cho cả lô
(`admin.tours.signPhotoUploads`, một request dưới trần 20/60s của ADR-0037), tải song
song tối đa ba file bằng XHR có tiến độ. Ảnh tải xong nối vào cuối, alt để trống;
hỏng thì Retry ký lại một chữ ký mới, hoặc Remove. Save khoá khi còn file đang tải
("Waiting for N uploads to finish."). URL xem trước thu hồi khi dòng tải xong hay bị
gỡ. CSP admin mở `connect-src https://api.cloudinary.com` — AMEND 5 của ADR-0038, viết
trong nhánh này theo lựa chọn của user (luật của ADR-0038: origin mới phải qua AMEND).

**Hộp Add from library.** Kho ảnh địa danh tải một lần (`admin.tours.photoLibrary`,
route riêng `/api/admin/tour-photo-library`), mặc định bày ảnh các địa danh tour đi
qua, ô chọn đổi sang từng địa danh kể cả địa danh đang ẩn. Ảnh đã có hiện "Added" và
khoá; không tích quá sức chứa; ảnh nằm ở hai địa danh chỉ bày và gửi một lần. Alt
chép từ ảnh gốc, sửa được.

**API.** `setPhotos` trong một transaction: giành hàng tour → phân loại từng ảnh vào
một trong ba nguồn (dòng đang có của tour giữ nguyên metadata và bốn cột ghi công;
ảnh tải lên trong `<root>/tours/<tourId>/` kèm metadata Cloudinary; dòng
`DESTINATION` — metadata và ghi công chép ở server) → ngoài ba nguồn là 400
`PHOTO_NOT_ALLOWED` → thay dòng → requeue ảnh tải lên bị gỡ, cùng transaction → kiểm
"vẫn đủ để bán". `admin.tours.get` trả `photos` theo thứ tự hiển thị. `delete` thành
một transaction dọn luôn dòng ảnh và requeue ảnh tải lên. Một cổng ký tự
`MediaPublicIdSchema` cho mọi publicId client gửi — ảnh review dùng chính nó.

**Readiness và G11.** `TourReadiness.cover`: `setPublished(true)` và mọi lệnh sửa của
tour đang bán chặn tour mất ảnh bìa ("a cover photo"). Khung readiness có mục "A
cover photo" trỏ tới tab Photos; câu "Ready to sell", câu hộp New tour và câu hộp xoá
tour sửa cho nói đúng. `onSaleShortfalls` là nguồn duy nhất của luật "tour đang bán"
ở Details, Itinerary, Photos, chỉ đếm chỗ do chính lệnh ấy làm hỏng. Hộp xoá tour có
thêm hàng Photos.

**Khe deploy:** `fetchAdminTour` lùi `photos` về `[]` và `readiness.cover` về `true`
khi API cũ chưa trả hai field ấy.

**Chỗ lệch plan** (không chạm spec): fixture plan bỏ sót — `DETAIL` trong
`admin-tours.spec.ts` của contract thêm `cover` và `photos`; ca "heroUrl… chưa có ảnh
trả null" của `admin-catalog.int.spec.ts` đổi vế null từ ALPHA (nay có ảnh bìa) sang
GAMMA; `proxy.spec.ts` so chuỗi `connect-src` nguyên văn. Plan gọi
`validateDetailsForm`, tên thật là `validateTourDetailsForm`. Thêm ca đối chiếu hai
codec của tab Photos với `errorMap` của contract (khuôn có sẵn ở
`tour-editor-write.spec.ts`). Hộp thư viện `showCloseButton={false}` như mọi hộp
thoại admin. JSDoc đầu `security-headers.ts` của admin và JSDoc `delete` sửa cho đúng.
Bước unit của gate chạy `--concurrency=1` từ Task 8: lượt gate Task 7 đẩy commit trống
xuống 1,6 GB, sát ngưỡng dừng 1,5 GB của watchdog.

**Giới hạn đã biết:** ảnh bìa catalog của 29 tour không nằm trong kho địa danh — gỡ
rồi lưu là không chọn lại được từ hộp thư viện (spec §8). `capacity` của tab Photos
đọc theo lượt render: hai lượt thả file liên tiếp trước khi render lại có thể vượt 30
ảnh, và lúc lưu server trả lỗi schema.

**Review findings:** chưa review — session gốc review trước merge.

**Việc hạ tầng:** không có — không migration, không env, không đổi thiết lập
Cloudinary. Thử tay trên production theo spec §5 gồm cả nghiệm thu CSP bằng DevTools
(ADR-0038, Hệ quả).

Tests after: Vitest **4629** (web 1576, admin 1385, api 1004, contract 559, core 46,
ui 23, tokens 18, i18n 18), int **698 ở 45 file**, jest mobile 159 và mobile-ui 86.
Ca mới: contract 12, api 11, admin 48, int 20. Mỗi ca mới thử đột biến; chín đột biến
sống sót với fixture ban đầu (năm cái plan hứa sẽ đỏ) và đều được giết bằng cách siết
fixture hoặc thêm ca: bỏ `orderTourPhotos` (ảnh bìa fixture có `sortOrder` 0), đảo
thứ tự nguồn của `planTourPhotos`, `requeue` ngoài transaction (thêm ca "lệnh hỏng
sau khi gỡ ảnh tải lên"), bỏ vế `current.cover` của G11, luôn vẽ nút thêm của kit,
bỏ điều kiện `blockedNote` ở `onSubmit`, ký theo số file chọn thay vì số file nhận,
Retry dùng chữ ký cũ, bỏ `dedupe` của hộp thư viện.

## 2026-09-28 — Sidebar admin thu gọn thành cột icon (nhánh `fix/admin-sidebar-icon-rail`)

Góp ý giao diện admin: đóng sidebar là nó trượt mất hẳn, trang không còn nút điều
hướng nào. Giờ thu gọn thành cột icon theo mẫu application-shell-26 của shadcnstudio
(user duyệt demo, dặn giữ vạch ngăn giữa các nhóm). Chỉ đổi giao diện admin và thêm
hai chuỗi i18n; API và contract không đổi.

- **Cột icon thay cho trượt mất** (`d6a567ea`). `collapsible="offcanvas"` đổi thành
  `"icon"`: thu gọn còn cột rộng 66px (3rem cộng khung inset) giữ logo, icon từng
  trang và avatar. Điện thoại vẫn là ngăn kéo: component tự đổi sang Sheet dưới
  768px.
- **Tooltip là nhãn của icon.** Rê vào icon thì tooltip bên phải nói tên trang, bật
  ngay không trễ; logo nói "Nexora — Dashboard", avatar nói tên người đang đăng
  nhập. Sidebar mở thì không có tooltip, vì nhãn đã nằm cạnh icon.
- **Mục chưa mở nói được vì sao không bấm được.** Nút `disabled` không nhận chuột lẫn
  tiêu điểm, nên ở cột icon tooltip "Posts · Soon" không bao giờ hiện. Đổi sang
  `aria-disabled`: rê chuột và Tab tới được, bấm vẫn không làm gì, con trỏ
  `not-allowed`, vẫn mờ như cũ.
- **Trang đang mở có ô sáng** và `aria-current="page"`. Trước đây không mục nào sáng;
  ở cột icon đó là dấu duy nhất cho biết đang ở đâu. `isActiveNav` bỏ query của href
  (`/reviews?status=pending`), trang con sáng mục cha (`/tours/<slug>/costs` sáng
  Tours), Dashboard chỉ sáng ở đúng `/`.
- **Vạch ngăn giữa ba nhóm** khi thu gọn, vì nhãn nhóm ẩn ở cột icon.
- **Nút Inbox cạnh Quick Create** ẩn hẳn ở cột icon thay vì `opacity-0`: nút trong
  suốt vẫn nhận Tab.
- **Giữ trạng thái khi chuyển trang.** Mỗi trang dựng lại `AdminShell` với
  `SidebarProvider` mặc định mở, nên thu gọn rồi bấm sang trang khác là sidebar bung
  ra. Shell giờ đọc cookie `sidebar_state` (provider tự ghi mỗi lần đổi) lúc dựng ở
  server. Trang Dashboard trước đây tự dựng một bản khung trùng 1:1, nay dùng chung
  `AdminShell` (`7851d236`) để chỉ còn một chỗ đọc cookie.

**Review findings:** không mở vòng review riêng; test viết trước. Rà lại trước khi
merge thêm hai ca canh (`5c2c5595`): tooltip phải bật NGAY (ca cũ dùng `findBy`, chờ
tới 1s nên không phân biệt được với trễ 600ms mặc định của Base UI khi thiếu
`TooltipProvider`), và Ctrl+B ghi đúng cookie mà shell đọc lại — tên cookie chép tay
vì gói ui không export hằng của nó. 17 đột biến đều làm test đỏ: `offcanvas` thay
`icon`, bỏ tooltip logo, bỏ `TooltipProvider`, tooltip avatar luôn ẩn, bỏ tooltip mục
đã mở, mục Soon về `disabled`, bỏ `isActive`, bỏ `aria-current`, Inbox về
`opacity-0`, vạch ngăn cả nhóm đầu, khớp tiền tố trần (`/tours-archive` sáng Tours),
giữ query của href, tooltip Soon mất chữ "Soon", giá trị cookie lạ thành thu gọn,
đổi tên cookie ở admin, đổi tên cookie ở gói ui, shell không đọc cookie. Bố cục jsdom
không đo được, nên soi bằng CSS của bản build admin (DOM từ jsdom đổ ra trang tĩnh):
thu gọn rộng 66px, logo hiện đủ, vạch 1px ở nhóm hai và ba, Inbox `display: none`,
mục Soon mờ 0.5 với `pointer-events: auto` và con trỏ `not-allowed`. Trạng thái mở
giữ nguyên, chỉ thêm ô sáng ở trang đang mở.

**Không có việc hạ tầng:** không migration, không env; API không đổi code.

Tests after: Vitest **4577** (web 1576, admin 1356, api 993, contract 547, core 46,
ui 23, tokens 18, i18n 18), jest mobile 159 và mobile-ui 86. Int không chạy ở máy:
session F18 đang dùng chung `tourism_test`, và nhánh không chạm API — CI chạy sau
push.

## 2026-09-28 — Góp ý giao diện của lượt thử tay F17 (nhánh `fix/f17-thu-tay-gop-y`)

Đóng mục CÒN TREO của entry thử tay F17 ngay dưới, cộng các góp ý user gửi thêm sau
lượt thử (tab Details, FAQ & policies, Costs). Toàn bộ là giao diện, không đổi API
hay contract.

Ba góp ý ghi trong lượt thử:

- **Ngày một điểm dừng in "09:00–09:00"** (`62c3aec3`). Chuỗi `stopsSummary` của
  i18n in khoảng đầu–cuối kể cả khi hai mốc trùng nhau; giờ mốc đầu trùng mốc cuối
  thì in một giờ ("Day 2 · 1 stop · 09:00"). Sửa ở chuỗi nên đúng cả ngày nhiều
  điểm dừng cùng một giờ.
- **Hai thứ tự chính sách trên một trang** (`51aef65d`). Hàng ô dưới nút đặt chỗ
  giờ đi qua cùng `orderPolicies` với tab Good to know (huỷ → thanh toán → chung).
  Sắp xếp ổn định nên ô của mỗi loại vẫn lấy chính sách admin để đầu.
- **Câu sàn số khách hiện hai lần** (`38dfa282`). Ô Max group size có lỗi thì gợi
  ý sàn ẩn, lỗi nói một mình; hết lỗi thì gợi ý quay lại. Chọn luật "có lỗi thì ẩn
  gợi ý" thay vì "ẩn khi trùng chữ": lỗi từ server có thể mang sàn mới hơn con số
  trong gợi ý đang cầm, và hai câu lệch số còn tệ hơn hai câu trùng chữ.

Góp ý gửi thêm:

- **Nhãn và ô "Base price (USD)" tụt xuống** (`6a5442b6`). Nguyên nhân không phải
  thiếu chú thích: mỗi ô (`FormField`) là một lưới; hàng ba cột kéo ô Base price cao
  bằng hai ô có dòng gợi ý, và lưới bên trong chia phần dư cho nhãn và ô nhập. Kit
  thêm `content-start` nên mọi hàng nhiều cột của admin thẳng mép, kể cả khi một ô
  hiện lỗi đỏ còn ô bên cạnh thì không.
- **Cụm nút ↑ ↓ và thùng rác nằm ngang nhãn** ở dòng FAQ, chính sách, chi phí
  (`67d16115`), và thùng rác dòng điểm đến lệch lên trên nút Primary (`2b595c87`).
  Bốn danh sách dùng chung `ListEditor`, cụm nút canh mép trên của dòng mà dòng mở
  đầu bằng nhãn. Kit thêm `labelledRows`: cụm nút hạ 20px (nhãn 14px và khoảng 6px)
  xuống ngang ô nhập đầu tiên. Highlights, Included, Excluded không có nhãn, giữ
  nguyên.
- **Ô tích không nói nó làm gì** (`2b595c87`). Good for và Badges có dòng gợi ý dưới
  nhóm nói tác động trên web, đọc từ code web: Good for chỉ là thẻ "Good for" ở tab
  Overview (không tích ô nào thì thẻ ẩn); Badges là chip cạnh giá đầu trang tour, tối
  đa hai, còn một khi giá đang hiện có giảm, phần dư gộp "+N". Badges có thêm chú
  thích nghĩa dưới từng ô — nghĩa là quy ước biên tập, hệ thống không tự tính;
  "Limited offer" chỉ dùng khi có giảm giá thật, bám luật giá gạch 15/09. Featured
  cũng có câu chú thích: chip "Featured" trên card trang /tours khi card không có
  giảm giá, và bộ lọc "Featured trips". Mọi câu gắn với ô qua `aria-describedby`.

**Review findings:** không mở vòng review riêng — mỗi thay đổi có test đỏ trước khi
sửa. Đột biến ở ba bản vá đầu: bỏ nhánh trùng giờ, bỏ `orderPolicies`, bỏ điều kiện
ẩn gợi ý, đảo điều kiện ấy — cả bốn đều làm test mới đỏ. Sáu đột biến ở phần gửi
thêm cũng chết: bỏ `content-start`, đổi `pt-5` thành `pt-4`, bỏ `labelledRows` ở form
chi phí, bỏ `aria-describedby` ở ô tích, bỏ nó ở nhóm, gắn chú thích cho cả các ô
Good for. Bố cục jsdom không đo được,
nên soi bằng trình duyệt: dựng ba form trong jsdom, đổ DOM ra trang tĩnh kèm CSS của
bản build admin, khổ 1400px. Hàng Days, Maximum group size, Base price: ba nhãn cùng
mép, ba ô nhập cùng mép; gỡ `content-start` ngay trên trang thì ô Base price tụt lại
đúng 11px như ảnh user gửi. Cụm nút của năm loại dòng lệch ô nhập đầu tiên 0px.

**Không có việc hạ tầng:** không migration, không env; API không đổi code.

Tests after: Vitest **4558** (web 1576, admin 1337, api 993, contract 547, core 46,
ui 23, tokens 18, i18n 18), int **678 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-28 — Thử tay F17 trên production (`e19d4ccc`): 8/8 bước đạt

Lượt thử từng bước trên `admin.nexora-travel.agency` và `www.nexora-travel.agency`
sau khi F17, vòng vá review và bản vá seed cùng lên `main`, bằng một tour thử tạo
mới ở bước 1 rồi xoá ở bước 8. Mỗi bước đối chiếu DB prod bằng câu đọc; cuối lượt
DB về đúng trạng thái trước khi thử (29 tour, cả 29 đang bán, không chuyến mồ côi).

1. **New tour:** slug tự điền theo tên; tour sinh ra tắt bán, một điểm chính;
   khung readiness liệt kê tóm tắt và lịch trình ngày 1–2; câu mới của hộp New tour.
2. **Details:** nút Save mờ khi chưa sửa; phím mũi tên ở nút xoá và ô chọn của dòng
   điểm đến không đổi điểm chính; bấm chữ "Primary" và "Featured" chọn được; lưu
   xong gõ tiếp ngay không mất chữ (chữ ấy vào DB ở lần lưu sau).
3. **Itinerary rồi bật bán:** lưu rồi bấm ngay sang Details, khung readiness chuyển
   "Ready to sell" với câu mới và công tắc mở khoá; bật bán; trang web hiện tour với
   khung ảnh giữ chỗ và "09:00" ở cột giờ riêng.
4. **FAQ, chính sách, chi phí:** trần 999,999.99 chặn ở dòng chi phí; Totals đúng
   ($18.50 mỗi khách, biên $30.50); trang web một ô mỗi loại chính sách (hai
   General và một Booking ra ba ô kể cả ô huỷ), tab Good to know đủ bốn thẻ.
5. **Dời dòng và rời trang:** dời dòng highlight bằng bàn phím, tiêu điểm đi theo
   nút ↓ của dòng vừa dời; đổi tab khi chưa lưu hiện "Discard unsaved changes?";
   F5 hiện hộp "Leave site?" của trình duyệt.
6. **Hai tab cùng sửa:** lệnh lưu cũ ra dải STALE, chữ đang gõ còn nguyên; Reload
   nạp bản của tab kia.
7. **Departures:** trần giá ở form chuyến; số ngày khoá khi có chuyến; hạ số khách
   dưới số ghế bị chặn bằng câu mới, nâng thì lưu được; giá vốn tính lại $16.83;
   chuyến tạo tay chụp giá vốn cố định 100.00.
8. **Xoá tour:** hộp xác nhận kể đủ thứ mất theo (1 chuyến, lịch trình, FAQ…); xoá
   xong trang tour trên web trả 404.

Ba điều jsdom không canh được — tiêu điểm sau khi dời dòng, hộp `beforeunload`,
Reload sau `STALE_TOUR` — đều đạt trong trình duyệt thật.

CÒN TREO — ba góp ý giao diện nhỏ, user chọn vá ngay ở một nhánh riêng:

- Web: ngày có đúng một điểm dừng hiện "1 stop · 09:00–09:00" ở dòng tóm tắt.
- Web: cùng một trang, hàng ô chính sách theo thứ tự admin nhập còn tab Good to
  know xếp theo loại.
- Admin: hạ số khách dưới sàn thì câu "At least 10 — …" hiện hai lần (gợi ý xám và
  lỗi đỏ trùng chữ).

## 2026-09-28 — Seed thay nguyên bảng con của tour fixture: đóng lỗi mức Cao cuối cùng của vòng review F17 (nhánh `fix/seed-bang-con-f17`)

Lỗi 1 của vòng review F17, tách nhánh vì chỉ nổ ở lượt seed lại 03/11. Khu làm
việc F17 thay nguyên FAQ, chính sách và dòng chi phí bằng hàng id MỚI, còn seed
upsert hay `createMany({ skipDuplicates })` theo id fixture: sửa một tour seed
rồi seed lại là bản fixture nằm CẠNH bản admin — FAQ và chính sách in hai lần
trên trang tour, dòng chi phí nhân đôi (giá vốn chụp vào booking và chuyến mới
gần gấp đôi), bỏ điểm chính fixture là tour mang hai điểm chính (tab Details trả
400). Seed vẫn báo thành công, `seed:verify` không bắt.

**Seed.** Năm bảng con của 29 tour fixture (điểm đến, lịch trình, FAQ, chính
sách, dòng chi phí) xoá rồi chèn lại trong MỘT transaction dạng mảng. Chỉ lọc
theo id tour fixture, nên tour tạo tay không bị đụng; không bảng nào có khoá
ngoại trỏ vào năm bảng này. Bước xoá chính sách CANCELLATION riêng nay thừa nên
gỡ. `costPrice` tính lại vô điều kiện (bản cũ chỉ điền chỗ trống, nên giữ giá
vốn tính từ dòng chi phí của admin mà bảng không còn); `fixedCostAmount` của
chuyến vẫn chỉ điền chỗ trống vì là bản chụp. Upsert tour thôi ghi lùi
`updatedAt` về mốc fixture — phiên bản của khu làm việc F17 không lùi.

**`seed:verify` thêm năm bất biến:** số điểm chính khác 1, FAQ trùng câu hỏi,
chính sách trùng loại và tiêu đề, dòng chi phí trùng nhãn, `cost_price` lệch
công thức dẫn xuất.

**Tập dượt trên DB Docker riêng** (seed → sửa một tour như admin qua bốn tab →
seed lại → verify): seed cũ ra 13 vi phạm, tour bị sửa mang FAQ 5→10, chính
sách 2→4, dòng chi phí 4→8, hai điểm chính, giá vốn của admin; seed mới ra 0
vi phạm và tour về đúng fixture; chạy lần ba vẫn ổn; một tour tạo tay còn
nguyên cùng FAQ và điểm đến của nó. Bước `data:reset` không nằm trong lượt tập
dượt: script đòi tài khoản admin mang id của prod, và nó giữ nguyên năm bảng
con nên kết quả không đổi.

**Spec 2026-09-24 §8 sửa lại** — bản đầu sai cả hai vế: bước reset GIỮ bảng
`tours`, nên tour tạo tay còn sống (mất chuyến, booking, đánh giá); tour seed bị
ghi đè trọn. Mục khe deploy ghi thêm rằng tab Departures nay sống qua khe ấy.

Chặn tạm ghi ở vòng review (thử tay chỉ bằng tour mới tạo) không còn cần: lượt
seed 03/11 sẽ ghi đè mọi chỉnh sửa trên tour seed về fixture. Việc còn lại trước
lượt ấy: gỡ bán hoặc xoá tour thử tạo bằng F17 (open-items).

**Không có việc hạ tầng.** Seed chỉ chạy tay ở lượt 03/11; không migration.

Tests after: Vitest **4546** (không đổi — seed không có unit test riêng ngoài 456
ca fixture của `prisma/`), int **678 ở 45 file**, jest mobile 159 và mobile-ui 86.

## 2026-09-28 — Merge F17 lên main (`9b284e9b`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F17" và "F17 tạo và
sửa tour". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge
nên chưa mang hash.

Nhánh `feat/p4e-3a-tour-editor` rebase lên `8a6390c4` (bản dọn `payment_events`
của `bookings.int.spec`, từ một session riêng) rồi fast-forward: 25 commit — 13
của đợt thi công, 12 của vòng review. Không xung đột. Gate đủ năm bước xanh
trước rebase; int chạy lại xanh trên đỉnh mới (678 ở 45 file). Không migration,
không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay F17 trên production bằng tour MỚI tạo, sau khi Vercel và
Render deploy xong; nhánh vá seed trước lượt seed lại 03/11 (open-items).

Tests after: Vitest **4546** (web 1575, admin 1328, api 993, contract 547,
core 46, ui 23, tokens 18, i18n 16), int **678 ở 45 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-28 — Vòng review F17: 24 lỗi thật, vá 23, lỗi seed tách nhánh riêng (nhánh `feat/p4e-3a-tour-editor`)

Review chạy TRƯỚC merge, ở mức cao nhất: mười một góc tìm độc lập, mười nhóm
agent kiểm chứng từng ứng viên, cộng một lượt quét sót các vùng chưa ai soi
(phân quyền, tour chưa có ảnh bật bán, khoá ngoại khi xoá, đổi slug, server
actions — đều sạch). Kết quả: 24 lỗi thật (2 Cao, 8 Vừa, 14 Thấp), 7 ứng viên
bị bác, 3 mục ghi sang open-items (G9–G11). Vá 23 lỗi trên nhánh; lỗi còn lại
(mức Cao, ở seed) chỉ nổ ở lượt seed lại 03/11 nên tách nhánh riêng làm ngay
sau merge — chi tiết và lệnh chặn tạm ở open-items "Trước lượt seed lại 03/11".

**Hai lỗi mức Cao.**

1. **Seed lại nhân đôi bảng con của tour đã sửa** (CHƯA vá ở nhánh này). Khu
   làm việc thay nguyên FAQ, chính sách, dòng chi phí bằng hàng id mới, còn
   seed upsert theo id fixture: seed lại là FAQ và chính sách in hai lần, giá
   vốn chụp vào booking mới gần gấp đôi, tour có thể mang hai điểm chính.
2. **Phím mũi tên tự đổi điểm đến chính.** `RadioGroup` của Base UI bọc cả danh
   sách điểm đến: gốc composite bắt mọi phím mũi tên nổi bọt từ nút xoá hay ô
   chọn, dời tiêu điểm sang một radio và radio tự bấm. Nay mỗi dòng một radio
   gốc trong `<label>`, tên đọc-màn-hình mang tên điểm đến ("Primary: Hà Nội").

**Tiền, đặt chỗ và luật tour.**

3. **Tên tour 161–200 ký tự làm mọi booking của tour đó 500** — cột bản chụp
   `bookings.tour_title` chỉ 160. `TOUR_TITLE_MAX` hạ về 160. Mô tả gửi cổng
   thanh toán cắt về 127 byte UTF-8 (trần của PayPal), giữ khoảng ngày.
4. **Trần mọi ô tiền admin gõ tay là 999,999.99** (trần một lần thu của Stripe)
   thay cho trần cột: giá × ghế của `total_amount`, tổng dòng chi phí của
   `cost_price` và `fixed_cost_amount` từng tràn `Decimal(14,2)` thành 500. Một
   luật đóng cả hai đường; admin báo câu riêng khi quá trần.
5. **Xoá tour đúng lúc khách đặt chỗ** trả `DEPARTURE_NOT_AVAILABLE` thay vì 500
   (khoá ngoại `P2003` ở câu INSERT booking).
6. **Tạo và sửa chuyến giữ hàng tour `FOR SHARE`** — câu INSERT chỉ lấy
   `KEY SHARE`, nên một chuyến quá trần từng commit đúng lúc tour đang hạ số
   khách. Đóng G8 của open-items, kể cả hai biến thể mà G8 chưa khai.
7. **Sàn số khách chỉ chặn khi HẠ**: dữ liệu đã lệch thì tab Details từng khoá
   cứng, kể cả khi chỉ sửa tên.
8. **Duyệt hay rút review không đẩy `updated_at` của tour** — cột ấy là phiên
   bản của khu làm việc, form đang mở từng dính `STALE_TOUR` giả. Sort công khai
   "updatedAt" nay là lần sửa nội dung gần nhất (ghi ở contract).

**Khu làm việc admin.**

9. **Form không bị dựng lại sau mỗi lần lưu.** Bốn trang từng dựng form với
   `key={detail.version}`: lượt refresh sau lưu gỡ cả form — mất tiêu điểm, mất
   chữ gõ trong khe, Save lần hai ra STALE giả; công tắc On sale refresh sau khi
   tab khác lưu cũng xoá bản sửa dở. `useTourFormState` đón bản server mới ngay
   trong render: form sạch thì nạp, đang sửa thì giữ chữ và hiện dải stale.
10. **Phần đầu theo kịp lần lưu.** Lưu xong bấm ngay sang tab khác thì Next bỏ
    lượt refresh, còn layout không render lại khi đổi tab — khung readiness kẹt
    ở bản cũ. Form nay đẩy bản vừa lưu lên `TourDetailProvider`.
11. **Công tắc ở phần đầu**: `TOUR_NOT_READY` nghĩa là trang đã cũ (câu riêng
    rồi refresh); `NOT_FOUND` về `/tours` thay vì rơi vào trang 404 trần.
12. **Khe deploy**: lượt đọc tour của layout hỏng (admin lên trước API) thì vẫn
    dựng thân tab — tab Departures của F12 sống qua khe ấy.
13. `liveSeatsMax` nhận 0 (DB chỉ canh `>= 0`); slug quá trần trên URL ra 404;
    hộp New tour điều hướng một lần thay vì dựng trang tour mới hai lần.
14. **Nút khoá trông khoá**: `buttonVariants` thêm `aria-disabled:` — nút
    `focusableWhenDisabled` (Save khi chưa sửa, lên/xuống ở mép) từng sáng như
    thường. Lỗi có từ F15, F17 biến nó thành trạng thái thường trực.
15. Danh sách điểm đến bỏ nút dời (bảng không có cột thứ tự); bấm vào chữ
    "Primary" hay "Featured" cũng chọn được; dòng dựng từ server mang key tất
    định (hết lệch id lúc hydrate); Good for và Badges chuẩn hoá thứ tự nên tích
    rồi bỏ tích không còn là "có thay đổi".
16. Copy nói đúng điều server đo: "Ready to sell", hộp New tour, sàn số khách,
    dòng báo tour tắt bán ở tab Departures; JSDoc `tours-publish.ts` lỗi thời.

**Web.**

17. Trang tour chịu được nhiều chính sách cùng loại và câu hỏi trùng nhau: hàng
    ô tin cậy một ô mỗi loại, key theo vị trí.

**Test xanh giả.** Tám đột biến từng sống qua bộ test, nay đều đỏ: bỏ
`deleteMany` chính sách, bỏ `deleteMany` dòng chi phí, bỏ một cột khỏi
`detailsColumns`, tráo hai ghi chú dữ kiện, dời bust vào trong transaction, sàn
chặn cả khi không hạ, cổng bật bán chỉ xét tóm tắt, và bỏ `useReportUnsaved` khỏi
khung form. Thêm ca cho `onFieldError` trả false và xoá điểm chính khi còn ba
dòng, cùng các cặp biên N/N+1 còn thiếu của contract.

**Bảy ứng viên bị bác.** Làm tròn cent từng dòng (mọi đường vào đều ≤ 2 chữ số
lẻ); bật/tắt bán không đẩy `updatedAt` (cố ý); refresh sau lưu (chi phí có chủ
đích); tab Departures đọc tour hai lần (song song, rẻ); `NOT_FOUND` hai nghĩa ở
`updateDetails` (danh mục và điểm đến không xoá được); Enter trong ô một dòng
lưu cả tab (quy ước form admin); seed lùi phiên bản và ghi đè lịch trình (bước
6b đặt lại `now()`, lịch trình giữ bản admin).

**Không có việc hạ tầng.** Không migration, không env, không webhook.

CÒN TREO:

- Nhánh vá seed (lỗi 1) trước lượt seed lại 03/11 — open-items.
- Thử tay F17 trên production bằng tour MỚI tạo, gồm ba điều jsdom không canh
  được (tiêu điểm sau khi dời một dòng, hộp `beforeunload`, Reload sau
  `STALE_TOUR`) và hai điều mới: phím mũi tên ở dòng điểm đến không đổi điểm
  chính; lưu rồi gõ tiếp ngay không mất chữ.

Tests after: Vitest **4546** (web 1575, admin 1328, api 993, contract 547,
core 46, ui 23, tokens 18, i18n 16), int **678 ở 45 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-25 — F17 tạo và sửa tour (nhánh `feat/p4e-3a-tour-editor`)

Admin tạo được tour mới (đang tắt bán), sửa mọi nội dung chữ và số của tour qua
bốn tab của khu làm việc `/tours/[slug]`, bật bán khi tour đủ để bán, và xoá
được tour chưa từng có booking. Quyết định ở ADR-0047: mỗi tab một lệnh ghi,
khối danh sách thay nguyên, một `version` cho cả tour so-và-ghi trong một câu,
`tourReadiness` chặn bật bán. Ba hàm giá vốn dời lên contract, tính trên cent.
Không migration, không sửa web. Mười ba commit (mười hai task, một commit docs),
thi công ở một session riêng theo plan `2026-09-24-p4e-3a-tour-editor.md`.

**Hộp New tour.** Nút ở thanh công cụ bảng `/tours`. Bảy ô: tên, slug (chạy theo
tên bằng `slugifyVietnamese` tới khi admin chạm vào nó; tắt soát chính tả, tự viết
hoa, tự sửa chữ), danh mục và điểm đến chính (ô chọn của kit, mục đã ẩn mang
"(hidden)"), số ngày, số khách tối đa, giá gốc. Tour sinh ra TẮT bán; tạo xong mở
thẳng tab Details của nó. `SLUG_TAKEN` hiện dưới ô slug, hộp giữ nguyên chữ đã gõ.
Danh sách chọn không tải được thì hộp nói vì sao và khoá nút tạo. Tên tour trong
bảng nay là link sang khu làm việc; nút Departures ở cột Actions giữ làm lối tắt.

**Khu làm việc và thanh tab.** Layout `/tours/[slug]` dựng phần đầu dùng chung:
Back to tours · tên tour · công tắc On sale · khung readiness ("Ready to sell"
hoặc "Missing before it can go on sale: …", mỗi mục là link tới đúng ô cần sửa) ·
thanh tab Details / Itinerary / FAQ & policies / Costs / Departures. Màn chuyến
của F12 dời vào dưới layout, bỏ tiêu đề và link Back riêng. Form còn thay đổi chưa
lưu thì bấm tab hay link khác hỏi "Discard unsaved changes?", rời trang thì
`beforeunload` hỏi. Nút Save chỉ sáng khi có thay đổi và khoá bằng
`focusableWhenDisabled`; lưu xong form nhận nguyên tour mới từ response rồi
`router.refresh()` cho phần đầu theo kịp.

**Bốn tab.** Details có ba khung (Basics, Destinations, Selling points): số ngày
khoá khi tour có chuyến; hạ số ngày thì báo trước ngày nào của lịch trình sẽ mất;
số khách tối đa không hạ dưới số ghế lớn nhất của các chuyến chưa xong và chưa
huỷ; điểm đến có nút radio "Primary", luôn đúng một. Itinerary có đủ N thẻ ngày mang `id="day-N"`;
ngày không tiêu đề không được lưu; ô mô tả gợi ý khuôn `09:00 — …` mà trang tour
tách thành cột giờ. FAQ & policies là hai khung sửa danh sách; chính sách huỷ sinh
tự động nên chỉ có một dòng ghi chú. Costs có khung Totals tính NGAY khi gõ bằng
chính ba hàm contract mà API gọi lúc lưu: tổng theo khách, tổng theo chuyến, giá
vốn mỗi khách khi đủ đoàn, biên lời so với giá gốc. Mọi ô chọn là `FormSelect`
của kit.

**Chống ghi đè, và "đang bán thì luôn đủ".** Mỗi lệnh sửa mở đầu bằng MỘT câu
`updateMany` so `updatedAt` với `version` form gửi lên rồi đẩy nó đi (`claimTour`);
phiên bản mới luôn lớn hơn bản cũ ít nhất 1 ms, kể cả khi đồng hồ server lùi
(`nextTourVersion` — có ca int đẩy `updatedAt` ra tương lai). `STALE_TOUR` hiện
dải báo kèm Reload, form giữ chữ đang gõ. Tour đang bán thì `updateDetails` và
`setItinerary` tính lại `tourReadiness` sau khi ghi, trước commit; thiếu là
`TOUR_NOT_READY`, và dải báo liệt kê chỗ thiếu tính từ chính lệnh vừa gửi.

**Công tắc bị khoá khi thiếu.** `setPublished` khoá hàng tour (`FOR UPDATE`), xét
no-op trước, chỉ kiểm readiness ở chiều BẬT, và giữ nguyên `updatedAt` — bật hay
tắt bán không làm form đang mở thành cũ. Công tắc ở phần đầu khu làm việc khoá
chiều bật khi tour chưa đủ, kèm câu "Fill in what is missing to put it on sale.";
gỡ bán không bao giờ bị chặn. Ở bảng `/tours`, `TOUR_NOT_READY` ra toast kèm nút
"Open tour".

**Xoá tour.** Vùng Delete ở cuối tab Details chỉ hiện khi tour chưa từng có
booking. Server gọi thẳng `tour.delete` và để khoá ngoại quyết: `Restrict` của
booking cho `P2003` thành `TOUR_HAS_BOOKINGS` (câu lỗi hiện trong hộp), id không
có cho `P2025` thành `NOT_FOUND`. Hộp xác nhận giọng đỏ kể đúng từng thứ mất theo
(đo trên `schema.prisma`) kèm số chuyến; xoá xong về `/tours`.

**Đường tạo booking đổi chỗ import.** `perPersonTotal`, `perDepartureTotal` và
`derivedCostPrice` dời lên `@tourism/contract`, tính trên cent nguyên. Bản
`Prisma.Decimal` của API chỉ bị xoá SAU khi test đối chiếu chứng minh hai bản ra
cùng ba con số trên cả 29 tour seed. `bookings.service.ts` (`costPerPerson`),
`admin-departures.service.ts` (`fixedCostAmount`) và `seed.ts` (`costPrice`) chỉ
đổi chỗ import, qua bộ chuyển `costItemsOf` (Decimal thành chuỗi hai số lẻ).

**Lệch plan, có lý do** (chi tiết theo từng task ở báo cáo bàn giao):

- Task 2: plan sót chỗ import thứ tư (`prisma/fixtures/catalog/tour-costs.spec.ts`)
  và một comment lỗi thời ở `departure-rules.ts`. User duyệt 24/09: chuyển spec
  sang hàm contract, sửa comment.
- Task 7: plan ghi "ba ca đầu đỏ", nhưng ca gỡ bán và ca no-op vốn xanh với code
  cũ — đó là ca canh hồi quy, đã kiểm bằng đột biến.
- Task 8: `ListEditor` đặt lại tiêu điểm tường minh sau mỗi lần dời (trình duyệt
  bỏ focus của nút bị `insertBefore`), và "ô đầu của dòng mới" tính cả trigger
  `role="combobox"` của `FormSelect`.
- Task 10: spec hook ở `src/lib` không được vitest gom — user duyệt 25/09 thêm glob
  `src/lib/**/*.spec.tsx` vào project dom. `toBeDisabled()` luôn sai với switch
  của Base UI nên kiểm `aria-disabled`. `useSectionSave` chặn lệnh trùng bằng ref
  chứ không bằng state.
- Task 11 và 12: `FormSelect` bắt buộc `placeholder`, nên ba ô luôn có giá trị
  truyền chính nhãn ô; dòng mới mặc định ở mục đầu của mỗi ô chọn; Totals in tiền
  qua `formatAmount` ("$16.83") thay vì số trần; nhóm ô tích dùng `fieldset`
  thay `div role="group"` (Biome `useSemanticElements`).
- Gate: bước int chạy trên DB riêng `tourism_test_f17` bằng config tạm ở
  `apps/api/out/` (session khác dùng `tourism_test` cùng lúc); script tắt API theo
  đúng PID nó dựng.

**Giới hạn đã biết:** nút Back của trình duyệt không hỏi lại khi form còn thay
đổi (chỉ link trong app và `beforeunload` được canh); tạo chuyến và hạ số khách
tối đa chạy cùng lúc có thể để lại một chuyến nhiều ghế hơn số khách tối đa (lệnh
tạo chuyến của F12 không khoá hàng tour — một admin thì không gặp).

**Không có việc hạ tầng.** Không migration, không env, không webhook.

CÒN TREO cho session review:

- Thử trong trình duyệt thật ba điều jsdom không canh được: dời một dòng của khung
  sửa danh sách thì tiêu điểm ở lại nút vừa bấm; rời trang khi form còn thay đổi
  thì trình duyệt hỏi (`beforeunload`); Reload sau `STALE_TOUR` dựng lại form theo
  phiên bản mới (`key={detail.version}` ở bốn trang, không có test trang).
- Merge (rebase + ff), CI (luật 14), rồi thử tay production theo mục "Sau khi bàn
  giao" của plan.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **4473** (web 1573, api 989, admin 1287, contract 522,
core 46, ui 22, tokens 18, i18n 16), int **666 ở 45 file**. So với main: thêm
282 ca Vitest (admin 175, contract 103, api 4) và 40 ca int (file mới
`admin-tours.int.spec.ts` 36 ca, `admin-catalog.int.spec.ts` thêm 4). Đột biến
255 ở mười hai task: 243 bị giết; 12 còn sống, cái nào cũng có lý do — 8 tương
đương, 3 chỉ lộ trong trình duyệt thật hoặc khi hai lệnh đua nhau thật, 1 vì dữ
liệu seed không chạm nhánh làm tròn (unit Task 1 đã canh). Bảy lỗ test do đột
biến lộ ra đều đã vá bằng ca mới hoặc ca siết lại.

## 2026-09-24 — Thử tay F15 trên production (`b39e6df3`): 6/6 bước đạt; ba góp ý giao diện vá trên nhánh `fix/f15-thu-tay-gop-y`

Chạy khi cả ba nơi đã lên bản `b39e6df3`: admin và web trên Vercel (READY), API
trên Render khởi động lại lúc 08:23 UTC, sau giờ push. Sáu bước, mỗi bước chờ
người thử xác nhận; mọi lệnh ghi đối chiếu thẳng với DB production bằng SQL chỉ
đọc, mọi hệ quả phía khách đo bằng `curl` trên trang thật.

Điểm đến thử chọn bằng một câu SQL chỉ đọc: **Quy Nhơn** — Central Vietnam, đúng
một tour đang bán (`quy-nhon-coastal-3d`, điểm chính), nên mỗi lệnh ghi chạm ít
khách nhất mà vẫn đủ để thấy hệ quả trên trang vùng.

1. **Ẩn.** Hộp Hide nói đúng từng câu của bản vá review F15: hai câu về trang
   Central Vietnam (bản của vùng Miền Trung, kết bằng "day-trip section"), ba câu
   về số đếm, hộ chiếu, journal; câu trấn an màu trung tính. Toast đúng. DB
   `is_active = false`, liên kết tour còn nguyên, tour vẫn đang bán. Phía khách:
   Quy Nhơn rời trang Central Vietnam, `/about` và bộ lọc `/tours`; tour của nó rời
   trang Central Vietnam (điểm dừng duy nhất ở vùng ấy) nhưng `/tours` vẫn đủ 29 tour
   và trang tour vẫn in "Based in Quy Nhơn" kèm link lọc.
2. **Web khi đang ẩn.** `/tours?destinations=quy-nhon` còn 1/29 tour; chip ghi TÊN
   "Quy Nhơn" chứ không in slug; trong Filters, Quy Nhơn có mặt ở cuối danh sách và
   đang được tích nên bỏ tích được — đúng hai lỗ mà Task 9a của F15 vá.
3. **Hiện lại.** Hộp Show và toast đúng; DB `is_active = true`; Quy Nhơn và tour
   của nó về lại trang Central Vietnam, `/tours`, `/about`.
4. **Đổi vùng sang Southern Vietnam.** Hộp Edit không có ô slug, ô vùng là danh
   sách chọn ba mục. DB đổi đúng cột `region`, tên/quốc gia/mô tả giữ nguyên. Trang
   Central Vietnam mất Quy Nhơn và tour của nó; trang Southern Vietnam có cả hai.
5. **Trả về Central Vietnam.** DB và hai trang vùng về như cũ.

**Cuối lượt DB khớp trạng thái gốc:** Quy Nhơn `Central Vietnam`, đang hiện, tên,
quốc gia, mô tả và liên kết tour không đổi. Trang `/destinations` không liệt kê
Quy Nhơn ở mọi thời điểm — trang ấy chỉ bày các điểm nổi bật (Vũng Tàu, Đà Lạt
cũng vắng), không phải hệ quả của lượt thử.

6. **Tạo với slug đã có** (bước bổ sung, sau khi user hỏi phần tạo mới). Gõ tên
   "Hội An", ô slug tự điền `hoi-an` — slug đã có — rồi bấm Add: server trả
   `SLUG_TAKEN`, câu "Another destination already uses this slug…" hiện ở cuối
   hộp, hộp giữ nguyên chữ đã gõ. DB vẫn 18 điểm đến, vẫn một `hoi-an`.

**Không chạy trên production: nhánh tạo thành công.** Nó để lại một hàng không xoá
được (F15 cố ý không có nút xoá, SQL trên prod chỉ đọc); int test đã canh nhánh ấy
(`admin-destinations.int.spec.ts`, kể cả hai lượt tạo cùng slug bắn cùng lúc).

**Ba góp ý của user trong lượt thử, vá cùng ngày trên nhánh `fix/f15-thu-tay-gop-y`:**

- **Cột tên của bảng Destinations rộng gần 900px** (`6e934329`). Khối `truncate`
  không có trần bề rộng, nên trong bảng tự giãn nó không cắt được gì. Rút thành
  kit `NameDescriptionCell`: trần `max-w-md` (khoảng nửa bề rộng cũ, theo góp ý),
  mô tả gói hai dòng, `title` giữ nguyên văn. Bảng Categories là bản chép y hệt,
  cùng lỗi, nên dùng chung.
- **Ô chọn vùng là `<select>` gốc, trông thô** (`6e934329`). Thay bằng kit
  `FormSelect` bọc `Select` của @tourism/ui — cùng dáng dropdown với thanh công cụ
  và phân trang. `inputClassName` hết người dùng nên thôi export. Plan F17 sửa theo:
  mọi ô chọn của khu làm việc tour là `FormSelect` (commit docs này).
- **Gỡ thành viên đã rút khỏi nhóm** (`22f245f1`). Trang About còn ba người, lưới
  ba cột, thôi đọc khe ảnh `about-team-ops`; câu trích dẫn ở `/verify-email` chuyển
  sang Giang Tử Dương, co-founder (user chọn).

**Review findings:** lượt thử không tìm ra lỗi chức năng nào; ba mục trên là góp ý
giao diện. Đột biến của hai mảnh kit mới: 7 cái, 6 chết; cái còn lại (đổi chuỗi
rỗng thành `null` trước khi đưa xuống Base UI) tương đương vì Base UI 1.6 vốn coi
`''` là chưa chọn, nên đoạn ấy đã bị bỏ.

**CÒN TREO:** seed vẫn tạo khe ảnh `about-team-ops` (ảnh robot giữ chỗ, không ai
đọc) — dọn ở lượt seed lại ~03/11 nếu muốn gọn.

Tests after: Vitest **4191** (tokens 18, i18n 16, ui 22, contract 419, core 46, api 985, admin 1112, web 1573), int **626 ở 44 file**. Tám ca mới đều ở kit admin (`FormSelect` 6, `NameDescriptionCell` 2).

## 2026-09-24 — Merge F15 lên main (`387824d0`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F15" và "F15 quản trị
điểm đến". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết TRƯỚC merge
nên chưa mang hash.

Nhánh `feat/p4e-2-destinations` đã nằm sẵn trên đỉnh `main` (`310d6e9d`, commit
prompt bàn giao), nên fast-forward thẳng, không cần rebase: 10 commit — sáu
của session thi công, bốn của vòng review. Gate đầy đủ đã chạy xanh trên chính
đỉnh ấy. Cùng lượt đẩy có ADR-0047 và spec F17 (P4e-3a tạo và sửa tour), chỉ là
tài liệu. Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay trên production sau khi Vercel và Render deploy xong
(plan P4e-2, mục Nghiệm thu cuối: ẩn rồi hiện một điểm đến, đổi vùng của một
điểm đến và xem nó nhảy sang trang vùng khác).

Tests after: Vitest **4183** (web 1573, admin 1104, api 985, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **626 ở 44 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-24 — Vòng review F15: 28 mục, vá 25, ba mục để lại có lý do (nhánh `feat/p4e-2-destinations`)

Review chạy ở session gốc, mức cao nhất: mười góc tìm độc lập, mỗi ứng viên một
agent kiểm chứng, cộng một lượt quét sót. 28 ứng viên sau lọc trùng, 27 xác nhận
và 1 bị bác (hai kiểu `CategoryOption`/`DestinationOption` trùng hình dạng là có
chủ đích). Lượt quét thêm 1 mục khả nghi: mất focus bàn phím sau khi hộp thoại
đóng — đọc ra từ mã nguồn Base UI, chưa tái hiện trên trình duyệt.

**URL gõ tay làm sập `/tours`.** Ba đường: `?durations=__proto__` (nhãn chip tra
bảng i18n ra Object.prototype, React ném ngay lần render đầu — có từ trước),
`?destinations=__proto__` (phần bù của Task 9a đưa slug ấy vào bộ đếm facet —
mới ở nhánh), và một khoá lặp lại (Next 16 trả mảng, `parseList` gọi `.split`).
Vá ở biên: `listParam`/`singleParam` chuẩn hoá tham số cho `/tours` lẫn
`/blog`; bảng nhãn tra bằng `ownLabel` (`Object.hasOwn`), bộ đếm là object không
prototype, sort cũng thôi dùng `in`.

**Id ô tích trùng giữa hai facet.** `facet-<slug>` không kèm tên facet: danh mục
`cruise` có sẵn trong seed, nên `/tours?destinations=cruise` — hoặc một điểm đến
admin tạo trùng slug danh mục — làm bấm dòng điểm đến bật ô DANH MỤC. Id nay là
`facet-<facet>-<slug>`.

**Bốn câu của hộp Hide/Show nói sai hoặc thiếu.** (1) Câu về chuyến riêng của
vùng hứa ba con số cho cả ba vùng, trong khi miền Bắc chỉ có khu "How long have
you got", miền Trung chỉ có khu chuyến một ngày, miền Nam chỉ có ô "Longest
trip" — nay mỗi vùng một câu. (2) Hộp Show chép câu của danh mục "tours do not
change", sai với điểm đến. (3) Câu hộ chiếu bỏ sót khách có chuyến SẮP đi. (4)
Điểm đến chưa có vùng vẫn bị nói "rời các trang điểm đến". Thêm dòng con số
(About và `/tours` đếm điểm đến đang hiện).

**Đính chính entry F15 ngay dưới.** Câu "Hộp xác nhận Hide nói đủ các điều ấy"
sai ở About và dòng "across n destinations" — dòng con số mới là phần còn
thiếu. Còn câu G4 cũ "hộp xác nhận nói thẳng cả hai" về link blog là một bộ lọc
vô hình mà hộp không hề nhắc tới: phía web nay vá hẳn (blog giữ chip cho mọi slug
đang lọc, tên tra ở cả hai trục), nên G4 đóng.

**Web lệch dữ liệu khi ẩn điểm đến.** Hộ chiếu đếm "places visited" theo booking
mà chia cho số điểm đến đang hiện — ẩn một nơi có thể ra 105%; nay chỉ đếm điểm
đến đang hiện. Hộ chiếu cũng thôi giữ bảng tên vùng chép tay (khớp đúng từng
chữ, trượt khi DB ghi `north`), gọi `findRegion` của contract như ADR-0045 đã
chốt. Điểm đến ẩn không còn tour đang bán nào thì chip in slug viết thành chữ
("Phong Nha") thay vì slug máy, ở cả nhánh endpoint hỏng.

**API.** `errors` của oRPC là Proxy dựng lỗi cho MỌI mã, nên nhánh "mã procedure
không khai thì trả nguyên lỗi" của `toContractError` — và của `mapError` phía
chuyến — chưa từng chạy; spec cũ xanh vì dùng object giả. `declaredError` kiểm
bằng `Object.hasOwn`, spec ghim bằng bảng lỗi thật của oRPC. Sửa hay ẩn/hiện
điểm đến nay bust thêm `tour:<slug>` của mọi tour gắn nó (đóng G5). Lệnh tạo
thôi đếm tour cho hàng vừa tạo.

**Admin.** Nút mở hộp thoại khoá bằng `aria-disabled` (`focusableWhenDisabled`)
trong lúc bảng làm mới, để Base UI trả focus về được — điểm đến, danh mục, nút
Add của màn chuyến; năm màn khác cùng khuôn ghi thành G6. Câu "quá dài" nói
đúng biên ("N characters or fewer"). `<select>` vùng mặc bộ class export từ
`Input` của kit thay vì chép chuỗi.

**Test xanh giả, đã sửa:** ca điền sẵn quốc gia tự cấp "Vietnam" qua fixture;
ca "toast đọc từ response" có mock phản chiếu đúng request (cả danh mục); ca
int "link lọc vẫn chạy" chỉ có một tour nên không phân biệt được bỏ lọc; ca
`tourCount` "cùng câu ghi" đổi tên theo đúng điều nó chứng minh. Thêm ca biên
độ dài cho slug, tên, quốc gia.

**Ba mục để lại, có lý do.** Endpoint điểm đến hỏng đúng lúc làm mới thì thẻ
facet suy từ tour và một điểm đến đã ẩn hiện lại tới lượt render kế — thẻ tour
không mang cờ ẩn, vá tận gốc phải thêm field vào contract công khai cho một ca
chỉ xảy ra khi API trục trặc; ghi ở `resolveFacetOptions` và spec §4.6. Bản đồ
tên dựng lại mỗi lần bấm chip điểm đến: khoảng 50 tour, không đáng tối ưu. Hai
hàm copy trùng danh mục tự hết trùng khi hộp điểm đến đổi theo vùng.

Ba mươi đột biến, cả ba mươi bị test bắt (web 14, api 4, admin 12).

Tests after: Vitest **4183** (web 1573, admin 1104, api 985, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **626 ở 44 file**, jest mobile 159 và
mobile-ui 86.

## 2026-09-24 — F15 quản trị điểm đến, và web chịu được điểm đến đã ẩn (nhánh `feat/p4e-2-destinations`)

Vùng thứ ba của P4e, bản song sinh của F14: `/destinations` trong back office
(tạo, sửa, ẩn/hiện — không xoá), ba vùng miền dời về `@tourism/contract`, và
trang `/tours` của khách thôi in slug thô cho một điểm đến vừa bị ẩn. Sáu
commit, mỗi task một commit, thi công ở một session riêng theo đúng 21 bài học
mà vòng review F14 để lại ở đầu phần F15 của plan.

**Ba vùng là từ vựng của contract (ADR-0045).** `REGIONS`, `RegionNameSchema`
(cổng GHI: đúng ba tên) và `findRegion` (cổng ĐỌC: nhận cả tên lẫn khoá ngắn,
không phân biệt hoa-thường). `regionOf` của web gọi sang `findRegion` thay vì
giữ bản luật riêng — admin chọn sẵn ô vùng của form sửa bằng CHÍNH hàm ấy, nên
bảng admin và trang vùng không thể đọc cùng một hàng ra hai vùng khác nhau.
`mocks/regions.ts` chỉ còn tái xuất khẩu; `region-static-params.spec.ts` ghim
`generateStaticParams` trả đủ ba slug, và ghim web dùng CHÍNH mảng của contract.

**Đo trước, viết câu sau.** Bài học 10 bắt đo từng chỗ đọc `fetchDestinations`
trước khi viết câu cảnh báo của nút Hide. Đo được 7 lời gọi ở 7 trang, tỏa ra
14 hệ quả — bảng ở spec §4.6. Bản spec đầu chỉ kể ba (trang vùng, tile,
facet); bảng đo thêm trang chủ, About, blog, hộ chiếu của khách, và một hệ quả
không ai đoán ra: tour có điểm đến ấy là điểm DUY NHẤT trong vùng thì rời lưới
tour của trang vùng. Hộp xác nhận Hide nói đủ các điều ấy, rồi trấn an bằng
câu giọng trung tính: tour vẫn bán, vẫn in điểm đến trên lộ trình, link cũ vẫn
lọc được.

**Web chịu được điểm đến đã ẩn (Task 9a).** Đúng cái lỗ danh mục vừa vá:
`resolveCategoryOptions` tổng quát thành `resolveFacetOptions`, thêm
`resolveDestinationOptions` (tên tra từ MỌI điểm dừng của tour). Trang listing
truyền `null` khi endpoint hỏng thay vì `[]` — nhánh cũ vừa xoá sạch thẻ
Destination vừa in "across 0 destinations" lên hero.

**Màn quản trị.** Ô vùng là `<select>` gốc ba mục đọc thẳng `REGIONS`; form
sửa chọn sẵn tên CHUẨN, nên một hàng lưu kiểu cũ lưu lại là đúng tên; cột
Region báo "No region" khi chuỗi trong DB không khớp vùng nào — ca mà ADR-0045
mô tả là "biến khỏi mọi trang vùng mà không có lỗi nào ở đâu cả". Ô slug điền
sẵn bằng `slugifyVietnamese(name, 80)`, vắng ở form sửa, tắt soát chính tả.
Nút Hide/Show giữ chỗ bằng `StableLabel`.

**Rút chung ở bản thứ ba** (bài học 4, 6, 7, 11, 20):

- `SLUG_PATTERN` + `slugSchema(max)` về `slug.ts`, `descriptionSchema(max)`
  (rỗng thành `null`) về `common.ts` — danh mục đổi sang dùng, câu lỗi giữ
  nguyên.
- `ContractError` + `toContractError` ở `apps/api/src/lib/contract-error.ts`:
  lỗi mang mã, N nhánh `instanceof` gập thành một, vẫn nhận diện bằng
  `instanceof`. Danh mục chuyển sang dùng, 26 ca int cũ vẫn xanh.
- `hasFormErrors` về `apps/admin/src/lib/form-errors.ts`, danh mục đổi sang
  dùng.
- Hide/Show/Visible/Hidden, câu lỗi slug và câu gợi ý slug thành hằng ở đầu
  `messages.ts`; hai bảng đọc cùng hằng.

Bản của departures (`mapError`, `hasFormErrors`) GIỮ NGUYÊN, có chủ đích:
code departures của F16 nằm ngoài phạm vi F15. Nợ G3 vì thế mới đóng hai trên
ba bản.

**Lệch plan, đã ghi tại bước của plan:** luật so khớp vùng dời về contract
cùng ba vùng (plan chỉ kể ba giá trị và schema); `MockRegion`/`MockRegionKey`
thành bí danh của kiểu contract; mặc định `country: 'Vietnam'` chỉ ở lệnh tạo
(lệnh sửa bắt buộc gửi, không lặng lẽ ghi đè); schema HÀNG để `slug` và
`region` lỏng (output chặt thì một hàng kiểu cũ làm cả bảng sập 500); ca ghim
`generateStaticParams` XANH từ trước khi dời — cái đỏ ở web là ca so tham chiếu.

**Test xanh giả bắt được trong lúc làm:** lượt chạy đỏ của int spec lộ ba ca
xanh sẵn khi route chưa tồn tại (route lạ cũng trả 404 kèm `NOT_FOUND`), nên hai
ca 404 nay khớp câu của contract; seed int đặt tên sắp ngược slug để ca "sắp
theo tên" phân biệt được; ca "hai bảng báo cùng một câu lỗi slug" chỉ so câu
đầu nên để lọt một luật gắn thêm — nay so cả danh sách; ca component của web ban
đầu không canh số tour trên ô được bù.

**Không có việc hạ tầng.** Không migration (bảng `destinations` đã đủ cột),
không env mới, không webhook.

CÒN TREO cho session review:

- Merge (rebase + ff), CI (luật 14), rồi thử tay trên production mỗi lượt một
  bước: đổi vùng của một điểm đến và xem nó nhảy sang trang vùng khác; ẩn một
  điểm đến rồi mở `/tours?destinations=<slug>` (chip in tên, ô đang tích bỏ
  được); bật lại. Nhớ lượt seed lại prod khoảng 03/11 xoá mọi dữ liệu tạo tay.
- Hai hệ quả của nút Hide chưa vá, chỉ nói trong hộp xác nhận: `/blog` chuyển
  tag trùng slug từ trục Places sang Topics (link `?place=<slug>` vẫn lọc nhưng
  hết ô để bỏ), và hộ chiếu của khách mất mục điểm đến đã ẩn khỏi sổ hành trình.
- Đổi TÊN một điểm đến bust tag `tours` nhưng không bust `tour:<slug>` của các
  tour gắn nó: trang chi tiết tour giữ tên cũ tới hết lượt ISR 300 giây.

**Review findings:** chưa chạy vòng review riêng cho F15.

Tests after: Vitest **4152** (web 1552, api 983, admin 1096, contract 419,
core 46, ui 22, tokens 18, i18n 16), int **625 ở 44 file**, jest mobile 159.
Thêm 108 ca Vitest (contract 43, admin 49, web 11, api 5) và 20 ca int. Đột
biến: mười ở Task 6, mười hai ở Task 7, mười lăm ở Task 8, mười ở Task 9a, hai
mươi hai ở Task 9 — cả 69 đều bị giết.

## 2026-09-23 — Thử tay F16 trên production (`d5b519a5`): 7/7 bước đạt, không phải vá

Chạy khi cả hai nơi đã deploy xong: admin trên Vercel, API mới trên Render khởi
động lúc 13:02 UTC. Connector Render đòi chọn workspace, nên mốc Render đo bằng
`uptimeSec` của `/api/health`. Bảy bước, mỗi bước chờ người thử xác nhận; mỗi
lệnh ghi đều đối chiếu thẳng với DB production. Phủ đủ các ý của spec §6.

Hai tour thử chọn bằng một câu SQL chỉ đọc, tính giai đoạn ngay trên DB:
`central-honeymoon-5d` có đủ ba giai đoạn chính (3 chuyến sắp đi, 1 chuyến đang
chạy 22/09 → 26/09, 5 chuyến đã về); `ha-giang-loop-4d` có một chuyến quá hạn
chót mà chưa đi (khởi hành 24/09) và hai chuyến đã huỷ.

1. **Huy hiệu và nút.** Chuyến đang chạy ghi *Departed*, chỉ còn Edit, và nút
   ấy thẳng cột với Edit của mọi hàng. Chuyến sắp đi ghi *Bookable* đủ ba nút,
   chuyến đã về ghi *Completed*.
2. **Tab lọc.** Upcoming 3, Departed 1, Completed 5, Cancelled rỗng kèm câu báo.
   URL mang `?phase=…`; về All thì tham số biến mất.
3. **Quá hạn chót mà chưa đi.** Chuyến 24/09 ghi *Deadline passed* (hạn 17/09
   "Passed") và vẫn còn Close, vì có thể còn khách đang trả tiền dở. Hai chuyến
   đã huỷ ghi *Cancelled*, không có nút nào.
4. **Đóng** chuyến 25/12 (0 booking): toast câu mới, hàng ghi *Closed* kèm
   Reopen bấm được, vẫn nằm ở tab Upcoming. DB `CLOSED`.
5. **Mở lại:** thân hộp xác nhận và toast đều là câu mới, hàng về *Bookable*.
   DB `OPEN`.
6. **Tắt đăng tour.** Không tour nào đang ẩn, nên tạm tắt Hà Giang Loop như spec
   §6 cho phép. Trang Tours ghi 3 kèm "Hidden while off sale".
7. **Dòng báo tour chưa đăng.** Màn chuyến hiện khung "This tour is off sale",
   bảng giữ nguyên. Bật đăng lại thì khung biến mất.

**Cuối lượt DB khớp trạng thái gốc.** Tour `is_published = true` (tắt khoảng
hai phút rưỡi, 13:17 → 13:20 UTC), chuyến 25/12 về `OPEN`, tám chuyến còn lại
không đổi từ lượt seed 18/09. Trang khách `/tours/ha-giang-loop-4d` trả 200 kèm
tên tour ngay sau khi bật lại.

DB xác nhận thêm một điều: ba chuyến đã về của Hà Giang Loop vẫn ghi `CLOSED` ở
cột `status` mà màn hình ghi *Completed* — đúng như ADR-0046 định: không sửa
seed, giai đoạn suy từ ngày.

**Review findings:** không có. Lượt thử không tìm ra lỗi nào, nên không có nhánh
vá.

Tests after: không đổi code, số test giữ như entry merge F16 ngay dưới.

## 2026-09-23 — Merge F16 lên main (`fc704e3a`)

Nội dung đã kể ở HAI entry ngay bên dưới — "Vòng review F16" và "F16 giai
đoạn chuyến khởi hành". Entry này chỉ ghi sự kiện merge, vì hai entry kia viết
TRƯỚC merge nên chưa mang hash.

Nhánh `feat/departure-phase` rebase lên `2711e755` (bản vá web tính "hôm nay"
theo ngày lịch Việt Nam, từ một session riêng) rồi fast-forward: 8 commit. Xung
đột duy nhất ở CHANGELOG, vì hai bên cùng thêm entry vào đầu file — giữ cả hai,
entry F16 nằm trên. `pnpm gate:int` chạy lại xanh trên đỉnh mới trước khi đẩy.
Không migration, không đổi env, nên không có bước hạ tầng nào.

Việc còn lại: thử tay trên production sau khi Vercel và Render deploy xong
(spec §6).

Tests after: Vitest **4044** (web 1541, api 978, admin 1047, contract 376,
core 46, ui 22, tokens 18, i18n 16), int **605 ở 43 file**, jest mobile 159.

## 2026-09-23 — Vòng review F16: mười lăm phát hiện, vá trọn (nhánh `feat/departure-phase`)

Review chạy TRƯỚC merge, ở mức cao nhất: mười góc tìm độc lập, mỗi ứng viên
một agent kiểm chứng, cộng một lượt quét sót. Sau lọc trùng còn 22 ứng viên, ba
bị bác khi kiểm chứng. Mười lăm phát hiện vào bảng, vá cả mười lăm.

**Ba ứng viên bị bác, và vì sao.** (1) Cho luật "đã khởi hành" gọi
`canCancelOnline` thay vì tự so ngày: "đã đi" là một sự thật về lịch, nếu luật
huỷ đổi thì huy hiệu KHÔNG được đổi theo. (2) Gộp `showToggle` với `canCancel`
vì luôn bằng nhau: hai luật khác nhau, một gương server, một luật giao diện.
(3) Tab All đọc hết lịch sử chuyến: spec đã chấp nhận, mỗi tour khoảng 10 chuyến.

**Hai lỗi lúc chạy thật.**

1. **Khe deploy làm trang Departures sập.** Vercel thường xong trước Render.
   Trong vài phút ấy admin mới đọc API cũ, dựng `<undefined />` ở ô Status, và
   React ném: 500 cho mọi tour có chuyến. Tour không có chuyến thì hiện câu báo
   "chưa đăng" nhầm. Changelog 09/2026 đã ghi đúng bài học này (field bắt buộc
   mới phải có đường lùi phía đọc) mà spec §7 lại chấp nhận rủi ro. Nay ô Status
   để trống, hàng thiếu `phase` không mời đóng hay huỷ, câu báo chỉ hiện khi
   `isPublished === false`, và thiếu `today` thì lùi về đồng hồ server admin.
2. **Hai đồng hồ trên một hàng.** Huy hiệu tính bằng `now` của API, còn chữ
   "Passed" và nút Reopen đọc đồng hồ riêng của trang. Quanh nửa đêm cùng một
   hàng vừa xanh vừa "Passed". Nay `admin.departures.list` trả `today` của
   chính lượt đọc, và cả màn đọc nó.

**Chữ gây hiểu nhầm.**

3. **"On sale" trùng chữ công tắc đăng tour** ở trang Tours: tour đang tắt hiện
   "Off sale" ở đó mà mọi chuyến của nó ghi "On sale" ở đây. Huy hiệu đổi thành
   **"Bookable"** (người dùng chọn "ngắn gọn, dễ hiểu"), khớp cột "Bookable
   departures" sẵn có. Mọi copy cấp chuyến thôi nói "on/off sale"; câu báo tour
   chưa đăng nói bằng chữ của trang Tours; toast tạo chuyến đọc giai đoạn từ
   response, không hứa "bookable" cho chuyến vừa tạo đã quá hạn.
4. **Trang Tours đếm "bookable" cả tour tắt bán**, ngược với câu báo ở màn
   chuyến. Nay có câu phụ "Hidden while off sale", và bộ đếm gọi chính
   `departurePhase` để luật chỉ sống ở một chỗ.
5. **Chú thích đầu VM nói server chặn Close sau khởi hành** — thật ra chỉ giao
   diện chặn (ADR-0046 cố ý không thêm mã lỗi). Viết lại, kèm một ca int ghim
   rằng server vẫn nhận Close ngày khởi hành, để không ai nới chỗ ẩn nút.
6. **Docstring "on-sale = khách còn đặt được" nói quá** cả hai chiều: chuyến kín
   chỗ vẫn xanh, còn chuyến quá hạn vẫn có thể nhận khoản trả trễ.

**Gọn lại.**

7. Ba cờ `showToggle`/`canClose`/`canReopen` cộng chiều gửi mà component tự suy
   từ `status` gộp thành một field `toggle`. `canClose` từng luôn `true` ở mọi
   chỗ nó được đọc. Hộp đóng/mở nay chụp chiều lúc bấm, nên không đổi chiều khi
   bảng vẽ lại dưới chân nó (admin khác vừa đóng chuyến).
8. Ba tab một-giai-đoạn mượn nhãn và icon của huy hiệu thay vì khai lại.

**Test và fixture.**

9. Helper fixture tính cả `phase` lẫn hạn chót bằng chính hàm contract. Fixture
   `SAVED` từng ghi hạn chót 24/11 cho chuyến mà contract tính ra 28/11.
   `makeDepartureRow`, `serverRow`, `vmAt` thay ba bản chép tay.
10. Ca int "mỗi hàng đúng giai đoạn" so cặp theo thứ tự và ghim `total`, thay
    cho `Object.fromEntries` gộp mất hàng trùng.
11. `khongPhase` đổi thành `missingPhase` (luật 8: identifier tiếng Anh).

**Tài liệu lỗi thời (12–15):** glossary còn định nghĩa `status` kiểu cũ; JSDoc
row-actions nói "không có nút huỷ"; comment trang mồ côi nói Close đổi tab; mô
tả route contract, JSDoc `phaseOf` và JSDoc tháng ở trang Tours. Cộng ADR-0046
AMEND 1 (nhãn Bookable, một đồng hồ, công tắc không còn hiện từ ngày khởi hành)
và sửa bảng cổng thiếu điều kiện tour đã đăng; spec §2–§7 theo code.

**Vá kèm ngoài bảng:** bỏ tham số `now` thừa của `rowById`; `TOGGLE_LABELS`
dùng chung cho nút thật và ô giữ chỗ; đổi tên ca int "đóng sớm không hứa gì với
ai" vốn nói ngược ADR-0046.

**Ngoài phạm vi, đã tách việc:** khu account web tính "hôm nay" theo UTC. Một
session riêng đã vá và đưa lên `main` (`144e4f23` tới `2711e755`).

**Để lại, có lý do:** ca int có thể chập chờn đúng lúc 00:00 giờ Việt Nam (cửa
sổ vài chục mili-giây, cùng kiểu với các ca cũ). Ca `zod-config.spec.ts` của
contract hết giờ 5 giây khi chạy 16 worker trên máy này, xanh với 4 worker và
trên CI — không dính F16.

Bảy đột biến đều bị test bắt.

Tests after: Vitest **4036** (web 1533, api 978, admin 1047, contract 376,
core 46, ui 22, tokens 18, i18n 16), int **605 ở 43 file**. Ca mới: admin 12,
contract 1, int 1; hai ca int viết lại cho đúng.

## 2026-09-23 — F16 giai đoạn chuyến khởi hành (nhánh `feat/departure-phase`)

Màn Departures của admin thôi in cột `status` làm trạng thái chuyến. Lượt thử
tay F14 (23/09) cho thấy người đọc hiểu nhầm nó theo hai cách: chuyến đang
chạy vẫn ghi Open, và chuyến đã về ghi Closed khiến người xem tưởng hệ thống tự
đóng chuyến. Quyết định ở ADR-0046: `status` chỉ là công tắc bán hàng, còn giai
đoạn SUY từ ngày bằng một hàm thuần ở contract. Không migration, không job,
không đổi cổng tiền.

**Sáu huy hiệu.** `departurePhase` ở `@tourism/contract` là chỗ duy nhất giữ
luật: Cancelled, Completed, Departed, Closed, Deadline passed, On sale, xét
theo đúng thứ tự ấy và theo lịch Việt Nam. API tính `phase` cho từng hàng với
MỘT mốc `now` mỗi lượt xử lý; admin chỉ in `row.phase`, không gọi hàm (ngoại
lệ duy nhất là helper fixture `apps/admin/src/test/departure-row.ts`). Huy hiệu
dùng biến thể có sẵn của `Badge` kèm icon, xanh đặc đúng một chỗ là On sale.

**Năm tab lọc theo nhóm.** All, Upcoming, Departed, Completed, Cancelled — URL
`?phase=`. API lọc TRONG BỘ NHỚ bằng chính `departurePhase` rồi mới cắt trang,
nên `total` đếm sau khi lọc. URL cũ `?status=OPEN` rơi êm về All.

**Nút đóng/mở nhường chỗ từ ngày khởi hành.** Hàng Departed và Completed chỉ
còn Sửa; ô nút đóng/mở thành một `span` `aria-hidden` mượn lớp của nút để cột
vẫn thẳng. Quá hạn chót mà chưa đi thì Close vẫn bấm được, vì checkout mở
trước hạn có thể đang dở. Nút huỷ chuyến nay đọc cùng `phase` với huy hiệu
thay vì so `today` của trang.

**Dòng báo tour chưa đăng.** `AdminDepartureTour` thêm `isPublished`; màn
chuyến hiện một `Alert` với `role="status"` ngay dưới tiêu đề khi tour chưa
đăng, vì chuyến On sale của tour đang ẩn vẫn không ai đặt được.

**Lệch plan, đều nhỏ:**

1. Task 1: spec viết theo plan đỏ typecheck (TS2345) vì callback `it.each`
   nhận hai tham số trong khi tuple có ba — thêm tham số `_why`, cùng nếp
   `_label` plan dùng ở Task 4.
2. Task 2 B2: bốn ca đỏ chứ không phải ba — ca "key `status` cũ bị bỏ qua"
   cũng đỏ vì schema cũ vẫn nhận `status`. Đúng lý do.
3. Task 4: sửa thêm JSDoc của `canClose` và `canCancel` trong `DepartureRowVM`,
   vì câu cũ ("đóng lúc nào cũng được, trừ khi đã huỷ") thành sai sau F16.
4. Task 4 B3 và B11: đỏ vì B1 đã xoá `t.status` và B4 đã bỏ
   `departureStatusBadgeVariant`, nên ca cũ nổ `TypeError` cùng lúc với ca mới
   — vẫn là lý do "VM và bảng còn đọc công tắc".
5. Task 5 B7: đảo điều kiện `isPublished` làm đỏ hai ca chứ không phải ba — ca
   "không phải `alert`" vẫn xanh vì khi đảo thì không có `Alert` nào được
   dựng. Đột biến vẫn bị bắt.

**Review findings:** chưa review — session gốc review trước merge.

Tests after: Vitest **4023** (web 1533, api 978, admin 1035, contract 375,
core 46, ui 22, tokens 18, i18n 16), int **604 ở 43 file**. Ca mới: contract
22, admin 22, int 8 (thêm chín, bỏ ca "lọc theo trạng thái"). Hai mươi đột
biến đều bị giết: tám ở `departurePhase`, ba ở `list` và `toTour`, hai ở tab
lọc, năm ở huy hiệu và nút, hai ở dòng báo.

## 2026-09-23 — Web tính "hôm nay" theo ngày lịch Việt Nam, khớp server và admin (nhánh `fix/web-vietnam-today`)

Phát hiện ở vòng review F16, ngoài phạm vi F16. `todayDateString()` của web cắt
ngày theo UTC, trong khi mọi cổng phía server đo bằng ngày lịch Việt Nam
(ADR-0041 §7) và màn Departures của admin cũng tính giai đoạn chuyến theo ngày
ấy (ADR-0046). Từ 00:00 tới 07:00 giờ VN mỗi ngày, trang account chậm một ngày:
in "còn 1 ngày" cho chuyến server đã thôi cho huỷ online và admin đã ghi
Departed; hôm sau ngày về thì admin ghi Completed mà web vẫn "Ends …" và ẩn
Review. Câu "web vốn đã tính theo ngày" ở ADR-0046 đúng về NGÀY, nhưng thước vẫn
là UTC cho tới bản vá này.

**Rà mọi chỗ web tự tính ngày quanh booking và chuyến đi:**

| Chỗ | Trước | Sau |
| --- | --- | --- |
| `todayDateString()`: nhóm journey, accordion (đã đi/đã về, đếm ngược, `canPay`, `canReview`), hộ chiếu | ngày UTC | `vietnamToday(new Date())` |
| Cuống receipt "Departs/Departed" | `new Date(ngày về) < giờ thật`, đổi chữ lúc 07:00 giờ VN của ngày về | từ NGÀY ĐI theo lịch VN, cùng nghĩa `departed` của admin |
| `itineraryDayState` (lịch trình chế độ live, chưa bật ở đâu) | getter UTC | quy `today` về ngày VN |
| `reviewSlot` (form review ở trang chi tiết) | ngày UTC | **giữ UTC có chủ đích**, thêm JSDoc và test ghim |
| Date picker của form chuyến riêng | nửa đêm giờ trình duyệt | giữ: chỉ ràng buộc UI, server không có luật ngày nào cho `travelDate` |
| Năm "member since" ở `/account` | năm UTC | giữ: trang trí, không quyết gì |
| Ngày của mốc đã qua (Booked, Paid, yêu cầu huỷ cũ) | cắt theo UTC | giữ: chỉ hiển thị, khớp email vốn cũng format UTC |

**Vì sao `reviewSlot` giữ UTC.** Nó là bản chép của `checkReviewEligibility`,
mà cổng ấy giữ UTC có chủ đích ([ADR-0009 AMEND 3](adr/0009-refund-correctness.md)).
Đổi riêng web sang ngày VN là mở form từ 00:00 giờ VN của ngày về, trong khi API
tới 07:00 mới nhận: khách gõ xong bài mới bị từ chối. Link Review của accordion
vẫn an toàn: nó chỉ hiện từ hôm sau ngày về theo giờ VN, lúc ấy ngày UTC ít nhất
đã tới ngày về. Trước đây không test nào canh chuyện này; đột biến `reviewSlot`
sang `vietnamToday` nay làm đúng ca ghim đỏ.

**Receipt đổi neo, không chỉ đổi thước.** Code gốc neo "Departed" vào NGÀY VỀ,
nên suốt một chuyến nhiều ngày voucher vẫn ghi "Departs". User chốt ở vòng
review: "Departed" từ ngày khởi hành (`departureStartDate <= hôm nay`), để một
chữ chỉ có một nghĩa trên cả sản phẩm.

**Review findings** (một reviewer độc lập, 0 critical): một important là neo
của receipt (user chốt như trên). Minor đã sửa: trích dẫn sai "ADR-0009 AMEND 2"
(câu giữ UTC nằm ở AMEND 3), một câu JSDoc nói quá rộng, và test ghim review
thêm mép 23:59:59.999Z. Bỏ qua có lý do: trang `/account/bookings` gọi
`todayDateString()` hai lần (cách nhau vài micro giây, có từ trước), và
`canPay` của accordion lỏng hơn cổng `reCheckout` (có từ trước, không dính múi
giờ).

Không migration, không đụng hạ tầng. Bốn commit `144e4f23` · `06add356` ·
`cf7fd833` · `d8664032`.

Tests after: Vitest **3987** (web 1541, api 978, admin 1013, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**, jest mobile 159.
Tám ca mới ở web: năm ca đỏ trên code cũ trước khi sửa (cùng ca đếm ngược viết
lại); ba ca còn lại là mép trái hoặc ghim nên xanh sẵn theo thiết kế, và ca ghim
review đã kiểm bằng đột biến.

## 2026-09-23 — Thử tay F14 trên production: 8/8 bước đạt, bốn mục vá (nhánh `fix/p4e-2-f14-manual-test`)

Lượt thử tay chạy NGAY sau merge F14 thay vì đợi F15 như plan ghi: F14 đã
chạy thật, còn F15 sẽ chép lại cách làm của nó, nên lỗi tìm được lúc này là
lỗi F15 khỏi phải lặp. Tám bước, mỗi bước chờ người thử xác nhận, và sau mỗi
lệnh ghi thì đối chiếu thẳng với DB production.

**Không tạo danh mục thật.** Hệ thống cố ý không có nút xoá, nên một hàng
"test" sẽ nằm lại vĩnh viễn, kể cả lúc bảo vệ. Thay vào đó:
`seasonal-classics` (đang ẩn sẵn, 0 tour) để thử chip không có tour, và ẩn rồi
hiện `trekking` (5 tour) để thử đường "danh mục đã ẩn". Form tạo vẫn được kiểm,
chỉ là bấm Cancel. Cuối lượt DB khớp TUYỆT ĐỐI trạng thái gốc — sáu `order`
không trùng, trạng thái bật/tắt và số tour như cũ.

**Ba lỗi của vòng review F14 ở đường "ẩn danh mục" — đã kiểm tận mắt là hết.**
Link cũ `/tours?categories=trekking` vẫn lọc đúng 5 tour, chip đang bật in
"Trekking & Adventure" chứ không phải slug, ô facet được bù vào cuối và đang
tích nên bỏ được. Menu lọc bên back office vẫn có danh mục đã ẩn. Đường nối
"thứ tự admin đặt → thứ tự chip của khách" chạy đúng từ đầu tới cuối.

**Bốn mục lượt thử tìm ra, đã vá cả bốn:**

1. **Cụm nút lệch cột** (góp ý của người thử). Hide và Show rộng khác nhau, mà
   cụm nút canh phải, nên hàng mang nhãn hẹp hơn kéo mũi tên và nút Edit lệch
   khỏi cột. Màn chuyến khởi hành lệch nặng hơn: nút "Cancel departure" chỉ có
   ở hàng chưa khởi hành. Người thử đề xuất tách mỗi nút một cột bảng. Bản vá
   xử cùng cái gốc mà không phải xẻ `DepartureRowActions` — component chứa nút
   huỷ chuyến có hoàn tiền — chỉ để sửa bố cục: mỗi ô nút luôn chiếm bề rộng
   của trạng thái rộng nhất của nó (kit `StableLabel` mới), và hàng thiếu nút
   huỷ giữ một ô trống cùng cỡ.
2. **Câu lỗi slug nói sai luật.** Câu cũ bảo gạch nối được phép, trong khi gõ
   đúng một dấu `-` lại bị từ chối — vòng review siết khuôn slug mà câu báo
   lỗi không theo kịp. Câu mới kèm một ví dụ, và có ca test ghim rằng ví dụ ấy
   hợp lệ.
3. **Ô slug bị soát chính tả** — trình duyệt gạch đỏ `dao-phu-quoc`. Đã tắt,
   cùng tự viết hoa và tự sửa chữ trên bàn phím điện thoại.
4. **Câu cảnh báo trấn an mà tô đỏ.** Hộp ẩn danh mục tô đỏ cả câu "tour vẫn
   bán, link vẫn chạy" — màu nói ngược với chữ. Kit `ConfirmWriteDialog` nhận
   thêm `warningTone`, mặc định vẫn đỏ; hộp danh mục xin giọng trung tính. Kèm
   theo: menu lọc danh mục ở `/tours` nay đánh dấu "(hidden)" cho danh mục đã
   ẩn, để admin biết vì sao nhóm tour ấy không có chip trên web.

**Một lỗ test lượt đột biến bắt được:** `fetchTourCategories` chưa từng có
test, nên gán cứng `isActive: true` ở đó thì dấu (hidden) chẳng bao giờ hiện
mà không ca nào đỏ. Thêm spec theo khuôn mock client của `bookings.spec.ts`.

**Bố cục cần mắt người.** jsdom không dàn trang, nên việc cụm nút đã thẳng cột
chưa được test tự động nào chứng minh — bước kiểm cuối là nhìn trên production
sau khi deploy.

Plan F15 cập nhật theo: bài học 8 ghi câu lỗi slug đã sửa, thêm bài học 13
(`StableLabel`) và 14 (`warningTone`).

**Review findings:** không có vòng review riêng — đây là bản vá từ lượt thử tay.

Tests after: Vitest **3979** (web 1533, api 978, admin 1013, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới ở
admin. Tám đột biến đều bị giết.

## 2026-09-23 — Merge F14 lên main (`892de4e8`)

Nội dung của lượt merge này đã kể đủ ở HAI entry ngày 22/09 ngay bên dưới —
"F14 quản trị danh mục tour" và "Vòng review F14". Entry này chỉ ghi sự kiện
merge, vì hai entry kia viết TRƯỚC merge nên chưa mang hash.

Nhánh `feat/p4e-2-categories` rebase lên `fa297460` (bản dọn `isValidDate` từ
một session song song) rồi fast-forward: 11 commit, không xung đột,
`pnpm gate:int` chạy lại xanh trên đỉnh mới trước khi đẩy. Không migration,
nên không có bước Supabase nào.

**Vì sao cần entry này — và vì sao CI lần đẩy đầu đỏ.** `docs-freshness.sh`
lọc commit theo NGÀY COMMIT (`git log --since`). Rebase ghi lại ngày commit
của cả 11 commit thành ngày rebase (23/09), còn entry mới nhất vẫn mang ngày
làm việc (22/09) — nên script thấy tám commit `feat`/`fix` "mới hơn" entry
cuối và đỏ, dù nội dung đã được kể. Bẫy này sẽ lặp lại MỖI KHI một nhánh viết
entry hôm trước rồi rebase-và-merge hôm sau. Cách tránh: viết entry vào đúng
ngày merge, hoặc thêm một entry merge ngắn như entry này.

Tests after: không đổi so với entry vòng review — Vitest **3964**, int
**596 ở 43 file**, đo lại trên đỉnh sau rebase.

## 2026-09-22 — Vòng review F14: mười lăm phát hiện, ba nhóm, ba cái gốc (nhánh `feat/p4e-2-categories`)

Vòng review chạy TRƯỚC merge, mười góc tìm cộng một lượt quét sót. Mười lăm
phát hiện, nhưng chúng gom về ba gốc chứ không phải mười lăm chỗ vá.

**Gốc thứ nhất — không ai bảo đảm mỗi lúc chỉ một người ghi thứ tự.** Năm phát
hiện quanh cột `order`. `move` đọc hai hàng RỒI mới `SELECT … FOR UPDATE`, nên
khoá xếp hàng người ghi mà không bảo vệ giá trị đã đọc: hai lượt trên hai cặp
giao nhau — (2,3) và (3,4) — để lượt sau ghi bằng ảnh chụp cũ, và vì cột ấy
không unique nên hai hàng cùng số sống chung im lặng, vĩnh viễn. JSDoc ngay
trên hai câu UPDATE khẳng định ngược lại. `create` tính `max + 1` cũng đua.
`assertSlugFree` là SELECT pre-flight, mà READ COMMITTED không serialize hai
INSERT — nên slug trùng thoát ra thành `P2002` trần, tức 500, tức admin phân
loại `GENERIC` rồi mất cả form vừa gõ. Và cờ đổi-chỗ ở phía client là state
của MỘT hàng, nên một admin bấm nhanh hai hàng là đủ gây đua, không cần hai
người.

Vá bằng một câu thay vì ba miếng dán: `withCategoryOrderLock`, khoá advisory
cấp bảng, cùng khuôn `withBookingRefundLock` (ADR-0006 AMEND 2b). Mọi lệnh đọc
nằm SAU khoá theo CẤU TRÚC, nên `move` hết stale read, `create` hết đua, và
`assertSlugFree` từ một lời hứa hão thành đúng thật. `FOR UPDATE` thô, phép
`.sort()` theo id và nhánh `CannotMoveError` không-thể-xảy-ra chết theo. Ba
lớp lưới cho đường không đi qua khoá: bắt `P2002`, bắt `P2025` (thay
`assertExists` + `update` vốn là check-then-act, bớt luôn một vòng mạng), và
khoá phụ `{ id: 'asc' }` ở cả hai đường đọc danh mục.

**Gốc thứ hai — web và admin đọc `is_active` bằng hai nghĩa khác nhau.** Ba
phát hiện. Menu lọc `/tours` của chính back office vẫn đọc endpoint CÔNG KHAI,
nên từ khi F14 có nút Hide, ẩn một danh mục là mất luôn cách lọc ra các tour
thuộc nó để đi sửa — đúng lúc cần nhất. Ở trang khách, một danh mục vừa ẩn thì
chip đang bật in slug máy và thẻ facet không có ô nào để bỏ tick, dù link cũ
vẫn lọc đúng. Và câu phụ đề "thứ tự ở đây là thứ tự khách nhìn thấy" nói sai,
vì bảng admin xen cả hàng ĐÃ ẨN còn trang khách lọc chúng đi.

Vá: menu back office đổi sang `admin.categories.list` (JSDoc ở đó đã hẹn
"P4e-2 sẽ thay nguồn" — P4e-2 chính là nhánh này). Trang khách tách "danh sách
chip nào tồn tại" khỏi "chip đang bật tên là gì", gom vào `resolveCategoryOptions`;
hàm ấy cũng phân biệt lời gọi HỎNG (`null`) với mảng rỗng hợp lệ, nên một lượt
500 của `/api/categories` không còn xoá sạch thẻ facet khỏi trang đang sống.
Câu phụ đề viết lại cho đúng.

**Gốc thứ ba — chỗ tự gây, và mấy cái nói sai.** `slugifyVietnamese` nuốt mất
`Ð`/`ð` (U+00D0, ETH) vì chỉ xử `Đ`/`đ` (U+0110): hai cặp vẽ y hệt nhau mà
TCVN3/VNI vẫn sinh ra cặp đầu, nên admin thấy tên ĐÚNG còn slug mất chữ đầu —
và slug khoá vĩnh viễn sau khi tạo. Regex dấu phụ viết bằng ký tự tổ hợp THÔ,
vô hình với mắt lẫn với diff; đo bằng `cat -A` thì viết escape cũng không
thoát, công cụ ghi file đổi nó thành ký tự thô, nên chuyển hẳn sang `\p{M}` và
dựng bốn ký tự D-có-gạch từ MÃ SỐ. `boDauTiengViet` đổi tên (luật 8 đòi
identifier tiếng Anh) và nuốt luôn bản trùng ở `apps/web/src/lib/text.ts`.
Khuôn slug siết lại — bản cũ nhận `-`, `---`, `-day-`; đã đo sáu slug đang
chạy trên production, tất cả đều qua. Mô tả rỗng nay thành `null` thật, đúng
như JSDoc của chính nó vẫn hứa. Bốn comment khai "Task 5 chưa làm" — sai từ
một commit CÙNG NHÁNH.

**`views={null}` sửa ở KHUNG, không ở call site.** Hàng điều khiển là
`justify-between` với đúng hai con, nên `views` rỗng làm cụm nút dạt sang
TRÁI, lệch với mười bảng còn lại. Khung nay tự bọc khe trái.

**Ba test xanh giả.** Ca int "hai lượt đối đầu" bắn `move(2,'down')` +
`move(3,'up')` — cùng MỘT phép đổi chỗ, nên không interleaving nào làm nó đỏ
được, kể cả khi gỡ sạch khoá. `expect(move).not.toHaveBeenCalled()` nằm trong
một ca không bấm gì. Ca contract "KHÔNG nhận số thứ tự" xanh vì thiếu
`direction` bắt buộc, chẳng liên quan tới `order`. Cả ba viết lại; khối guard
của int spec cũng thiếu `update`, nay đủ năm đường cộng một ca 401.

**Dọn.** `Field` chép nguyên văn giữa hai dialog về kit thành `FormField`,
trước khi màn `/destinations` của F15 chép lần thứ ba. Regex slug phía admin
thôi chép tay. Gỡ `isMoveStale`, `CategoryRowVM.order`, hai khoá i18n
`move.up`/`move.down`. JSDoc của `departures` về đúng key nó mô tả.

**Ba món ghi vào sổ nợ** (`open-items.md` G1–G3), có chủ đích chứ không bỏ
quên: payload `move` mà client vứt đi (tiêu thụ nó cần hai nguồn sự thật cho
một bảng sáu hàng), 23 bản chép `sessionCookie` trong int spec, và hai bản
`mapError` đáng rút chung khi F15 thêm bản thứ ba.

**Review findings:** 15 phát hiện, tất cả CONFIRMED, tất cả đã vá.

Tests after: Vitest **3964** (web 1533, api 978, admin 998, contract 353,
core 46, ui 22, tokens 18, i18n 16), int **596 ở 43 file**. Mười lăm ca mới.
Đo đột biến từng cụm: gỡ khoá khỏi `move` hay `create` → đỏ 3/3 lượt; mười ba
đột biến còn lại ở contract, admin và web đều bị giết.

## 2026-09-22 — F14 quản trị danh mục tour, và bộ chip của khách thôi nói dối (nhánh `feat/p4e-2-categories`)

Vùng thứ hai của P4e: `/categories` trong back office, cộng một đoạn dây nối
nó tới trang công khai mà trước nay không có.

**Màn quản trị.** Sáu hàng, không phân trang, không lọc, không tìm kiếm — đo
trên production thì bảng này có đúng sáu hàng, và một thanh công cụ cho sáu
hàng là nhiễu. Bốn hành động trên từng hàng: sửa, ẩn/hiện, lên, xuống. KHÔNG
có nút xoá: `is_active` đã có sẵn nên ẩn là đảo ngược được bằng một cú bấm,
còn xoá thì không.

**Slug khoá sau khi tạo**, và ô nhập chỉ CÓ MẶT ở form tạo — không phải mờ đi,
mà vắng mặt hẳn. Slug đi vào `/tours?categories=<slug>`, mà tham số truy vấn
thì không chuyển hướng được; một ô mờ chỉ mời người ta thử rồi bắt ta giải
thích. Lúc tạo, slug tự điền theo tên qua `slugifyVietnamese` cho tới khi admin
chạm vào ô đó — đo trên production thì slug thật do người chọn (`Hà Nội` thành
`hanoi`, không phải `ha-noi`), nên quyền quyết cuối phải ở họ.

**`move` khoá HAI hàng, sắp theo id trước khi khoá.** Đổi chỗ động tới hai
dòng; hai admin bấm ngược chiều cùng lúc mà khoá theo thứ tự khác nhau là một
deadlock có thật, không phải giả định.

**Đoạn dây nối.** Đây là phần đáng kể nhất của cụm: `/tours` vốn dựng bộ chip
lọc bằng cách suy từ danh sách tour đã tải, nên `is_active` và `order` **không
với tới trang công khai** — ẩn một danh mục vẫn thấy chip, đổi thứ tự vẫn không
đổi gì, và một danh mục mới tạo chưa gắn tour thì không có chip nào để admin
nhìn thấy. Trang nay đọc `catalog.categories.list`; hàm suy-từ-tour xoá hẳn,
vì còn để đó là còn đường quay lại.

Con số in trên chip thì GIỮ cách đếm cũ, ngược với điều bản plan ghi:
`toursCount` của endpoint là số toàn catalogue, in nó ra khi khách đang tìm
kiếm là hứa nhiều hơn thực tế. Endpoint quyết chip NÀO có mặt và theo thứ tự
nào; con số vẫn tính trên lưới đã lọc.

**Hai chỗ doc nói sai code, đã sửa doc:**

- Spec §2e ghi "trang 2 của danh sách tour có bộ chip khác trang 1" như một sai
  lệch cần vá. Đo lại thì không có sai lệch đó — `fetchTours()` gọi một lần
  `limit: 50` và explorer phân trang phía client bằng `history.replaceState`,
  không có vòng server nào. Đính chính ghi thẳng vào spec.
- Bước B5 của plan ghi ngược về con số trên chip (xem trên). Lý do lệch ghi
  ngay tại bước đó.

**Một lỗi tự bắt khi soát lại trước commit:** view model của bảng suy mô tả
hiển thị ra `No description` khi cột trống, rồi form sửa lại so ngược chuỗi ấy
để đoán về bản thô. Một danh mục có mô tả thật đúng bằng câu đó sẽ mở form ra ô
trống, và lưu một phát là mất mô tả. Mô tả thô nay đi riêng khỏi mô tả hiển thị.

**Review findings:** chưa chạy vòng review riêng cho F14.

Tests after: Vitest **3949** (web 1525, api 978, admin 997, contract 347,
core 46, ui 22, tokens 18, i18n 16), int **590 ở 43 file**. Thêm 41 ca admin,
26 ca contract, 20 ca int, và 3 ca web thay cho 3 ca của hàm đã xoá. Mọi ca
mới đều kiểm ĐỎ bằng đột biến — chín đột biến ở vùng admin, ba ở vùng web.

## 2026-09-22 — Vòng hai của F12: tám mục, và hai trong số đó đã tự đóng (nhánh `fix/p4e-f12-wave2`)

Tám mục không-chạm-tiền mà vòng review F12 (21/09) gác lại. Rà từng mục trong mã
hiện tại TRƯỚC khi vá — và **hai mục hoá ra đã đóng** do chính bản vá F12 và F13,
nên chúng được KIỂM chứ không được vá.

**Sáu mục vá thật:**

1. **Form giờ là `<form>` thật.** Gõ xong bốn ô rồi bấm Enter là phản xạ của mọi
   người từng điền form; trước vòng này khối ô chỉ là một `<div>` nên Enter rơi
   vào hư không.
2. **`aria-describedby` nối ô nhập với gợi ý và câu lỗi của nó.** Helper `Field`
   đổi sang render-prop và tự ghép chuỗi id — để mỗi chỗ gọi tự ghép là bốn nơi
   phải nhớ hai luật, và một `aria-describedby` trỏ vào id không tồn tại còn tệ
   hơn không có.
3. **`update` ghi dòng nhật ký kiểm toán.** `create` và `setStatus` đã có, mà
   `update` mới là lệnh đổi được nhiều thứ nhất (ngày, ghế, giá). Ghi CẢ trước
   và sau, vì "đổi 20 thành 45" mới là câu trả lời được cho *"ai hạ ghế xuống?"*.
4. **`TourNotFoundError` bắt bằng `instanceof`, không so `error.name`.** Repo có
   **năm** lớp trùng tên ở năm module, nên so theo tên là bắt nhầm lỗi của bất kỳ
   module nào lọt vào đây.
5. **`isRefreshing` rời khỏi deps của `useMemo` dựng cột, đi qua context.** Cờ ấy
   đổi hai lần mỗi lệnh ghi; nằm trong deps thì mảng cột dựng lại cả hai lần,
   TanStack thấy cột mới nên dựng lại ô, kéo theo `DepartureRowActions` unmount
   rồi mount lại cùng toàn bộ state của nó.
6. **Trần ghế theo cỡ nhóm tour** (`SEATS_ABOVE_TOUR_MAX`, 422) ở cả `create` lẫn
   `update`. `tours.max_group_size` là lời hứa in trên chính trang tour và nó
   quyết cỡ xe; một chuyến 40 ghế trên tour công bố tối đa 12 là bán thứ không
   giao được, mà không tầng nào bên dưới bắt — CHECK của DB chỉ canh
   `seats_booked <= seats_total`, không biết gì về tour. Đo trước khi bật: prod
   có **0** hàng vi phạm, nên không chuyến nào đang chạy bỗng thành không sửa được.

**Hai mục đã tự đóng, kiểm bằng đột biến mã chứ không bằng suy đoán:**

- *Test xanh giả ở `departure-row-actions.spec.tsx`.* Khối chứa nó đã được viết
  lại ở vòng vá F12 (câu `t.list.bookings(2)` thay bằng cặp khẳng-định/phủ-định
  theo nhãn). Quét đột biến ba hành vi mà file ấy canh — bỏ chốt hàng đã huỷ, mở
  khoá nút Reopen, luôn hiện nút huỷ — đều làm đúng số ca đỏ.
- *Dời ngày chuyến đã qua thì viết lại sổ P&L tháng đã chốt.* Báo cáo gom giá vốn
  cố định theo `end_date` và **chỉ đếm chuyến có khách đã trả tiền**; mà chuyến
  như thế thì `seats_booked` khác 0, nên chốt `dateChangeBlocker` chặn sẵn. Tính
  chất này chỉ đúng NHỜ thước `seats_booked` của vòng vá F12 — bản cũ đếm theo
  trạng thái booking và một booking hoàn-thiện-chí-trọn-tiền đọc ra 0 trong khi
  vẫn tính vào P&L. Nay có ca int ghim lại, kèm ca thứ hai cho hướng dời-về-quá-khứ
  (chốt `START_IN_PAST` bắt trước).

**Một hệ quả phụ đáng ghi:** fixture của int spec dựng chuyến 20 và 30 ghế trên
một tour fixture công bố tối đa **16** — tức dữ liệu test vốn đã mâu thuẫn với
lời hứa của chính tour đó, chỉ là chưa ai hỏi. Hạ xuống 12/14 cho khớp.

**Review findings:** không có vòng review riêng — đây là vòng hai của review F12.

Tests after: Vitest **3882** (web 1525, api 978, admin 956, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **570 ở 42 file**. Thêm 7 ca unit và 4 ca int.
Bốn ca component mới đã kiểm ĐỎ bằng đột biến (đổi nút submit về `type="button"`
và cắt `aria-describedby`).

## 2026-09-22 — Vá lỗ hổng đường claim: chuyến dời ngày giữa lúc khách đang trả tiền (ADR-0009 AMEND 4, nhánh `fix/claim-gate-departure-moved`)

Mục cuối cùng còn chạm tiền của P4e-1, phát hiện ở vòng review F12 và để lại
trong [open-items](open-items.md) vì nằm ngoài phạm vi F12.

**Lỗ hổng.** Booking `PENDING` không làm tăng `seats_booked` (bất biến #1 của
ADR-0009), mà chốt chặn đổi ngày của `admin.departures.update` lại đo bằng
`seats_booked`. Nên admin dời được ngày một chuyến ngay trong lúc khách còn ngồi
ở trang thanh toán — hoàn toàn hợp lệ theo luật hiện hành. Khi capture về, gate
claim của [ADR-0009 AMEND 1](adr/0009-refund-correctness.md) chỉ hỏi *"chuyến
còn mở và chưa đi chưa"*, không hỏi *"chuyến còn là thứ khách đã mua không"* —
nên booking flip `PAID` mang BẢN SAO NGÀY CŨ. Khách cầm voucher in sai ngày và
một hạn huỷ tính từ một ngày không còn tồn tại, không có gì báo cho ai.

**Vá.** Qual của AMEND 1 thêm hai phép so `dep.start_date = b.departure_start_date`
và `dep.end_date = b.departure_end_date`. Lệch ngày → outcome MỚI
`departure-moved` → đi đúng đường auto-refund sẵn có của
`overbooked`/`departure-closed`: hoàn trọn, booking `CANCELLED`, email
`BOOKING_REFUNDED`, dedupe key riêng `departure-moved-refund:<bookingId>`.

**Ba quyết định, ghi đủ ở [AMEND 4](adr/0009-refund-correctness.md):**

- *Outcome RIÊNG chứ không dùng lại `departure-closed`.* Hai đường xử lý giống
  hệt nhau nên gộp là rẻ hơn, nhưng chuyến ở đây đang MỞ và đang bán — một dòng
  log nói "departure-closed" về nó là câu sai nằm lại trong sổ sự kiện tiền.
  Cùng lý lẽ đã dùng khi bỏ cột "x / y refunded".
- *HOÀN TIỀN chứ không dời booking theo chuyến.* Đồng bộ bản sao xuống booking là
  âm thầm đổi thứ khách đã đồng ý; ADR-0041 §2b đã loại cách ấy cho người ĐÃ trả
  tiền, người ĐANG trả lại càng chưa đồng ý gì.
- *KHÔNG siết chốt chặn ở `admin.departures.update`.* Thêm "chặn khi có PENDING"
  chỉ thu hẹp cửa sổ chứ không đóng được: `bookings.create` không khoá chuyến,
  nên một booking mới luôn chen được vào giữa lúc admin đọc và lúc admin ghi.
  Chỉ gate claim mới đóng được, vì nó là nơi duy nhất thấy cả hai sự thật.

**Một test cũ phải sửa SETUP, và đó là phát hiện phụ đáng giữ.** Ca §3.2
("thanh toán đang dở lúc hạn chót trôi qua vẫn được nhận") giả lập hạn chót đã
qua bằng cách DỜI NGÀY CHUYẾN mà không dời bản sao trên booking — tức nó đang
giả lập nhầm một chuyện khác hẳn, và gate mới trả `departure-moved` đúng như nó
phải làm. §3.2 nói về ĐỒNG HỒ chạy tới, không nói về lịch bị sửa; setup nay dời
cả hai.

**Review findings:** không có vòng review riêng — bản vá một mục đã được review
gọi tên từ 21/09.

Tests after: Vitest 3875 không đổi, int **566 ở 42 file** (thêm 2 ca AMEND 4 —
một ca dời ngày, một ca dời-rồi-khởi-hành để ghim thứ tự phân loại). Ca dời ngày
đã kiểm ĐỎ bằng cách gỡ hai phép so ra khỏi CTE.

## 2026-09-22 — Chạy thử tay F13 trên production, và một câu copy nói dối (nhánh `fix/departure-cancel-reason-copy`)

Lượt nghiệm thu cuối của [plan P4e-1](plans/2026-09-21-p4e-1-departures.md), chạy
trên chính production (Stripe test mode, worker inline). Đường huỷ chuyến chạy
đúng từ đầu tới cuối; một lỗi copy lộ ra, và nó là loại lỗi chỉ thử tay mới bắt.

**Đường huỷ: đạt.** Tạo chuyến 22/10 trên tour `hanoi-old-quarter-food-night`,
đóng rồi mở lại, đặt một chỗ và trả bằng thẻ test, rồi huỷ chuyến. Đo được trong
DB prod: chuyến `CANCELLED` với đủ ba cột sổ (`cancelled_at/by/reason`), booking
`CANCELLED`, một dòng sổ hoàn **35.00 USD** mang mã `re_…` do chính Stripe trả
về, ghế trả lại `0 / 4`, `cancellation_requests` ở `REFUNDED` đúng lý do, email
`BOOKING_CANCELLED` đã gửi và in đúng số tiền. Từ lúc bấm huỷ tới lúc hoàn xong:
**1,4 giây** — ảnh chụp kịp thấy cột "1 traveller still to refund" rồi nó biến
mất sau một lượt refresh, đúng hành vi đã đổi ở vòng review.

**Lỗi tìm được.** Hộp xác nhận huỷ nhắc dưới ô lý do: *"Say why — travellers see
this on their booking."* Câu ấy SAI. Lý do có vào `cancellation_requests.reason`
thật và admin đọc được, nhưng email báo huỷ không mang nó và trang booking phía
khách không render nó ở đâu cả — tra lại mã nguồn thì `apps/web` chỉ có ô
`reason` để KHÁCH tự gõ khi họ huỷ. Không mất tiền, nhưng là copy nói dối trên
màn tiền: nó khiến admin cân nhắc câu chữ cho một người đọc không tồn tại. Cùng
loại lỗi mà vòng review vừa bắt ở cột "x / y refunded".

Vá bằng cách nói đúng thứ đang xảy ra — câu nhắc nay là *"it is kept on every
affected booking for your team"*. Cho khách thật sự đọc được là việc KHÁC (phải
đụng payload outbox, template email và một vùng trên web, cộng một quyết định về
giọng văn vì lý do admin gõ là câu nội bộ); đã ghi thành đề xuất sản phẩm ở
[open-items](open-items.md) chờ chủ dự án quyết.

Ghi chú vận hành: 3.877 test tự động không cái nào biết email trông ra sao. Đây
là giá trị của mục "chạy thử tay" trong plan, và là lý do nên giữ nó ở mọi phase
sau.

**Review findings:** không có vòng review riêng — đây là lượt vá một câu copy.

Tests after: không đổi con số nào (chỉ sửa chuỗi i18n và hai khối JSDoc). Vitest
3875, int 564 ở 42 file.

## 2026-09-22 — P4e-1 F13: nút công ty huỷ chuyến, hoàn tiền qua hàng đợi (nhánh `feat/p4e-departure-cancel`)

Đóng món nợ [ADR-0041 §6](adr/0041-single-cancellation-deadline.md) mở từ đầu
tháng 9: *công ty huỷ chuyến hoàn 100% mọi lý do — lõi đã viết sẵn nhưng chưa
có nút*. Bốn task theo [plan](plans/2026-09-21-p4e-1-departures.md), mỗi task
một commit.

**Hai đường huỷ, hai cách tính tiền.** `refundOnOperatorCancelForBooking` là
hàm mới, và toàn bộ lý do nó tồn tại nằm ở chỗ nó KHÔNG nhận `now`: hạn chót
là luật cho KHÁCH đổi ý (qua hạn thì chỗ không bán lại được nữa nên không tự
hoàn), còn chuyến bị công ty bỏ thì khách chẳng đổi ý gì cả. Cùng một mốc
18/10 với hạn chót 17/10, khách tự huỷ ra `0.00` và công ty huỷ ra trọn
`117.00`. Thêm `now` vào chữ ký là mời người đọc sau tin rằng thời điểm có ảnh
hưởng.

**Hàng đợi đầu tiên của dự án mang payload.** Năm queue hiện có đều là cron
không tham số với `retryLimit: 0`, vì lượt kế bù được. Ở đây bỏ một lượt là
MỘT KHÁCH KHÔNG ĐƯỢC HOÀN TIỀN, nên queue khai `retryLimit: 5` giãn luỹ thừa
từ 30 giây, và `policy` để mặc định chứ không `'short'` (`'short'` gộp các job
đang chờ thành một, mà mỗi job ở đây là một khách khác nhau). Retry chỉ an
toàn nhờ job idempotent: lượt giao lại đọc trạng thái booking TRONG khoá, thấy
`CANCELLED`, và dừng TRƯỚC cổng thanh toán. Trả `null` chứ không ném — "đã
hoàn rồi" là kết cục THÀNH CÔNG, ném ở đó sẽ đốt hết retry để báo lỗi cho một
việc đã xong.

**Một job mỗi booking, không phải mỗi chuyến.** Mỗi booking là một lời gọi ra
cổng thanh toán và hỏng độc lập; gom cả chuyến thì khách thứ 7 hỏng kéo theo
lượt retry của 6 người đã hoàn xong.

**Endpoint đồng bộ, tiền bất đồng bộ.** `admin.departures.cancel` khoá chuyến,
đổi `CANCELLED`, huỷ luôn nhóm `PENDING` tại chỗ (chưa trả tiền nên không có
gì hoàn; không trả ghế vì `PENDING` chưa từng claim ghế), chụp nhóm cần hoàn,
rồi trả về. Đợi hoàn tiền ngay trong request là sai: một chuyến 30 khách là 30
lời gọi ra cổng, và request đầu tiên hết giờ chờ để lại một lượt huỷ nửa chừng
mà không ai biết đã tới đâu.

**Màn admin.** Nút huỷ dùng thước NGÀY KHỞI HÀNH chứ không phải hạn nhận đặt —
khác hẳn nút Mở lại ngay bên cạnh, vì một chuyến quá hạn đặt mà hướng dẫn viên
gãy chân vẫn phải huỷ được. Hộp xác nhận in hai con số (bao nhiêu người được
hoàn, bao nhiêu phiên thanh toán bị huỷ) và bắt nhập lý do, kèm câu nhắc rằng
KHÁCH đọc được lý do ấy. Cột tiến độ đọc từ đếm booking, không thêm bảng nào.

**Hai thứ làm THÊM so với plan, cùng vì một lỗ hổng.** Job được đẩy SAU khi
transaction commit, nên có một khoảng hở thật: không worker nào đăng ký, hoặc
pg-boss lỗi, hoặc tiến trình chết đúng khe giữa — thì booking đã trả tiền nằm
lại trên chuyến đã huỷ và KHÔNG có gì đánh thức nó dậy (khác mọi queue khác,
ở đây không có cron nào tự chạy lại). Vá bằng: ba cột sổ trên `tour_departures`
(`cancelled_at/by/reason` — cũng là nơi DUY NHẤT trả lời "ai huỷ, vì sao" với
một chuyến không có khách nào), và lượt quét `sweepStranded` đi ké nhịp
`booking-sweep` 10 phút. Chuyến huỷ từ trước F13 không có sổ thì lượt quét BỎ
QUA và cảnh báo, không bịa ra người quyết.

**Một quyết định đo được, không phải suy đoán.** `cancelled_by` cố ý KHÔNG có
khoá ngoại tới `users`. Bản đầu có, và `TRUNCATE users CASCADE` lập tức kéo
theo cả `tour_departures` làm 25 integration test đỏ — `POST /api/bookings`
trả `DEPARTURE_NOT_AVAILABLE` vì lịch chạy biến mất giữa chừng. Lý do thứ nhất
đứng độc lập với lỗi ấy: một dấu vết kiểm toán phải sống lâu hơn tài khoản nó
trỏ tới, mà khoá ngoại chỉ cho chọn giữa `SET NULL` (xoá admin là xoá luôn vết
họ từng huỷ chuyến nào) và `RESTRICT` (không xoá được tài khoản nữa).

**Review findings:** vòng review 22/09 báo **4 phát hiện, nhưng chỉ hai chỗ
sai** — vá ở gốc thay vì vá bốn triệu chứng (`b221754f`).

*Gốc 1 — đường operator mượn cổng chặn của đường khách.* `cancellationBlocker`
chặn khi "đã tới ngày khởi hành": đúng với khách, SAI với lượt hoàn tiền của
công ty. Lượt ấy chạy bất đồng bộ — worker gói free ngủ 15 phút, cổng thanh
toán hờn rồi retry giãn luỹ thừa — nên job hoàn toàn có thể chạy sau ngày khởi
hành, mà chuyến khi ấy đã bị bỏ từ trước. Đo được bằng test: chuyến 10/10 huỷ
ngày 09/10, worker tỉnh ngày 11/10 → `cancelByOperator` trả `null` → pg-boss
ack THÀNH CÔNG → khách mất tiền, không log, không alert; lưới quét 10 phút/lần
vấp đúng chốt ấy nên không bao giờ cứu được, và vì chỉ đếm thành công nên cũng
không kêu. Vá: `cancellationBlocker` nhận `initiator` (mặc định `'customer'`
để mọi chỗ gọi cũ giữ nguyên nghĩa), chốt ngày chỉ áp cho khách. Kèm theo,
`cancelByOperator` tách hai kết cục vốn bị gộp: trạng thái đã đóng là ĐÃ XONG
(trả `null`), còn thiếu capture là CẦN NGƯỜI NHÌN (ném) — `claimSeatsForPaid`
nhận `providerPaymentId ?? null` nên hàng PAID không capture là có thật.

*Gốc 2 — cột "x / y refunded" nói sai.* Tử số `cancelledBookingCount` đếm cả
booking `PENDING` vừa bị huỷ tại chỗ (chưa trả tiền nên chưa từng được hoàn)
lẫn booking khách tự huỷ từ trước: chuyến 2 PENDING cộng 3 PAID hiện
"2 / 5 refunded" ngay khi chưa một đồng nào đi, và chuyến huỷ lúc chưa ai đặt
hiện "0 / 0 refunded". Vá bằng cách THAY thước chứ không sửa phép tính: cột in
"N travellers still to refund" đọc thẳng từ `liveBookingCount` và để TRỐNG khi
hết người chờ. `cancelledBookingCount` bỏ hẳn khỏi contract — một field không
ai dùng trên hàng tiền là một field sẽ lệch.

**CÒN TREO:**

- **Deploy migration `20260922120000_departure_cancellation_audit` lên Supabase**
  sau khi merge (luật 15).
- **Chạy thử tay** theo mục nghiệm thu của plan: tạo một chuyến, đóng, mở lại,
  rồi huỷ một chuyến có booking sandbox và xem cột tiến độ chạy tới đủ.
- Vòng hai của F12 (8 mục) vẫn mở.

Tests after: Vitest **3875** (web 1525, api 975, admin 952, contract 321, core 46,
ui 22, tokens 18, i18n 16), int **564 ở 42 file**, Jest mobile 245 không đổi.
Riêng F13 thêm 23 ca unit và 19 ca int (gồm vòng vá review). Task 8, Task 9 và luật
`departureCancelBlocker` đi đúng TDD (đỏ trước rồi mới implement); bảy ca int
của endpoint viết SAU phần cài đặt và được bù bằng đột biến mã — bỏ chốt
huỷ-lần-hai, bỏ chặn chuyến đã khởi hành, bỏ ghi sổ, bỏ huỷ nhóm `PENDING`,
bỏ chốt idempotent và bỏ guard chuyến đều làm đúng số ca dự kiến đỏ.

## 2026-09-22 — P4e-1: danh sách tour có công tắc đăng, và lịch chạy của từng tour (nhánh `feat/p4e-tours-list` rebase dưới `feat/p4e-departures-crud`)

Hai cụm việc đầu của P4e, dựng song song ở hai worktree rồi gộp làm một lượt vì
F12 nối thẳng từ màn F11 (nút "Departures" trên mỗi hàng tour). Thiết kế đi
trước: [spec](specs/2026-09-21-p4e-1-departures-design.md) ·
[plan 11 task](plans/2026-09-21-p4e-1-departures.md).

**F11 — `/tours`.** `admin.tours.list` trả CẢ tour chưa đăng (bề mặt công khai
không được biết chúng tồn tại), kèm `isPublished` và số chuyến còn bán được
trong khoảng lọc. `admin.tours.setPublished` là ĐÚNG MỘT công tắc, cố ý không
khai mã lỗi nào ngoài `NOT_FOUND`: gỡ đăng một tour đang có khách là hợp lệ và
không được chặn — khách đã mua vẫn đi, tour chỉ thôi được chào bán. Chặn ở đây
là khoá đúng thao tác vận hành cần nhất khi có chuyện.

**F12 — `/tours/[slug]/departures`.** Bốn thao tác: đọc danh sách, thêm, sửa,
đóng/mở lại. Hạn chót có CỘT RIÊNG chứ không giấu sau tooltip, vì nó là mốc
quyết định mọi thao tác trên hàng. Ba luật viết thành hàm thuần có test:

- **Đổi ngày** bị khoá khi chuyến đã có ghế bị giữ. `Booking` lưu BẢN SAO ngày
  khởi hành và ADR-0041 tính hạn huỷ từ bản sao ấy, nên đổi ngày chuyến là tạo
  hai sự thật. Bất biến: hạn huỷ không bao giờ xấu đi sau khi khách đã trả tiền.
  Giá và ghế thì vẫn sửa được, kể cả khi đã có khách.
- **Hạ ghế** dưới số đã đặt bị từ chối ở tầng nghiệp vụ. CHECK
  `departures_seats_within_total` vẫn đứng sau làm lưới, nhưng một SQLSTATE
  23514 phơi lên màn hình là câu trả lời cho máy, không phải cho người sửa lịch.
- **Mở lại** sau hạn chót bị từ chối: hạn chót cũng là lúc ngừng nhận đặt, nên
  mở lại sau mốc đó là bày ra một chuyến không ai đặt được.

KHÔNG có nút huỷ chuyến (đó là F13, và nó chạm tiền) và KHÔNG có lệnh xoá:
chuyến đã có người đặt thì phải huỷ có hoàn tiền, chuyến chưa ai đặt thì `CLOSED`
đã đủ — thêm lệnh xoá là thêm một đường làm mất bản ghi mà báo cáo tháng đang đếm.

**Review findings:** hai vòng review riêng, 10 góc mỗi vòng, tổng **28 mục vá**.

*F11 — mười ba mục* (`c3fc83c6`). Sáu mục chặn merge. Nặng nhất: công tắc đăng
KẸT sai trạng thái tới khi tải lại cả trang, vì gương `serverValue` được nâng
khi prop đổi giữa lúc lệnh ghi đang bay; bản vá ĐẦU TIÊN của vòng này cũng sai
theo đúng cách ấy, và chính hai test mới bắt được. Bust cache thôi gác sau
`changed` (revalidate là fire-and-forget, gác lại thì tour ở lại trên site trọn
300 giây ISR). Menu lọc danh mục gọi endpoint công khai nên ăn trần đọc theo
IP — nay hỏng thì trả rỗng thay vì kéo sập cả bảng. `page` kẹp cả TRẦN 10 000
theo contract: lỗ này ở kit dùng chung nên **sáu bảng admin cùng được vá**.
Đếm chuyến cắt thêm nhát `isWithinDeadline`, hệ quả cố ý là tháng quá khứ trả 0
và nhãn đổi sang "Bookable departures".

*F12 — mười lăm phát hiện, bảy mục vá* (`048cfc48`); tám mục còn lại dồn sang
vòng hai vì chúng không chạm tiền và không làm sập trang.

Năm mục chạm tiền:

1. **Trần giá và đúng 2 chữ số lẻ.** `129.999` từng đi lọt cả ba tầng rồi bị
   cột `Decimal(14,2)` làm tròn thành `130.00` — một con số khách phải trả mà
   không ai gõ vào. Quá 12 chữ số phần nguyên thì Postgres ném `22003`,
   `mapError` không nhận ra nên thành 500 trần, admin phân loại `GENERIC`, rồi
   kit ĐÓNG dialog: mất sạch bốn ô vừa điền.
2. **Token `version` chống ghi đè mù giữa hai tab**, kèm mã `DEPARTURE_STALE`.
   `FOR UPDATE` tuần tự hoá hai lệnh ghi nhưng KHÔNG phát hiện được cái cũ, vì
   giá trị "hiện tại" trong payload đến từ form trình duyệt chứ không từ hàng
   vừa khoá. A đổi 20 ghế thành 45, B bấm Lưu từ form mở trước đó và ghi đè về
   20: 25 ghế biến mất im lặng, khách đặt tiếp đâm trần, claim trả `overbooked`,
   hệ thống tự hoàn tiền người ĐÃ trả. Token là `updatedAt` nên không thêm cột;
   form CHỤP nó lúc mở chứ không đọc lại lúc gửi.
3. **Thước khoá ô ngày đổi sang `seats_booked`.** Bản đầu đếm trạng thái
   booking, nhưng [`booking-states`](conventions/booking-states.md) nói ngược
   đúng chỗ đó: hoàn tiền thiện chí trọn tiền KHÔNG trả ghế, khách vẫn đi tour.
   Nên đếm theo trạng thái đọc ra 0 trên một chuyến vẫn còn khách thật rồi mở
   khoá ô ngày. Đổi thước còn xoá một mâu thuẫn bày ngay trên màn hình:
   "Seats 4 / 20" đứng cạnh "Live bookings 0".
4. **Tách `pendingBookingCount`.** Đóng chuyến gây hai hệ quả khác hẳn nhau:
   khách ĐÃ trả giữ chỗ và không ai báo gì, còn khách ĐANG trả bị đường claim
   từ chối rồi hoàn tiền tự động kèm email. Hộp xác nhận nay in hai dòng, và
   thêm một câu cảnh báo khi còn checkout dở.
5. **Copy tạo chuyến thôi hứa "goes on sale straight away"**, và form cảnh báo
   ngay khi chuyến sắp tạo đã quá hạn nhận đặt — hạn là `ngày đi − N` với N tới
   7 ngày, nên một chuyến 5 ngày khởi hành tuần sau đã quá hạn ngay lúc tạo.

Hai mục làm sập cả trang: `seatsTotal` ở hàng ĐẦU RA nới về `nonnegative()` (khai
chặt 1..500 nghĩa là một hàng hợp lệ với DB nhưng ngoài dải sẽ trượt validation
đầu ra và 500 cả trang, kể cả chính cái form dùng để sửa nó); và CHECK
`departures_date_range` (`end_date >= start_date`) — một hàng ngược ngày sinh ra
độ dài âm, `tripLengthDays` ném `RangeError`, mà hàm đó chạy cho MỌI hàng ở
`admin.departures.list` lẫn `catalog.getTourBySlug`, nên đúng một hàng hỏng kéo
sập luôn trang tour công khai.

**CÒN TREO:**

- **Vòng hai của F12** (8 mục, không chạm tiền): bọc `<form>` để Enter gửi được ·
  `aria-describedby` cho ô có gợi ý · `update` thiếu dòng nhật ký kiểm toán ·
  một test xanh giả ở `departure-row-actions.spec.tsx` · `TourNotFoundError` bắt
  bằng `error.name` thay vì `instanceof` · `isRefreshing` nằm trong deps của
  `useMemo` nên ô bảng bị dựng lại · thiếu kiểm `maxGroupSize` lúc tạo · dời
  ngày một chuyến đã qua thì viết lại sổ P&L của tháng đã chốt.
- **Lỗ hổng đường claim** (ngoài phạm vi F12, đã ghi ở
  [open-items](open-items.md)): booking `PENDING` không làm tăng `seats_booked`,
  nên chuyến vẫn đổi ngày được trong lúc khách đang thanh toán; lượt claim về
  sau vẫn flip sang `PAID` với bản sao ngày CŨ. Cổng claim hiện chỉ kiểm chuyến
  còn `OPEN` và chưa khởi hành, không so bản sao ngày với ngày thật.
- **Deploy migration `20260922090000_departure_date_range_check` lên Supabase**
  sau khi merge (luật 15: hạ tầng sống chỉ đụng ở session gốc, sau review).

Tests after: Vitest **3852** (web 1525, api 965, admin 942, contract 318, core 46,
ui 22, tokens 18, i18n 16), int **545 ở 41 file**, Jest mobile 245 không đổi.
Riêng hai cụm này thêm 163 ca unit và 48 ca int. Ba ca mới của vòng vá F12 đã
kiểm ĐỎ bằng đột biến mã trước khi nhận là xanh thật. Build web chạy với API
sống trên máy (đúng cấu hình CI) — xanh.

## 2026-09-21 — Đại tu tài liệu: bản đồ gọn lại, thêm lớp cho người đọc phổ thông, tách CHANGELOG (nhánh `docs/overhaul-2026-09`)

Đợt rà soát toàn bộ `docs/` đầu tiên kể từ 03/08. Quy mô lúc bắt đầu: **159 file
Markdown · 78.970 dòng · 4,40 MB**, cộng 114 file khác. Bảy đợt sửa, ghi đầy đủ ở
[báo cáo rà soát](analysis/2026-09-21-docs-audit.md).

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| `docs/README.md` | 149 KB, 665 ký tự/dòng | **19 KB**, 68 ký tự/dòng |
| `docs/CHANGELOG.md` | 589 KB, 133 entry | **60 KB**, 17 entry |
| File lưu trữ changelog | 2 | **12** (tối đa 75 KB) |
| `conventions/` | 12 file, 86 KB | **7 file, 41 KB** |
| File `.md` ngoài bản đồ | 4 | **0** |
| Link `.md` gãy trong `docs/` | 17 | **0** |
| Trang cho người không lập trình | 0 | **3** |
| `docs/` trên đĩa | 109 MB | **11 MB** |

**Thông tin sai ở đúng chỗ người lạ đọc đầu tiên.** `README.md` gốc ghi admin là
Vite/TanStack trong khi thật ra là Next 16.3.4, mobile Expo 56 và RN 0.85 trong
khi thật ra 57 và 0.86.3, ba app còn đánh dấu chưa làm trong khi đã chạy thật,
thiếu hẳn hai gói `ui`, và vẫn trỏ repo tham chiếu Nexora đã bỏ từ 14/09.
`CLAUDE.md` còn ghi P4 admin là phase kế tiếp.

**Bản đồ đã hoá thành bách khoa.** 224 dòng nhưng 149 KB: mỗi ô bảng là bản tóm
tắt đầy đủ của một ADR kèm cả AMEND, ô dài nhất 5.772 ký tự. Cắt được vì mọi
AMEND chép trong đó đều đã có đủ trong chính file ADR — và bản chép còn cũ hơn
bản gốc (ghi ADR-0026 tới AMEND 4 trong khi ADR có AMEND 5).

**Ba tài liệu mới cho người không lập trình**: [overview](overview.md) (sản phẩm
là gì, ai dùng, sáu luồng chính, sơ đồ bốn app), [glossary](glossary.md) (khoảng
60 thuật ngữ chia sáu nhóm), [open-items](open-items.md) (gom hơn 30 mục CÒN TREO
vốn rải khắp 133 entry). Không dịch ADR và plan sang ngôn ngữ phổ thông — làm
loãng chúng thì mất chính xác mà không ai được lợi.

**Tách CHANGELOG, kiểm nguyên văn bằng máy.** 116 entry vào 10 file lưu trữ theo
kỷ nguyên, cộng [mục lục](changelog/README.md) kể lại 12 giai đoạn bằng ngôn ngữ
thường. Ghép 11 file lại rồi so từng dòng với bản gốc lấy từ git: 6.904 dòng nội
dung khớp 100%, đủ 133 entry. Chỗ duy nhất đụng là **89 đường dẫn tương đối** phải
thêm `../` vì file xuống sâu một cấp — đúng cách hai file lưu trữ đợt 03/08 đã
làm, dù header của chúng tuyên bố "0 ký tự đổi".

**Rà `conventions/` bằng cách đối chiếu mã nguồn.** Bốn file đúng nguyên
(`booking-states`, `read-then-write-races`, `soft-404-loading-tsx`,
`supabase-data-api-surface` — kiểm `cancelInLock`, `vietnamToday`, `FOR UPDATE`,
vị trí `loading.tsx`, 36 bảng RLS). Ba file lệch:

- `mobile-dev-loop` §2 đứng trọn trên tiền đề WSL NAT, lỗi thời từ 14/09 khi máy
  dev sang Windows native. Nợ này CHANGELOG 16/09 đã ghi nhận mà chưa trả. Kèm
  [ADR-0040 AMEND 2](adr/0040-mobile-app-expo.md) đảo §8: `dev` = `expo start`
  (LAN), thêm `dev:tunnel`, `dev:lan` giữ làm bí danh.
- `outbox-dedupe-key` sai bốn chỗ: hai dòng bảng trùng nhau, ví dụ
  `cancellation-denied` thuộc luồng ADR-0041 đã xoá, tên sự kiện `booking-paid`
  trong khi mã dùng `booking-confirmed`, và thiếu ba dạng đang chạy thật.
- `read-then-write-races` thiếu nơi áp dụng thứ ba (`admin-enquiries`, W4).

**Sắp xếp lại ba chỗ.** Năm tài liệu bàn giao mobile sang [`handoff/`](handoff/README.md)
— chúng có hình dạng của plan và có ngày hết hạn, khác luật áp dụng mãi mãi.
`color-system` tách đôi: luật thi hành ở lại (4 KB), phần đo đạc sang
[analysis](analysis/2026-07-22-color-system-analysis.md) (9 KB). `design/prompts/`
gộp lên một cấp vì thư mục chỉ có đúng một file.

**Hai thư mục không phải Markdown.** `snapshots/` (28 file JSON, có commit) nay có
[mục lục](snapshots/README.md) — trước đó không một dòng giải thích, dù
`reset-operational-data.mjs` đọc `keep-list.json` ở thư mục có ngày lớn nhất nên
thêm một lượt là đổi luôn hành vi script dọn dữ liệu. `screenshot/` (98 MB ảnh
tham chiếu riêng của user, gitignored) đã dời hẳn ra ngoài kho mã.

**Đo được một rủi ro rộng hơn tưởng.** Gotcha `+` ở cột 0 lâu nay chỉ nhắc
changelog; đo lại thì **11 file** dính, gồm 4 ADR, 2 bản phân tích (một file 37
dòng), 2 plan, 1 spec và `libs/shared/tokens/README.md`. Tất cả là dòng tiếp nối
hoặc phép cộng bị ngắt dòng — mở rồi save bằng editor có markdownlint là làm sai
nghĩa. CLAUDE.md đã ghi đúng phạm vi.

**CÒN TREO:** quét QR thử app điện thoại sau khi đổi lệnh `dev` sang LAN (nếu
không chạy được thì `dev:tunnel` vẫn còn nguyên) · `.claude/skills/` có 41 link
gãy nhưng đó là bản sao upstream của skill bên thứ ba, không đụng.

**Review findings:** chưa có vòng review riêng.

Tests after: không đổi code sản phẩm — thay đổi duy nhất ngoài `docs/` là một
dòng script `dev` trong `apps/mobile/package.json` và ghi chú `.gitignore`. Vitest
3689, Jest mobile 245, int 497 ở 39 file, tất cả giữ nguyên so với entry trước.

## 2026-09-21 — Prerender thử lại khi API hắt hơi (ADR-0044, nhánh `fix/prerender-retry`)

Ba lượt build web trên Vercel chết liên tiếp, **ba mã lỗi khác nhau trên cùng
một đường**, trong khi gọi tay chính endpoint ấy trả 200 dưới 0,6 giây:

| Deploy | Trang chết | Lỗi |
| --- | --- | --- |
| `f4809d3f` | `/tours/bana-hills-golden-bridge-day` (trang 57/75) | `TimeoutError`, quá 10s |
| `659a48fc` | `/blog/what-to-pack-for-the-mist-season` (trang đầu) | HTTP 502, header `x-render-routing: dynamic-free-error` |
| redeploy `659a48fc` | cùng trang | HTTP 520, trang lỗi HTML của Cloudflare |

- **Chẩn đoán sai một nhịp rồi sửa lại giữa chừng.** Bản đầu kết luận "flake do
  Render ngủ dậy" và đề nghị deploy lại; deploy lại VẪN chết, lần này 520 dù API
  đã tỉnh ổn định 11 phút. Kết luận đúng có hai tầng: (a) service Render đặt
  `autoDeploy` theo MỌI commit nên push docs cũng dựng lại API — log Render
  `03:22:59 ==> Deploying…` rồi `03:23:34 Starting Nest…` trong khi build web gọi
  lúc `03:23:48`; (b) instance **free** một mình ở Singapore không nuốt nổi loạt
  75 request prerender bắn từ vùng IAD, Cloudflare đứng trước trả 520/502.
- **`settle()` của ADR-0016 không dùng được ở đây.** `fetchPostDetail` cố ý ném
  lại mọi lỗi khác `POST_NOT_FOUND` để error boundary xử lý; đổi sang `settle` là
  build XANH trong khi xuất bản một trang bài viết rỗng. Thà đỏ.
- **Vá ở tầng vận chuyển**, một chỗ duy nhất: bọc `fetch` của `OpenAPILink` bằng
  `createRetryingFetch` (`apps/web/src/lib/api/retry-fetch.ts`). Bốn ràng buộc
  của ADR-0044 đều có test canh: CHỈ `GET` (gửi lại POST là nguy cơ đặt trùng chỗ
  và thu tiền hai lần), CHỈ phía server, CHỈ lỗi tạm thời (network/timeout cộng
  `408 425 429 500 502 503 504 520 521 522 523 524`; 404 và 4xx nghiệp vụ đi
  thẳng để `notFound()` còn chạy), và đúng ba lượt giãn 400ms rồi 1200ms.
- **Timeout tách hai phía:** server 20s, trình duyệt giữ nguyên 10s.
  `AbortSignal.timeout()` phải dựng LẠI từng lượt — dùng chung một signal thì
  lượt thử thứ hai nhận signal đã hết hạn và chết tức khắc.

**Phần (1) đã xong bằng tay 21/09:** user bật Build Filter trên dashboard Render
(service `Tourism-Platform-V2` → Settings → Build Filters → Ignored Paths →
`docs/**`) — Render chưa mở cấu hình này qua API lẫn MCP nên không tự động hoá
được. Từ nay commit chỉ đụng `docs/` không dựng lại API nữa.

Còn một mức siết nữa CHƯA làm, để dành khi cần: `apps/web/**`, `apps/admin/**`
và `apps/mobile/**` cũng không vào ảnh Docker của API, nên thêm chúng vào
Ignored Paths sẽ chặn nốt phần lớn ca còn lại. **Đừng thêm `libs/**`** — API ăn
`@tourism/contract` và `@tourism/core`, ignore chúng là deploy API thiếu bản
contract mới mà không ai hay.

**Review findings:** chưa có vòng review riêng.

Tests after: Vitest 3689, trong đó web 1538 (thêm **32** test mới cho
`retry-fetch`), api 932, admin 838, contract 279, core 46, ui 22, tokens 18,
i18n 16. Jest mobile 245 không đổi. Int 497 ở 39 file. `pnpm gate:int` trọn
xanh; lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Audit hết đỏ: metro bỏ `image-size`, ghim `@types/react`, ghi nhận lỗ `decode-uri-component` (nhánh `fix/audit-metro-image-size`)

Workflow `Audit` (lịch, 09:00 thứ Hai) đỏ từ **14/09** mà không ai nhìn — lần
xanh cuối là 07/09. Ba lỗ, cả ba chỉ đến từ bộ công cụ Expo trong `apps/mobile`;
web và api sạch.

- **Hai lỗ high `image-size` (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq)** — vá
  bằng MỘT lượt làm mới lockfile, không cần override: `metro@0.87.1` đã **bỏ hẳn**
  dependency `image-size`, và `metro-config@0.87.1` nằm trọn trong dải `^0.87.0`
  mà `@react-native/metro-config@0.87.1` (bản repo đang cài) khai. Lock chỉ đang
  giữ 0.87.0 vì `--frozen-lockfile`. Đây là patch BÊN TRONG dải upstream đã cho
  phép, không đụng Expo SDK 57 của ADR-0040 — hợp chính sách freeze 15/10.
- **KHÔNG override `image-size` lên 2.x** dù advisory bảo `>=2.0.3`:
  `metro/src/Assets.js` gọi `_interopRequireDefault(require("image-size"))`, tức
  dùng default export, mà v2 chỉ xuất named `imageSize` → Metro sẽ chết khi bundle
  bất kỳ ảnh nào. Đã kiểm bằng cách đọc mã nguồn metro trong `node_modules`.
- **Lỗ moderate `decode-uri-component` (GHSA-vcc3-ghjq-m6fr) KHÔNG vá được**, ghi
  nhận có chủ đích bằng `auditConfig.ignoreGhsas` kèm lý do đo được và điều kiện
  gỡ. Advisory ghi "Patched versions >=0.4.3" nhưng **bản 0.4.3 không tồn tại trên
  npm** (registry chỉ tới 0.4.1 rồi nhảy 0.5.0), và 0.5.0 là `"type": "module"`
  trong khi `query-string@7.1.3` là CJS `require()` nó → ép lên là
  `ERR_REQUIRE_ESM`, expo-router hỏng lúc CHẠY. Gỡ được khi Expo kéo
  `query-string >=9.5.1` (bản đó khai `decode-uri-component: ^0.5.0`; 9.0 vẫn khai
  `^0.4.1` nên chưa đủ).
- **Tác dụng phụ bắt được nhờ gate, không phải nhờ may:** lượt làm mới lock kéo
  thêm `@types/react@19.2.18` cạnh 19.2.17 mà react-native và `apps/web` đang
  dùng → hai bản types trong store → `tsc` ở `libs/shared/ui` báo *"Two different
  types with this name exist, but they are unrelated"* cho `Ref<SVGSVGElement>`.
  Ghim `'@types/react': '19.2.17'` theo đúng nếp đã có cho `react`/`react-dom`, và
  cùng lý lẽ: hạ xuống cho khớp, KHÔNG phải nâng cấp. Lỗi này không hiện ở runtime.
- **Phạm vi lock:** 33 gói đổi version, toàn bộ patch/minor trong dải đã khai,
  **không gói nào nhảy major**. Phần lớn là họ `metro-*` 0.87.0 lên 0.87.1; vài gói
  là đích của override bảo mật sẵn có tự trôi tới (hono 4.13.5 lên 4.13.8, postcss
  8.5.23 lên 8.5.28, nanoid 3.3.17 lên 3.3.19).

**Kiểm metro riêng vì gate không đụng tới nó:** `pnpm gate` chạy jest-expo chứ
không chạy Metro (ADR-0040 §5 — `expo export` tốn 1–2 phút nên đứng ngoài vòng
lặp TDD). Đã chạy `turbo run bundle --filter=@tourism/mobile`: ra bundle iOS
3.4MB và Android 3.7MB, đúng như CI. Build web thì cần API sống (ADR-0016) nên
chạy tay với API nền ở cổng 3001 — xanh.

**Review findings:** chưa có vòng review riêng.

Tests after: không đổi con số nào so với entry trước (thay đổi không chạm file
nguồn nào). Vitest 3657 chia ra api 932, web 1506, admin 838, contract 279, core
46, ui 22, tokens 18, i18n 16. Jest mobile 245 (mobile 159 và mobile-ui 86). Int
497 ở 39 file. Lint vẫn đúng 1 warning và 1 info có từ trước. `pnpm audit
--audit-level=moderate` nay exit 0.

## 2026-09-21 — Việc 4: OTP gửi ngay, `.vercel.app` chuyển hướng về www, và chốt KHÔNG tự đăng nhập sau OTP (nhánh `feat/outbox-nudge`)

Đóng mục cuối của bản bàn giao sau đợt hoàn tiền — ba đề xuất từ 18/09 user
chưa chọn. Kết cục ba kiểu khác nhau: một cái sửa code, một cái đổi thiết lập
hạ tầng, một cái chốt KHÔNG làm.

### 1. OTP và đặt lại mật khẩu xin drain ngay

- `9c10a5e3` feat(api): thêm `worker/outbox-nudge.ts` — registry cấp module,
  vòng worker đăng ký hàm `boss.send` của chính instance nó, đường request gọi
  `nudgeOutboxDrain()` để đẩy một job vào queue `outbox-drain` thay vì đợi tick
  cron (mỗi phút, granularity nhỏ nhất pg-boss cho). Gọi ở hai chỗ tạo email
  auth trong `auth.config.ts`: `PASSWORD_RESET` và `EMAIL_OTP` (callback OTP
  phục vụ cả ba loại OTP của plugin nên một dòng phủ hết).

  **Vì sao là registry chứ không phải DI** — bản bàn giao đề xuất "đẩy job cho
  pg-boss" mà chưa biết chỗ vướng: `sendVerificationOTP` là callback của plugin
  better-auth ở TẦNG MODULE, không nằm trong container Nest và ghi bằng `prisma`
  trần, nên không inject được gì vào đó. Dùng lại đúng instance pg-boss của
  worker (không mở client thứ hai) vì pool Postgres chốt ~10 kết nối.

  **BEST-EFFORT là toàn bộ hợp đồng**: không worker nào đăng ký, pg-boss lỗi,
  queue chưa tạo — đều log rồi đi tiếp, vì cron vẫn là lưới cuối. Để một lỗi
  pg-boss lan ra ngoài `sendVerificationOTP` là biến "email chậm một phút"
  thành "không đăng ký được".

  **Giới hạn đã biết, ghi trong JSDoc**: chỉ có tác dụng khi worker chạy CÙNG
  tiến trình API (`WORKER_INLINE=true` — đúng cấu hình prod trên Render free).
  Tách worker ra process riêng thì nudge trả `no-worker` và OTP quay lại nhịp
  cron; muốn phủ cả ca đó thì API phải tự mở một client pg-boss, tức thêm một
  kết nối vào pool — cố ý không làm khi prod chưa cần.

  Hai đường đã cân và loại: gọi thẳng `outbox.drainOnce()` trong request (app
  API không import `WorkerModule` nên KHÔNG có deliverer, và nó kéo cả lô 50
  row vào đường request); gửi thẳng qua Resend bỏ qua outbox (mất kiểm
  `email_suppressions`, mất retry, mất audit — đúng loại email không được phép
  mất mấy thứ đó).

- **Test của chính đợt này bắt được lỗi của chính nó.** Int spec mới ghim ca
  "queue chưa tạo → `failed` chứ không ném" — ca duy nhất soi được lỗi đăng ký
  sai thứ tự, vì nudge nuốt lỗi nên mọi thứ sai ở tầng queue đều hỏng IM LẶNG.
  Lượt đầu nó xanh, lượt sau đỏ: schema `pgboss` của `tourism_test` KHÔNG bị
  truncate giữa các lượt (globalSetup chỉ `migrate deploy` schema Prisma) nên
  queue do lượt trước tạo vẫn còn. Sửa bằng `deleteQueue` tường minh trước khi
  khẳng định, rồi chạy hai lượt liên tiếp để chứng minh tính lặp lại.

### 2. `.vercel.app` chuyển hướng về www — user đổi trên Vercel

Domain `tourism-platform-v2-web.vercel.app` đang phục vụ app trực tiếp
(`redirect: null`), nên mở site qua host đó thì đăng ký/đăng nhập hỏng: API chỉ
trả CORS cho `www.nexora-travel.agency` (đúng thiết kế W3/W4). User đặt redirect
308 sang www, giống hệt apex đã có sẵn. Đo sau khi đổi: `/`, `/login` và một
trang tour đều trả 308 và GIỮ NGUYÊN path; đi theo chuỗi thì đúng một lượt
chuyển hướng rồi 200 ở www.

Hệ quả phụ đã lường và đo: `robots.txt` trên host cũ nay cũng 308 sang www, nên
host đó không còn tự phục vụ `disallow: /` nữa. Chặt hơn chứ không hở — 308
vĩnh viễn gom tín hiệu về www và không còn nội dung nào ở host cũ để index,
trong khi `disallow` chỉ ngăn thu thập mà vẫn để URL tồn tại. Không file nào
trong repo ghi cứng host đó; `robots.ts` khớp theo mẫu `*.vercel.app` nên không
phải sửa.

### 3. Tự đăng nhập sau OTP — CHỐT KHÔNG LÀM

- `ab57f8dd` docs(web): ghi lý do ngay cạnh chỗ redirect trong `otp-form.tsx`.

Đọc plugin `email-otp` của better-auth 1.6.23: nó KHÔNG có tuỳ chọn phát session
sau `verify-email`. Hai route tách bạch — `/email-otp/verify-email` chỉ đánh dấu
email đã xác minh, còn `/sign-in/email-otp` là một luồng ĐĂNG NHẬP KHÔNG MẬT
KHẨU riêng. Nên "tự đăng nhập sau OTP" chỉ làm được bằng cách chuyển sang route
thứ hai, và cái giá là mã 6 số gửi qua email trở thành yếu tố đăng nhập đầy đủ
cho MỌI tài khoản, không riêng tài khoản vừa đăng ký — đúng thứ lần siết 20/08
cố ý bỏ. User chốt không đánh đổi. Ghi vào code chứ không chỉ vào đây, để lần
sau không ai đề xuất lại mà không biết điều đó; đổi ý thì phải đi qua một ADR.

**Review findings:** chưa có vòng review riêng.

Tests after: cổng đầy đủ xanh (28/28 task với `--concurrency=2`, int 6/6, API
nền sống cho build web). Int 498 ở 39 file (thêm 1: nối dây nudge trên pg-boss
thật). Vitest 3680, trong đó api 936 có thêm 4 test cho `outbox-nudge`; web
1525, admin 838, contract 279, core 46, ui 22, tokens 18, i18n 16 đều không
đổi. Jest mobile 245 không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Nghiệm thu trên prod: hoàn tiền đã để lại vết ở `/payment-events` (không đổi code)

Đóng mục CÒN TREO quan trọng nhất của entry ADR-0043 bên dưới. Chạy tay trên
site thật theo từng bước, user bấm, agent đo.

**Đường đi:** đặt `BK-XKEHLSZL` (Hanoi Old Quarter Street Food by Night, đợt
16/10/2026, 1 người lớn, 35.00 USD) bằng tài khoản khách `boscowong31@`, trả qua
Stripe test mode, rồi huỷ. Chọn đợt 16/10 vì tour 1 ngày nên N = 1, hạn chót
15/10 — còn xa, huỷ phải hoàn ĐỦ. Hộp xác nhận in đúng "full refund of $35.00".

**Đo được, khớp từng lời hứa của ADR-0043:**

| Kiểm | Kết quả |
| --- | --- |
| Dòng sổ `refunds` | 35.00 USD, `re_3UHzrvK1oRTwa7qk1hs4Rxnw`, `admin_id` NULL |
| Row `payment_events` | type `payment.refunded`, gắn `BK-XKEHLSZL` |
| `event_id` là id refund của CỔNG | trùng `provider_refund_id` |
| `processed_at` = `received_at` = `refunds.created_at` | cả ba đúng `05:37:06.615` |
| `payload` | `source: refund-core`, `cause: cancel`, đủ ba id |
| `payment.refunded` toàn prod | 0 trước, **1** sau |
| Trang admin `/payment-events` | có dòng "Refund issued", 35.00, gắn đúng booking; drawer in đúng payload |

**Sửa một con số ghi sai ở entry ADR-0043 bên dưới.** Entry đó viết "hai khoản
hoàn cũ trên prod sẽ còn làm bất biến báo **2** cho tới lượt seed 03/11". Đo
thật thì là **46**: prod seed ngày 18/09 bằng bộ sinh CŨ nên 44 dòng hoàn của
seed mang type thô (`charge.refunded` 30, `PAYMENT.CAPTURE.REFUNDED` 14) và
cũng trượt bất biến mới, cộng 2 khoản hoàn thật. Bản chất không đổi — lượt seed
lại khoảng 03/11 ghi đúng `payment.refunded` và xoá cả 46 cùng lúc — nhưng con
số thì phải nói đúng.

**Một quan sát củng cố quyết định của ADR-0043:** lượt thanh toán này lại đẻ
thêm đúng 2 event Stripe không map được (`other` đi từ 4 lên 6), y như hôm
18/09. Nếu chọn hướng "bật `charge.refunded` ở dashboard" thay vì để lõi tự
ghi, dòng hoàn sẽ rơi vào đúng cái hố "Other / Not linked" đó.

**CÒN TREO:** connector Stripe trong phiên đã hết hạn nên KHÔNG đối chiếu được
dashboard cổng; `re_…` là id do chính Stripe trả về nên khoản hoàn chắc chắn đã
phát, nhưng muốn nhìn tận mắt thì mở dashboard test mode tìm
`pi_3UHzrvK1oRTwa7qk1fb0095a`. Booking `BK-XKEHLSZL` ở lại prod dưới dạng
CANCELLED đã hoàn đủ — không cần dọn, lượt seed 03/11 xoá sạch.

Tests after: không đổi code, không chạy lại cổng. Bằng chứng là dữ liệu prod đo
trực tiếp, liệt kê ở bảng trên.

## 2026-09-21 — Ba món nợ nhỏ sau đợt hoàn tiền: JSDoc cũ, dải chip chết, favicon 404 (nhánh `chore/refund-followups`)

Gom ba mục còn treo trong bản bàn giao sau đợt "hoàn tiền một hạn chót". Không
mục nào đổi hành vi money-path; không migration.

- `71050455` docs(contract): khối JSDoc trên `CancellationRequestStatusSchema`
  còn tả luồng duyệt huỷ của ADR-0029/0030 (REQUESTED là đơn đang mở, DENIED là
  admin từ chối, REFUNDED là đã duyệt rồi hoàn theo bảng bậc) — cả ba vế đều sai
  từ ADR-0041. Viết lại: `REFUNDED` là kết cục thường và mang nghĩa "đã giải
  quyết", KHÔNG phải "đã có tiền về" (huỷ quá hạn hoàn 0 cũng ghi nó mà không
  sinh dòng sổ `refunds`); `REQUESTED`/`DENIED` chỉ còn để đọc dữ liệu cũ. Câu
  cuối là đo được chứ không đoán: `verify-seed.mjs` dòng 242 đã có bất biến
  "yêu cầu huỷ còn REQUESTED hoặc DENIED" phải bằng 0. Chỉ sửa comment.
- `139c6f5a` refactor(web): xoá `DepartureStrip`. Bản bàn giao ghi "không trang
  nào render" — đúng nhưng chưa đủ: nó CÓ một người import là
  `DepartureStripConnected`, mà chính wrapper đó mới là thứ không ai gọi. Trang
  chi tiết tour cố ý bỏ dải chip theo wireframe đã duyệt (panel đặt chỗ ngay
  dưới đã in đúng bốn ô ngày đó), nên cả cụm là mã chết — và là mã chết mang
  LUẬT CŨ: nó chọn đợt theo mỗi `seatsLeft`, chưa qua `isDepartureOpen` của
  ADR-0041. Xoá component, spec 13 test, wrapper, và `MockTourDeparture` (consumer
  duy nhất của type đó là chính file vừa xoá — đúng tiền lệ `mocks/types.ts` đã
  ghi sẵn cho `MockTourDifficulty`/`MockTourBadge`). Hình dạng một đợt ở web nay
  chỉ còn `DepartureVM`. Vá năm chỗ chú thích trỏ tới file đã xoá, trong đó
  `tour-hero.spec.tsx` là chỗ ngoài kế hoạch tự lòi ra khi quét.
- `8d8da389` fix(web): rewrite `/favicon.ico` sang `/icon` ở `next.config.ts`.
  Icon sinh động từ `app/icon.tsx` (ADR-0038 AMEND 4) nên tab trình duyệt vẫn
  đúng, nhưng trình đọc RSS, crawler và trình duyệt cũ gọi thẳng `/favicon.ico`
  và nhận 404. Chọn rewrite thay vì đặt `public/favicon.ico` để giữ MỘT nguồn
  sự thật cho icon. Đo thật sau khi dựng, không chỉ khai là đã thêm dòng config:
  `/favicon.ico` trả 200, `content-type: image/png`, magic byte PNG đúng.
- `5caf15ef` chore(api): `EMAIL_FROM` mẫu ở `.env.example` đổi từ `tourism.test`
  sang `noreply@nexora-travel.agency`. Tên miền cũ chưa verify ở Resend nên mọi
  lượt gửi ở máy dev bị 403 và outbox đánh FAILED — đó là lý do luồng quên mật
  khẩu không thử được ở máy hôm 18/09. Kèm chú thích nói rõ phần sau `@` phải là
  tên miền đã verify. (`.env.local` của máy cũng đổi theo, nhưng file đó không
  commit.)

**Một lượt gate đỏ vì FLAKE, không phải hồi quy — ghi lại để khỏi truy lại lần
sau.** `apps/web/src/mocks/mocks.spec.ts` (test FAQ) timeout đúng 30 000ms trong
lượt `gate:int` đầu. Truy: test là hàm thuần (`await import('./faq.js')` rồi so
chuỗi), không I/O, không có gì để mất 30 giây; chạy riêng 14/14 xanh; chạy trọn
bộ web một mình 1525/1525 xanh; file đó lần cuối đổi ở `8e3f52e2` chứ không phải
đợt này, và thứ đợt này sửa trong `src/mocks/` chỉ là type — bị xoá lúc runtime,
mà typecheck trong chính lượt gate ấy đã xanh. Nguyên nhân là tranh tài nguyên:
bộ web tốn 631 giây CPU chỉ để import trên 96 giây thực, nên khi turbo chạy 8
package cùng lúc kèm một API server thì một `import()` kẹt là chuyện sẽ tới.
Chạy lại với `--concurrency=2` xanh trọn 28/28. Kết luận vận hành: ở máy này
chạy gate nên hãm concurrency, đừng đọc một lượt đỏ kiểu này là hồi quy.

**CÒN TREO:** Việc 4 của bản bàn giao (chuyển hướng `.vercel.app` về www, OTP gửi
ngay, tự đăng nhập sau OTP) vẫn chưa làm — cả ba chờ user chọn. Lỗ hổng
`image-size` mà workflow Audit bắt được đã do `f4809d3f` xử lý ở nhánh khác,
không thuộc đợt này.

**Review findings:** chưa có vòng review riêng.

Tests after: cổng đầy đủ xanh (28/28 task với `--concurrency=2`, int 6/6, API nền
sống cho build web). Int 497 ở 39 file, không đổi. Vitest 3676, trong đó web 1525
(bớt 13 test của `departure-strip.spec.tsx`; phần tăng so với entry trước là của
`969ccb7b` thêm `retry-fetch.spec.ts` theo ADR-0044, không phải đợt này); api 932,
admin 838, contract 279, core 46, ui 22, tokens 18, i18n 16 đều không đổi. Jest
mobile 245 không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — Hoàn tiền để lại vết ở sổ `payment_events` (nhánh `feat/refund-payment-event`, ff vào `main` `a1544081` — ĐẨY NHẦM, xem mục Review findings)

Hai khoản hoàn THẬT trên prod (`BK-7WKW9ESB`, `BK-PY7IZMD4`, nghiệm thu 18/09)
chỉ có event lượt thu, nên `/payment-events` — kính soi tiền của admin — không
bao giờ thấy tiền đi ra. Rà ra **ba** nguyên nhân chứ không một, và hai cái sau
khiến "bật thêm event ở dashboard" một mình là vô nghĩa:

1. Cả ba đường ghi dòng sổ `refunds` (admin hoàn thiện chí, khách tự huỷ,
   auto-refund của money-path) đều chỉ ghi `refunds`, không đường nào chạm
   `payment_events`.
2. Với Stripe, `data.object` của `charge.refunded` là một **Charge** — ta chỉ
   đặt `metadata[bookingId]` trên Checkout Session, không bao giờ đặt
   `payment_intent_data[metadata]`, nên Charge không mang metadata đó.
   `mapStripeEvent` đọc `object.metadata?.bookingId` và `object.amount_total`,
   Charge không có cả hai → row sẽ là `other` / không gắn booking / **không cả
   số tiền**. Đúng hình dạng hai row "Other / Not linked" prod đã ghi 18/09.
3. Seed ghi type **thô** của provider (`checkout.session.completed`,
   `charge.refunded`) còn `beginEvent` của app thật ghi type **trung lập**
   (`payment.completed`…). Nên không chỉ dòng hoàn lệch — dòng thu cũng lệch,
   mọi row seed nằm ngoài bộ lọc type của admin, và bất biến nghiệm thu seed
   (dò hai chuỗi thô) **không thể đúng với dữ liệu thật dù chọn hướng nào**.

Chốt hướng sau brainstorming ([ADR-0043](adr/0043-refund-payment-event.md)):
`payment_events` đổi nghĩa thành sổ sự kiện tiền CẢ HAI CHIỀU. Row hoàn không
phải dữ liệu bịa — cổng thật sự có phát event hoàn, ta ghi nó từ response của
API refund thay vì đợi echo. Đối soát qua webhook để dành dạng CHỈ ĐỌC, không
làm đường ghi thứ hai.

- `23768ed2` docs(adr): ADR-0043, ba nguyên nhân đo được, hai phương án đã bỏ
  (chỉ-bật-webhook; và giữ `payment_events` thuần webhook rồi cho admin đọc sổ
  `refunds` ở vùng khác — bỏ vì không đạt nghiệm thu user đặt ra).
- `41575415` feat(api): `VerifiedEvent['type']` nay là TỪ VỰNG của cột
  `payment_events.type`, thêm giá trị thứ năm `payment.refunded`; kéo theo
  `PAYMENT_EVENT_TYPES`, nhãn i18n "Refund issued" và icon `Undo2` ở menu lọc
  admin. **Không migration** — cột là `varchar(100)` tự do, không phải enum
  Prisma, nên không có gì phải deploy lên Supabase. Mirror spec ép hai chiều
  tuple ⊆ union và union ⊆ tuple nên quên chỗ nào là đỏ typecheck.
- `5d3d83d0` feat(api): builder THUẦN `refund-event.ts`, ba call-site ghi row
  trong ĐÚNG transaction đang ghi dòng sổ (vẫn trong advisory lock ADR-0009).
  `eventId` lấy id refund của CỔNG để khoá `[provider, eventId]` vẫn là lớp
  chống trùng thật; hai mốc bằng ĐÚNG `refunds.created_at` — đường huỷ cho CTE
  `refund_insert` trả `created_at` rồi dùng lại, hai đường kia lấy từ row Prisma
  vừa tạo. Ba khoản hoàn NGOÀI sổ (lệch tiền, dup-capture, nhánh off-ledger)
  giữ nguyên đường `note` của ADR-0006 AMEND 2a, có test chốt chặn. Seed ghi
  type trung lập và `eventId` là id refund của cổng; bất biến `verify-seed` đổi
  sang `payment.refunded`. Viết lại JSDoc ở bảy chỗ còn gọi bảng này là "sổ
  webhook".
- Chỉ số `paymentEvents.received` của dashboard nay gộp cả row hoàn. **Cố ý**
  (user chốt 21/09): mô tả đổi từ "thông lượng webhook" sang "số dòng sổ sự kiện
  tiền trong kỳ". Loại một type ra khỏi một chỉ số thông lượng là đúng thứ
  luật-chồng-luật rồi không ai nhớ.
- Hai thứ phải sửa dọc đường, đều là **rác cục bộ chứ không phải lỗi mã**:
  Prisma Client sinh ra ở máy còn bản trước M2 (thiếu `BOOKING_CANCELLED`) nên
  `typecheck` đỏ 19 lỗi `EmailType` cho tới khi `prisma generate`; và `.next` của
  admin còn trỏ hai trang `cancellations` đã xoá theo ADR-0041 nên
  `admin#typecheck` đỏ cho tới khi xoá thư mục. Lượt gate đầu còn đỏ ở
  `web#build` với `ECONNREFUSED` — đó là yêu cầu đã biết của ADR-0016 (build web
  cần API SỐNG, xem `ci.yml` bước "Migrate + seed db rồi mở API nền"), không
  phải hồi quy; chạy lại với API nền ở `localhost:3001` thì xanh.

**CÒN TREO cho session gốc:**

- **Nghiệm thu trên site thật** (thứ duy nhất chứng minh xong): huỷ một booking
  sandbox → `/payment-events` phải có dòng `Refund issued` gắn đúng booking,
  đúng số tiền.
- **Hai khoản hoàn cũ trên prod KHÔNG backfill** (user chốt 21/09): lượt seed
  lại prod khoảng 03/11 (ADR-0041 Phụ lục B Bước 8) xoá sạch chúng, nên
  migration backfill là làm việc rồi bị xoá. Tới lúc đó `seed:verify` trên prod
  vẫn báo 2 ở mục "refund không có đúng một payment event hoàn" — con số đã
  biết, không phải lỗi mới.
- **Nhánh này mang thêm 5 commit docs/mockup của một session khác**
  (`a176b7b4`…`8dafd4ee`, cụm mobile P5b và mục lục thư mục mockup) commit chồng
  lên trong lúc thi công. Không phải của đợt này. Cả 5 nay đã ở `main`.

**Review findings:** chưa có vòng review riêng. **Nhánh lên `main` do ĐẨY NHẦM
21/09**: session mockup được user duyệt đẩy MỘT commit docs (`8dafd4ee`) nhưng
chạy `git push origin HEAD:main` mà không kiểm lại HEAD — HEAD đã dịch sang
`a1544081` vì session này commit chồng lên trong lúc đó, nên ba commit của đợt
này đi theo. User chốt 21/09 **giữ trên `main` và review tại chỗ** thay vì
revert: không có migration nào đi kèm (0 file trong `prisma/migrations/`) nên
không có thay đổi DB nào được deploy, và revert thì Render/Vercel phải dựng
thêm một lượt nữa. Việc còn lại: chạy vòng review, sửa gì thì vá bằng commit
MỚI trên `main`.

Bài học cho lần sau: nhánh dùng chung nhiều session thì `git push HEAD:main`
là cái bẫy — phải `git log --oneline origin/main..HEAD` ngay trước khi đẩy,
hoặc đẩy đích danh SHA (`git push origin <sha>:main`).

Tests after: cổng đầy đủ xanh (28/28 task, int 6/6, với API nền sống). Int 497 ở
39 file (thêm 2: đường admin và đường khách tự huỷ). Vitest 3657, trong đó api
932 có thêm 7 test (5 cho builder `refund-event`, 2 cho chốt chặn từ vựng type ở
fixture seed chạy trên hai mốc H); các package còn lại không đổi — admin 838,
web 1506, contract 279, core 46, ui 22, tokens 18, i18n 16. Jest mobile 245
không đổi. Lint vẫn đúng 1 warning và 1 info có từ trước.

## 2026-09-21 — M2 hoàn tiền một hạn chót: xoá hai cột badge huỷ và ba loại email duyệt (nhánh `chore/refund-deadline-m2`, ff vào `main`)

Migration thu hẹp đi sau M1 đúng một nhịp (Phụ lục B Bước 7 của plan 15/09,
spec 15/09 §10 bước 7). Code viết 19/09; merge và deploy 21/09 sau khi bản
ADR-0041 đã chạy thật ba ngày, đúng khoảng chờ user chốt 17/09. Prod đã seed lại
18/09 nên không bản API nào còn đọc hai cột.

- `22ec285a` chore(api): migration `20260919111406_refund_deadline_contract` xoá
  `tours.free_cancellation_days` và `cancellation_requests.free_cancellation_days`;
  dựng lại enum `EmailType` không còn `CANCELLATION_REQUESTED`,
  `CANCELLATION_APPROVED`, `CANCELLATION_DENIED` (Postgres không có
  `ALTER TYPE … DROP VALUE`). Migration mang chốt chặn `DO $$ … RAISE`: còn dòng
  `outbox` mang ba giá trị ấy thì dừng, không đổi kiểu nửa chừng.
- Code theo sau trong cùng commit: `EmailTypeSchema` còn 12 giá trị
  (`BOOKING_CANCELLED` vẫn cuối); gỡ ba `case` của `render-email.tsx` (105 dòng),
  ba mục của `outbox-type-menu.tsx` cùng ba icon mồ côi, và ba nhãn ở
  `@tourism/i18n`. Hành vi "hoàn 0 thì không hứa tiền" đã nằm ở biến thể không
  hoàn của `BOOKING_CANCELLED` (hai ca `amount: '0.00'` trong spec), nên xoá
  describe cũ không mất bất biến nào.
- Lệch plan, đã xử lý: Step 4 chạy `prisma migrate dev` không kèm `DATABASE_URL`,
  tức rơi vào DB Docker `tourism` dùng chung. Checkout gốc còn trên `main` chưa
  có M2 sẽ hỏng, vì Prisma Client ở đó vẫn SELECT hai cột. Lượt này tạo và kiểm
  migration trên DB riêng `tourism_m2` rồi xoá; sau cổng xoá luôn `tourism_test`,
  vì globalSetup chỉ `migrate deploy` chứ không reset — lần chạy sau tự dựng lại
  theo migration của checkout đang chạy.
- Chú thích ở `seed.ts` từng nói M2 xoá cả `decision_note`; sai, M2 chỉ xoá
  `free_cancellation_days`. Đã sửa.
- **Lệch plan nặng nhất, bắt được trước khi deploy:** Step 12 bảo chạy M2 lên
  Supabase TRƯỚC khi push. API đang chạy vẫn khai hai cột trong `schema.prisma`,
  và Prisma Client liệt kê mọi cột khi query không có `select` riêng
  (`catalog.service.ts` trang chi tiết tour, `cancellations.service.ts` lịch sử
  huỷ) — xoá cột trước là 500 cho tới khi Render dựng xong API mới. Thứ tự đúng:
  push code, chờ Render chạy API mới, rồi mới chạy M2. Step 12 của plan đã sửa.

Kiểm trên DB riêng: `migrate dev` lần hai báo "Already in sync" (SQL viết tay
khớp `schema.prisma`); seed H = 2026-09-18 trên schema M2 rồi `seed:verify`
0 vi phạm trên 106 bất biến. Trên prod trước khi push: `outbox` không còn dòng
nào mang ba loại cũ (chốt chặn sẽ qua), `migrate status` chỉ còn M2 chưa áp.

**Trạng thái deploy:** commit code push lên `main` lúc 07:19 giờ VN 21/09; Render
dựng xong bản mới lúc 07:23 (deploy `dep-dao7g72jnfac739etisg`, `status: live`),
CI `gate` của `22ec285a` xanh; **M2 chạy lên Supabase lúc 07:28 giờ VN 21/09**,
`migrate status` in "Database schema is up to date!". Đo lại trên prod ngay sau
đó: không còn cột `free_cancellation_days` nào, enum `EmailType` còn 12 giá trị
đúng thứ tự với `BOOKING_CANCELLED` ở cuối, kiểu tạm `EmailType_old` đã bị xoá.
Kiểm chạy: `/api/tours/{slug}` (đường Prisma đọc mọi cột của `Tour`),
`/api/tours`, `/health` và bốn trang web đều 200 — gọi mỗi trang hai lần vì ISR.

**Review findings:** không có vòng review riêng; migration và phần gỡ code theo
đúng plan đã duyệt, cổng đầy đủ là lưới.

Tests after: cổng đầy đủ xanh. Int 495 ở 39 file (có spec đối chiếu thứ tự enum
giữa DB và contract). Vitest 3650 (api 925, bớt 11 test của ba template; contract
279, admin 838, web 1506, core 46, ui 22, tokens 18, i18n 16) và jest mobile 245.
Build 8/8, web 75/75 trang. Typecheck 15/15. Lint chỉ còn 1 warning và 1 info có
từ trước. `check-admin-prerender` OK, tokens-only ✓.

## 2026-09-18 — Tinh chỉnh giao diện web và admin: hạn chót huỷ, hộp huỷ, nút Export, nút Ask about, favicon (nhánh `fix/ui-polish-web-admin`, ff vào `main`)

User gom năm góp ý giao diện từ hai lượt nghiệm thu (test tay 17/09, nghiệm thu
prod 18/09) vào một nhánh. Bốn commit, không migration, không đổi API:

- `8039a8f3` nút "Ask about this trip" ở hàng chuyến đã đóng của tab Departures:
  chữ xuống hai dòng kế thừa `text-right` của ô bảng nên canh phải, nay canh giữa.
- `c3fc9dec` favicon: web vẫn dùng `favicon.ico` mặc định của create-next-app
  (chính là logo Vercel, có từ scaffold 22/07), admin không có favicon nào. Hai
  app nay sinh `app/icon.tsx` (32px) và `app/apple-icon.tsx` (180px) bằng
  `ImageResponse`: hai viên kim cương của logo trên ô vuông nền primary, màu lấy
  từ `@tourism/tokens/theme`; hình mark tách thành hằng `LOGO_MARK` dùng chung
  với `Logo`. Ở admin, `/icon` và `/apple-icon` vào `PUBLIC_PATHS` (không thì
  trang login mất icon) và vào allowlist của `check-admin-prerender.mjs`, ghi
  thành ADR-0038 AMEND 4.
- `02edc785` nút Export CSV của admin: cao 32 → 28px, rộng tối thiểu 192 → 144px,
  chữ 11 → 10px; giữ nguyên kiểu HUD.
- `8646aa7c` trang booking của khách: hạn chót huỷ miễn phí từ dòng chú thích xám
  cỡ nhỏ thành khối có viền, tiêu đề, icon lịch và chữ cỡ thân bài; quá hạn thì
  cả khối sang tông cảnh báo. Hộp xác nhận huỷ rộng 384 → 512px, tiêu đề
  `text-xl`, thân và link `text-base`, hai nút cỡ lớn.

Nghiệm thu: user xem bằng mắt trên localhost bốn mục (DB Docker riêng
`tourism_ui`, H = 2026-09-18). Nút Export để kiểm trên production vì admin local
không đăng nhập được: thư đặt lại mật khẩu bị Resend từ chối 403, do `.env.local`
gửi từ tên miền `tourism.test` chưa xác minh.

**Review findings:** không có vòng review riêng; đây là tinh chỉnh giao diện nhỏ,
user duyệt bằng mắt từng mục.

**CÒN TREO:** kiểm nút Export trên production sau deploy · xoá DB Docker
`tourism_ui` khi nghiệm thu xong · ở máy dev không gửi được thư thật (tên miền gửi
`tourism.test`), muốn thử luồng email ở máy thì đổi địa chỉ gửi sang tên miền đã
xác minh · ba đề xuất 18/09 user chưa chọn làm: chuyển domain `.vercel.app` về
www, gửi OTP ngay khi tạo mã, tự đăng nhập sau khi xác minh OTP.

Tests after: cổng đầy đủ xanh. Int 495 ở 39 file. Vitest 3661 (admin 838 có thêm 2
test cổng icon, web 1506, api 936, contract 279, core 46, ui 22, tokens 18, i18n
16) và jest mobile 245. Build 8/8, web 75/75 trang (thêm hai route icon, bớt
`favicon.ico`). Typecheck 15/15. Lint chỉ còn 1 warning và 1 info có từ trước.
`check-admin-prerender` OK, tokens-only ✓.

## 2026-09-18 — Triển khai hoàn tiền một hạn chót lên prod và seed lại dữ liệu (Phụ lục B Bước 2–6)

Phần hạ tầng của entry ngay dưới. Không đổi code; commit này chỉ mang snapshot,
bản đồ tài liệu và hai ghi chú cho plan.

- **Bước 2 (09:40 giờ VN):** M1 `20260915120000_refund_deadline_expand` lên
  Supabase qua Session pooler cổng 5432, `migrate status` báo "up to date"; API cũ
  vẫn `database: up`.
- **Bước 3–5:** Ignored Build Step của hai project Vercel tạm để không build. Push
  `2060c457..3569f496` thì deployment của web và admin đều Canceled, đúng ý đồ.
  Render chạy API mới sau khoảng 100 giây; CI run `35301236930` success. Redeploy
  web và admin từ chính bản Canceled của `3569f496`, bỏ build cache, rồi trả
  Ignored Build Step về giá trị cũ. Web: `/`, `/tours`, `/cancellation-policy` và
  trang tour trả 200, in hạn chót từng chuyến. Admin: `/bookings`, `/outbox`,
  `/reports` tải được, `/cancellations` ra 404.
- **Bước 6, seed lại prod với H = 2026-09-18.** Đo trước: prod không có dòng nào
  tạo sau lượt seed 15/09, tức toàn dữ liệu seed. Tập dượt trên DB Docker rỗng dựng
  bằng `migrate deploy`: `seed:verify` 0 vi phạm trên 106 bất biến; bốn chốt chặn
  nhắm prod (thiếu cờ, thiếu H, H ở tương lai, mật khẩu khách trống) đều dừng trước
  khi kết nối. Lượt prod: `snapshot:export` 3117 dòng (`docs/snapshots/2026-09-18/`
  đi cùng commit này, `backups/2026-09-18/` gitignored); `data:reset` chạy khô rồi
  chạy thật, xoá 2662 dòng (có 9 yêu cầu `REQUESTED` của luồng duyệt cũ), giữ đúng
  một admin; `db:seed` ghi 702 booking, 730 payment event, 44 dòng hoàn, 15 yêu cầu
  huỷ, 261 chuyến, 119 review, 67 enquiry, 177 subscriber, 120 khách giả và gỡ 29
  policy `CANCELLATION` cũ; `seed:verify` 0 vi phạm trên 106 bất biến.
- **Nghiệm thu sandbox Stripe, đạt 5/5**, trên tài khoản khách mới do user tạo:
  1. `BK-7WKW9ESB` (tour trong ngày, đi 22/11) trả bằng thẻ test: `PAID`, webhook
     xử lý ngay, thư xác nhận Sent.
  2. Huỷ trong hạn: hộp xác nhận "Cancel and refund $49.00"; booking `CANCELLED`,
     một dòng hoàn $49 mang mã refund Stripe, `admin_id` NULL, thư huỷ Sent.
  3. Admin ghi "By the customer · Within the free-cancellation deadline (21 Nov
     2026) · Refunded $49.00". Mã refund do Stripe trả về, API chỉ ghi dòng hoàn
     sau khi có mã; phía dashboard Stripe do user tự xem (Stripe MCP của agent nối
     một tài khoản khác).
  4. Huỷ quá hạn trên booking seed `BK-9L93LTWH`: "Cancel without refund", không
     dòng hoàn, không gọi cổng. Thư biến thể không hoàn bị Resend từ chối 422 vì
     địa chỉ `@example.com` của khách seed: outbox có một dòng FAILED, không thử
     lại, lượt seed 2 sẽ dọn.
  5. Trang `central-honeymoon-5d`: chuyến 22/09 ghi "Booking closed" kèm "Ask about
     this trip", bốn ô tổng hợp bỏ qua chuyến đã đóng.

**Phát hiện trong lúc triển khai:**

- Danh sách Deployments của Vercel không hiện bản Canceled, phải mở thẳng trang
  deployment để Redeploy; Redeploy bản Ready cũ hơn là build lại code cũ. Đã ghi
  vào Bước 5 của plan.
- Lệnh `echo "${DATABASE_URL%%@*}"` ở Bước 2 của plan in ra MẬT KHẨU (phần trước
  `@`). Lượt này không dùng nó; plan đã sửa thành `${DATABASE_URL##*@}`.
- Mở web qua `tourism-platform-v2-web.vercel.app` thì đăng ký báo "Something went
  wrong": API chỉ trả CORS cho `www.nexora-travel.agency`, đúng thiết kế W3/W4.
  Nên cho domain `.vercel.app` chuyển hướng về www.
- Thư OTP chờ khoảng 1,5 phút vì outbox gửi theo cron mỗi phút. Xác minh OTP xong
  phải đăng nhập lại là cố ý từ 20/08 (verify không phát session).

**CÒN TREO:** Bước 7 (nhánh M2, sau vài ngày chạy thật) · Bước 8 (lượt seed 2
khoảng 03/11) · nhánh tinh chỉnh giao diện web và admin mà user gom ngày 18/09 ·
chuyển `backups/2026-09-18/` từ worktree về checkout gốc trước khi gỡ worktree ·
seed lại DB Docker `tourism` theo code mới.

Tests after: không đổi code; CI của `3569f496` success.

## 2026-09-18 — Hoàn tiền một hạn chót mỗi chuyến (ADR-0041, nhánh `feat/refund-deadline`, ff vào `main`)

Thay bảng bậc 100/50/25/0, ân hạn 24 giờ và luồng duyệt huỷ bằng MỘT hạn chót
cho mỗi chuyến: ngày chót = khởi hành trừ N, với N là 1 cho tour trong ngày, 3
cho tour 2–3 ngày, 7 cho tour từ 4 ngày. Cùng một mốc vừa ngừng nhận đặt vừa hết
huỷ miễn phí. Khách tự huỷ và hệ thống xử lý ngay: trong hạn hoàn trọn phần còn
lại, quá hạn hoàn `0.00` và không gọi cổng thanh toán. Mọi phép so ngày theo giờ
Việt Nam, tính ở server. 15 task, 14 commit thi công (`b11c5a5f..e5cf0cbf`, kèm
hai commit ghi chú cổng), một commit vá sau nghiệm thu, một commit ghi điều chỉnh
seed prod và bốn commit vá sau review: 22 commit, rebase lên `main` `2060c457`.

- Luật là bộ hàm thuần ở `libs/shared/contract/src/schemas/refund-policy.ts`
  (`cancellationDeadline`, `isWithinDeadline`, `canCancelOnline`,
  `refundOnCancel`, `vietnamToday`); API, web, admin, seed và email gọi chung.
- Lõi huỷ `cancelInLock` chạy trong advisory lock của booking: gọi cổng thanh
  toán TRƯỚC, một CTE ghi SAU (booking CANCELLED, yêu cầu REFUNDED, dòng hoàn
  nếu có, trả ghế, outbox `BOOKING_CANCELLED`). P4e-1 dùng lại cho nút
  "Cancel departure".
- Gỡ: vùng Cancellations của admin, `admin.cancellations.*`, stepper duyệt,
  `CANCELLATION_OPEN`, `refundEstimate`, badge `freeCancellationDays`.
- Báo cáo tháng đổi cặp approved/denied thành huỷ trong hạn và huỷ quá hạn; P&L
  tính tiền giữ lại của booking huỷ quá hạn là doanh thu (ADR-0033 AMEND 2).
- Hai migration: M1 `20260915120000_refund_deadline_expand` (mở rộng) chạy cùng
  đợt này; M2 thu hẹp đi ở nhánh riêng sau khi prod đã seed lại.
- Plan 15 task sai hoặc sót khoảng một chục chỗ nhỏ (fixture, vòng đếm grep, copy,
  số ca seed); mỗi chỗ đã vá lúc thi công và ghi trong message commit của task đó.

**Đóng hai mục CÒN TREO:**

- Chốt chặn đặt chỗ: từ nay `create` và `checkout` bị chặn sau hạn chót của
  chuyến, thay cho đề xuất "chốt chặn 3 ngày" còn treo từ vòng rà 04/09.
- `search_path` của `refunds_sum_within_total()` đã ghim
  (`SET search_path = public, pg_temp`), đóng cảnh báo
  `function_search_path_mutable` của linter Supabase.

**Nghiệm thu 17/09:** `seed:verify` 0 vi phạm trên 106 bất biến ở ba mốc H
(20/09, 03/11, 17/09), mỗi mốc một DB Docker mới dựng bằng `migrate deploy`. User
test tay 10 bước trên trình duyệt, đạt cả 10: khách huỷ trong hạn và quá hạn, cổng
lỗi thì booking giữ nguyên, API chặn đặt chuyến đã đóng, lịch sử huỷ và hoàn
thiện chí ở admin, outbox, báo cáo và file Excel. Bốn phát hiện giao diện, vá
trong `0d0659db`:

- Tháng chỉ còn chuyến đã đóng vẫn báo "Almost full": `monthNotice` nay bỏ chuyến
  đã đóng khi xét ghế và báo "Booking closed" khi tháng hết chuyến nhận đặt.
- Ô "Seats left" cộng cả ghế chuyến đã đóng dưới nhãn "across every open date".
- Ô "Price range" tính cả giá chuyến đã đóng; hết chuyến nhận đặt thì lùi về
  `basePrice` như `heroPrice`. Ô "Next departure" cùng lỗi, nay ghi "Booking closed".
- Testimonial mẫu "Cancelled two days before … refunded" trái luật với chuyến từ
  hai ngày trở lên, đổi thành huỷ trước một tuần.

**Review findings:** 3, cả ba trên đường tiền, vá trong `c95d5fa4`, `f283d829`,
`896b1b15`; `64151282` ghi lại vào ADR-0041 §4 và spec §4.4.

- Event `payment.completed` gửi lại trên booking khách đã huỷ quá hạn đi đường
  tiền mồ côi, tức hoàn trọn khoản luật cho giữ và đổi booking sang REFUNDED.
  `handleCaptureOnCancelled` nay xét `provider_payment_id` của booking: NULL là
  tiền mồ côi thật (đường cũ), trùng capture là event gửi lại nên không làm gì,
  capture khác là khách trả hai lần nên hoàn ngoài sổ.
- Hộp xác nhận in số hoàn lúc tải trang còn server tính lại lúc bấm: mở trang
  trước nửa đêm ngày hạn chót rồi bấm sau nửa đêm thì booking bị huỷ với 0 đồng
  mà khách không được hỏi lại. `bookings.cancel` nay bắt buộc
  `expectedRefundAmount`; lệch thì 409 `REFUND_AMOUNT_CHANGED` và không ghi gì,
  web báo khách rồi tải lại số mới.
- Khoá chống trùng `cancel:<bookingId>` giữ nguyên qua mọi lần thử trong khi số
  tiền tính lại từ sổ: hoàn thiện chí xen giữa hai lần thử thì cổng từ chối vì
  trùng khoá, khách kẹt ở `REFUND_FAILED`. Khoá nay là
  `cancel:<bookingId>:<tổng đã hoàn>`; câu `REFUND_FAILED` thôi khẳng định booking
  "không đổi gì", log API ghi khoá và nhắc đối soát khi lỗi là hết giờ chờ.

Rủi ro còn lại, đã báo user và chấp nhận: Stripe lưu cả phản hồi lỗi 500 theo khoá
trong 24 giờ; cổng hết giờ chờ nhưng thật ra đã hoàn, sau đó khách quá hạn xác
nhận huỷ 0 đồng, thì sổ lệch cổng và phải đối soát tay.

**Trạng thái deploy:** M1 chạy lên Supabase 18/09 (Phụ lục B Bước 2 của plan),
TRƯỚC khi push. Seed lại prod chạy sau push và ghi ở entry sau.

**CÒN TREO:**

- Seed lại prod theo seed spec §8.3 và nghiệm thu sandbox Stripe năm mục (Phụ lục
  B Bước 6).
- M2 (xoá hai cột `free_cancellation_days` và ba loại email duyệt huỷ, Phụ lục A):
  chỉ chạy sau khi bản mới đã chạy prod vài ngày (Bước 7).
- Lượt seed prod 2 khoảng 03/11 với bốn điều chỉnh ghi 17/09 (Bước 8).
- Nợ P4e-1: nút "Cancel departure" mở `cancelInLock` cho `initiator: 'operator'`
  và CHECK `end_date >= start_date` trên `tour_departures`.
- JSDoc của `CancellationRequestStatusSchema` (`libs/shared/contract/src/schemas/bookings.ts`)
  còn tả luồng duyệt cũ. `DepartureStrip` (giữ có chủ đích, chưa trang nào dùng)
  chưa theo cờ `bookable`.
- Góp ý giao diện user để làm sau: dòng hạn chót ở trang booking và hộp huỷ quá
  nhỏ, nút Export của admin quá to.
- DB Docker dùng chung `tourism` đã có M1 nhưng dữ liệu vẫn theo seed cũ; seed
  lại theo code mới trước khi dev tiếp.

Tests after: cổng đầy đủ xanh sau rebase (bảy lệnh của Phụ lục B Bước 4). Int 495
test ở 39 file. Unit Vitest 3659 (contract 279, api 936, admin 836, web 1506, core
46, ui 22, tokens 18, i18n 16) và jest mobile 245 (mobile 159, mobile-ui 86). Build
8/8, web 74/74 trang với API sống ở `localhost:3001`. Typecheck 15/15. Lint chỉ
còn 1 warning và 1 info có từ trước nhánh. Tokens-only ✓ 65 file nguồn mobile.

## 2026-09-18 — Vòng vá review 2 cụm auth mobile: review nhánh của Nghĩa, giữ ba phần, vá bốn chỗ (`fix/p5b-auth-review-2`, ff vào `main`)

User review nhánh `feat/mobile-dev-api-url-auto-derive` của Nghĩa (2 commit
`32ef255e`, `dacc4fdd`, rẽ từ `ee91d5b1` — TRƯỚC vòng vá review 1) bằng review 10
góc có kiểm chứng; 15 phát hiện đều xác nhận. User chốt 18/09: dựng nhánh mới từ
`main`, chỉ đưa sang phần khớp bản vẽ, commit của Nghĩa đứng tên Nghĩa; nhánh gốc
xoá sau merge.

Đưa sang, đứng tên Nghĩa:

- `1f2efd15` nút pill cao 46dp — đúng `.btn` 46px của bản vẽ.
- `ed2d0353` tự suy origin API dev từ `hostUri` của Metro (bản gốc, vá ở dưới).
- `60154a49` nút Next onboarding tròn 54dp nền primary — đúng `.round` của bản vẽ;
  main đang lệch với `IconButton` glass 44dp.

Vá chồng lên:

- `403425a8` bản tự suy gốc ĐÈ `EXPO_PUBLIC_API_URL` ở mọi phiên Metro và tắt chốt
  https. Lệnh dev mặc định (`--tunnel`) cho `hostUri` là host ngrok không cổng, nên
  origin thành `http://…exp.direct:3001` — cổng tunnel không mở — còn API đã deploy
  khai trong `.env.local` bị bỏ qua mà không báo gì. Nay env tường minh thắng; chỉ
  thay host loopback bằng IPv4 LAN của Metro, giữ scheme và cổng; tunnel,
  `--localhost`, IPv6 và bản phát hành giữ nguyên env. Lỗi đang ngủ vì chưa màn nào
  dùng `apiUrl`.
- `20ddcf3b` pill lấy `touchTargetMin` làm sàn — 46 > 44 trước đó chỉ là trùng số.
- `246cb9d9` font nạp lỗi thì `fontsLoaded` mãi false: cây không vẽ, splash không
  gỡ, không gì ném lên `ErrorBoundary` (lỗi có từ trước). Nay nạp lỗi cũng tính là
  xong, app vẽ bằng chữ hệ thống.
- `e6bd9500` runbook `mobile-dev-loop.md` và `.env.example` theo hành vi mới.

Không đưa sang, lý do đã kiểm bằng mã nguồn thư viện:

- **Dev build/EAS** (`expo-dev-client`, `eas.json`, `extra.eas.projectId`, `owner:
  ngh1az`) và `@expo/ngrok` trong devDependencies: đảo ADR-0040 §1 mà không có AMEND
  (CLAUDE.md #5). Có `expo-dev-client` là `expo start` tự chuyển sang dev client nên
  QR hết mở bằng Expo Go; `projectId` bật ký manifest ở mỗi request nên người chưa
  đăng nhập Expo bị prompt chặn. User chọn giữ Expo Go.
- **Splash poster 1080×2340** kèm `resizeMode: cover` và bỏ `imageWidth`: plugin
  `expo-splash-screen` 57 chỉ vẽ ảnh trong ô vuông `imageWidth` (mặc định 100) trên
  cả hai nền tảng, nên poster còn khoảng 46×100dp — mark 9dp, tagline 1dp. Kèm mốc
  giữ splash 900ms áp cho cả bản phát hành.
- **Tinh chỉnh khoảng cách** 5 màn auth, onboarding và gallery: rẽ từ trước review 1
  nên conflict 8 file, và chọn phía nhánh là đảo ba bản vá (`autoFocus` màn quên mật
  khẩu, vai `subtitle`, `insets.bottom` ở onboarding). `View` bọc cộng dồn margin lên
  primitive nên lệch bản vẽ xa hơn (OrDivider 16 so với 10, Checkbox 24 so với 14);
  `OnboardingButton` cao cứng 68dp; cỡ chữ viết số; `\n` cứng trong tiêu đề i18n.

Tests after: mobile 159 test ở 31 file (149, thêm 9 cho `resolveDevApiUrl` và 1 cho
font lỗi), mobile-ui 86 (thêm 1 cho sàn vùng chạm) — mỗi test mới đã chạy đỏ trước
khi sửa. Build và typecheck 6/6 task của các gói bị ảnh hưởng, Biome exit 0,
tokens-only ✓ 65 file nguồn mobile, `bundle` xanh cả iOS lẫn Android, `expo-doctor`
21/21, user test tay nút Next trên máy thật. `test:int` KHÔNG chạy ở máy: DB
`tourism_test` đang mang migration `20260915120000_refund_deadline_expand` của nhánh
hoàn tiền chưa merge, chạy chung dễ phá session kia; nhánh này không chạm `apps/api`
và CI chạy `test:int` với Postgres riêng.

**CÒN TREO:**

- Splash chưa có wordmark và tagline như khung 1a — plugin chỉ vẽ một ảnh nhỏ giữa
  màn, cần chốt cách làm trước.
- Phần vá giao diện giao cho Nghĩa vẫn mở: 6 khung chưa đối chiếu trên máy (4a–4c,
  5b, 5c, 5d), nền tối chưa soi. Làm lại trên nền `main` hiện tại: số dọc qua
  `fromMockup`, cỡ chữ qua vai `AppText`, khoảng cách sửa trong primitive.
- Runbook `mobile-dev-loop.md` và ADR-0040 §8 còn tiền đề WSL NAT, tunnel mặc định —
  lỗi thời từ 14/09 khi máy dev chuyển sang Windows native.
- `expo start` tự gỡ `expo-env.d.ts` khỏi `include` của `apps/mobile/tsconfig.json`
  mỗi lần chạy (typedRoutes tắt), để lại file bẩn — commit sẵn thay đổi đó.
- Nợ cũ giữ nguyên: chặn tab khi chưa đăng nhập · icon app · admin chuyển sang
  `@tourism/core` · nối API thật.

## 2026-09-16 — Vòng vá review 1 cụm auth mobile: chờ font rồi mới vẽ, dựng lại đúng tỉ lệ bản vẽ (`fix/p5b-auth-review-1`, ff vào `main`)

User nghiệm thu bằng máy thật (Android, nền sáng) ngay sau entry dưới và bắt được
ba chuyện. Hai chuyện đầu là lỗi; chuyện thứ ba là sai ở CÁCH chuyển bản vẽ sang
code, không phải thiếu việc.

- `4e3591e7` chữ "Skip" ở onboarding hiện ra "Ski", reload một lần thì đúng lại.
  Vỏ ứng dụng vẽ ngay bằng chữ hệ thống rồi mới đổi sang chữ brand, mà BỐ CỤC đã
  đo xong bằng khuôn cũ nên ký tự cuối bị cắt; lần hai font đã nằm trong cache nên
  không thấy nữa. Nay chưa có font thì chưa vẽ gì — splash vẫn đang che nên quãng
  chờ đó không ai thấy. Bước đọc cờ onboarding dời xuống sau khi có cây thật, vì
  `router.replace` gọi lúc cây còn `null` là gọi khi chưa có navigator nào mounted.
  Cùng commit: tab Account nay có nút Sign in (vỏ ứng dụng trước đó không có đường
  nào tới cụm auth ngoài trang onboarding cuối) kèm đường tắt tới `/dev/gallery`
  chỉ dựng ở bản dev.
- `441ae969` **khung điện thoại trong mockup là 324×700 px — một hình minh hoạ thu
  nhỏ, không phải khung máy** — mà đợt dựng chép thẳng số pixel đó thành dp. Ảnh bìa
  300px là 42,9% khung vẽ nhưng chỉ còn 35,5% trên máy 844dp: ảnh thấp hơn thiết kế,
  chữ dồn lên cao, đáy thừa khoảng trống. `fromMockup(px, screenHeight)` quy mọi số
  DỌC về tỉ lệ chiều cao màn; đệm ngang và cỡ chữ vẫn theo token.
  - Nút thoát, nhãn địa danh và Skip đo từ `insets.top` thay vì top cứng: bản vẽ có
    thanh trạng thái giả cao 40px, máy thật có tai thỏ 47–59dp nên nút bị cắt.
  - Màn kết quả: nút chính nay bo tròn hết cỡ và ghim đáy đúng lề 24dp.
  - `AppText` thêm vai `subtitle` (bậc sm) cho câu dẫn dưới tiêu đề; vai `label` đổi
    sang semibold theo Archivo 600 của bản vẽ.
  - Stack gốc khai luôn nhóm `dev`. Thiếu dòng đó, expo-router đội cho gallery một
    header tên "dev", khung ngắn lại và **gallery trông giống bản vẽ hơn màn thật** —
    chính quan sát này của user là bằng chứng chốt chẩn đoán tỉ lệ.
  - Bỏ `autoFocus` ở ô email màn quên mật khẩu: bàn phím bật ngay che mất nút gửi.

Tests after: `gate:int` xanh (6/6 task, int 496 test ở 37 file), `gate` 28/28, mobile
149 test (thêm 2 cho `fromMockup`), `bundle` xanh cả iOS lẫn Android, tokens-only ✓
65 file nguồn mobile.

**CÒN TREO — bàn giao phần vá giao diện cho thành viên khác (user chốt 16/09):**
mới đối chiếu được 8 ảnh máy thật, TOÀN Ở NỀN SÁNG; chưa ai soi nền tối. Sáu khung
chưa từng đối chiếu trên máy: verify email (4a, 4b, 4c), forgot đã gửi (5b), reset
(5c, 5d). Cỡ nhãn nhỏ trong ô nhập, cỡ chữ dòng điều khoản và số đo ô OTP cũng chưa
so với bản vẽ. Nợ cũ giữ nguyên: chặn tab khi chưa đăng nhập · icon app · admin
chuyển sang `@tourism/core` · dòng COPY trong `apps/api/Dockerfile` nếu API dùng
`core` · nối API thật.

## 2026-09-16 — P5b-1 cụm auth mobile: `@tourism/core` và 17 khung giao diện tĩnh (hai nhánh, ff vào `main`)

Spec: [specs/2026-09-16-p5b-auth-wireframe-design.md](specs/2026-09-16-p5b-auth-wireframe-design.md) ·
plan: [plans/2026-09-16-p5b-auth-wireframe.md](plans/2026-09-16-p5b-auth-wireframe.md) ·
mockup user duyệt: `design/mockups/mobile-auth-screens.src.html` ·
bàn giao: [handoff/mobile-auth-handoff.md](handoff/mobile-auth-handoff.md).

### Nhánh 1 — `refactor/shared-auth-rules` (4 commit, `d3a3c442`…`8fa89ff3`)

- `d3a3c442` dựng `@tourism/core` tại `libs/shared/core` (đóng gói y hệt `@tourism/i18n`)
  và chuyển NGUYÊN VĂN `auth-errors.ts` của web sang, kèm test.
- `7baeee14` chuyển tiếp `auth-form.ts`; 7 file của web đổi đường import, không đổi
  một dòng logic nào.
- `d4763519` hàng rào import canh bằng máy (`package-boundary.ts`): chỉ được import
  tương đối, `@tourism/contract` và `@tourism/i18n` — cấm react/react-native/next/DOM/Node.
- `8fa89ff3` khai type Node cho chính spec quét file đó (ADR-0042).
- `AuthErrorField` thêm `'otp'` để mã xác minh sai rơi đúng kênh 1; web không đổi
  hành vi vì web không có màn nào nhận field `otp`.

### Nhánh 2 — `feat/p5b-auth-screens` (14 commit, `fcffded1`…`8504135a`)

Dựng đủ **17 khung** của spec §4 dưới dạng giao
diện TĨNH; không màn nào gọi API thật.

- **Bộ primitive mới** (`@tourism/mobile-ui`): `TextField` (nhãn nổi, nút hiện/ẩn
  mật khẩu), `FormMessage`, `OtpInput` (một ô nhập trong suốt phủ 6 ô vẽ — hệ điều
  hành lo sẵn nhảy ô, xoá lùi và dán mã), `Checkbox`, `IconButton`. `AppText` thêm
  tông `link` và `media`; `Button` thêm `shape="pill"`, `leading` và vai `media`.
  Cầu font brand (Literata cho tiêu đề, Archivo cho thân) và `withAlpha` để suy dải
  mờ TỪ token thay vì gõ màu tay.
- **Seam hạ tầng**: `AuthActions` 7 method cùng bản giả lập chọn nhánh theo email và
  mã nhập vào, và `OnboardingStore` nhớ trong RAM. Người làm hạ tầng đổi đúng hai
  dòng ở `src/app/_layout.tsx`.
- **Ba kênh lỗi, một hàm quyết kênh** (`placeAuthError`): dưới ô sai · khung ngay
  trên nút chính · thay cả thân màn. Màn không tự chọn kênh nên hai màn không thể
  nói khác nhau về cùng một mã lỗi.
- **Cụm `(auth)` bỏ hẳn header**: mỗi màn tự vẽ đường thoát đè lên nội dung (X đóng
  cả nhóm ở màn đầu, mũi tên lùi ở màn đi tiếp, màn kết quả không có đường lui).
- **Splash và onboarding**: `assets/splash-mark.png` xuất từ chính mark SVG của web;
  màu nền splash trong `app.json` có `app-config.spec.ts` canh cho khớp token chế độ
  tối, vì lưới tokens-only không quét file JSON. Cấu hình splash nằm trong plugin
  `expo-splash-screen`, KHÔNG phải khoá `expo.splash` như plan viết: SDK 57 đã bỏ
  khoá đó khỏi schema và `expo-doctor` báo đỏ.
- **`/dev/gallery`**: bảng tra 17 khung dựng bằng dữ liệu cứng, chỉ mở được ở bản
  dev (`isDevBuild()` đẩy bản phát hành về Home).

### Cổng đã đo

- **jest-expo** (cổng nhánh 1, Task 3): mobile tiêu thụ được `@tourism/core` — xanh.
- **Metro** (cổng Task 10): `pnpm turbo run bundle --filter=@tourism/mobile` xanh cho
  cả iOS lẫn Android, không phải thêm `metro.config.js` nào.
- **expo-doctor**: 21/21.
- Runbook `mobile-dev-loop.md` đổi bước build sang `--filter=@tourism/mobile^...`:
  Metro cần `dist` của cả `i18n` và `core`, bản cũ chỉ build `tokens` nên máy sạch
  chết ở `@tourism/i18n`.

### Bẫy ghi lại

- **RNTL 14 bất đồng bộ**: `fireEvent.*`, `unmount()` và `render()` đều trả Promise.
  Bốn cú `fireEvent.press` không `await` trong một test để lại phần việc treo và làm
  MỌI test sau trong cùng file render ra cây RỖNG — lỗi hiện ở test khác chứ không ở
  chỗ gây ra nó. Đã sửa cả 10 chỗ còn thiếu `await` trong spec mobile và mobile-ui.
- **`rerender` của RNTL thay TOÀN BỘ cây** bằng đúng thứ được truyền vào, nên gọi
  thẳng là rụng provider; `renderWithTheme` nay bọc lại nó.
- **Bản giả lập `react-native-screens` trong jest vẫn render nội dung header đã ẩn**,
  nên `headerShown: false` một mình vẫn để lại hai nút cùng nhãn trong cây test.

Tests after: `gate:int` xanh lúc 16/09 (6/6 task, int 496 test ở 37 file), đo lại sau
khi rebase lên `main` thì `gate` vẫn 28/28. Unit 3786
test: web 1477 · api 809 · admin 918 · contract 255 · mobile 147 · mobile-ui 84 ·
core 46 · ui 22 · tokens 18 · i18n 10. So với 15/09 (3627): mobile thêm 118,
mobile-ui thêm 32, i18n thêm 4, core 46 test mới trong đó 41 chuyển nguyên văn từ
web (nên web giảm 41), còn lại là 5 test hàng rào import. `pnpm gate` 28/28 task
xanh · tokens-only ✓ (64 file nguồn mobile) · Biome không lỗi.

**CÒN TREO sau đợt này:** chặn tab khi chưa đăng nhập (cụm tabs) · icon app ·
admin chuyển sang `@tourism/core` (bản chép thứ ba vẫn còn) · thêm dòng COPY trong
`apps/api/Dockerfile` nếu API dùng tới `core` · nối API thật và thay
`createMemoryOnboardingStore` (thành viên khác, theo tài liệu bàn giao).

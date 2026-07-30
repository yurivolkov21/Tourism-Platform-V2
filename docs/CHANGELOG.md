# CHANGELOG

Một entry mỗi merge: ngày · hash · nội dung · review findings · "Tests after: ...".

## 2026-07-30 — Dropdown navbar bị navbar đè: hai nguyên nhân, một lớp lỗi cũ bỏ sót (branch `fix/navbar-dropdown-stacking`, ff-only, commit code `e6f179f`)

User báo: hover "Destinations" lúc đã cuộn thì dropdown bị thanh navbar đè lên. Điều
tra bằng `elementFromPoint` quét dọc vùng chồng cho ra **hai nguyên nhân độc lập**,
không phải một.

- **Overlap 18px — neo sai mốc.** Base UI đo `sideOffset` từ ANCHOR, tức chính
  trigger. Trigger cao 20px, căn giữa hàng cao 40px trong `p-4`, nên dải navbar còn
  thừa đúng **26px** bên dưới nó; với offset 8 thì `popup.top − navbar.bottom =
  −18px`. Con số này **giống nhau ở cả hai trạng thái cuộn**.
- **Navbar thắng cuộc chồng lấp — z-index.** Popup **portal ra `body`** nên stacking
  context của nó là **anh em** của `<nav>` trong context gốc, không phải con; navbar
  là `z-(--z-sticky)`=1100 còn bản vendor để `z-50`. Portal còn là con ĐẦU TIÊN của
  `body` nên kể cả bằng z vẫn thua. Hit-test: mọi y trong vùng chồng cho ra chính
  `<nav>`.
- **Vì sao chỉ thấy khi cuộn:** chưa cuộn nav là `rgba(0,0,0,0)` + `backdrop-filter:
  none` — chồng vẫn 18px nhưng không có gì để che. Cuộn xuống nó thành
  `bg-background/60 + blur(40px)`.

**Đây là lớp lỗi repo đã sửa BỐN lần** (`select.tsx`, `dialog.tsx`, `sheet.tsx`,
`drawer.tsx` đều có comment ghi đúng câu đó). `navigation-menu.tsx` là component
vendor **duy nhất bị bỏ sót** đợt ấy.

Vá: Positioner và Popup dùng `isolate z-(--z-popover)`; Root forward `sideOffset` và
`destinations-menu` truyền **34 = 26 + 8**, đặt ở **call site** vì 26px là đặc thù
`site-header`, không phải luật chung. Một con số cho cả hai trạng thái (user chốt
phương án (a)). Z cao vẫn cần dù đã hết chồng: Positioner mang cầu hover
`before:top-[-10px]` bắc qua khe, cầu nằm dưới navbar thì chuột đi xuống panel làm
menu đóng giữa đường.

**Hai phương án đã LOẠI, ghi để không ai thử lại:** `sideOffset` dạng hàm —
`OffsetFunction` của Base UI 1.6 chỉ cấp **kích thước**, không cấp vị trí; và neo vào
chính dải navbar — khi ấy `align='start'` căn theo mép dải chứ không theo trigger, mà
căn ngang theo trigger đo được **đang đúng 0px lệch** nên đó là ràng buộc phải giữ,
không phải lỗi thứ hai.

**Review findings:**

1. **Mutation không bite là phát hiện quan trọng nhất.** 2/3 đột biến bị bắt, nhưng
   gỡ `sideOffset={sideOffset}` ở Root thì **6/6 test vẫn xanh, `lint` im,
   `typecheck` im** — bug quay lại hoàn toàn âm thầm. Bịt bằng
   `libs/shared/ui/src/components/navigation-menu.spec.ts` mới, làm TDD trung thực:
   áp đột biến trước, viết test, xem đỏ, rồi bỏ đột biến. Spec đọc source vì "một prop
   có được forward hay không" **không hiện ra DOM**, và jsdom không dựng layout nên
   render không phân biệt offset 8 với 34.
2. **Câu hỏi của user có một tiền đề sai, đã sửa lại:** họ hỏi cả "không bị lệch",
   nhưng đo được `popup.left − trigger.left = 0px` — dropdown **không lệch**; đó là
   thứ phải giữ khi vá, không phải lỗi cần vá.

**Nợ mở — cùng bug, đang NGỦ:** `dropdown-menu.tsx` còn `isolate z-50` / `z-50` và
được `user-menu.tsx` dùng **trong chính navbar đó** (`site-header.tsx:100`). Hôm nay
`MOCK_SESSION` là chưa-đăng-nhập nên nó render link "Log in", dropdown avatar không
mở — nên chưa thấy. Nó sẽ thức đúng lúc nối auth. Sáu component vendor khác còn `z-50`
(`alert-dialog`, `combobox`, `context-menu`, `hover-card`, `popover`, `tooltip`) hiện
**chưa file app nào dùng**.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web 656 (trước
654) · ui **10** (trước 5) · API 188 · contract 55 · tokens 10 · i18n 1, tổng **920**.
`@types/node` thêm vào `libs/shared/ui` cho spec đọc file, khớp `26.1.1` mà `apps/api`
và `libs/shared/tokens` dùng. Đo lại trên Chromium cả hai trạng thái cuộn:
`popup.top − navbar.bottom` từ **−18px thành +8px** · căn ngang giữ **0px lệch** ·
z positioner **1500 > 1100** · chuột đi từ trigger qua khe xuống panel thì menu
**vẫn mở**. `pnpm test:int` không chạy được ở máy này.

## 2026-07-30 — Đóng cụm Destinations (Task 6/7) và dọn 4 khoản nợ phase giao diện tĩnh (branch `fix/sitemap-destinations`, ff-only, commit cuối `cf8f821`)

Đợt dọn nhà TRƯỚC khi nối API. User chốt: đóng Task 6 trước, rồi xử lý tồn đọng,
rồi ADR-0016 (tầng dữ liệu web) ở session mới.

- **Task 6 — sitemap thiếu 4 URL của trang đang sống.** `/destinations` và ba trang
  vùng ship 30/07 nhưng `STATIC_PAGES` không có, và không có nhóm URL vùng nào.
  Comment `lib/sitemap.ts` còn ghi *"`/destinations` … CHƯA tồn tại"* — đúng lúc
  viết, sai từ lúc trang lên. Bài học ghi vào comment: câu "chưa tồn tại" là khẳng
  định về HIỆN TRẠNG nên phải có **test** canh, không chỉ có comment.
  Thang priority: `/destinations` cùng bậc **0.9** với `/tours` (hai lối vào
  catalogue ngang hàng), trang vùng **0.8** cùng bậc tour detail. `regions` nhận qua
  **tham số** chứ không `import` trong lib — hàm này test được chính vì mọi nguồn dữ
  liệu đi vào từ ngoài; vỏ `app/sitemap.ts` truyền đúng `REGIONS` mà
  `generateStaticParams` dùng, nên sitemap không thể liệt kê URL chưa prerender.
- **Task 7 — đo trên PRODUCTION BUILD** (`next start`, không phải dev): 3 slug vùng
  → 200, slug lạ **và slug sai chính tả** → **404 thật** (không soft-404),
  `/tours/khong-co-tour` → 404, `sitemap.xml` → 200 với đúng **38 URL**.
- **Cặp `primary` dark: lỗi WCAG AA thật, vá.** `primary-foreground` KHÔNG lật theo
  theme mà dark `primary` lại SÁNG HƠN light → chữ 14px trên mọi nút primary ở dark
  đo **4.11:1**, dưới 4.5. Hạ dark L 0.563 → **0.53** (chữ 4.73 ✅, nút/nền 3.13 ✅).
  Phương án "chữ tối trên primary sáng" đã đo và **chết**: kể cả gần-đen (L=0.16)
  cũng chỉ 4.37. Tối hơn 0.50 thì nút tan vào nền trang (2.75).
- **`rating` light: 2.27 → 3.22.** Ngôi sao là graphic (ngưỡng 3:1) và bản cũ trượt
  ở CẢ `background` (2.27) lẫn `card` (2.40). 0.66 mới đạt 2.98 — vẫn dưới; **0.64**
  là mốc sáng nhất đạt trên cả hai. Dark giữ 0.78 (đã đạt).
- **Nội dung ẩn khi JS tắt — lớn hơn tưởng.** `motion` render `initial` thành `style`
  inline NGAY TRONG HTML server, nên `initial={{opacity:0}}` cộng `whileInView` là ẩn
  vĩnh viễn khi JS chết — mà mọi trang là SSG. Đo: trang chủ **62** phần tử, `/about`
  **60**, trang vùng 15, `/tours` 10, `/blog` 8. Vá bằng MỘT rule trong `<noscript>`
  ở `<head>` thay vì sửa từng component (`initial` là cách duy nhất motion biết điểm
  bắt đầu; bỏ nó là bỏ chuyển động đã duyệt ở 40+ chỗ). Đo được rule **không** nằm
  trong stylesheet đang áp khi JS bật, và 0 phần tử kẹt mờ.
- **Dedup bộ số spring: 62 bản copy → 1.** Trước: 21 file khai `const SPRING` nguyên
  văn, 19 chỗ gõ spring 240 inline, 22 chỗ gõ spring 320 inline, cộng `REVEAL_EASE`
  khai ở cả `reveal-line.tsx` lẫn `lib/motion.ts`. Hai spring **một-lần** giữ tại chỗ
  (`on-this-page` 420, `not-found-body` 260) — chúng không phải bản copy, và nhồi mọi
  giá trị một-lần vào `lib/motion.ts` biến file đó thành bãi hằng số.

**Review findings:**

1. **Test cũ đỏ vì thứ nó canh đã biến mất theo đúng ý muốn.** Ba test trong
   `motion.spec.ts` khẳng định "`lib/motion` KHỚP bản copy trong reveal.tsx /
   gallery.tsx / reveal-line.tsx" — hợp lý khi còn 62 bản copy. **Suy lại, không xoá
   cho xanh**: bất biến mới đi NGƯỢC chiều, canh rằng **chỉ còn một bản**. Nó không
   thể xanh giả — thêm lại một `const SPRING` là đỏ ngay, còn test cũ thì vẫn xanh
   miễn hai bên cùng giá trị. Thêm **allowlist** cho spring một-lần: file thứ ba gõ
   spring riêng sẽ đỏ và buộc trả lời "một-lần thật, hay bản copy thứ 22 sắp trôi?".
2. **Test `'phần còn lại không vượt 0.7'` của sitemap cũng phải suy lại.** Bản cũ
   liệt kê tay ba ngoại lệ; nối thêm ngoại lệ cho Destinations sẽ biến nó thành bản
   sao của chính thang priority — xanh với BẤT KỲ thang nào miễn hai bên khớp. Bản
   mới canh **THỨ TỰ** của thang nên đổi một giá trị là đỏ, mà thêm họ URL mới thì
   không phải sửa test.
3. **Tôi báo sai một lần rồi phép đo bác lại.** Đề xuất ban đầu cho
   `motion-reduce:transform-none` là "xoá, đổi 0 pixel"; đo lại thì nan quạt bưu
   thiếp **dẹp phẳng**. Truy ra không phải tailwind-merge — chính edit của tôi đánh
   rơi dòng so le. Làm lại đúng thì `translate` giống hệt hai chế độ.
4. **Con số 0.52 tôi đưa ra ban đầu là sai** vì đoán `background` dark = 0.208; giá
   trị thật là 0.25 nên cửa sổ hẹp hơn, và **0.53** mới là điểm tối ít nhất vượt
   ngưỡng.
5. **Tự kill shell hai lần** vì `pkill -f "next dev"` / `pgrep -f "next start"` khớp
   chính dòng lệnh chứa chuỗi đó trong commit message. Cách đúng: tra PID theo cổng
   (`ss -ltnp`) hoặc để message trong file rồi `-F`.

**Nợ mở:** nút primary đứng **trên card** ở dark đo 2.57 và **đã là 2.95 trước khi
sửa** — dưới 3:1 của WCAG 1.4.11 ở cả hai bản. Hạ L không tạo ra lỗi đó và cũng không
chữa được; chữa thật là đổi `card` dark hoặc cho nút một viền, và đó là quyết định
thiết kế riêng cần user xem. Còn lại: `apps/web` **chưa có API client** nào (xem
[rà soát 30/07](analysis/2026-07-30-docs-audit-progress.md)) — việc của ADR-0016.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web **654**
(trước đợt này 649) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1, tổng **913**.
TDD sitemap: 6 test đỏ trước khi sửa code, 16/16 xanh sau, mutation **4/4 bite**.
Chứng minh dedup đổi 0 pixel: chụp **9 trang** fullPage ở chế độ reduce trước và sau
— **9/9 giống hệt từng byte**. `pnpm test:int` không chạy được ở máy này.

## 2026-07-30 — P3b: cụm Destinations — `/destinations` và ba trang vùng (branch `feat/destinations-pages`, ff-only, commit cuối `03569b4`, 60 commit)

Cụm dài nhất của P3b tới nay. `/destinations` dựng lại **2 lần**, `/destinations/[region]`
dựng lại **4 lần** — mỗi lần vì user xem trang thật rồi bác, và mỗi lần bác đều
chỉ ra một luật đúng mà bản trước vi phạm.

- **Hai trang mới.** `/destinations` (hành trình dọc, 3 vùng lồng địa điểm) và
  `/destinations/[region]` cho 3 slug qua `generateStaticParams`, slug lạ →
  `notFound()`. Mỗi miền **7 khu**, trong đó **6 khu riêng** — chỉ hero, lưới 6
  `TourCard` và footer là giống nhau, đúng ràng buộc user chốt.
- **ADR-0015: rút lớp tint theo vùng TOÀN SITE.** Cụm này *thêm* slot
  `--region-hero` ở Task 1 rồi *xoá cả ba khối* `[data-region]` ở Task 5i, vì user
  kết luận *"màu sắc có lẽ không phải là lựa chọn phù hợp"*. Bản sắc vùng chuyển
  hẳn sang **cấu trúc**: thứ tự khu riêng, gallery riêng ba bố cục
  (`peaks`/`lanterns`/`panorama`), khu chữ ký riêng, và ba **trục chuyển động**
  riêng (Bắc dọc · Trung ngang · Nam nở tại chỗ).
- **Số liệu thành DẪN XUẤT.** `tourCount` trong mock phồng 2–5× so với `TOURS`;
  `lib/regions.ts` tính lại từ nguồn duy nhất. Sửa này lan sang `/about`
  (68 → 16 tour) — một con số sai đã hiển thị công khai.
- **Copy: cắt phần bịa.** ≈202 dòng i18n port từ Nexora quảng cáo **4 địa danh v2
  không bán** (Hà Giang 5 lần, Lan Hạ, Fansipan, Pù Luông = 0 trong mock). Cùng họ
  lỗi ở nhãn gallery: ba vùng cắt chung MỘT danh sách nên trang miền Bắc chú thích
  *"Lantern-lit old town"* (Hội An, miền Trung).
- **Chuyển động (Task 5m/5n/5o).** `lib/motion.ts` giữ con số một chỗ,
  `motion/reveal-header.tsx` cascade cho cả 9 khu, và `motion/reveal-item.tsx` mang
  ba trục miền. Gallery miền Trung cuối cùng chuyển sang cơ chế cuộn của
  `home/gallery.tsx` nhưng lái `scrollLeft` chứ **không** `transform`.

**Review findings — mười lỗi đo được, phần lớn do tự đo chứ không do review báo:**

1. **Cặp `--primary`/`--primary-foreground` chỉ 4.11:1 trong scope dark** (chữ 14px,
   ngưỡng 4.5). Tìm ra sau khi review đã pass. Vá cục bộ bằng `variant="outline"`
   (11.19–12.22:1); **nợ toàn site vẫn còn**, ghi ở ADR-0015 §Hệ quả.
2. **Soft-404.** Một `loading.tsx` ở BẤT KỲ đâu trong chuỗi segment làm slug lạ trả
   **HTTP 200** kèm UI 404. Đo được, nên `destinations/` tuyệt đối không có file đó.
3. **`color-mix(in oklch)` trôi hue** khi cả hai đầu vào có chroma ≈ 0 — Chrome trả
   hue `none`/powerless, ra nền hồng. Chuyển sang `in oklab`.
4. **Nền phớt vùng pha `--region-surface` không đạt AA ở dark**; chip số tour cũng
   trượt. Cả hai do trộn token bất-biến-theme với token lật-theo-theme — một gốc, năm
   biểu hiện.
5. **Dải trắng trên footer.** `site-footer` mang `mt-32` sơn `--background`; khu cuối
   có nền riêng thì 128px đó hiện thành vạch sáng. Giả thuyết `-mb-32` **đo được là
   sai** (`body` là `flex flex-col` nên margin không collapse).
6. **`IntersectionObserver` cắt target qua tổ tiên có clip TRƯỚC khi so root**, nên ô
   4–6 của một dải `overflow-x-auto` không bao giờ bắn observer và **kẹt `initial`
   vĩnh viễn, kể cả ở chế độ giảm chuyển động**. Nới `rootMargin` và đặt
   `viewport.root` đều không chữa — đã thử, đã đo.
7. **`motion-reduce:transform-none` là NO-OP** (Tailwind v4 biên `translate-y-*`
   thành thuộc tính `translate` riêng). Grep toàn repo: đúng 1 chỗ; đã xoá, vì kể cả
   nếu chạy thì nó vẫn sai — `prefers-reduced-motion` xin bớt chuyển động, không xin
   đổi bố cục.
8. **Thẻ lệch pha vì số dòng không cố định**: thẻ chuyến-một-ngày lệch 28px ở hai
   hàng giữa, thẻ nhóm miền Bắc lệch 24px ở khổ 768 (chỗ đó có `border-t` nên hai
   thẻ cạnh nhau có vạch ngang lệch nhau). Hàng giá không lệch vì có `mt-auto`.
9. **Cỡ trang 8 không khớp lưới.** Lưới 2 và 3 cột thì 8 để lại ô mồ côi; 6 là con số
   duy nhất dưới 12 không bỏ ô lẻ ở bất kỳ khổ nào.
10. **Ba brief tôi viết cho subagent có lỗi thật và implementer bắt được**: một brief
    bắt `initial={{opacity:0}}` đồng thời đòi JS-tắt đọc được (không cùng đúng); một
    brief nói repo chưa có reveal trục x (thực có 4 file); một brief nói `scrollLeft`
    để trình duyệt tự kéo ô focus vào tầm (đo được: Tab tới ô 4 thì Chromium để nó
    kẹt 252px ngoài mép và **không** cuộn).

**Nợ mở, nói thẳng:**

- **Task 6 của plan CHƯA XONG: `/destinations` và 3 URL vùng KHÔNG có trong sitemap**,
  và comment `lib/sitemap.ts:22` vẫn ghi *"`/destinations` … CHƯA tồn tại"* — nay
  sai. Trang sống nhưng crawler không thấy.
- **Task 7 CHƯA XONG:** chưa đo 404 trên bản production build, chưa chạy `gate:int`
  ở máy (không có Postgres cục bộ — CI lo).
- `--rating` đo 2.27:1 trên light; 21 file khai `const SPRING` nguyên văn và 19 file
  gõ spring 240 inline, chưa dedup. Cả hai là nợ toàn site có trước cụm này.
- JS tắt còn 15 phần tử `opacity:0` (hero, eyebrow, footer) — pre-existing; cụm này
  làm **giảm** từ 20 xuống 15 vì gỡ 5 lớp `Reveal` bọc trọn khu.

Tests after: `pnpm gate` xanh — **18/18 task** kể cả `next build` · web 649 (trước
cụm 344) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1, tổng **908**.
Đo thêm bằng Chromium thật trên dev server: đồng bộ thẻ **0 vi phạm** trên 9 nhóm ×
3 miền ở 1440/768 · chế độ giảm chuyển động **0 phần tử kẹt** ở 3 miền × 2 theme ·
JS tắt cả 5 tiêu đề khu đọc được và dải Trung vẫn cuộn native · `body` không tràn
ngang ở 1440/390. `pnpm test:int` không chạy được ở máy này.

## 2026-07-28 — Vân topo phủ liên tục hero + dải khởi hành (branch `fix/topo-across-departure-board`, ff-only, commit `ec742b2`)

User phát hiện bằng mắt: nền chỗ hiển thị giá không có vân như hero, và hỏi
"hay là chủ ý thiết kế?". **Không phải chủ ý — nhưng cũng không phải cẩu thả**: nó
là hệ quả chưa ai soi của hai quyết định đúng đâm nhau.

- **Chẩn đoán.** (a) Task 9 cố ý cho dải khởi hành **cùng `bg-hero`** với hero,
  cách nhau một hairline, để hai băng đọc thành *một bảng có đường chia*. (b) Luật
  25/07: `TopoPattern` **tối đa 1 vị trí mỗi trang**, hero đã dùng suất đó. Mỗi cái
  tự nó hợp lý; cộng lại thì nền và vân nằm trên TỪNG section nên vân dừng đúng tại
  vạch chia. Đo được: hero y 0–580 có vân, dải y 580–763 không, mà màu nền hai bên
  **giống nhau từng chữ số** (`lab(13.1862 -5.12658 -0.193918)`).
- **Vì sao nó đọc thành lỗi render, không đọc thành hai khu khác nhau:** cùng màu
  tuyệt đối thì hai băng là MỘT mặt trong mắt người xem, và một mặt liền có texture
  **đứt ngang giữa nét đường cong** thì não đọc là hỏng. Chính ý định (a) làm khuyết
  điểm (b) lộ ra. Việc user phải hỏi "hay là chủ ý?" là bằng chứng nó không truyền
  đạt được chủ ý nào.
- **Sửa:** hoist nền + **MỘT** instance `TopoPattern` lên wrapper phủ cả hai tấm
  (vân 0–580 → **0–763**). Luật "1 topo mỗi trang" vẫn nguyên — một instance, chỉ
  là phủ trọn bảng.
- **Cố tình KHÔNG thêm instance thứ hai vào dải**, dù nhanh hơn: `mask-size: cover`
  tính theo kích thước hộp, nên instance riêng trên hộp cao 183px crop và scale
  khác hộp 580px → các đường **lệch nhau tại vạch ghép**, hỏng rõ ràng hơn cả để
  phẳng.
- **Hai bẫy đã xử lý, ghi vào comment:**
  - `relative z-10` cho dải là **bắt buộc**, không phải trang trí: vân là phần tử
    `absolute`, còn phần tử static nằm DƯỚI phần tử positioned cùng stacking
    context theo thứ tự vẽ CSS — để static thì **vân phủ lên chính các chip khởi
    hành**. Hero không cần vì nội dung nó đã có `relative z-10`.
  - `bg-hero` và vân giữ **NGOÀI mọi scope `dark`**; đặt vào trong là tái lỗi
    `22bd75e`. Đo lại dark mode: board `lab(4.59765 …)` khác nền trang
    `lab(13.1862 …)`, và `dark:opacity-[0.2]` vẫn ăn.
- **Đánh đổi đã nhận, ghi vào JSDoc:** `TourHero` giờ KHÔNG tự mang nền — nó là một
  tấm của bảng, chỉ render đúng trên nền do cha cấp. Chấp nhận vì component dùng ở
  đúng một chỗ, nhưng đó là coupling thật.
- **Giới hạn nói thẳng: KHÔNG có test canh bất biến này.** jsdom không tính layout
  nên không đo được chiều cao lẫn thứ tự vẽ; thứ duy nhất test được là chuỗi class,
  mà đó là test giòn vô nghĩa. Phần dễ vỡ nhất — ai đó bỏ `relative z-10` — chỉ có
  comment canh, không có CI canh.

Tests after: `pnpm gate` xanh — **18/18 task** · web 344 · API 188 · contract 55 ·
tokens 10 · ui 5 · i18n 1 (không đổi số: đây là sửa layout, không thêm logic).
Kiểm mắt bằng ảnh cắt quanh vạch ghép ở cả light và dark, đo bằng
`getComputedStyle` trên dev server đang chạy — KHÔNG chạy `next build` vì cổng
3000 đang có dev server của user.

## 2026-07-28 — CTA điều hướng trả lại role `link` + sửa cách gọi tên nợ contract #1 (branch `fix/anchor-link-role`, ff-only, commit cuối `60549ff`)

Trả ba khoản nợ ghi ở entry dưới, không phải feature mới.

- **Gốc rễ không nằm ở 6 call site mà ở một nhánh cứng trong Base UI.**
  `useButton.js` gắn thuộc tính theo đúng `isNativeButton ? { type: 'button' } :
  { role: 'button' }` — nên `nativeButton={false}` **luôn** đóng `role="button"`
  lên phần tử `render` sinh ra, và trên `<a href>` nó **đè mất role `link` ngầm**.
  Không prop nào tắt được: `role` nằm trong `getButtonProps`, mà `getButtonProps`
  được merge SAU props ngoài. Trớ trêu là cùng file đã biết về link —
  `isNativeButton ? isButton : !isLink` để **không** tổng hợp click cho anchor —
  nó biết đấy là link mà vẫn ghi đè role.
- **Bỏ hẳn primitive thay vì cố ghi đè.** Thêm `ButtonLink`
  (`@tourism/ui/components/button-link`) là `<a>` + `buttonVariants`. Bỏ không
  mất gì: Enter là hành vi gốc của `<a href>`, còn Space **không** kích hoạt link
  — đó mới là hành vi link ĐÚNG, tức primitive đang thêm một hành vi sai. Đặt ở
  **file riêng**, không nhét vào `button.tsx`: file đó vendored từ shadcn, chạy
  lại `shadcn add button --overwrite` là mất. `buttonVariants` vẫn import từ đó
  nên kiểu dáng có đúng một nguồn sự thật.
- **Vá luôn rule file của skill shadcn** (`.claude/skills/shadcn/rules/base-vs-radix.md`)
  — nó đang dạy đúng mẫu sinh ra cả 6 chỗ này, nên không vá thì lần sau lặp lại.
  Mẫu upstream vẫn đúng cho `<span>`/`<div>`; cảnh báo chỉ giới hạn ở `<a href>`
  điều hướng. Cùng kiểu patch có chú thích "giữ lại khi cập nhật upstream" như
  patch monorepo 22/07.
- **Chỗ thứ 7: `PaginationLink` của `@tourism/ui`** — chưa ai dùng (`apps/web` tự
  dựng `PaginationBar` bằng `<button>` thật vì lọc chạy client). Vá để admin P4
  không kế thừa. Ở đó lỗi nặng hơn: nó mang `aria-current="page"`, thuộc tính chỉ
  có nghĩa trên link điều hướng.
- **Chứng minh không đổi pixel bằng test so hai chuỗi class**, không ghim cứng
  một chuỗi — ghim cứng thì mỗi lần đổi kiểu dáng nút là test đỏ oan. Kèm mặt còn
  lại của bất biến: `Reserve` VẪN phải là `<button>` thật (nó không điều hướng).
- **Spec §8 sửa BẢN CHẤT, không chỉ mức độ.** `posts.ts:35` ghi
  `// Tour-summary hiện có của catalog — KHÔNG media (ADR-0005)`, và
  [ADR-0005](adr/0005-media-read-build-url.md) nói thẳng là chốt hợp đồng "trước
  khi các module media sau (**tour media**, admin CRUD ở P4) kế thừa" + "Khi
  catalog thêm media (**P3b/P4**) thì related tự có". Vậy #1 **không phải lỗ bị
  bỏ sót mà là khoản hoãn có chủ đích, đã thiết kế xong** — và điều đó đổi việc
  phải làm: `resolveForOwners` nhận *mọi* `MediaOwnerType` (`TOUR` là giá trị đầu
  enum), `MediaItemSchema` đã có, `PostDetailSchema` là tiền lệ nguyên vẹn, nên
  **#1 không cần ADR mới**, chỉ #2–#5 cần. Ngược lại mức độ TĂNG: gallery đã dựng
  nên thiếu media là mất hẳn một khu nhìn thấy được. Thứ tự đề xuất: **#4 trước**
  (khoản duy nhất gãy *im lặng*), rồi #1.
- **Review finding tự gây ra rồi tự sửa — đáng ghi vì `gate` không canh được.**
  Khi lint markdown, **entry CHANGELOG CŨ bị đổi 9 dấu đầu dòng + chèn 27 dòng
  trắng**. Bốn dấu trong đó là **phép cộng** của tổng số test bị ngắt dòng
  (`… 5 ui + 76 web` / `+ 188 api)`): formatter thấy là bullet nên đổi sang `-`,
  **nói sai con số đã ghi trong lịch sử**. Đã hoàn nguyên đúng nội dung `a701b32`.
  Thủ phạm KHÔNG phải CLI — đo được: `markdownlint-cli2` không tự sửa khi thiếu
  `--fix`, và `biome check docs/CHANGELOG.md` trả "0 files, path ignored" (Biome
  bỏ qua `.md` hoàn toàn, nên `pnpm gate` **không bao giờ** thấy churn kiểu này).
  Là extension markdownlint qua format-on-save, đúng thứ `.vscode/settings.json`
  pin. Luật mới trong CLAUDE.md: entry mới không để `+` đầu dòng, và luôn
  `git diff` file `.md` trước khi stage. Còn **6 chỗ** `+` đầu dòng trong file —
  cố ý KHÔNG sửa, entry cũ là bản ghi lịch sử, cùng luật với `migration.sql`.

Tests after: `pnpm gate` xanh — **18/18 task** · web **344** (từ 336; +8 test của
`link-cta.spec.tsx`) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1.
⚠️ `pnpm gate:int` vẫn KHÔNG chạy được ở máy này (không có Docker CLI trong distro
WSL) — **CI là nơi xác minh**, và tới lúc merge này `main` còn **7 commit chưa
push** nên chưa commit nào trong đợt 28/07 qua int test lần nào.

## 2026-07-28 — P3b: hình ảnh & uy tín trang chi tiết tour — card thiết kế lại + gallery + reviews (branch `feat/tour-detail-visuals`, ff-only, commit code cuối `9d21739`)

Ba việc user nêu trong **một** yêu cầu, làm tuần tự trên cùng branch: thiết kế lại
tour card → gallery ảnh → khu Traveller reviews. Không phải task nào trong
[plan 13 task](plans/2026-07-27-tours-pages.md) — cụm Tours đã đóng ở entry dưới;
đây là đợt user xem giao diện xong rồi yêu cầu thêm.

⚠️ **Cùng ngày 28/07 với entry dưới nên `docs-freshness.sh` KHÔNG hề bắt được
merge này** (script so theo *ngày*, dùng `--since="<ngày> 23:59:59"`, nên mọi
commit trong cùng ngày với entry mới nhất đều coi như đã kể). Nó xanh không phải
vì sổ sách đủ. Ghi lại làm giới hạn đã biết của script, không sửa script ở đây.

- **`TourCard` thiết kế lại sau 5 vòng — vòng cuối là *bỏ*, không *thêm*.** Vòng
  1–4 đi theo yêu cầu user (tham khảo shadcnspace/shadcnstudio/prebuiltui → chốt
  hướng D → thêm flip 3D → đóng khung kiểu vé như trang auth) và user chặn lại:
  *"bạn làm loạn bố cục lên hết rồi"*. Chẩn đoán đúng bệnh: tôi đang **bồi đắp
  chứ không thiết kế** — 7 thiết bị tổ chức chồng lên một card nhỏ. User cho phép
  **xoá hết ràng buộc ban đầu của chính họ** và tự thiết kế một kiểu. Kết quả
  chốt: **năm băng, một thứ tự đọc, một chữ ký** (dải chặng — các điểm nối bằng
  gạch mảnh cố định), không khung, không nền card, không kẻ chân, không trái tim.
  Cả hai mẫu có-khung sau đó đều bị loại: *"thêm cái khung vào làm cho mọi thứ
  trở nên kì quái hơn"* — đúng lại bài học "cái khung là gốc rễ trống hoác" của
  4 vòng listing.
- **Điểm dark green bị che là do `box-shadow`, không phải do lề.** Vòng glow quanh
  điểm primary tràn ra ngoài phần tử nên bị `overflow-hidden` cắt. Bỏ vòng glow
  (nó là **tín hiệu thứ hai dư thừa** — điểm primary đã tô đặc) rồi chừa 2px hơi
  bằng `-ml-0.5 pl-0.5`. Sửa nguyên nhân, không nới lề để né triệu chứng.
- **Motion: CSS giữ nhịp, Tailwind giữ giá trị.** Hover làm các chặng của dải
  sáng lên **lệch pha** — `[data-leg]` + biến `--leg-index` trong `globals.css`
  (`transition-delay: calc(var(--leg-index,0) * 55ms)`), theo đúng tiền lệ
  `--card-index` đã có. Tailwind không diễn tả được delay theo chỉ số nên đây là
  ranh giới đúng, không phải lách luật tokens-only.
- **Gallery: khảm 1 ảnh lớn + tối đa 4 thumb, lightbox bằng Base UI Dialog.**
  `aria-label` của mỗi ô nói **vị trí** (`Open photo 3 of 6`) chứ không bịa nội
  dung ảnh. Không wrap-around ở cuối danh sách; `onKeyDown` đặt trên
  `DialogContent` **chứ không phải `window`** — vừa đúng thiết kế (phím chỉ nên
  hoạt động khi dialog mở) vừa là lý do listener trên `window` không kích hoạt
  trong jsdom.
- **`ratingAvg`/`ratingCount` chuyển sang DẪN XUẤT** từ `TOUR_REVIEWS` — xoá 32
  dòng literal khỏi 16 object tour. Lý do là tính trung thực chứ không phải gọn
  code: hero in `4.6 (14)` thì con số đó phải là con số của **chính danh sách mà
  người đọc bấm vào xem được**. Viết tay `1204` rồi mock 14 review nghĩa là
  "See all 1,204 reviews" mở ra 14 dòng. Ở API thật hai cột này denormalize
  atomically trong transaction duyệt review, nên dẫn xuất phản chiếu đúng quan hệ
  đó. Có test canh bất biến.
- **Mock review CỐ Ý không ghép vào `MockTourDetail`** — khác media (media ghép
  vào, vì API thật trả media trong payload detail). API thật trả review qua **một
  lời gọi phân trang riêng** (`reviews.listByTour`), nên mock phải giữ đúng ranh
  giới đó; ghép vào là thiết kế UI quanh dữ liệu không nằm ở chỗ mình tưởng, và
  chỉ phát hiện lúc wire. `tourReviews()` **sao y thứ tự server**
  (`authorDeleted asc → createdAt desc → id desc`) chứ không chọn thứ tự đẹp hơn:
  client sắp khác server thì "trang 1 tĩnh" và "trang 1 từ API" là hai danh sách
  khác nhau mà không ai nhận ra tới lúc so bằng mắt.
- **Reviews: bốn thứ cố tình KHÔNG dựng, và cả bốn đều từng có key i18n** trong
  khối `tourDetail` port từ Nexora mà đợt 1 đã cắt — nên lý do ghi thẳng vào
  component để không ai port lại: histogram phân bố sao (contract không trả số
  đếm theo mức; tính từ trang đang tải là nói dối) · badge `Verified traveller`
  (`source: VERIFIED|CURATED` **chỉ có ở `AdminReviewSchema`**, cố ý không phơi
  công khai) · sort/lọc theo sao (`ReviewsByTourQuerySchema` chỉ có
  `page`/`pageSize`/`tourSlug`) · CTA viết review (`create` cần auth +
  `bookingCode`, eligibility đòi booking `PAID` **và** chuyến đã kết thúc — luồng
  booking chưa có trong web). Trạng thái rỗng mời **HỎI** (`/contact`), không mời
  viết review.
- **Đây là feature web đầu tiên KHÔNG cần đổi contract dòng nào**:
  `reviews.listByTour` đã tồn tại, đã `@Public()`, đã phân trang, và trả **đúng
  phong bì `Paged`** mà `lib/paginate.ts` đang dùng cho tours/blog.
- **`z-index` `@tourism/ui/dialog`** (phát sinh, ngoài phạm vi): `z-50` hard-code
  → backdrop `z-(--z-overlay)` (1300) + content `z-(--z-modal)` (1400), vì navbar
  là `z-(--z-sticky)`=1100 nên lightbox mở ra bị navbar đè. Trừ một khỏi khoản nợ
  "~9 component chưa quét z-index" → **còn ~8**.
- **Review findings tự tìm trong vòng kiểm mắt** (không ai báo):
  - **`next build` fail `Can't resolve './tour-media.js'` trong khi Vitest xanh** —
    đúng cái bẫy đã ghi trong `lib/toc.ts`: import **giá trị** phải bỏ đuôi
    (Turbopack không map `.js`→`.ts`), chỉ `import type` mới được giữ vì nó bị
    xoá lúc biên dịch. Cùng repo, hai resolver khác nhau → unit test không bao giờ
    phát hiện được lớp lỗi này.
  - **`alt` in HAI lần trong lightbox** (nhãn placeholder + caption). Bỏ nhãn —
    caption là thứ sống sót khi thay ảnh thật.
  - **Đệm của một component trả `null`**: `TourGallery` ẩn thì wrapper `pt-10` ở
    page vẫn chiếm chỗ. Dời đệm vào chính `<section>` của component.
- **Nợ ghi sổ, KHÔNG sửa ở đây**: `Button` + `nativeButton={false}` +
  `render={<a href>}` sinh `<a role="button">`, **đè mất role link ngầm** nên
  trình đọc màn hình đọc nó là *nút* dù nó điều hướng. Áp cho **6 chỗ / 4 file**
  (`tour-list-card`, `departures-table`, `booking-rail`, `tour-reviews`) cộng
  `pagination` của `@tourism/ui`. Sửa là một đợt riêng để đổi nhất quán và kiểm
  một lần — test hiện **khoá lại hiện trạng** (query theo `role="button"` rồi
  khẳng định `tagName === 'A'`) để đợt đó biết đúng chỗ cần đổi.

Tests after: `pnpm gate` xanh — **18/18 task** · web **336** (từ 255 cuối cụm
Tours; 20 file test) · API 188 · contract 55 · tokens 10 · ui 5 · i18n 1.
Production build lại được sau khi vá đuôi `.js`; kiểm mắt bằng screenshot 4 nhánh
reviews (danh sách · dialog trang 3 · rỗng · đúng 3 review nên không có "See all").
⚠️ `pnpm gate:int` vẫn KHÔNG chạy được ở máy này (không có Docker CLI trong distro
WSL) — **CI là nơi xác minh**, và branch này chưa push nên int test chưa chạy lần
nào cho 4 commit đó.

## 2026-07-28 — P3b: cụm Tours đợt 2 — trang chi tiết đủ nội dung + SEO + nợ blog (branch `feat/tours-pages`, ff-only, commit code cuối `7a1e743`)

Đóng cụm: Task 9–12 của [plan 13 task](plans/2026-07-27-tours-pages.md). Đợt 1
(Task 1–8) là entry ngay dưới. Ngày 28/07 vì Task 10–12 làm qua nửa đêm — ghi theo
ngày commit thật, không theo ngày bắt đầu cụm.

- **Dải khởi hành — điểm nhấn số 1 của cụm.** `departures[]` là dữ liệu v2 có mà
  Nexora không (họ hardcode `departures: []` nên khối chọn ngày của họ luôn ẩn),
  nên nó lên thẳng đầu trang — **ngược cả 8 sản phẩm đã khảo sát**, vốn giấu lịch
  sau một cú click. Chọn một đợt thì **ba nơi cùng đổi**: dải chip · bảng đợt ·
  rail booking (+ bar đáy mobile). Đo được cả hai chiều trên bản production.
  Ghế + giá in thẳng trên chip vì Baymard ghi nhận: bộ chọn ngày không nói rõ
  tình trạng chỗ thì người dùng phải tự đi xác minh, và đó là điểm rời trang.
- **Trạng thái ở CONTEXT, không nâng lên page** (`departure-selection.tsx`): ba
  nơi đó nằm ba vị trí khác nhau trong bố cục, nâng state lên page sẽ biến cả
  trang thành client component và mất phần render phía server của itinerary,
  inclusions, good-to-know. Ba component trình bày giữ dạng nhận prop thuần để
  test độc lập; các bản `…Connected` chỉ nối chúng vào context.
- Khởi tạo bằng **đợt CÒN CHỖ đầu tiên**, không phải `[0]`: đợt đầu có thể đã hết
  chỗ, mở trang ra với một đợt không đặt được là dẫn người dùng vào ngõ cụt.
- **Timeline mở hết, không accordion**: mô tả ngày của contract v2 là text thuần
  ngắn (không Markdown như Nexora), giấu đi thì trang chỉ còn một cột tiêu đề.
  Đường kẻ dọc dựng bằng `flex-1 w-px`, không phải pseudo-element tính chiều cao.
  `meetingPoint` gắn vào **Day 1** vì nó là thông tin của ngày đầu.
- **FAQ accordion nhưng policy MỞ SẴN** — cùng section, khác cơ chế có lý do: câu
  hỏi ngắn thì quét rồi mở cái cần, còn điều khoản tiền và huỷ chuyến không được
  giấu sau một cú bấm.
- **Inclusions render nguyên văn** — không port cái regex-parse meals/transport
  của `tour-detail-derive.ts` (Nexora): không field nào bảo đảm định dạng chuỗi
  nên parse là đoán, đoán sai thì hiện sai thông tin bán hàng.
- **`robots.ts` + `sitemap.ts`** trả một thụt lùi "Quan trọng": catalogue trước
  giờ vô hình với crawler. Logic ở `lib/sitemap.ts` (12 test) vì project Vitest
  `node` không quét `app/**`. `lastModified` **chỉ điền khi có ngày thật** — blog
  dùng `updated ?? date`, tour bỏ trống; không bịa `new Date()` vì nó nói sai với
  crawler **và** làm output build phụ thuộc thời điểm chạy. Có test canh bất biến
  đó. Đo thật: 34 URL (9 tĩnh + 16 tour + 9 blog), 0 dòng auth.
- **Task 12 (nợ từ cụm Blog)**: `ArticleBody` tách từ khối ~33 dòng mà
  `legal-article.tsx` và `blog/[slug]/page.tsx` chép giống nhau **từng ký tự**.
  Tách đúng khối đang chạy, KHÔNG theo khuôn trong plan — khuôn đó là bản nháp
  (một `Typeset` bọc hết, không số mục, không `Reveal`, không `divide-y`) và làm
  theo là hồi quy thị giác trên cả 4 trang. Kiểm mắt `/terms`: không đổi pixel nào.
- **Phân trang `/blog` dùng `limit = 6`, không phải 9 như plan ghi**: mock có đúng
  9 bài nên `limit = 9` cho `totalPages = 1` và `PaginationBar` tự ẩn — ship một
  tính năng không bao giờ chạy. Đây đúng lý lẽ Task 3 dùng khi chọn 16 tour cho
  `limit = 12`. Đổi luôn `/blog` sang `history.replaceState`: `router.replace`
  kích hoạt RSC round-trip mỗi lần bấm — vấn đề đã sửa cho tours ở `29df3bb` mà
  `/blog` còn sót, và phân trang làm số lần ghi URL tăng hẳn.
- **Review findings tự tìm trong vòng kiểm mắt** (không ai báo):
  - Nút **scroll-to-top che mất nút `Reserve`** của bar đáy mobile (`fixed
    right-5 bottom-6` cùng `z-(--z-sticky)`). Chừa `pr-20` cho góc đó thay vì hạ
    z-index — cùng lớp thì nút tròn vẫn phủ lên chữ.
  - **Nửa phải băng khởi hành trống hoác** — đúng lớp lỗi listing mất 4 vòng mới
    thấy. Thêm link `See all N dates`; cả 8 sản phẩm khảo sát đều có affordance
    "See all dates" nên đây là phần còn lại hợp lý của pattern ta đảo.
  - `role="group"` trên div bọc dải bị Biome chặn (đòi `<fieldset>`, mà fieldset
    có `min-inline-size: min-content` phá vùng cuộn ngang). Bỏ hẳn vì `<section>`
    bọc dải đã có `aria-labelledby`; handler bàn phím chuyển lên chính các chip.
  - `TourCard` (từ trước không trang nào import, nay dùng cho related) tự khai
    `DIFFICULTY_LABEL` trùng y hệt `toursPage.difficultyLabels`, và in rating thô
    nên `4.0` hiện thành `4`.
- **Ba điều học được khi viết test component**, ghi trong spec để không vấp lại:
  `PostCard` gốc là `<Link>` chứ không phải `<article>` như `TourListCard` nên đếm
  card phải theo `href` · chip chuyên mục cũng là `<Link>` (server-render + crawl
  được) chứ không phải button · trong jsdom card đang exit của `AnimatePresence
  mode="popLayout"` **không bao giờ rời DOM** (không có animation frame thật) nên
  đếm sau khi bấm luôn ra 6+3=9 — `waitFor` không cứu, phải khẳng định nội dung
  trang mới đã VÀO.
- Nợ ghi sổ (không làm ở đây): 5 lỗ contract spec §8 — nổi bật là **3 facet
  price/duration/difficulty đang lọc CLIENT sẽ GÃY IM LẶNG khi chuyển sang phân
  trang server**, giờ là điều kiện chặn của cụm gắn API · JSON-LD
  Product/Offer/AggregateRating + FAQPage tách module dùng chung · skip link ·
  `images.remotePatterns` · cache-tag revalidation · `/destinations` · wishlist
  (contract có `wishlist.check` batch) · ~9 component `@tourism/ui` chưa quét
  z-index · **khi gắn API mà muốn skeleton cho trang detail thì phải đo lại status
  slug lạ** (bẫy soft 404, ghi trong plan).

Tests after: `pnpm gate` xanh — **18/18 task** · API 188 · web **255** (từ 214 đầu
đợt 2) · contract 55 · tokens 10 · ui 5 · i18n 1. Production build có `/tours` (ƒ)
· `/tours/[slug]` (● SSG 16 slug) · `/robots.txt` (○) · `/sitemap.xml` (○).
Đo bằng curl trên bản production: slug tour lạ **404** (không phải soft 404),
sitemap 34 URL, robots có dòng `Sitemap:`.
⚠️ `pnpm gate:int` vẫn KHÔNG chạy được ở máy này (không có Docker CLI trong distro
WSL, `test:int` cần Postgres ở `localhost:5432`) — **CI là nơi xác minh**, workflow
chạy trên mọi branch với service `postgres:17-alpine` và gọi `pnpm test:int` trước
`gate`.

## 2026-07-27 — P3b: cụm Tours đợt 1 — listing + khung trang chi tiết (branch `feat/tours-pages`, ff-only, commit code cuối `f1f5e81`)

**Merge GIỮA CỤM** theo yêu cầu user: Task 1–8 của
[plan 13 task](plans/2026-07-27-tours-pages.md); Task 9–12 (dải khởi hành ·
itinerary/inclusions · robots/sitemap · ArticleBody+phân trang blog) còn tiếp
trên cùng branch. Nên `main` hiện có `/tours/[slug]` với các section là **tiêu
đề rỗng** — trạng thái có chủ ý, không phải bug.

- **Mock đắp theo contract, không theo nhu cầu UI** — ngoại lệ duy nhất của luật
  "shape mock tự do": `MockTourCard`/`MockTourDetail` gương đúng
  `TourCardSchema`/`TourDetailSchema` (16 tour), nên cụm gắn API là swap nguồn
  chứ không rename khắp component. Bất biến canh bằng test: tiền là **string**,
  `ratingAvg: null` ≠ 0, mỗi tour đúng 1 destination `isPrimary`,
  `itinerary.length === durationDays`, mọi nhánh nullable có mock chứng minh.
- **`lib/tours.ts` + `lib/paginate.ts` thuần, test trước** (ADR-0014 ranh giới:
  logic thuần chạy project `node`, tương tác chạy `dom`). `foldAccents` tách khỏi
  `lib/blog.ts` thành `lib/text.ts` dùng chung.
- **`/tours` đi qua 4 VÒNG THIẾT KẾ LẠI** (plan dự tính 1 — bảng đầy đủ trong
  plan): chip rail → sidebar Nexora → sidebar tĩnh → drawer → hàng tiêu đề khu
  vực. Ba vòng đầu sửa *thuộc tính* của thứ đang có (màu, vị trí, thanh cuộn,
  đệm); vòng 4 khảo sát 13 sản phẩm thật mới thấy gốc rễ "trống hoác" là **cái
  khung** vẽ quanh các điều khiển, không phải ít phần tử. → luật mới:
  **khảo sát mẫu thật TRƯỚC khi vẽ, không phải sau vòng sửa thứ ba.**
- **Trang chi tiết (Task 8)**: hero tối + `RouteRibbon` + metadata có
  `alternates.canonical` (mẫu `/blog` bỏ sót so với Nexora) + khung 3 cột. Ribbon
  là vector sinh từ `destinations[]` thật, đứng thay bản đồ contract không có;
  **không** gắn nhãn Start/End dù Intrepid rút hành trình về hai đầu mút, vì
  `destinations[]` là bảng join M:N chứ không phải hành trình theo thời gian
  (thứ tự thời gian nằm ở `itinerary[]`). Tour 1 địa danh không vẽ sơ đồ.
- **`token hero`** (ngoài phạm vi plan, phát sinh từ review): trước đó hero mượn
  `background` bên trong scope `dark` nên ở dark mode nó **trùng màu tuyệt đối**
  với nền trang và biến mất. Quy ước chốt: `bg-hero` trên `<section>` + wrapper
  `<div className="dark contents">` bọc nội dung — **không bao giờ** đặt `dark`
  lên chính section. Thêm `--aspect-band` 21/9 cho băng ảnh cắt ngang trang.
- **6 lỗi trong `@tourism/ui`** (vendored cho Radix, repo đã chuyển Base UI):
  `z-50` hard-code trong khi navbar là `z-(--z-sticky)`=1100 (`sheet`/`select`/
  `drawer` — **còn ~9 component chưa quét**) · biến thể `disabled:` chết vì Base
  UI render `<span data-disabled>` · `Select.Value` in **giá trị thô** nếu không
  truyền hàm render · đệm `DrawerHeader`/`DrawerFooter` (`p-4 pb-0`/`p-4 pt-0`)
  bị mất khi thêm border · override class phải khớp **đúng tiền tố** gốc
  (`data-[swipe-axis=x]:sm:`), viết `sm:` trần sẽ bị đè.
- **Review findings đợt đọc lại trước Task 8** (4 lỗi, `1ccce02`·`f1f5e81`):
  9 link dropdown Destinations trỏ `?destination=` (số ít) trong khi `/tours` đọc
  `?destinations=` (số nhiều, danh sách ngăn phẩy) → **mở trang mà không lọc gì,
  im lặng** · `tours/loading.tsx` còn vẽ lưới 3 cột card dọc của bản thiết kế
  ĐẦU trong khi listing là một cột hàng ngang, và đặt `dark` lên section (đúng
  anti-pattern vừa sửa ở `22bd75e`) · khối `tourDetail` trong i18n là **188 dòng
  port trọn gói từ Nexora** mô tả bữa ăn/hạng phòng/travel style/FAQ+policy CỨNG
  — không component nào dùng, đã cắt về đúng field contract · footer `Tours` trỏ
  anchor `/#tours` (section Stats trang chủ) thay vì trang `/tours` thật.
- **SOFT 404 — `loading.tsx` nuốt status code.** Đo được: `loading.tsx` ở segment
  `/tours` tạo Suspense boundary bọc **cả route con `[slug]`**, Next stream shell
  ra trước nên HTTP **200** đã gửi xong trước khi thân trang gọi `notFound()`.
  Slug lạ trả 200 kèm giao diện 404 → crawler index trang lỗi, đúng route Task 11
  sắp đưa vào sitemap. Đo ở CẢ `next dev` lẫn production build; `/blog/[slug]`
  không dính vì không có `loading.tsx` nào. Chữa: listing vào route group
  **`(listing)/`** (URL không đổi) nên skeleton không còn bọc `[slug]`, và
  `[slug]` **không có `loading.tsx`** (trang là SSG tĩnh, skeleton không mua được
  gì). Đã thử và KHÔNG ăn: `dynamicParams = false` — 404 của nó vẫn đi qua cùng
  boundary. Hai lần đoán sai đầu tiên cũng ghi trong plan để không thử lại.
- Nợ ghi sổ: 5 lỗ contract (spec §8) — nổi bật là **3 facet price/duration/
  difficulty đang lọc CLIENT trên mock sẽ GÃY IM LẶNG khi chuyển sang phân trang
  server**, giờ là điều kiện chặn của cụm gắn API · JSON-LD Product/Offer/
  AggregateRating + FAQPage · skip link · `images.remotePatterns` · cache-tag
  revalidation · `/destinations` · ~9 component `@tourism/ui` chưa quét z-index ·
  khi gắn API mà muốn skeleton cho trang detail thì phải đo lại status slug lạ.

Tests after: `pnpm gate` xanh — **18/18 task** · API 188 · web **214** (từ 83) ·
contract 55 · tokens 10 · ui 5 · i18n 1; production build sinh `/tours` (ƒ) +
`/tours/[slug]` (● SSG 16 slug); status đo bằng curl trên bản production:
`/tours/<slug hợp lệ>` 200 · `/tours/<slug lạ>` **404**.
⚠️ `pnpm gate:int` **CHƯA chạy được** ở máy này: `test:int` cần Docker Postgres
ở `localhost:5432`, distro WSL hiện tại không có Docker CLI (`ECONNREFUSED`,
globalSetup chết nên vitest báo "No test files found"). Rủi ro đã bound bằng
grep: diff của cụm không chạm file nào trong `apps/api`/`libs/shared/contract`/
`prisma`, và `apps/api` **không** phụ thuộc `@tourism/i18n` nên key i18n bị xoá
không tới được int test. CI (có service Postgres) là nơi xác minh khi push.

## 2026-07-27 — Thân trang 404 + nền lưới động Contact (thẳng `main`, `e34de29`·`55c3c17`)

Hai chỉnh sửa giao diện nhỏ, làm thẳng trên `main` vì không đụng contract nào.

**Thân trang 404** — user hỏi vì sao 404 có khoảng trắng trước footer. Đo ra:
khoảng đó (`mt-32` của footer) có ở **cả 7 trang**, nhưng chỉ 404 mới lộ, vì
nền tối của nó do các lớp `absolute` vẽ nên dừng đúng ở biên section. User chốt
KHÔNG gỡ khoảng trắng (đó là nhịp chung của site) mà thêm hẳn một section thân
trang nền sáng hoà vào đó.
- `not-found-body.tsx` — hai cột: chữ bên trái, số 404 khổ lớn bên phải. Số
  dựng kiểu **in lệch**: một lớp đặc `text-primary`, sau lưng một lớp bóng
  cùng chữ tông nhạt lệch xuống-phải. Motion: bóng "đặt xuống" trước, lớp đặc
  đè lên sau, các dòng cột trái trồi lên lệch pha.
- Copy dẫn đường bằng **link nhúng trong câu** (lối Mailchimp) thay vì hàng nút
  trống, và **chỉ trỏ trang có thật** — /blog · /about · /faq. `/tours` và
  `/destinations` chưa dựng; gợi ý sang đó là đẩy người đang lạc vào một 404 nữa.
- `py-24` chứ không `py-32`: cộng `mt-32` của footer ra 224px, khớp nhịp 208px
  các trang khác.
- `lib/blog.ts`: thêm `latestPosts(posts, count)` + 5 test; `homeTeaserPosts`
  nay định nghĩa qua nó.
- **Ba bản bị user loại giữa chừng** (ghi lại để không thử lại): khối gợi ý bài
  viết ("không phải ý mình") · số 404 nét viền rỗng · ba lớp viền lồng nhau. Nút
  "Report a broken link" cũng bị bỏ — **mình không có tính năng nhận báo link
  hỏng**, để nút đó là hứa một thứ không tồn tại.
- Bài học quy trình user nhắc thẳng: *"mới nhìn vào cái đầu tiên là chốt sẵn
  luôn"* — lần đầu tôi lấy ngay block đầu của shadcn/studio. Làm lại: khảo sát
  cả 5 block + Mailchimp/Notion/Framer/GitHub rồi so 5 phương án mới chốt.

**Nền lưới động `#visit` ("Two doors, always open.")** — thay `TopoPattern
variant="grid"` bằng **Animated Grid Pattern** vendor từ MagicUI. Không thêm
dependency npm (chỉ cần `motion`, `apps/web` đã có). Đặt ở
`apps/web/src/components/motion/` **chứ không** `@tourism/ui`: gói dùng chung
không khai `motion` (component MagicUI đã có trong đó — `animated-theme-toggler`
— chạy bằng View Transitions API), và mọi component dùng motion đều nằm ở đây.
Ba chỗ vá so với bản gốc, đều là thứ bản gốc thiếu:
- bỏ mặc định `fill-gray-400/30` (hex cứng, vi phạm luật tokens-only) — màu do
  caller đặt bằng token;
- tự kiểm `prefers-reduced-motion` — `MotionConfig reducedMotion="user"` của
  mình **chỉ tắt transform/layout, KHÔNG tắt opacity**, nên với bản gốc người
  xin giảm chuyển động vẫn bị lưới nhấp nháy;
- `IntersectionObserver` dừng hoạt hình khi cuộn khỏi khung nhìn; bản gốc chạy
  vô hạn, mỗi ô `setState` liên tục kể cả khi không ai nhìn.

Đo bằng trình duyệt thật thay vì tin lời hứa: số `<rect>` trong `#visit` là
**28** khi trong khung nhìn, **2** khi cuộn khỏi, **2** với `reducedMotion:
'reduce'` (2 = chỉ còn lưới nền tĩnh). `TopoPattern` vẫn dùng ở 5 chỗ khác nên
giữ nguyên.

Dọn trước khi push: 6 commit thử nghiệm trung gian squash còn 2 theo đúng ranh
giới tính năng (diff cây so HEAD cũ = 0 ngoài 1 docstring sửa có chủ ý — docstring
`latestPosts` còn viện dẫn khối gợi ý đã bị gỡ).
Tests after: gate xanh 18/18 — 76 unit web + 5 ui; không lỗi runtime ở
`/contact` lẫn `/not-found`, kiểm cả desktop 1440 và mobile 390.

## 2026-07-27 — Vá 3 alert Dependabot (thẳng `main`, `f01a58f`)

Ba alert bắc cầu, không cái nào là dependency trực tiếp của mình.
- **#8 find-my-way 9.6.0 → 9.7.0** (high, CVSS 7.5, DDoS qua HTTP/2). Đây là
  router BÊN TRONG fastify nên nằm trên đường HTTP thật của `apps/api`.
  `fastify@5.10.0` khai `^9.6.0` nên tự lên được, nhưng
  `@nestjs/platform-fastify@11.1.28` **ghim cứng 9.6.0** và bản 11.x mới nhất
  cũng vẫn ghim → phải override. Đo mức độ trước khi hốt hoảng: `apps/api`
  **không bật HTTP/2 ở đâu** (grep `http2`/`allowHTTP1`/`createSecureServer`
  = rỗng) nên lỗ hổng không với tới được ở cấu hình hiện tại.
- **#9 valibot 1.2.0 → 1.4.2** (moderate). Đường đi prisma CLI → `@prisma/dev`
  → valibot, **ghim cứng 1.2.0**, bản `@prisma/dev` mới nhất (0.24.16) cũng
  vẫn ghim → override. Dự án không dùng valibot (validate bằng zod).
- **#10 brace-expansion → 5.0.8** (high, CVSS 7.5, DoS nở chuỗi brace).
  Advisory ghi affected `<= 5.0.7` tức **cả dòng 2.x cũng dính mà không có
  backport** — bản vá duy nhất là 5.0.8. Hai đường: `minimatch@10`
  (shadcn/ts-morph + style-dictionary) tự lên được; `minimatch@9` ←
  `@swc/cli` — **trình biên dịch build của `apps/api`** — khai `^2.0.1`, nên
  override này **ép qua major 2→5**. Không suy đoán là an toàn: đã xoá
  `apps/api/dist` rồi ép build lại (`--force`), swc biên dịch đủ 115 file và
  loại đúng `**/*.spec.ts` — chính glob đó là đường đi qua minimatch →
  brace-expansion. Ghi sẵn lối thoát trong `pnpm-workspace.yaml`: nếu build
  gãy vì dòng này thì gỡ ra và chấp nhận alert, vì mẫu brace ở đây do chính
  `package.json` của mình viết, không phải input từ ngoài.

Bài học công cụ: **pnpm 11 không còn đọc `pnpm.overrides` trong `package.json`**
(chỉ cảnh báo rồi bỏ qua) — chỗ đúng là `overrides:` trong `pnpm-workspace.yaml`.
Tests after: gate:int xanh — 334 unit (10 tokens + 55 contract + 5 ui + 76 web
+ 188 api) + 145 int; build ÉP LẠI từ đầu cho cả api lẫn web đều xanh.

## 2026-07-27 — P3b: cụm trang Blog (branch `feat/blog-pages`, merge `b7aeb3f`)

Vá thụt lùi so với Nexora: `/blog`, `/blog/[slug]`, `/blog/rss.xml` — v2 trước
đó chỉ có section `#journal` trên Home. Thực thi subagent-driven, 7 task + 3
đợt vá, mỗi task một reviewer riêng CỘNG một final review toàn nhánh.
- **Mock 3 → 9 bài**, mỗi bài có `sections[]` (cùng hình dạng `LegalDoc`) nên
  dùng lại được nguyên bộ xương cụm pháp lý: `Typeset preset="reading"` +
  `OnThisPage` + `ReadingProgress` + `tocFromSections` (tách ra từ
  `tocFromLegalDoc`, test cũ giữ nguyên).
- **`lib/blog.ts`** — toàn bộ logic thuần có test: `sortPostsByDate` ·
  `filterPostsByCategory` · `postCategories` · `searchPosts` (bỏ dấu tiếng
  Việt HAI CHIỀU, `đ`/`Đ` phải thay tay vì `normalize('NFD')` không tách được)
  · `adjacentPosts` · `relatedPosts` · `homeTeaserPosts`.
- **`/blog`**: lưới tạp chí (bài mới nhất 2 cột), chip lọc chuyên mục, **search
  gõ-tới-đâu-lọc-tới-đó** đồng bộ `?tag=&q=` qua `router.replace(scroll:false)`.
  Chip là `<Link>` thật + `preventDefault` → **lọc vẫn chạy khi tắt JS**.
- **Gói motion** (user chọn sau khi xem bản đầu): hiệu ứng "chroma" CSS thuần
  (`[&:has(a:hover)_a:not(:hover)]` — học ReactBits Chroma Grid, không thêm
  dependency) · reflow `AnimatePresence` + `layout` + blur-fade (ý MagicUI Blur
  Fade, dựng bằng `motion/react` sẵn có) · gạch chân chạy dùng `currentColor`.
- **`/blog/[slug]`**: `generateStaticParams` 9 slug, slug lạ → `notFound()`,
  JSON-LD `Article` + `BreadcrumbList`, `ShareRow` (copy link + X + Facebook),
  `PostNav` bài mới/cũ hơn, 3 bài liên quan.
- **`lib/site.ts`** (`siteUrl`·`absoluteUrl`·`escapeXml`) + `apps/web/.env.example`
  — file env đầu tiên của web + feed RSS 9 item.
- **HAI QUYẾT ĐỊNH ĐỔI HƯỚNG CỦA USER giữa chừng**:
  1. **Một `PostCard` duy nhất theo thiết kế Home** (card trần, chip jade in
     hoa, nút mũi tên tròn) — hướng Home → /blog, không phải ngược lại. Card
     Home nay bấm được (trước chỉ có `cursor-pointer`, không `href`).
  2. **Toàn site về `ImagePlaceholder`**, chỉ dùng ảnh thật khi user yêu cầu
     riêng. 4 chỗ đổi: `not-found` · `auth-screen` · `tour-card` · `post-card`;
     `grep next/image apps/web/src` nay rỗng. File ảnh + CREDITS giữ làm tài sản.
- Review findings — **thứ chỉ final review toàn nhánh mới thấy** (7 reviewer
  từng-task đều bỏ lọt vì mỗi người chỉ soi brief của mình):
  * `BreadcrumbList` spec yêu cầu nhưng **rơi mất ngay từ lúc viết plan** nên
    không brief nào nhắc → không ai bắt.
  * Task 3b **âm thầm đảo hành vi** mà reviewer Task 3 đã xác minh: tag lạ
    đáng lẽ ra trạng thái rỗng, sau 3b lại rơi về "All" hiện đủ 9 bài trong
    khi URL vẫn ghi `?tag=…` — comment còn bị viết lại cho khớp hành vi mới,
    xoá luôn dấu vết.
  * Test `relatedPosts` tên là "bù bằng bài MỚI NHẤT" mà chỉ assert độ dài →
    thêm `.reverse()` vào filler thì 76/76 vẫn xanh.
- Review findings từng task (đều đã vá): nhánh `đ`/`Đ` có 0% canh (xoá 2 dòng
  replace mà 19/19 xanh) · chip mất khả năng chạy không-JS · **Home render
  tràn 9 card** vì Task 1 nâng mock mà không ai rà nơi tiêu thụ (USER tự phát
  hiện, review tự động bỏ lọt) · test "Home chỉ 3 bài" là tautology → chuyển
  vào hàm thuần `homeTeaserPosts` · `siteUrl` bỏ bước cắt `/` thừa mà 6/6 xanh
  · `apps/web/.gitignore` có rule `.env*` TRẦN chặn luôn `.env.example`
  (gitignore thư mục sâu thắng gitignore gốc) · `ShareRow` đọc
  `window.location` lúc render làm **SSR sập 500** (lỗi trong chính brief).
- Nợ ghi sổ: tách `ArticleBody` dùng chung cho `/terms` + `/blog/[slug]` (đang
  chép ~40 dòng, đã bắt đầu trôi) · phân trang + gắn API (`blog_posts`) ·
  `EnquiryCta` cuối bài · related tours · jsdom + RTL cho `apps/web` (cần ADR —
  là gốc rễ khiến 2 lỗi tầng component lọt qua CI) · `robots.ts`/`sitemap.ts`
  (giờ đã có `lib/site.ts` nên nhẹ hơn) · scrim hero bài viết đậm tới mức ô
  placeholder vô hình (chờ ảnh thật) · `journal-mist.jpg` là núi tuyết kiểu
  Himalaya gắn cho bài Sa Pa.
Tests after: gate:int xanh — **76 unit web** (từ 41) + 5 ui + **145 int / 17
file**; build production có đủ `/blog` (ƒ) · `/blog/[slug]` (● SSG 9 slug) ·
`/blog/rss.xml` (○); CI branch `success` trước merge.

## 2026-07-25 — P3b: cụm trang pháp lý/utility (branch `feat/legal-utility-pages`, merge `1760831`)

Vá đúng chỗ thụt lùi so với Nexora: 4 trang nội dung dài + 3 route boundary
chưa hề tồn tại ở v2.
- **Nội dung có sẵn từ P0**: `libs/shared/i18n/src/lib/legal/{terms,privacy,
  cancellation}.ts` + `messages.{faqPage,resilience,pageMeta}` đã port từ
  18/07 nhưng chưa trang nào dùng — đây là lần ĐẦU `apps/web` import
  `@tourism/i18n`. Dọn lại: 13 chỗ "Nexora" → "Tourism", `updated` → 25/07,
  bật `reviewNote` cả 3 doc, **thêm mục "Test-mode payments"** vào terms +
  đoạn nhắc trong cancellation (Stripe/PayPal sandbox, không tiền thật).
- **Tách `resilience` ra module riêng**: `error.tsx`/`global-error.tsx` là
  client component, import cả `messages.ts` (~83KB chuỗi) chỉ để lấy vài câu
  là phí. `messages.resilience` vẫn trỏ về đó nên chỗ gọi cũ không đổi.
- **Khuôn chung `LegalArticle`** (khảo sát Vercel/Linear/Stripe: trang pháp lý
  hiện đại mở bằng typography, KHÔNG ảnh hero): `ContentHero` band tối mỏng +
  `TopoPattern` tĩnh · thân bài 1 cột 68ch `Typeset preset="reading"`
  (ADR-0012) · số mục mono + hairline · `OnThisPage` sticky **bên phải**
  (Nexora để trái), mobile đưa lên đầu, cuộn trong khung 256px.
- **Motion giữ lại 3 thứ bám hành vi đọc**: thanh tiến độ đọc (`useScroll`),
  chỉ báo TOC trượt (`layoutId`), reveal section. Nền hero ĐỘNG (`TopoLive` —
  noise + marching squares trên canvas, 12 test) đã dựng rồi **revert**
  (`b0bb134`): user chốt vân dày lên và chạy liên tục phá nhịp trang đọc.
- **/faq**: `filterFaqCategories` thuần (5 test) + 5 nhóm accordion kế thừa
  style `contact-faq` + JSON-LD `FAQPage` (escape `<`, pattern Nexora).
- **`SiteChrome`** tách khỏi `(site)/layout.tsx` — 404 của URL không khớp chỉ
  render trong ROOT layout nên không có chrome nếu không dùng lại khối này.
  `not-found` màn ảnh thật (halong.jpg, mẫu Intrepid); `error`/`global-error`
  panel tối giản, CỐ Ý không chrome/ảnh để sống được khi cây trang đã hỏng.
- **`Stepper`** (user tự thêm) vá để build được: cài `@stepperize/react` v7,
  sửa alias `@/lib/utils`, **migrate API cũ → v7** (`state.current.data.id` →
  `id`, `navigation.goTo` → `goTo`, `lookup.getIndex` → `index`), bỏ 2
  useEffect controlled thủ công (v7 có `step`/`onStepChange`). Lỗi tool không
  bắt: `data-loading={false}` vẫn render thuộc tính · `*:[svg]:size-4` không
  sinh CSS · `role="tablist"` bọc cả tabpanel → chuyển xuống nav rồi đổi nav
  thành div. Thử làm sơ đồ hoàn tiền ở /cancellation-policy rồi **revert**
  (`13f5b3b`) — user chốt trang này dùng đúng khuôn /terms.
- Nối link: footer nhóm Support (4 link `#top` → route thật); `/register` và
  mini-FAQ Contact hết 404.
- Review findings tự bắt bằng ĐO (không đoán): Turbopack không resolve
  `'./slug.js'` → `.ts` dù Vitest resolve được (test xanh mà trang 500) · mép
  trái thân bài lệch 80px so với hero (đo `getBoundingClientRect`) · thanh
  tiến độ `z-50` bị TopBar `z-1700` che, rồi màu `primary` trên TopBar jade
  thì tàng hình → `on-media` · eyebrow 404 jade trên ảnh vịnh đọc không ra →
  `on-media/80`. Biome bắt thêm: `aria-hidden` trên `<canvas>`, tên hàm
  `Error` che global.
- Nợ ghi trong spec: `robots.ts`/`sitemap.ts` (cụm SEO riêng, user chốt hoãn) ·
  `EnquiryCta` cuối /faq · gắn API cho FAQ (ứng viên bảng `faqs`) ·
  `StepperTrigger asChild` mới chỉ là đồ trang trí · i18n sweep copy inline.
Tests after: gate:int xanh — 26 unit web + 5 ui + **145 int / 17 file**;
build production liệt kê đủ 4 route mới + `/_not-found`; CI branch `success`
trước merge.

## 2026-07-25 — P3b: gia vị bản đồ 4 vị trí (branch `feat/topo-accents`, merge `6074f06`)

Nhân diện motif trắc địa của cụm auth ra site — nguyên tắc CHỪNG MỰC: tối đa
1–2 vị trí/trang, mỗi texture phải kể đúng chuyện section đó (khảo sát Hero
Patterns/Pattern Monster/Dribbble: pattern hình học generic bị loại).
- **`TopoPattern`** component 3 variant (mask token, màu tự ăn theme):
  `wide` (topo-wide.svg 1800×700 seed 11 — sinh MỚI cho band ngang, giữ độ
  mảnh nét thay vì phóng bản dọc) · `portrait` (dùng chung auth-topo.svg) ·
  `grid` (survey-grid.svg 1200×900 TILE chia hết bước 60px, không mối nối).
- **4 vị trí**: CTA band Home (vân sáng 5% khắc chìm) · hero Contact (jade
  12%, ăn rơ tem "HÀ NỘI · SA PA") · Numbers About (4% — nhạt nhất, user chốt
  giữ) · Location Contact (LƯỚI trắc địa: index 300px + tick "+" + dấu ×,
  fade dần về đáy bằng mask 2 lớp composite để card sạch; dark nâng 14%).
- User note: "ổn dù không đúng hẳn ý định ban đầu" — chốt giữ cả 4; các đề
  cử còn lại (vân giấy, postmark) chưa làm, để dành vòng polish P7.
Tests after: gate:int xanh — gate 18/18 + int 145/17; CI branch `success`
trước merge.

## 2026-07-25 — P3b: trọn bộ 5 trang auth còn lại (branch `feat/auth-pages` đợt 2, merge `3bf142f`)

Nhân layout từ /login mẫu ra 5 trang (plan Task 3–6), cụm auth HOÀN CHỈNH 6/6:
- **/register**: name/email/password + Terms checkbox + Google; quote "minivan
  2014" (Đức Anh) bám chuyện sáng lập /about. Stub `NEW TRAVELLER`.
- **/forgot-password**: mock state `sent` đổi thân card thành "Check your
  inbox" + gửi lại (`LOST TICKET DESK`) · **/reset-password**: password ×2
  (`REISSUE TICKET`).
- **OtpForm dùng chung** (màn ra mắt `input-otp` của @tourism/ui): 6 ô 3+3 +
  đếm ngược resend 60s → **/verify-email** (`BOARDING CHECK · EMAIL`, có móc
  backend thật vì ADR-0008 đã gate emailVerified) + **/two-factor** (TOTP,
  toggle "Use a recovery code", `BOARDING CHECK · TOTP`).
- **PasswordStrengthField** (review vòng 2, convert từ playground FlyonUI user
  đưa): eye toggle + 5 vạch điểm + checklist 5 yêu cầu; token hoá màu
  (destructive→spark→primary thay orange/amber/green-500), ngưỡng 12→8 ký tự;
  dùng chung register + reset. Copy dài rút gọn toàn cụm; bỏ note "six-digit".
- Cross-link đủ: login ↔ register ↔ forgot → reset; các trang OTP có đường lui.
- Sự cố tự vá: `git add -A` lỡ track `playground.md` (file nháp user) → gỡ
  khỏi commit + thêm `.gitignore`.
- Nợ không đổi (ghi ở spec): Better Auth client, Google backend, twoFactor
  plugin, validate/honeypot/rate-limit.
Tests after: gate:int xanh — gate 18/18 + int 145/17; web unit 11; CI branch
`success` (3m8s và lượt chót sau strength-field) trước merge.

## 2026-07-24 — P3b: hạ tầng cụm auth + /login mẫu (branch `feat/auth-pages`, merge `da006cb`)

Merge MỘT PHẦN có chủ ý: spec+plan 6 trang auth, hạ tầng dùng chung, và /login
làm trang MẪU đã chốt layout; 5 trang còn lại (register/forgot/reset/verify/2FA)
nhân bản từ mẫu ở branch sau.
- **Kiến trúc**: root layout tách route group — `(site)/` giữ shell
  TopBar/navbar/footer/ScrollToTop (Home/About/Contact dời vào, URL không đổi),
  `(auth)/` màn hình riêng chỉ logo; AuthScreen (split 2 cột, quote đổi theo
  trang) + TicketCard (chữ ký "tấm vé": đục lỗ mép trái, cuống vé mono
  `HN → SAPA · GATE: LOGIN` + barcode 2 lớp gradient) dùng chung cả cụm.
- **Saga thiết kế 4 vòng** (bài học đắt → memory `design-research-before-decorating`):
  aurora WebGL (ogl) → poster vector "SAPA EXPRESS" (tàu, ruộng bậc thang) →
  cả hai bị loại vì "lộ mùi AI"; chốt bằng KHẢO SÁT MẪU THẬT (10 login SaaS +
  Dribbble topo + Airbnb/AllTrails): panel phải = ẢNH THẬT Sa Pa "Ray over
  terrace rice field" (Phi Phi Hoang, CC BY 2.0 Wikimedia, credit ngay UI,
  crop 4:5 sharp 237KB) + khung hairline + caption mono; nền trái = vân đồng
  mức SINH THUẬT TOÁN (value-noise + marching squares, script scratchpad seed 7)
  xuất `auth-topo.svg` 16KB dùng CSS mask token-hoá + tuyến hành trình chấm
  `1 650 M → FAN SI PAN · 3 143 M`. Dependency `ogl` thêm rồi GỠ sạch.
- **GoogleIcon 4 màu brand** (ngoại lệ tokens-only có ghi chú — brand mark);
  autofill/label a11y giữ chuẩn (`htmlFor` cho Checkbox base-ui).
- Nợ ghi ở spec: Better Auth client, Google backend, twoFactor TOTP +
  emailVerification (ADR lúc gắn), validate/honeypot/rate-limit form.
- Ảnh thật đầu tiên vào repo (phá lệ placeholder CÓ CHỦ Ý, chỉ cụm auth).
Tests after: gate:int xanh — gate 18/18 task (FULL TURBO) + int 145/17; web
unit 11; typecheck + biome sạch; CI branch `success` 2m33s trước merge.

## 2026-07-24 — P3b: trang /contact (branch `feat/contact-page`, merge `19e639f`)

Trang thứ ba của P3b — kế hoạch 5 section user duyệt trước khi dựng, sau đó
2 vòng điều chỉnh nâng "wow" (user chấm bản đầu 6.5 vì quá an toàn):
- **5 section**: Hero tối ngắn (kiểu Nexora ContentHero, breadcrumb + dòng
  "presence" chấm jade thở "Mai is on replies today") · Split form+info
  (ShadcnSpace Contact 01 — trái info + mini-marquee Featured-by tái dùng
  PARTNERS qua export, phải form card) · Location & hours (Nexora
  ContactLocation — map placeholder + 2 card văn phòng HN/Sa Pa) · Mini-FAQ
  (ShadcnSpace FAQ 01 — card rời, item mở đổi nền; 5 câu pre-sales, link /faq
  tương lai) · CTA 01 aurora HỒI SINH từ git history (tránh trùng CTA 02 của
  /about).
- **Chữ ký "LÁ THƯ"** (skill frontend-design, đặt cược một chỗ = form vì luận
  đề "not a hotline"): bản 1 mad-libs blank-giữa-câu bị chê rối mắt → bản 2 bố
  cục thư rõ ràng — "Hello tourism," + từng dòng nhãn-câu-hỏi + chỗ điền gạch
  nét đứt mực jade italic + "Yours," + tem la bàn + P.S. người thật đọc thư.
- Mock mới TDD: `offices` (2 văn phòng) + `faq` (5 câu) — ứng viên schema;
  Select vùng mock từ REGIONS (nợ API categories như Nexora); navbar/footer
  Contact trỏ /contact (section Home giữ song song như Nexora).
- Kỹ thuật: hero PHẢI scope dark (navbar chưa-cuộn chữ on-media theo pattern
  "hero luôn tối" — hero sáng làm navbar tàng hình); export ContactField/
  BARE_FIELD/EMAIL/PHONE từ home/contact thay vì nhân bản.
Tests after: gate:int xanh 18/18 task — web unit 11 (mocks +offices/faq) ·
int 145/17 · tokens 10 · ui 5 · typecheck · biome sạch; CI branch `success`
2m28s trước merge.

## 2026-07-24 — P3b: trang /about hoàn chỉnh (branch `feat/about-page`, merge `5e9dd08`)

Trang thứ hai của P3b, dựng TỪNG SECTION theo quy trình demo → review → chốt
(khác Home dựng cả trang một lượt) — 16 file, +1.207 dòng. Nguồn mở rộng:
ngoài 12 template PrebuiltUI còn khai thác **ShadcnSpace** (đọc source thật qua
registry `/r/<block>.json`, chỉ dùng block free).
- **8 khối**: Hero (forged/Hero — reveal 3 dòng từng dòng, stats CountUp, scroll
  cue) · Story (forged/About — ảnh + floating box "12+", 2 quote guide) ·
  Timeline (prompt2app/build-process — trục TỰ VẼ theo scroll, 4 mốc nhuộm màu
  vùng, zigzag chữ-ảnh + TiltCard, sửa lỗi thứ tự mobile của template gốc) ·
  Numbers (forged/Stats — lưới hairline + watermark "NUMBERS" + nền ảnh mờ,
  "0 Scripts" làm điểm dừng mắt) · Values (forged/Services — 6 lời hứa, thẻ
  highlight No scripts, khép vòng các teaser pill/marquee) · Gallery (ShadcnSpace
  Gallery 01 — bento 3 vùng + tổng, số derive từ REGIONS) · Team (ShadcnSpace
  Team 01 — portrait grayscale hover, CHỈ founder theo quyết định user; TDD mock
  `team_members`) · CTA (ShadcnSpace CTA 02 — video placeholder + marquee cam
  kết nền primary, thắng CTA 01 aurora sau khi demo cả hai).
- **Điều hướng**: navbar/footer anchor sang dạng `/#...`, About Us trỏ `/about`;
  Partners bị BỎ khỏi About (dải tối cô lập CTA) — trust do Numbers gánh.
- **Nhất quán dữ liệu**: phát hiện + vá Numbers hardcode 96 tour ≠ 68 tổng
  REGIONS — cả Numbers lẫn Gallery giờ derive cùng nguồn.
- Chẩn đoán phụ trong review: cảnh báo hydration `fdprocessedid` là do browser
  extension (IDM) của user, không phải bug — không vá, đã giải thích.
Review findings đáng nhớ: hero container thử kiểu forged rồi user chọn bản gốc
(comment chống "sửa lại" đã ghi tại chỗ); script screenshot dùng sai tham số
`viewportSize` → toàn bộ ảnh soát trước đó chụp 1280 thay 1920, đã sửa; bài học
build-chen-dev-server thành memory + được tuân thủ suốt branch này.
Tests after: gate:int xanh 18/18 task — web unit 9 (mocks +team) · int 145/17 ·
tokens 10 · ui 5 · typecheck · biome sạch; CI branch `success` 2m39s trước merge.

## 2026-07-23 — P3b: nâng cấp navbar (branch `feat/navbar-upgrade`, merge `4e8f981`)

Điều chỉnh Home sau chốt (đổi hướng lộ trình: nhóm trang marketing trước
listing) — navbar lên đủ đồ theo đối chiếu Nexora site-header, 6 vòng điều
chỉnh với user:
- **Destinations dropdown** (NavigationMenu Base UI): 3 vùng + hint + chấm màu
  `--region-primary` theo `data-region` (lần đầu region token lên navbar);
  trigger LỘT nền muted mặc định của shadcn để đồng bộ link trần (#2).
- **UserMenu** (convert Nexora): chưa đăng nhập → "Log in" (/login, phase auth);
  đã đăng nhập → avatar + dropdown (mock `MOCK_SESSION` trong mocks/auth.ts —
  flip sang SAMPLE_USER để xem). Nav thêm Travel Blog (#journal) + About Us;
  bỏ Reviews (#3 — navbar chỉ chứa đích đến là trang thật).
- **AnimatedThemeToggler @magicui** vào `@tourism/ui` qua shadcn CLI (lan tròn
  View Transitions) + script init theme trước paint đầu (localStorage/system,
  chống chớp trắng khi reload) + `@types/react-dom` còn thiếu.
- **2 bug dark-theme lộ ra khi user lần đầu bật được dark**: (a) autofill
  Chrome ép nền trắng — vá inset-shadow theo token card + transition trick; ghi
  chú giới hạn: trạng thái preview (`:-internal-autofill-previewed`) là UA cấm
  đè, không fix được; (b) field Contact HAI lớp màu — `dark:bg-input/30` của
  shadcn Input/Textarea không bị `bg-transparent` gỡ (khác variant), phải thêm
  `dark:bg-transparent` tường minh.
Review findings đáng nhớ: screenshot tự soát bắt lỗi `slice(1)` nuốt mất mục
"Travel Blog" trước khi tới tay user; bài học tw-merge-không-gỡ-variant-khác
vào comment BARE_FIELD.
Tests after: gate:int xanh 18/18 task — int 145/17 · web 8 · tokens 10 · ui 5 ·
typecheck · biome sạch; CI branch `success` 2m48s trước merge.

## 2026-07-23 — CI xanh lại + vá 5 alert Dependabot (branch `fix/ci-test-db-and-dep-vulns`, merge `69cac5a`)

CI main đỏ **suốt 21→23/07** (từ merge ADR-0008) mà không ai nhận ra vì merge
kiểu ff không qua PR — phát hiện khi push trang Home. Lỗi HAI TẦNG cùng một
triệu chứng P2021:
- **Tầng 1**: ADR-0008 thêm reconcile admin lúc `onApplicationBootstrap` → 4 e2e
  spec trong task `test` (bootstrap · fail-closed · throttle · health) boot cả
  AppModule nên chạm bảng `User`; CI chỉ tạo + migrate `tourism_test` trong
  globalSetup của `test:int` — chạy SAU. Sửa: đảo `test:int` lên trước bước gate
  trong ci.yml (tái dùng cơ chế idempotent duy nhất, không nhân đôi vào YAML).
- **Tầng 2** (che tầng 1 khỏi chẩn đoán): turbo **strict env** lột `DATABASE_URL`
  khỏi task `test` (turbo.json không khai báo `env`) → e2e rơi về db mặc định
  `tourism` — ở CI db này TỒN TẠI nhưng RỖNG (image Postgres tự tạo db trùng tên
  POSTGRES_USER), nên lỗi hiện ra là "thiếu bảng" chứ không phải "thiếu db".
  Sửa: `"env": ["DATABASE_URL"]` cho task `test`.
- **5 alert Dependabot**: fast-uri 3.1.4/4.1.1 (2 high — `pnpm update` trong
  range) · sharp 0.35.3 (high, chạy prod thật qua next/image — override
  `>=0.35.0` vì Next khai báo ^0.34) · postcss 8.5.22 (moderate — override
  `>=8.5.10` vì Next pin cứng 8.4.31) · @hono/node-server GIỮ 1.x + dismiss
  tolerable-risk có ghi lý do (path traversal chỉ Windows, transitive của
  dev-tooling, bản vá 2.0.5 là major phá `@prisma/dev`) — lý do nằm tại comment
  pnpm-workspace.yaml.
Review findings: bài học "CI chạy mọi branch" phát huy — fix được CI thật xác
nhận (run `success` 2m48s) TRƯỚC khi merge vào main, đúng lỗ hổng mà quy ước
này sinh ra để vá.
Tests after: gate:int xanh 18/18 task — API unit 188/21 file (có mô phỏng điều
kiện CI: unit chạy trên `tourism_test`) · int 145/17 · web 8 · tokens 10 · ui 5 ·
typecheck · biome sạch.

## 2026-07-23 — P3b: trang Home tĩnh hoàn chỉnh (branch `feat/home-page`, merge `2d98be3`)

Trang Home static-first đầu tiên của P3b — 40 commit, **33 vòng điều chỉnh** review
từng-section với user (quy trình: demo → user review local → điều chỉnh đánh số).
Nguồn thiết kế: convert **nguyên bố cục template Estate** (quyết định vòng 1 sau khi
bản tự-compose bị chê "chán"), sau đó thay/bồi từng section bằng convert từ
**forged** (Partners marquee, CTA banner tràn viền, footer newsletter+watermark,
Journal/Insight Hub, thanh cuộn 4px + ::selection) — luật chung: *bố cục + motion
100% template, da thịt 100% token/font dự án* (bài học #25: không ép Literata
ALL-CAPS 900).
- **10 khối**: Hero fullscreen · Partners marquee · Stats (CountUp + slider) ·
  Destinations sticky-scroll ngang (9 địa danh 3 vùng, chip tint `--region-*`) ·
  WhyChooseUs (accordion + ảnh đổi theo mục + caption/chấm điều hướng) ·
  Testimonials (marquee dọc 2 cột ngược chiều + bảng điểm 4.9 tính từ mock) ·
  Journal (3 card, khôi phục sau khi bị bỏ rơi ở vòng convert) · CTA banner
  (heading 2 dòng accent italic, nút glow) · Contact (form icon-field + panel
  primary gradient: timeline 3 bước + card liên hệ, lai Nexora "Plan your trip") ·
  shell TopBar/pill-navbar/footer/ScrollToTop (convert Nexora).
- **Mocks = công cụ khám phá schema** (`apps/web/src/mocks/`, 8 test bất biến):
  ứng viên đã ghi chú tại chỗ — destinations · trip_moments · announcements ·
  newsletter_subscribers · blog_posts.
- **Chính sách placeholder**: mọi ảnh dùng `ImagePlaceholder` (kèm biến thể
  `corner`); ảnh thật thay khi trang chốt. 7 ảnh Commons/Unsplash đã tải sẵn
  (CREDITS.md) cho lúc đó.
- **Nợ ghi nhận cho lúc gắn API** (đối chiếu Nexora): form Contact/newsletter
  đang no-op — phải vá validate + honeypot + rate-limit + success state như
  `plan-trip-form` Nexora; độ giàu trường (phone·groupSize·budget·interests) là
  quyết định sản phẩm còn mở.
Review findings đáng nhớ: import sót sau xóa file làm typecheck đỏ (bắt trước khi
giao — bài học replace-không-assert); flex `justify-between` vỡ khi thêm con thứ 3
(bọc khối); watermark đè link sửa bằng z-âm; JourneyScrubber thử rồi gỡ theo review
(#20) — giá thử rẻ vì component độc lập.
Tests after: gate:int xanh 18/18 task — web unit 8 (mocks) · tokens 10 · ui 5 ·
API int 145/17 file · typecheck · biome sạch.

## 2026-07-22 — P3b: bộ font chính thức (branch `feat/fonts-final`, merge `9e26959`)

Chốt bộ 3 font theo vai trò sau 2 vòng specimen trực quan với user (font thật nhúng
trang, đủ dấu tiếng Việt): **Literata** (heading — user chọn trực tiếp) ·
**Archivo** (sans thân/UI — grotesque ghép giọng editorial với Literata) ·
**IBM Plex Mono** (mã đặt chỗ/số kỹ thuật — có subset vietnamese, hơn Geist Mono cũ).
Thay bộ tạm Be Vietnam Pro + Lora + Geist Mono của ADR-0013 — ADR ghi khối
"cập nhật cùng ngày" thay vì sửa lặng lẽ; [color-system §6](conventions/color-system.md)
ghi bộ chốt + lịch sử. Chỉ đổi `layout.tsx` (next/font, subset latin+vietnamese)
+ comment tokens.mjs — cơ chế wire `--font-*` giữ nguyên.
Review findings: không phát sinh (đổi 1 file code; verify = build web + 20 woff2
self-host + 3 family có mặt trong CSS build).
Tests after: gate:int xanh — tokens 10 · ui 5 · int 145/17 file · typecheck · biome sạch.

## 2026-07-22 — P3b: theme Wuling + region tokens + fonts (branch `feat/theme-tokens`, merge `be43756`)

Rebrand hoàn chỉnh theo [ADR-0013](adr/0013-wuling-theme-tokens.md), hệ màu chốt cùng user qua 6 vòng
demo trực quan (bản ghi đầy đủ: [conventions/color-system](conventions/color-system.md) — brand "Wuling"
+ 3 region tint theo 3 operator Endfield, codename nội bộ, kèm ghi chú pháp lý):
- **Phát hiện quan trọng**: `@tourism/tokens` KHÔNG phải stub — P0 đã port nguyên pipeline Style
  Dictionary 5 + culori của Nexora (type scale, shadow, z-index, density, semantic colors, rn-convert
  cho P5). Giữ nguyên kiến trúc, chỉ thay giá trị + mở rộng.
- `tokens.mjs`: toàn bộ màu brand light+dark → hệ Wuling (oklch, quy đổi culori từ hex chốt); chart
  ramp = 5 hue brand+vùng; scrim/media-tint đổi hue theo họ ngọc.
- **Lớp region mới**: 5 slot `--region-*` mặc định brand trên `:root`, override qua
  `[data-region='north|central|south']` — luật 90/10: component shared CẤM tham chiếu `--region-*`.
- `@tourism/ui/globals.css`: bỏ khối neutral shadcn, import `@tourism/tokens/tokens.css` (đối chiếu
  key: tokens phủ 100% biến cũ trước khi xóa).
- Fonts: **Be Vietnam Pro** (sans) + **Lora** (heading) qua next/font — subset `vietnamese` (Geist+
  Fraunces Nexora không đủ dấu); metadata description sang tiếng Anh (luật #7).
- TDD: 4 test mới nguồn token (oklch hợp lệ · primary hue 170–195 · region đủ slot · REGIONS khớp);
  sửa 1 test rn-convert theo brand mới (ghi chú trong file); +`@types/culori`.

Review findings: tự kiểm chứng — visual light/dark + 3 region tint qua page tạm (đã gỡ); bug quy trình
tự bắt: gắn class `dark` trước hydration bị React ghi đè (chụp dark phải gắn sau load).
Tests after: gate:int xanh — tokens 10 unit (4 mới) · ui 5 · int **145/17 file** · typecheck · biome sạch.

## 2026-07-22 — P3b: shadcn/typeset trong `@tourism/ui` (branch `feat/ui-typeset`, merge `985f911`)

Tích hợp **Typeset** (shadcn 10/07/2026 — hệ typography cho HTML/markdown render trong MỘT file CSS
sở hữu repo) theo [ADR-0012](adr/0012-typeset-typography.md), thay `@tailwindcss/typography` của Nexora:
- `libs/shared/ui/src/styles/typeset.css`: lõi vendor NGUYÊN BẢN từ `shadcn-ui/ui@main` (490 dòng, pin
  nguồn+ngày, loại khỏi Biome như artifact để diff upstream) + **3 preset tự viết**: `typeset-docs`
  (tour/FAQ/admin preview) · `typeset-chat` (chặt, ≈`prose-sm` cũ, dành cho AI concierge P6) ·
  `typeset-reading` (thoáng, trang đọc dài). Import trong `globals.css` → web+admin hưởng tự động.
- Component `<Typeset preset>` (cva + `useRender`, idiom base-nova) + **vitest đầu tiên của `@tourism/ui`**
  (5 unit test `typesetVariants`, TDD).
- Đối chiếu Nexora (#10): `prose prose-sm dark:prose-invert` (chat-panel/post-content/tour-itinerary) →
  v2 tương đương hoặc tốt hơn (streaming-safe, bớt plugin dependency).

Review findings: tự kiểm chứng render (page tạm + screenshot chromium — 3 preset khác biệt đúng thiết kế,
class có mặt trong CSS build production; page đã gỡ). Font còn fallback serif — chờ task rebrand/tokens.
Tests after: gate:int xanh — unit 5 (ui) + int **145/17 file** · typecheck · biome sạch.

## 2026-07-22 — P3b: bộ shared UI shadcn `@tourism/ui` (branch `feat/p3b-shared-ui`)

Dựng bộ **components/blocks dùng chung** cho web+admin theo [ADR-0011](adr/0011-p3b-web-architecture.md):
gói **`libs/shared/ui` (`@tourism/ui`)** — shadcn monorepo mode, style **base-nova (Base UI, KHÔNG Radix)**,
baseColor neutral, icon lucide. **59 components** (tất cả registry `@shadcn` *trừ* `native-select` theo yêu cầu).
Runtime deps (cmdk/recharts/sonner/date-fns/react-day-picker…) khai ở chính `@tourism/ui` (self-contained
cho admin tái dùng); `apps/web` consume qua `@tourism/ui/components/*` + `transpilePackages` + theme dùng chung.

**Rà từng component xử cảnh báo Biome** (khác ESLint-next của Nexora nên soi kỹ hơn, nhất là a11y):
- Sửa thật 6: `pagination` bỏ `role` thừa · `field` `===`+key-theo-message · `chart` 2 array-key→`item.name`/`item.value` · `scroll-area` gỡ import React thừa.
- `biome-ignore` + lý do (11 file): pattern primitive canonical shadcn/Base-UI (a11y role trên div/span, `dangerouslySetInnerHTML` chart, `noArrayIndexKey` slider, `noDocumentCookie`+`useExhaustiveDependencies` sidebar) — không sửa được sạch mà không phá primitive.

Setup monorepo: `components.json` ở cả `@tourism/ui` lẫn `apps/web`; `sharp` allowBuilds; Biome bật
`css.parser.tailwindDirectives` + loại `!**/public`. Theme wire vào `@tourism/tokens` để **giai đoạn sau**.
Tests after: `@tourism/ui` typecheck xanh · `@tourism/web` build (Turbopack) xanh · biome sạch (không đụng backend, gate:int giữ 145 int).

## 2026-07-22 — P3b: scaffold web Next.js 16 (branch `feat/p3b-web-scaffold`)

Mở phase P3b — dựng nền `apps/web` (`@tourism/web`) theo [ADR-0011](adr/0011-p3b-web-architecture.md):
**Next.js 16.2.11** (App Router · Turbopack) + React 19 + Tailwind v4, tích hợp Turborepo + **Biome
(KHÔNG ESLint)**. Reconcile monorepo: xóa nested `pnpm-workspace.yaml`/`CLAUDE.md` create-next-app thêm;
tên `@tourism/web`; `sharp` vào `allowBuilds`; biome bật `css.parser.tailwindDirectives` (Tailwind v4
`@theme`) + loại `public/` (asset không lint); gỡ SVG demo; page/metadata placeholder sạch.

Bộ **shared components/blocks (`libs/shared/ui`)** + shadcn + trang thật là **bước phối hợp kế tiếp** (chờ
user điều phối bộ legacy components). Verify: `pnpm --filter @tourism/web build` (Turbopack) xanh + typecheck
+ biome sạch. Không đụng backend (gate:int giữ nguyên 145 int).

## 2026-07-22 — Infra hardening trước P3b (branch `feat/infra-hardening`)

Đóng 2/3 gap "độ chín production" (TB) từ [độ sẵn sàng backend](analysis/2026-07-22-backend-readiness-vs-nexora.md)
theo [ADR-0010](adr/0010-infra-hardening.md), trước khi web P3b lộ FE. 2 commit `a0cb221..dc1beec`, TDD:
- **Global exception filter** (`APP_FILTER` `AllExceptionsFilter`) — chuẩn hoá MỌI lỗi rơi vào pipeline Nest
  (guard 401/403, route Nest thuần, lỗi bất ngờ) về envelope oRPC `{defined, code, status, message, data}`;
  FE một parser. oRPC procedure-error + webhook `{code}` giữ nguyên (không bị đụng — verify). 500 ẩn stack.
  Unit 5 + e2e 401.
- **`@fastify/helmet`** trong `configureHttp` (test e2e phủ) — security headers, **CSP tắt** (API JSON, CSP để P3b).
- **Sentry seam** env-gated (`SENTRY_DSN` + `captureException`) — filter gọi cho 500; hiện no-op (interim:
  Logger.error → platform stdout). Cài `@sentry/node` là follow-up khi provision DSN (trừ phần cần key).

Guard 401/403 đổi shape body (thêm `code`) — không test nào assert body-shape lỗi nên **zero ripple**.
Tests after: `pnpm gate:int` xanh (145 integration + unit filter/e2e).

## 2026-07-22 — Vòng đời PENDING: đóng lỗ mồ côi (branch `feat/pending-lifecycle`)

Đưa booking PENDING mồ côi về terminal theo [ADR-0006](adr/0006-pending-lifecycle.md) (Accepted 22/07) —
gap "v2 kém Nexora" duy nhất chạm checkout, phát hiện ở
[độ sẵn sàng backend 22/07](analysis/2026-07-22-backend-readiness-vs-nexora.md). 4 feat + 2 chore commit
`d40597b..63af354`, mỗi feat TDD (không migration — enum/cột sẵn có):
- **PAY-1** (`d40597b`) `VerifiedEvent` +type `payment.expired`; Stripe `checkout.session.expired` tách khỏi
  `payment.failed`; `handleEvent` → flip PENDING→CANCELLED (gate `status='PENDING'`, không đụng ghế).
- **WRK-1** (`988e8b8`) `PendingSweepService` + pg-boss job `booking-sweep` lịch 10′, TTL 30′ — backstop khi
  webhook expired rớt. Idempotent với PAY-1.
- **BK-1** (`f5b546a`) create bọc try/catch → `CHECKOUT_FAILED` (502 typed) thay 500 opaque; procedure
  `bookings.checkout` re-mint session cho PENDING của chủ. FE phân biệt được gateway-lỗi vs hết-ghế.
- **BK-2** (`3e17568`) procedure `bookings.cancelPending` — khách tự hủy PENDING chưa trả (không refund),
  tách khỏi cancellation-request (PAID).
- Chore (`bb3bd8d`·`63af354`) dọn 2 comment "nói dối" pending-expiry-sweep + `booking-states.md` thêm hàng
  PENDING→CANCELLED; unit ripple stripe expired→payment.expired.

Ba đường cancel (webhook · cron · self-cancel) đều gate `status='PENDING'` → idempotent chồng nhau;
capture-đến-muộn sau CANCELLED đã được PAY-R1 fresh-refund guard lo (ADR-0009). Không chạm bất biến ghế/tiền
(PENDING không giữ ghế). Tests after: `pnpm gate:int` xanh (145 integration).

## 2026-07-22 — P3a contract closeout: C1·R1·R2 (branch `feat/p3a-contract-closeout`)

Đóng 3 gap hình dạng contract customer/admin API TRƯỚC khi mở P3b Web (đổi sau = rework
component), theo [spec](specs/2026-07-21-p3a-contract-closeout-design.md) —
parity từ [sweep parity toàn code](analysis/2026-07-21-full-parity-sweep-pre-p3ab.md).
3 commit feat `7319426..728c020`, mỗi cái TDD (không ADR — thuần additive; không migration):
- **C1** (`7319426`) `TourCard`/`TourDetail` trả `destinations[]` (`{slug,name,isPrimary}`, primary
  đứng đầu) thay `primaryDestination` đơn — tour đi qua nhiều nơi không còn mất destination phụ.
  `cardInclude` bỏ `where isPrimary/take:1`.
- **R1** (`810a724`) `reviews.mine` thêm `tourSlug`/`tourTitle` (+ `include tour`) — trang "Đánh giá
  của tôi" hiện tên + link tour.
- **R2** (`728c020`) `admin.reviews.list` thêm filter `source`/`rating`/`search` (body/title/tên) +
  output `moderatedBy`(tên admin)/`tourTitle`. Chỉ include (FK `moderatedById` có sẵn), không migration.
  PII khách (email) cố ý không phơi (admin UI P4 chưa xây).

Quyết định shape (chốt với user): C1 bỏ hẳn `primaryDestination` (web chưa xây → đổi contract free);
R2 không userEmail. Không mutation-test (không phải logic money/security; test filter đã discriminating).
Tests after: `pnpm gate:int` xanh (141 integration).

## 2026-07-21 — Refund correctness: đóng tiền-RA (branch `feat/refund-correctness`)

Sub-project B của "chùm refund" — vá ba gốc double-refund/resurrection ở đường tiền-RA
theo [ADR-0009](adr/0009-refund-correctness.md), 8 commit `47d906d..96cc1a6`, mỗi bước
TDD + mutation-proof:
- **BK-R1** (`7e90bbc`·`666f3c6`·`f2bd9c4`) trigger DB `SUM(refunds) ≤ total` (lưới cứng)
  + `withBookingRefundLock` (advisory `pg_advisory_xact_lock` per-booking bao
  read→gateway→ledger) bọc `refundByAdmin` VÀ `cancellations.approve` — hai admin refund
  đồng thời, hoặc refund‖cancel-approve cross-path, giờ serialize: đúng 1 refund + 1 gateway
  call, flow thua nhận `RefundNothingLeftError`. Mutation gỡ lock → double-refund `[200,200]`/500 ĐỎ.
- **PAY-R1** (`23b30b9`) `refundOrphanedCapture` chỉ re-derive REFUNDED khi refund vừa phát
  MỚI (`issueFullAutoRefund='refunded'`); `'already-refunded'` (booking đã refund qua
  overbook/W4) → giữ CANCELLED, không email lần hai. **Sửa cơ chế ADR** (`1572f98`): bỏ gate
  `paid_at` (không phân biệt được overbook-retry với orphan-thật — cả hai NULL; lại phá test
  orphan + bỏ sót ca W4). Vá luôn W4-cancelled resurrection.
- **TOCTOU** (`96cc1a6`) bọc `issueFullAutoRefund` bằng cùng advisory lock, re-check
  existing-Refund trong lock → hai webhook auto-refund đồng thời (eventId khác) chỉ gọi
  gateway 1 lần. Mutation gỡ lock → double gateway `[200,500]` ĐỎ.

Ngoại lệ có chủ đích của "gateway ngoài transaction" (giữ 1 connection lúc HTTP) — giới hạn
cho đường refund hiếm, đổi lấy money-integrity (ADR-0009 §Quyết định 1). Đánh đổi PAY-R1:
crash đúng khe của orphan-thật → kẹt CANCELLED (tiền vẫn hoàn đủ; orphan-thật = pending-expiry
của sub-project A chưa dựng). Tests after: `pnpm gate:int` xanh (140 integration).

## 2026-07-21 — Admin bootstrap emailVerified-gated + AUTH-2 email (branch `feat/admin-bootstrap-verified`)

Đóng **SEC-1** (priv-esc) + **AUTH-1** (no self-heal) + **AUTH-2** (email chưa dây)
theo [ADR-0008](adr/0008-admin-bootstrap-verified.md) — 8 commit `8283fbd..112fd0a`,
mỗi bước TDD + mutation-proof:
- **AUTH-2** (`51d3ebf`·`37c4593`·`2833f9e`) EmailType +PASSWORD_RESET/EMAIL_VERIFICATION;
  `sendResetPassword`/`sendVerificationEmail` ghi outbox → Resend (thay console.log);
  `sendOnSignUp:true`. Vá luôn reset-mật-khẩu prod đang hỏng.
- **AUTH-1** (`bb7c43b`) `reconcileAdmins` + `AdminReconcileService` (OnApplicationBootstrap)
  — self-heal promote email thêm vào `ADMIN_EMAILS` sau, promote-only.
- **SEC-1** (`648da2a`) bỏ auto-promote signup-hook; promote qua `afterEmailVerification`
  (chỉ sau khi chứng minh sở hữu email). `requireEmailVerification` giữ false — khách
  không bị chặn, verify chỉ gate đặc quyền admin.
- **Ripple test** (`112fd0a`) fixture int: admin promote thẳng DB sau signup (guard đọc
  role tươi); lọc `EMAIL_VERIFICATION` khỏi assertion đếm outbox.

Edge email-squatting ghi nhận trong ADR (không priv-esc). Tests after: `pnpm gate:int` xanh.

## 2026-07-21 — Vá parity nhỏ CAT-4 · BK-3 · ENQ-1 (branch `worktree-fix+enquiry-name-min2`)

Ba finding parity **Nhỏ** còn lại từ đợt rà soát (khôi phục quy tắc Nexora), làm ở
branch song song, rebase+ff lên main — 2 commit `098e92d..9b74186`, kèm test contract:
- **ENQ-1** (`098e92d`) enquiry `name` `min(1)`→`min(2)` — parity `@MinLength(2)`.
- **CAT-4 + BK-3** (`9b74186`) `TourSortKeySchema` + `SORT_COLUMN` thêm `updatedAt`;
  booking `contactPhone` `min(1)`→`min(6)` — parity `@Length(6,30)`.

Tests after: `pnpm gate:int` xanh (128 integration).

## 2026-07-21 — Rà soát độc lập + vá P0 batch (branch `fix/review-p0-batch`)

Rà soát độc lập toàn `apps/api` (parity vs Nexora + review defect v2 tự sinh, fan-out
8+6 agent, tự kiểm chứng 4 High) — báo cáo
[independent-review](analysis/2026-07-21-independent-review.md). Vá 6 finding
an-toàn/không-cần-ADR (5 commit `d776d02..2a0cff3`), mỗi cái TDD + mutation-proof:

- **ENQ-R1** (`d776d02`) `trustProxy:1` (không `true`) — throttle chống spam bypass
  được bằng spoof `X-Forwarded-For`; +e2e regression (đỏ dưới mutation `true`).
- **TQ-1** (`c654b2e`) `FakeGateway.failRefunds` + int test nhánh refund-thất-bại
  (502 · không ledger/outbox · giữ PAID) — nhánh W3 trước đây test-chết.
- **CAT-R1** (`b07fc1e`) serialize tiền `.toFixed(2)` ở `catalog` VÀ `bookings` API
  response ("39"→"39.00") — lệch mọi serializer khác; test cũ so-bằng-`Number` không bắt.
- **INF-R1** (`024f459`) prod-guard `RESEND_API_KEY` — thiếu → email im lặng rớt (SENT giả).
- **NL-R1** (`2a0cff3`) `deleteAccount` xóa HẲN `Subscriber` trùng email (GDPR erasure;
  chốt hard-delete: bảng lá, nhất quán scrub-PII của User tombstone).

Kèm **[ADR-0006](adr/0006-pending-lifecycle.md)** trạng thái **Proposed** (vòng đời
PENDING) — chùm refund production (BK-R1/PAY-R1) + SEC-1/AUTH-2 chờ chốt ADR/hướng
mới code. Tests after: `pnpm gate:int` xanh (128 integration).

## 2026-07-21 — P3a-C: Posts · Site-media (branch `feat/p3a-c-posts-site-media`)

Hai module ĐỌC công khai cuối của P3a — blog (`posts.{list, bySlug, tags}`) và
`siteMedia.list` — cùng hạ tầng **media-đọc** (dựng Cloudinary URL) mà v2 chưa
từng có. 7 commit feat `8f5dc97..8c5fc79`. Thực thi subagent-driven (7 task,
mỗi task 1 implementer + 1 review).

Hai ADR đi trước code (luật 5):
- **[ADR-0004](adr/0004-post-visibility-helper.md)** — helper bắt buộc
  `publishedPostWhere()`: mọi path public đọc Post lọc `status=PUBLISHED ∧
  publishedAt<=now()`. Loại Prisma extension (cản admin P4) + repository wrapper.
- **[ADR-0005](adr/0005-media-read-build-url.md)** — API dựng & trả Cloudinary
  URL lúc đọc (chỉ cần `CLOUDINARY_CLOUD_NAME` công khai, không secret upload).
  Web dumb; đổi transform không phải migrate.

- **T1** (`82e1529`) Helper thuần `buildCloudinaryUrl` + env
  `CLOUDINARY_CLOUD_NAME` (default dev, chặn prod). Review bắt 2 Important:
  implementer (haiku) **tự thêm `Co-Authored-By: Claude`** vào commit — vi phạm
  luật 12, amend bỏ; guard prod thiếu test hai chiều → thêm theo khuôn sibling.
- **T2** (`f65a3fa`) `MediaService.resolveForOwners` — resolve batch (MỘT
  query, chống N+1) → `Map<ownerId, MediaItem[]>` đã dựng URL. Tie-break
  hero-đầu dựa Postgres sort enum `MediaRole` theo declaration order.
- **T3** (`74174f1`) `publishedPostWhere()` (ADR-0004). Fix: test đổi cast
  `as {lte}` → `expect.any(Date)` (tuân luật không-cast).
- **T4** (`58acc83`) `posts.list` — card GỌN (không `content`), cover role
  `hero`, tie-breaker `[{sort},{id:desc}]`, lọc tag, search title. `pageSize`
  (query) → `limit` (output). Mutation-test ADR-0004: bỏ guard → bài
  future/draft lọt, test đỏ.
- **T5** (`7c634e3`) `posts.bySlug` — detail đầy đủ + full media + related
  tours (dùng `toTourCard` catalog, **KHÔNG media**, tour unpublish rớt âm
  thầm). Draft/future → `POST_NOT_FOUND` 404, không phân biệt với không tồn tại.
- **T6** (`0ac24c2`) `posts.tags` — tag có ≥1 bài published + `count`, MỘT
  query `_count` nested where (chống N+1), order name asc, path `/api/posts-tags`.
  Review bắt Minor "order-assert vacuous" (mảng 1 phần tử → luôn đúng) → thêm
  tag-mixed (published+draft+future, count phải =1) + tên đảo thứ tự tạo.
- **T7** (`8c5fc79`) `siteMedia.list` — đọc `site_media_slots`, resolve batch
  `SITE`, chỉ trả slot CÓ media. YAGNI: không tạo slot-catalog (việc admin P4).

**Final review toàn nhánh** (model mạnh nhất) — Ready to merge: **Yes**, không
Critical/Important. Xác nhận cả 8 bề mặt (visibility 3 path canh thật · N+1 sạch
· enum SITE/POST · `@Public()` 2 controller · related-tours-no-media ·
no-cast-kể-cả-test · coherence). Đính chính: `cover=media.find(role==='hero')`
ROBUST với sort order (find theo predicate, không vị trí) — hero-first rủi ro
thấp. Nếp mutation-test hai chiều áp cho cả 3 path visibility + honeypot filter.

**Bài học quy trình:** implementer subagent (nhất là model rẻ) có xu hướng tự
thêm AI attribution — từ Task 2 trở đi brief nhấn mạnh + kiểm `git log` sau mỗi
task, không tái phạm.

**Cố ý để lại (cleanup đợt sau, không chặn merge):** `siteMedia` findMany
thiếu `orderBy` (thứ tự phi tất định — web tra theo `key` nên không hại) ·
literal `'demo'` lặp tay ở `env.ts` (nên tách hằng `DEV_*`) · thiếu comment
cảnh báo THỨ TỰ cạnh enum `MediaRole` (schema chỉ cảnh báo đổi TÊN) · khoảng
trống phủ test (phân trang page 2, video có poster URL tuyệt đối).

- Tests after: **361** (234 unit — api 175 · contract 51 · tokens 7 · i18n 1 —
  + 127 integration), `gate:int` xanh.

## 2026-07-19 — P3a-B: Wishlist · Enquiry · Newsletter (branch `feat/p3a-b-customer-writes`)

Ba endpoint GHI công khai đầu tiên (khách chưa đăng nhập gọi được) + hạ tầng
rate limiting đi kèm. 16 commit, `6d3d49c..8a5d71c`.

- **T1** (`33fb899`..`35706bf`) `EmailType.ENQUIRY_ADMIN_ALERT` + template
  deliverer. Security review tự động báo XSS → **dương tính giả** (`f()` đã
  escape đủ; fix nó đề xuất sẽ escape hai lần), nhưng chạm đúng lỗi thật kề
  bên: subject là plain text KHÔNG được escape → thêm `subjectText()` + cắt
  CR/LF chặn header injection. Review còn bắt lỗi trong **chính plan**:
  `deliver()` lấy người nhận từ `payload.email`, mà Task 4 dùng chung payload
  cho ack khách + alert admin → alert bay về hộp thư khách. Thêm `to` thắng
  `email`, vá luôn plan.
- **T2** (`0370206`, `fcb0397`) Rate limiting cho endpoint ghi công khai. Test
  không canh được `trustProxy` của `main.ts` (reviewer tái hiện: gỡ khỏi
  `main.ts` mà suite vẫn xanh) → `createFastifyAdapter()` dùng chung.
- **T3** (`a2ec198`) Wishlist set/list/check idempotent + cờ `unavailable`.
- **T4** (`b232c66`..`477b457`) Enquiry công khai: honeypot, throttle, outbox
  kép trong `$transaction`. Implementer tự phát hiện gỡ `$transaction` mà
  KHÔNG test nào đỏ → thêm test atomicity ép outbox thứ hai hỏng. Review (7
  mutation độc lập) bắt 2 Important: 6/10 field input không test nào chạm
  (hoán đổi `nationality`/`budgetTier` mà 8/8 vẫn xanh) · `adminEmails[0]`
  fallback **im lặng** về email khách khi `ADMIN_EMAILS=" "` — bug A13 quay
  lại đường khác → fail-fast ở `env.ts` + `primaryAdminEmail`.
- **T5** (`5fb13a4`..`c8665fa`) Newsletter subscribe im lặng chống dò email.
  Review bắt **Critical** (chạy thật trên DB, đo được 2 dedupeKey): email chưa
  normalize khi ghép `dedupeKey`. `Subscriber.email` là `citext` nhưng
  `Outbox.dedupeKey` là `VarChar` thường → `Jane@X.com` vs `jane@x.com` ra hai
  key → welcome gửi **2 lần**. Test cũ tưởng phủ ca này nhưng chỉ assert
  `subscriber.count()`, không nhìn outbox.
- **T6** (`97eef44`, `d991054`) Unsubscribe tự phục vụ, token HMAC, tách
  GET/POST (GET thuần đọc — email client prefetch link để quét virus). I1:
  đăng ký lại sau khi huỷ là ngõ cụt câm lặng → `resubscribe` dùng LẠI token
  HMAC làm bằng chứng chính chủ, **bắt buộc POST** (GET sẽ bị prefetch tự
  đăng ký lại đúng người vừa huỷ). I2: link huỷ vào email welcome + header
  `List-Unsubscribe`; **cố ý không** one-click RFC 8058 (mail provider POST
  body không khớp schema JSON).

**Final review toàn nhánh** (3 reviewer song song, mảng tách rời) — 7 phát
hiện đã vá (`f0d4528`, `8a5d71c`):

- **Honeypot enquiries phân biệt được với thành công**: trả `{id: null}` còn
  nhánh thành công trả `{id: <uuid>}` → bot đọc body là biết mình bị bắt. Ba
  comment + JSDoc contract đều *khẳng định* tính chất mà code không có. Sửa:
  trả uuid giả không bao giờ persist; siết `EnquiryResultSchema` sang
  non-nullable (contract nói dối thì sửa contract).
- **Guard "đã huỷ bản tin" không có test canh phạm vi**: xoá
  `NEWSLETTER_EMAIL_TYPES.has(row.type) &&` khiến guard chặn MỌI loại email
  mà **110/110 test vẫn xanh** → người huỷ bản tin sẽ mất luôn
  `BOOKING_CONFIRMATION`. Lần verify thủ công trước đây (`sent:2`) chưa bao
  giờ được commit. Đã commit test canh.
- **Guard đọc `payload.email` còn deliverer ưu tiên `payload.to`** → loại email
  tương lai mang `to` sẽ bị kiểm đồng thuận ở địa chỉ này, gửi tới địa chỉ
  kia. Gộp về `resolveRecipient()` dùng chung.
- **Wishlist `createdAt` không được pin**: mutation `update: {createdAt}` qua
  6/6 test. `createdAt` quyết thứ tự list → sentinel `2000-01-01`.
- **Oracle `@updatedAt` biên chỉ 4–19ms** (đo 25 lần) → đổi sang sentinel,
  biên ~26 năm, hết phụ thuộc timing.
- **`website` honeypot không giới hạn độ dài và bị log nguyên văn** — field
  user-controlled DUY NHẤT không có `.max()` (các field anh em đều có). Log
  injection qua CR/LF, ~1MB/request. Sửa: **cắt ngắn 200 ký tự chứ không
  reject** — Fastify parse hết body TRƯỚC khi zod chạy nên reject không tiết
  kiệm gì mà lại trả 400, dựng lại đúng tín hiệu lộ honeypot vừa xoá ở trên.
- **`subscribe()` ghi subscriber + outbox không transaction** trong khi
  `enquiries` có → bọc `$transaction` cho khớp bất biến outbox-producer.

Nếp mutation-test hai chiều bắt thêm 2 ca "xanh mà không canh gì": int test
**không thể** quan sát truncation (giá trị không vào DB, cũng không còn vào
log) → gỡ `.transform()` mà 114 int vẫn xanh, phải thêm `honeypot.spec.ts` ở
tầng contract. Tổng 26+ mutation, 23 bị bắt ngay.

**Cố ý để lại** (không phải quên): `timingSafeEqual` → `===` không test nào
bắt được — side-channel timing không thể canh bằng assertion giá trị, ghi nhận
thay vì dựng test giả · `subjectText` trả `''` với tên toàn CR/LF và case body
thiếu `??` (zod `.trim().min(1)` chặn từ tầng trên) · N+1 `findUnique` trong
drain (≤50 query/phút) · row bị skip vẫn ghi `SENT` — cần `OutboxStatus.SKIPPED`
tức là migration mới, không phải blocker · `trustProxy: true` khiến khoá
throttle giả mạo được qua `X-Forwarded-For` (phụ thuộc cách deploy) · throttler
in-memory nên trần là per-process.

**Nợ chưa trả — đến hạn ở P3b, KHÔNG chặn P3a-C** (ghi rõ để không tưởng đã
xong): link huỷ đăng ký trong email welcome trỏ tới `apps/web/` — hiện mới chỉ
có `.gitkeep`. Không chặn Posts/Site-media (P3a-C) vì hai module đó không đụng
web; đây là **điều kiện tiên quyết trước khi bật `RESEND_API_KEY` ở
production**, mà trang unsubscribe thuộc web (P3b). Chừng nào Resend chưa bật
thì chưa cắn, nhưng nghĩa là **lý do GDPR của T6 chưa đạt đầu-cuối**. Liên
quan: chỗ DUY NHẤT user nhận được token resubscribe là email welcome vốn chỉ
gửi một lần vĩnh viễn (`dedupeKey` theo email) → ca "tôi xoá mất email rồi" vẫn
là ngõ cụt. I1 coi như **đóng một nửa**.

- Tests after: **340** (226 unit — api 167 · contract 51 · tokens 7 · i18n 1 —
  - 114 integration), `gate:int` xanh.

## 2026-07-19 — Đợt vá sau P3a-A (8 merge nhỏ vào `main`)

Bắt nguồn từ việc user phát hiện v2 **thiếu rate limiting** trong khi Nexora
có — rồi rà lại đúng tầng thì lòi ra nhiều hơn.

- **Env** (`8958e95`, `938dc6b`, `aad7131`): `superRefine` chặn `DATABASE_URL`
  mặc định ở production (bỏ sót cạnh 2 guard đã có). Biến rỗng `KEY=` là
  **chuỗi rỗng** chứ không phải undefined nên `.default()` không chạy còn
  `.min(1)` fail — copy file mẫu rồi để trống 9 biến optional là app không
  boot; nền tảng deploy cũng gửi chuỗi rỗng khi ô bị bỏ trống. Chốt quy ước
  tên `.env.local` / `.env.production` / `.env.example`, `.gitignore` viết
  không kèm đường dẫn để app sinh sau tự được che (verify 13 trường hợp).
- **Supabase** (không commit — thao tác hạ tầng): `migrate deploy` + seed lên
  Session pooler, 33 bảng khớp local, `citext` 1.6, pg-boss chạy trọn vòng
  đời. Direct connection IPv6 **không tới được từ WSL** (đã đo).
- **Hạ tầng** (`b407c68`): CORS thiếu hoàn toàn (chặn cứng P3b) · `trustProxy`
  (thiếu là rate limit sau này tự DoS) · health probe chạm DB, 503 khi hỏng ·
  `provider-http` timeout 15s (`fetch()` trần không có timeout mặc định —
  money-path đã chạy thật). Tách `configureHttp()` sang `bootstrap.ts` để test
  chạm được. Mutation-test cả 4.
- **Catalog** (`d88487d`): P3a xây `ratingAvg/ratingCount` xử lý race rất kỹ
  nhưng catalog **chưa hề đọc ra** — dữ liệu trong DB mà FE không lấy được.
  Thêm `toursCount` cho category (chỉ đếm tour đã publish).
- **Auth** (`e5c382a`, [ADR-0003](adr/0003-auth-fail-closed.md)): đảo mặc định
  sang **fail-closed** — `APP_GUARD` toàn cục + `@Public()`. Test canh chính
  cái mặc định bằng cách đăng ký controller mới không khai gì ngay trong test.
- **Docs** (`de61748`, `12f1db4`, `bfcf5a8`): quét sâu 1.377 file Nexora,
  bảng theo dõi A1–A11 (A1/A5/A9 đã vá). Bác bỏ 1 dương tính giả (`seatsLeft`
  clamp — CHECK constraint khiến trạng thái đó bất khả thi). CLAUDE.md thêm
  luật 10: chủ động đối chiếu Nexora ở CẢ hai tầng trước mỗi phase.
- Tests after: **284** (204 unit + 80 integration), `gate:int` xanh, CI xanh.

## 2026-07-19 — P3a-A: Nền chung + API reviews (branch `feat/p3-customer`)

- **T1** Schema query dùng chung: `PageQuerySchema`, `SearchQuerySchema`,
  `sortQuerySchema(keys)` generic suy ra literal union (không phải `string`).
- **T2** Migration `p3a_customer`: `Tour.ratingAvg/ratingCount`,
  `Review.featuredRank`, `Subscriber.unsubscribedAt/updatedAt`,
  `Enquiry.email → citext`, bảng `ReviewModerationEvent`, CHECK
  `reviews_source_shape`. ⚠️ DROP+ADD trên `enquiries.email` và
  `subscribers.updated_at NOT NULL` — fail cứng (rollback, KHÔNG mất data
  âm thầm) trên DB có dữ liệu; phải viết migration MỚI trước khi staging
  P3b có traffic thật.
- **T3** `checkReviewEligibility` TDD thuần: ownership kiểm TRƯỚC status
  (không rò trạng thái booking người khác), so sánh calendar-day UTC.
- **T4** `reviews.create` — P2002 → 409 `REVIEW_ALREADY_EXISTS`.
- **T5** `admin.reviews.moderate` transaction 4-trong-1: flip trạng thái +
  audit trail append-only + recompute rating + outbox dedupe. **Review phát
  hiện lost update** khi duyệt 2 review cùng tour song song. Cách sửa đầu
  tiên (gộp một câu `UPDATE … FROM (SELECT …)`) **đo thực nghiệm cho thấy
  VẪN sai** — EvalPlanQual không tính lại subquery khi statement chờ lock.
  Fix đúng: `SELECT … FOR UPDATE` ở statement riêng. Lần thứ hai EPQ cắn dự
  án (lần đầu: claim ghế P2-W2) → [read-then-write-races.md](conventions/read-then-write-races.md).
- **T6** `reviews.listByTour` + `reviews.mine` (endpoint spec W1 có nhưng
  **plan bỏ sót**, phát hiện khi review) + integration suite vòng đời.
  Review findings: rating tour bị testimonial `CURATED` đội lên (gate theo
  `tourId` thay vì `source`), và test canh nó là **test rỗng trá hình**.
- **Final review (mutation-test)**: xoá `@Roles(ADMIN)` khỏi controller admin
  → 72/72 test vẫn xanh; xoá `isApproved`+`isPublished` khỏi list công khai
  → vẫn xanh. Nguyên nhân gốc: `gate` chưa bao giờ chạy integration test và
  CI không có Postgres — một int spec hỏng từ T2 sống tới T6. Đã nối
  `test:int` vào turbo + CI service; `gate:int` giờ là điều kiện khai xong.
  Cũng vá: tombstone bật cờ mà quên scrub `authorName` (spec §4.2).
- Review findings: 3 Important (lost update rating · CURATED đội rating ·
  bề mặt bảo mật không có test canh) + 1 Important hạ tầng (int test không
  có lưới) — tất cả đã fix. Bác bỏ 1 đề xuất của chính controller (thống
  nhất outbox `refunds` theo `reviews` — hai `dedupeKey` khác ngữ nghĩa).
- Tests after: **266** (189 unit + 77 integration), gate:int xanh.

## 2026-07-18 — P2: Money-path (branch `feat/p2-money-path`)

- **W1** Contract `bookings.{create,mine,byCode}` (procedure authed đầu tiên —
  `@UseGuards` ghép class-level với `@Implement`); **`PaymentGateway`
  interface** + FakeGateway (mô phỏng duplicate/orphaned); create PENDING với
  snapshot, soft seats check (bất biến #1: PENDING không giữ ghế); P2002-retry
  thay pre-flight SELECT của Nexora (đóng TOCTOU).
- **W2** Webhook raw-body + PaymentEvent idempotency (ghi amount/currency/
  bookingId — audit H4). **Atomic claim thiết kế lại sau khi lead review phát
  hiện race EPQ thật** (Nexora miễn nhiễm nhờ connection_limit=1; pool 10 của
  v2 làm race sống dậy): bookings-first claim, trừ ghế vô điều kiện + CHECK
  abort (23514), phân loại follow-up SELECT. Test concurrency ×10 vòng ổn định
  qua 3 lần chạy suite. Review findings: 1 (race — fixed).
- **W3** `refund-math` TDD + RefundsService: partial refund CỘNG DỒN
  (PAID → PARTIALLY_REFUNDED → REFUNDED theo SUM ledger); currency mismatch
  bất khả biểu diễn by construction; orphaned → REFUNDED, overbook → CANCELLED;
  admin refund không nhả ghế (thuộc approve W4). `admin.bookings.{list,byCode,refund}`.
- **W4** Cancellation D1-B: partial unique `WHERE status='REQUESTED'`, lịch sử
  DENIED append-only (đóng audit M7); approve = gateway refund → một CTE
  [Refund row + CANCELLED + nhả ghế + flip request + outbox];
  `booking-states.md` chuẩn hóa 4 terminal states; 23505 adapter-normalized
  (verify thực nghiệm). EmailType += CANCELLATION_APPROVED.
- **W5** Stripe + PayPal test-mode **raw, zero SDK mới** (seam HttpPost
  injectable): HMAC t=/v1= timingSafeEqual + tolerance 5′, PayPal OAuth cache +
  verify-webhook-signature; `money.ts` minor-units Decimal (zero-decimal set).
  Idempotency key 4 flow refund. ResendDeliverer 9 EmailTypes (bind theo env).
- **W6** ADR-0002 (gateway interface + ledger + claim gen-2 + D1-B), docs sweep.
- Tests after: **186** (unit 128 · integration 58 trên PG thật).

## 2026-07-18 — P1: API lõi (branch `feat/p1-api-core`)

- **W1** NestJS 11 **ESM-first** + Fastify (D1 thắng — zero friction, không cần
  fallback CJS): SWC emit + tsc/TS7 typecheck, Vitest qua unplugin-swc, Zod env
  validation fail-fast, `/health`, compose Postgres 17.
- **W2** Prisma schema v2: 30 model (27 port + 4 Better Auth + `Refund` ledger),
  toàn bộ delta audit áp xong (snapshots Booking, PaymentEvent forensics,
  `authorDeleted`, 8 chỉnh index, Decimal 14,2, uuidv7, TourDifficulty enum,
  citext Subscriber). `hardening-v2.sql` = migration thứ hai (CHECK + citext +
  RLS **31/31 bảng**, vá `cancellation_requests` Nexora sót). Seed 177 catalog
  rows + booking PAID có snapshot. Verify sống: CHECK chống oversell nổ đúng,
  citext khớp case-insensitive.
- **W3** Better Auth 1.6.23 tại `/api/auth/*`: `generateId:false` (id base62
  mặc định của BA sẽ vỡ cột uuid — phát hiện quan trọng), `role input:false`,
  ADMIN_EMAILS bootstrap promote-only, AuthGuard chặn session user tombstone.
  `DELETE /api/account` = tombstone MỘT transaction (scrub PII, email
  `deleted+uuid@tombstone.local` giải phóng email gốc, xóa sessions/accounts,
  flip `Review.authorDeleted`) — chủ đích không dùng BA deleteUser (hard-delete
  vs FK Restrict).
- **W4** `@tourism/contract` (Zod 4 + oRPC) + CatalogModule qua `@orpc/nest`
  `@Implement`: `/api/tours` (+filters/pagination), `/api/tours/{slug}` (404
  typed), `/api/destinations`, `/api/categories`, `/api/health`.
  ZodSmartCoercionPlugin giữ schema thuần cho client types. expectTypeOf chứng
  minh `ContractRouterClient` suy `Paged<TourCard>` — **zero codegen**.
- **W5** Worker pg-boss 12 process riêng (`dist/worker.js`, ESM thuần — hết
  dynamic-import): cron `outbox-drain` 1′ (batch 50, MAX_ATTEMPTS 5, updateMany
  guard chống resurrect) + `outbox-purge` SENT >30d (giữ FAILED). Deliverer
  console sau token EMAIL_DELIVERER (P2 thay Resend). Smoke bắt tick cron thật.
- **W6** Docker: multi-stage Dockerfile (kiêm artifact deploy) + compose trọn hệ
  (postgres + migrate one-shot idempotent + api + worker). Quy ước dedupeKey
  văn bản hóa (`docs/conventions/outbox-dedupe-key.md`).
- Tests after: **63** (unit 22 api + 22 libs · integration 19 trên PG thật).

## 2026-07-18 — P0: khung xương monorepo

- Khởi tạo repo trong WSL: pnpm 11 + Turborepo 2.10 · TypeScript 7.0 (tsgo) ·
  Biome 2.5 · Vitest 4.1 · Node 24. `.gitattributes` ép LF toàn repo.
- Port từ Nexora (chỉ đọc): `@tourism/tokens` (Style Dictionary + RN hex theme,
  build artifact `generated/` chuyển sang gitignore + turbo outputs) và
  `@tourism/i18n` (messages + legal). Chuyển targets Nx → package scripts +
  turbo; Jest → Vitest (globals mode, spec giữ nguyên trừ 1 chỉnh
  `noUncheckedIndexedAccess` trong `rn-convert.spec.ts`).
- Docs skeleton: ADR-0001 (tech stack), CLAUDE.md, README. CI GitHub Actions.
- Tests after: **7** (tokens 5 · i18n 2, chuyển từ Jest sang Vitest).

# ADR-0023 — Năm cột nội dung bán hàng cho `Tour`, và chỗ KHÔNG cần cột nào

- **Trạng thái:** Accepted (2026-08-14)
- **Bối cảnh:** trả sổ nợ mở ra sau vòng trùng tu Tour Details 13/08
  ([backlog A9–A11](../analysis/2026-08-06-backlog-no-ky-thuat.md)). Đây là lần
  đầu bảng `tours` nở cột kể từ [ADR-0020](0020-real-images-sourcing.md), nên
  ADR đi trước code theo luật 5.

## Bối cảnh

Vòng trùng tu dựng trang theo một wireframe user đã duyệt qua ~20 vòng. Ba chỗ
trên bản duyệt **nói được điều dữ liệu không nói được**, và cả ba đã bị ship
thiếu có chủ ý thay vì bịa chữ:

1. **Bốn card dữ kiện** (tab Overview) — bản duyệt có một câu mô tả dưới mỗi
   giá trị ("Day four is a buffer morning — coffee and a late drop-off…").
   `TourDetailSchema` không có trường nào chứa câu đó. Hệ quả đo được: card cao
   **~110** thay vì **197**, và cả hàng bốn card trông rỗng.
2. **Thẻ "Changing your mind"** ở tab Departures — bản duyệt ghi
   **"Free until 10 days out"**. Con số 10 hiện chỉ tồn tại dưới dạng văn xuôi
   trong `TourPolicy.body` ("Free cancellation up to 10 days before departure;
   50% refund within 5–10 days…"). Muốn in con số thì phải **đọc-hiểu câu văn**
   — thứ không được phép làm với dữ liệu do người soạn nhập tự do.
3. **Tiêu đề thẻ policy** — bản duyệt có eyebrow ("Cancellation") + tiêu đề
   riêng ("Free up to 10 days out"). Đây là chỗ **KHÔNG cần cột mới**, xem
   mục "Quyết định" §3.

## Vấn đề

Trộn ba nhu cầu trên thành "thêm cột cho đủ" là cách nhanh nhất để phình schema
mà không ai nhớ vì sao. Ba câu hỏi phải trả lời riêng:

- Mô tả card dữ kiện là **bốn cột** hay **một cột JSON**?
- Cửa sổ huỷ miễn phí là **cột số** hay tiếp tục đọc từ `body`?
- Tiêu đề policy có cần cột thứ ba bên cạnh `kind` + `title` không?

## Quyết định

### 1. Bốn cột `varchar(280)` nullable, KHÔNG phải một cột JSON

```prisma
factDurationNote   String? @map("fact_duration_note")   @db.VarChar(280)
factGroupSizeNote  String? @map("fact_group_size_note") @db.VarChar(280)
factDifficultyNote String? @map("fact_difficulty_note") @db.VarChar(280)
factGoodForNote    String? @map("fact_good_for_note")   @db.VarChar(280)
```

Bốn card là **bốn ô cố định** của một bố cục đã chốt, không phải danh sách mở.
Cột riêng cho mỗi ô nghĩa là: Zod kiểm được từng trường, admin ở P4 dựng được
bốn ô nhập bình thường, và query chỉ chọn cột cần. Một cột JSON sẽ đẩy toàn bộ
việc kiểm tra sang tầng ứng dụng để đổi lấy một sự linh hoạt **không ai yêu
cầu** — thêm card thứ năm là đổi bố cục, tức là đổi cả wireframe.

`280` là trần có lý do: một câu, cỡ một dòng tweet cũ. Dài hơn thì card cao
vống lên và bốn card trong hàng lệch nhau — đúng khuyết tật thị giác vòng trước
đã phải vá ở thẻ policy.

**Nullable, và UI phải chịu được null.** 30 tour × 4 câu là việc soạn nội dung
thật; tour mới tạo ở admin sẽ trống lúc đầu. Card thiếu mô tả vẫn phải đọc
được, chỉ là thấp hơn.

### 2. `freeCancellationDays Int?` — con số rời khỏi văn xuôi

```prisma
freeCancellationDays Int? @map("free_cancellation_days")
```

`TourPolicy.body` vẫn là nguồn của **toàn văn** chính sách; cột này chỉ tách ra
**một** con số mà giao diện cần in thành nhãn ngắn. Hai thứ này phải nhất quán,
và trách nhiệm giữ nhất quán nằm ở người soạn nội dung (và ở admin P4), giống
hệt cách `ratingAvg` denormalize khỏi bảng `reviews`.

Vì sao không parse từ `body`: `body` là văn tự do 4000 ký tự do người soạn viết
bằng tiếng Anh đời thường. **Đã đếm trên 29 policy `CANCELLATION` đang có** —
regex `up to (\d+) days` chỉ bắt được **12/29**; 17 câu còn lại viết khác khuôn
("Cancel at least 24 hours before pickup…", "Cancellations more than 48 hours
before departure…", "Cancel 5 or more days before departure…"). Trượt thầm lặng
thì nhãn biến mất, mà nhãn biến mất trên thẻ "chính sách huỷ" là chỗ tệ nhất
để im lặng.

**Đơn vị là NGÀY, và tour tính bằng giờ để `null`.** Cũng đếm được:
**15/29 tour tính cửa sổ bằng ngày, 14/29 bằng giờ** — gần một nửa. Cố ép 24
giờ thành "1 ngày" là nói sai: chính sách 24 giờ tính từ *giờ khởi hành*, không
phải từ nửa đêm.
Tour nào để `null` thì thẻ rơi về đọc `policy.title` như mọi thẻ khác — vẫn
đúng, chỉ không có con số nổi bật.

### 3. Tiêu đề thẻ policy: KHÔNG cột mới, sửa ở tầng dữ liệu

`TourPolicy` đã có `kind` (enum, dùng làm eyebrow qua i18n) và `title`. Fixture
đang đặt `title` **bằng đúng nhãn nhóm** cho cả 90 row (`'Cancellation'` cho
`kind: CANCELLATION`, ×30 tour), nên UI phải bỏ eyebrow để khỏi in một chuỗi
hai lần — và hai trong ba thẻ mất một dòng, tiêu đề lệch tầng so với thẻ thứ ba.

Đây là **lỗi nội dung, không phải thiếu trường**. Chữa bằng cách viết 90 tiêu
đề thật vào fixture. Thêm cột `headline` bên cạnh `title` sẽ để lại một cột
`title` không ai biết dùng làm gì.

Kèm theo: bước seed `tourPolicies` đổi từ `createMany({ skipDuplicates: true })`
sang **upsert theo id**. `skipDuplicates` bỏ qua row đã tồn tại, nên sửa fixture
mà không đổi cơ chế thì DB đang chạy **không bao giờ nhận** nội dung mới —
người sửa tưởng đã sửa, còn trang thì vẫn hiện chữ cũ. Seed đã có tiền lệ
upsert cho nội dung biên tập (`siteMediaSlot`, `posts`, `users`); ba bảng cấu
trúc còn lại giữ `createMany`.

## Phương án đã cân nhắc và loại

- **Một cột `facts Json`** — loại, xem §1.
- **Parse cửa sổ huỷ từ `body` bằng regex** — loại, xem §2. Rẻ hôm nay, sai
  thầm lặng về sau.
- **Cột `cancellationPolicyType` enum (FLEXIBLE/MODERATE/STRICT)** kiểu
  Airbnb. Loại: nó là một tầng trừu tượng THỨ HAI phải định nghĩa và bảo trì,
  trong khi thứ giao diện cần chỉ là một con số. Nếu sau này cần xếp hạng chính
  sách để lọc thì mở ADR riêng.
- **Thêm `TourPolicy.headline`** — loại, xem §3.

## Hệ quả

- **Một migration cho cả năm cột.** Năm cột cùng bảng, cùng đợt, cùng lý do —
  tách hai migration là tạo drift thừa cho một thay đổi. Migration đã apply là
  bản ghi bất biến (luật repo), nên gộp đúng lúc còn gộp được.
- **Supabase KHÔNG tự nhận migration này.** `prisma.config.ts` chỉ đọc `.env`
  nên `migrate dev` chỉ chạm Postgres docker local. Phải deploy tường minh từ
  `apps/api` — xem gotcha trong `CLAUDE.md`. Đã dính lỗi này 12/08 (enum
  `REVIEW` thiếu trên Supabase làm web build SSG chết 500).
- **`TourDetailSchema` nở năm trường**; `TourCardSchema` **không** — card danh
  sách không hiện mô tả dữ kiện, thêm vào chỉ làm nặng payload `/tours`.
- **Ba thẻ chính sách ở tab Departures dựng được.** Chúng đã bị bỏ sót ở vòng
  13/08 (bản duyệt có `fcard ×3` ở cuối pane, bản ship có 0) — thẻ giữa của
  chúng chính là chỗ tiêu thụ `freeCancellationDays`.

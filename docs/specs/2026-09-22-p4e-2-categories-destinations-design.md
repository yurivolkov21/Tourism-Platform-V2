# Spec P4e-2 — Danh mục tour và điểm đến

22/09/2026 · đợt thứ hai của **P4e catalog CRUD**, ngay sau khi
[P4e-1](2026-09-21-p4e-1-departures-design.md) đóng trọn (F11–F13). Cùng đầu vào:
[khảo sát parity admin 20/08](../analysis/2026-08-20-admin-parity-nexora.md) §4.1
— *"khoảng cách lớn nhất là bề mặt GHI catalog (tours/departures/categories/
destinations/posts): v2 chưa có endpoint ghi nào"*.

Đánh số tính năng **F14–F15**, nối tiếp F11–F13.

## 1. Mục tiêu & phạm vi

### Vì sao làm hai vùng này trước tour CRUD

Chốt 21/09: **chia theo vùng, dễ trước khó sau**. Danh mục và điểm đến là hai
bảng phẳng nhất của catalog — không itinerary, không policy, không FAQ, không
media picker. Chúng cũng là *điều kiện* của P4e-3: form tạo tour cần chọn danh
mục và gắn điểm đến, mà hiện cả hai chỉ vào được bằng seed.

Quy mô đo trên production 22/09: **6 danh mục** (5 đang bật) và **18 điểm đến**
(tất cả đang bật). Nhỏ tới mức phân trang và tìm kiếm là thừa — quyết định này
chi phối phần lớn thiết kế bên dưới.

### Trong phạm vi

- Trang `/categories` — danh sách, tạo, sửa, bật/tắt, sắp thứ tự lên/xuống.
- Trang `/destinations` — danh sách, tạo, sửa, bật/tắt.
- Chín endpoint `admin.categories.*` và `admin.destinations.*`.
- **Một việc phía web**: chip lọc danh mục ở `/tours` đọc `catalog.categories.list`
  thay vì suy từ danh sách tour đã tải.
- Ba vùng miền dời từ `apps/web/src/mocks/regions.ts` vào `@tourism/contract`.

### Ngoài phạm vi, cố ý

| Không làm | Vì sao |
| --- | --- |
| **Xoá** danh mục hoặc điểm đến | Cả hai bảng đã có `is_active`, và tắt là đảo ngược được bằng một cú bấm. Xoá thì không — nhất là khi `tour_destinations` có khoá ngoại `ON DELETE CASCADE`, tức xoá một điểm đến sẽ âm thầm gỡ nó khỏi mọi tour |
| **Sửa slug** sau khi tạo | Slug nằm trong URL công khai dạng tham số truy vấn (`/tours?categories=…`), mà tham số truy vấn thì **không chuyển hướng được**. Đổi slug là link đã chia sẻ lọc ra rỗng |
| Ảnh bìa cho điểm đến | Cần media library — P4f |
| Gộp hai danh mục làm một | Chưa ai cần; và nó là một lệnh ghi đụng mọi tour của cả hai |
| Thêm vùng miền thứ tư | Mỗi vùng có nguyên một trang với hero, gallery, mùa, bưu thiếp viết trong web. Thêm vùng là việc của web, không phải việc nhập dữ liệu |
| Phân trang, tìm kiếm | 6 và 18 hàng |

## 2. Quyết định thiết kế

### 2a. Chỉ bật/tắt, không xoá

`is_active` đã có sẵn trên cả hai bảng và endpoint công khai đã lọc theo nó.
Tắt một điểm đến là nó biến khỏi site nhưng mọi liên kết tour còn nguyên; bật
lại là xong. Không có thao tác nào của cả phase không hoàn tác được.

Quyết định này cũng tránh hẳn một cái bẫy đo được: khoá ngoại
`tour_destinations_destination_id_fkey` khai `ON DELETE CASCADE`, nên nếu có
lệnh xoá thì DB sẽ **không chặn** — nó im lặng gỡ điểm đến khỏi mọi tour.

### 2b. `region` là danh sách chọn, không phải ô chữ tự do

Web ghép `destinations.region` với ba vùng cố định bằng `regionOf`
(`apps/web/src/lib/regions.ts`): so với `key` (`north`) hoặc `name`
(`Northern Vietnam`), đã lowercase và trim. Trượt thì trả `null`, và điểm đến
**biến khỏi mọi trang vùng mà không có lỗi nào**.

Một ô chữ tự do trên một cột phải khớp ba giá trị viết cứng là một lần gõ nhầm
cách một điểm đến khỏi site. Nên: danh sách chọn, lưu `name` (khớp dữ liệu
đang có: `Northern Vietnam` / `Central Vietnam` / `Southern Vietnam`).

**Ba vùng dời vào `@tourism/contract`** — ghi thành [ADR-0045](../adr/0045-region-vocabulary-in-contract.md). Hiện chúng nằm ở
`apps/web/src/mocks/regions.ts` — đúng 10 dòng, chỉ có `key`/`slug`/`name`.
Picker của admin và `regionOf` của web phải đọc **một nguồn**, nếu không chúng
trôi xa nhau và không gì bắt được. Cùng nguyên tắc ADR-0041 §8 (luật hoàn tiền
ở contract, không chép hai nơi).

### 2c. Slug sinh lúc tạo, khoá sau đó

Ô slug ở form **tạo** điền sẵn từ tên và admin sửa được; form **sửa** không có
ô ấy. Đổi tên hiển thị không đụng tới slug.

Vì sao không cho sửa: slug đi vào `/tours?categories=<slug>` và
`/tours?destinations=<slug>`. Đó là **tham số truy vấn**, nên không có cách nào
chuyển hướng link cũ — đổi slug là mọi link đã chia sẻ lọc ra rỗng. Với 6 và 18
hàng thì đổi slug là việc vài năm một lần; khoá lại là bớt hẳn một lớp lỗi.

**Hàm sinh slug là GỢI Ý, không phải luật.** Đo trên production:

| Tên | Slug thật | `slugify` sẵn có của web cho ra |
| --- | --- | --- |
| Đà Lạt | `da-lat` | `l-t` |
| Đà Nẵng | `da-nang` | `n-ng` |
| Hà Nội | **`hanoi`** | `h-n-i` |

Hai điều rút ra. Một: `apps/web/src/lib/slug.ts` **không dùng lại được** — nó
viết cho anchor mục lục nên xoá sạch ký tự có dấu. Hai: slug hiện tại do người
chọn (`Hà Nội` → `hanoi`, không phải `ha-noi`), nên hàm sinh chỉ điền sẵn một
đề xuất hợp lý; quyền quyết vẫn ở admin.

Hàm mới `slugifyVietnamese(value, maxLength)` đặt ở `@tourism/contract`: bỏ
dấu, `đ` → `d`, cắt theo `maxLength` do chỗ gọi truyền (60 cho danh mục, 80 cho
điểm đến — hai cột khác độ rộng), không để gạch thừa hai đầu. Nhận độ dài qua
tham số chứ không đoán: một hàm tự biết trần của hai bảng khác nhau là một hàm
biết quá nhiều.

### 2d. Sắp thứ tự bằng nút lên/xuống

`admin.categories.move` nhận `{ id, direction }` chứ không nhận số thứ tự.
Client không cần biết `order` đang là bao nhiêu, và hai admin bấm cùng lúc
không thể tạo ra hai hàng cùng số.

Server khoá **cả hai** hàng liền kề bằng `FOR UPDATE` **theo thứ tự id cố
định** rồi mới đổi chỗ, trong một transaction. Khoá theo thứ tự cố định là để
hai lượt ngược chiều không ôm nhau chết.

Không thêm ràng buộc `UNIQUE(order)` ở DB: đổi chỗ hai hàng dưới một unique
constraint cần giá trị tạm hoặc `DEFERRABLE` — thêm một khái niệm để canh thứ
mà transaction đã canh rồi. Đo prod 22/09: `order` hiện là 1..6, không trùng.

### 2e. Web đọc endpoint danh mục

Hiện `/tours` dựng chip lọc bằng `tourCategories(tours)` — suy từ **danh sách
tour đã tải**. Hệ quả đo được: `is_active` và `order` của danh mục **không ảnh
hưởng gì tới trang công khai**; chúng chỉ đổi menu lọc trong back office.

> **Đính chính 22/09 (đo lại khi thi công Task 5).** Bản spec đầu tiên còn
> nói "trang 2 của danh sách tour có bộ chip khác trang 1". **Sai.** Trang
> listing gọi `fetchTours()` MỘT lần với `limit: 50` rồi `ToursExplorer` phân
> trang phía client bằng `history.replaceState` — đổi trang không có vòng
> server nào, nên bộ chip vốn đã ổn định. Hai hệ quả thật vẫn nguyên: `is_active`
> và `order` không với tới trang công khai, và một danh mục **chưa có tour
> published nào thì không có chip**, nên admin vừa tạo xong không thấy nó đâu.

Nối `/tours` đọc `catalog.categories.list` sửa cả ba: nút bật/tắt và nút
lên/xuống có nghĩa thật, và danh mục mới tạo hiện ngay (ở dạng khoá, vì bấm
vào chỉ ra lưới trống).

## 3. Bề mặt API

Chín endpoint, cùng khuôn guard `AuthGuard` + `@Roles(ADMIN)` ở cấp class như
mọi controller admin.

| Endpoint | Input | Ghi chú |
| --- | --- | --- |
| `admin.categories.list` | — | Trả **cả hàng đã tắt** kèm số tour |
| `admin.categories.create` | `name` · `slug` · `description?` | `order` = max + 1 |
| `admin.categories.update` | `id` · `name` · `description?` | Không có slug |
| `admin.categories.setActive` | `id` · `isActive` | |
| `admin.categories.move` | `id` · `direction` | |
| `admin.destinations.list` | — | Trả cả hàng đã tắt kèm số tour |
| `admin.destinations.create` | `name` · `slug` · `country` · `region` · `description?` | |
| `admin.destinations.update` | `id` · `name` · `country` · `region` · `description?` | Không có slug |
| `admin.destinations.setActive` | `id` · `isActive` | |

`setActive` tách khỏi `update` cùng lý lẽ `setPublished` của F11: bật/tắt là
**một cú bấm trên hàng**, không phải mở form.

**Mã lỗi:**

| Mã | Status | Khi nào |
| --- | --- | --- |
| `NOT_FOUND` | 404 | id không còn |
| `SLUG_TAKEN` | 409 | slug đã có hàng khác dùng |
| `CANNOT_MOVE` | 409 | đã ở đầu hoặc cuối danh sách |

## 4. Tám chỗ dễ sai

1. **`region` trượt khỏi `regionOf`** → điểm đến biến khỏi mọi trang vùng, im
   lặng. Chặn bằng 2b (danh sách chọn, một nguồn ở contract).
2. **Slug trùng.** Cả hai bảng khai `@unique`. Để Prisma ném `P2002` là thành
   500 trần, admin phân loại `GENERIC`, kit ĐÓNG dialog — mất cả form vừa gõ.
   Đúng vết xe F12 (`priceOverride` tràn cột). Chặn bằng `SLUG_TAKEN` kiểm
   trong cùng transaction với lệnh ghi.
3. **Giới hạn cột**: slug 60/80 · name 120 · description 500/2000 · country 60
   · region 80. Contract phải gương đúng từng con số, cùng lý do như trên.
4. **Bust cache sau commit.** Điểm đến nuôi `TAGS.TOURS`; danh mục sau khi nối
   web cũng vào tag ấy. Gọi **sau** transaction, fire-and-forget (ADR-0016 §3,
   tiền lệ F11–F13).
5. **Copy lúc tắt một danh mục còn tour** phải nói đúng BA điều: chip biến khỏi
   `/tours`, **tour vẫn hiện**, và breadcrumb trên trang tour vẫn link
   `/tours?categories=<slug>` — link ấy **vẫn lọc được**. Bài học
   `closeWarning` của F12 và câu "travellers see this" của F13: một câu copy
   nói sai trên màn quản trị là một quyết định sai của người đọc nó.
6. **Copy lúc tắt một điểm đến còn tour**: biến khỏi trang vùng, khỏi tile,
   khỏi facet; tour vẫn hiện và vẫn gắn điểm đến ấy. Kèm số tour đang gắn.

   > **Đo lại 24/09 (Task 9a B1), TRƯỚC khi viết câu cảnh báo.** Ba chỗ ở câu
   > trên thiếu phần lớn. `fetchDestinations` có 7 lời gọi ở 7 trang (plan đếm
   > 11 là tính cả 4 component nhận danh sách qua prop: `home/gallery`,
   > `about-numbers`, `about-gallery`, `blog-explorer`). Endpoint công khai lọc
   > `is_active` còn hàng tour thì KHÔNG, nên ẩn một điểm đến X gây ra:
   >
   > | Trang | Chỗ đọc | Ẩn X thì |
   > | --- | --- | --- |
   > | `/` | 9 tile `topDestinations` | X rời lưới nếu đang ở top 9, tile thứ 10 lên thay |
   > | `/destinations` | câu hero `heroSubtitle(n)` | "n places" giảm 1 |
   > | `/destinations` | 4 tile nổi bật mỗi vùng | X rời tile, điểm kế tiếp lên thay |
   > | `/destinations` | số tour mỗi vùng | tour có X là điểm DUY NHẤT trong vùng ấy thôi được đếm |
   > | `/destinations/[vùng]` | nơi chốn, lưới tour, review, số liệu hero | X rời danh sách nơi chốn; tour như dòng trên rời lưới tour của vùng, kéo review của nó theo |
   > | `/destinations/[vùng]` | "bạn có mấy ngày", chuyến một ngày, "Longest trip" | tour có MỌI điểm trong vùng mà có X thôi là "chuyến riêng" của vùng — rời hai khu ấy, có thể đổi "Longest trip" |
   > | `/tours` | thẻ facet Destination | X rời thẻ — trừ khi đang được lọc: Task 9a bù nó vào cuối, đang tích |
   > | `/tours` | chip đang bật | trước Task 9a in slug thô (`?? value`), sau đó in tên |
   > | `/tours` | eyebrow "across n destinations" | n giảm 1 |
   > | `/about` | ô số "Destinations" | giảm 1 |
   > | `/about` | số tour trên bento từng vùng | như dòng "số tour mỗi vùng" ở `/destinations` |
   > | `/blog` | hai trục Places / Topics | tag trùng slug X chuyển từ Places sang Topics; link `?place=x` vẫn lọc nhưng trục Places hết ô để bỏ. Đo DB dev: 7 điểm có tag như vậy (`can-tho`, `da-nang`, `hanoi`, `hoi-an`, `hue`, `ninh-binh`, `sa-pa`) |
   > | `/account` | sổ hành trình của hộ chiếu | khách đã đi X mất mục X khỏi sổ; chuyến vẫn ở My bookings |
   > | `/account` | dòng "% of the map explored" | mẫu số giảm 1, phần trăm nhích lên |
   >
   > KHÔNG đổi: thẻ tour và trang tour vẫn in X trên lộ trình (`cardInclude`
   > không lọc `is_active`), link `/tours?destinations=x` vẫn lọc đúng, menu
   > Destinations trên navbar (bốn link cố định) và sitemap (chỉ đọc ba vùng).
   >
   > Hai dòng `/blog` và `/account` là hệ quả thật nhưng Task 9a không vá — nằm
   > ngoài danh sách file của plan; hộp xác nhận ở Task 9 nói thẳng cả hai.
7. **`move` ở biên**: hàng đầu bấm "lên" phải là **nút tắt**, không phải một
   lỗi 409 sau khi bấm. VM tính `canMoveUp`/`canMoveDown` làm gương luật server.
8. **`order` trùng do đua ghi**: hai admin bấm cùng lúc. Chặn bằng khoá hai
   hàng theo thứ tự id cố định (2d).

## 5. Definition of done

- [ ] TDD trên logic thuần: `slugifyVietnamese` · `canMoveUp`/`canMoveDown` ·
      chuẩn hoá `region`.
- [ ] Integration test: slug trùng → 409 (không phải 500) · `move` đổi đúng chỗ
      và từ chối ở biên · hai lượt `move` đối đầu không sinh `order` trùng ·
      `list` của admin trả cả hàng đã tắt còn endpoint công khai thì không.
- [ ] Component test (admin, jsdom): ô slug khoá ở form sửa và mở ở form tạo ·
      nút lên/xuống tắt đúng ở hai biên · hộp xác nhận in đúng số tour và nói
      đúng ba hệ quả.
- [ ] Test phía web: chip lọc đọc từ endpoint · danh mục đã tắt không hiện ·
      thứ tự theo `order` · **trang 2 có cùng bộ chip với trang 1**.
- [ ] `pnpm gate:int` trọn xanh (luật 11).
- [ ] Bust cache đúng tag, gọi sau commit.
- [ ] Comment code tiếng Việt (luật 8); copy người dùng thấy bằng tiếng Anh và
      nằm trong `@tourism/i18n` (luật 7).
- [ ] Entry CHANGELOG + cập nhật bản đồ `docs/README.md` (luật 13).
- [ ] Nghiệm thu tay trên production, mỗi lượt một bước: tạo một danh mục → sắp
      lên đầu → xem `/tours` đổi thứ tự chip → tắt nó → xem chip biến mất mà
      tour vẫn còn → bật lại. Rồi đổi vùng của một điểm đến và xem nó nhảy sang
      trang vùng khác.

## 6. Rủi ro đã biết

**Nối web đọc endpoint danh mục là đụng vào trang đang chạy.** `/tours` là
trang bán hàng chính. Thêm một lời gọi API vào đường prerender của nó nghĩa là
thêm một chỗ có thể hỏng lúc build — đúng loại sự cố ADR-0044 vừa vá bằng
`createRetryingFetch`. Lời gọi mới đi qua cùng client nên thừa hưởng retry ấy,
nhưng vẫn phải kiểm build web với API sống trước khi merge.

**Ba vùng dời khỏi `mocks/`** là đụng một file mà `generateStaticParams` của
`/destinations/[region]` đang đọc. Dời sai là ba trang vùng biến mất khỏi bản
build. Ca này phải có test.

**Lượt seed lại prod khoảng 03/11** xoá mọi danh mục và điểm đến tạo tay. Thử
nghiệm thoải mái trước mốc đó; đừng dựng dữ liệu thật bằng tay rồi trông chờ nó
còn.

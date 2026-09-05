# ADR-0034 — Báo cáo tháng xuất Excel; CSV ở lại đúng chỗ của nó

- **Trạng thái:** Accepted (2026-09-05)
- **Bối cảnh thi hành:** nhánh `fix/p4c-backend-logic`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0033](0033-financial-model.md) (những con số file này in
  ra) · spec P4b §3-F6 — ADR này **ĐẢO** quyết định 0-dependency chốt 31/08 ·
  [ADR-0026](0026-p4-admin-app.md) · `docs/specs/2026-09-01-bookings-export-selection-design.md`
  (route export CSV của `/bookings`, KHÔNG đổi)

## Bối cảnh

Spec P4b dòng 154 ghi nguyên văn:

> *Đường 0-dependency (user chốt 31/08 — freeze dep 15/10): CSV + trang in,
> KHÔNG thêm thư viện xlsx/PDF.*

Vòng góp ý 05/09 từ giảng viên nói ngược lại: báo cáo nên xuất **Excel** thay
vì CSV, và **form phải rõ ràng, dễ nhìn**. Đây là một quyết định của người dùng
bị một ràng buộc bên ngoài đảo lại — nên nó phải được ghi thành một ADR, không
phải một dòng `pnpm add` lặng lẽ.

Hai thứ hôm nay đang có, và giới hạn thật của chúng:

**1. `reportCsvRows()` xuất hai cột `Metric,Value`.** Giá trị là chuỗi thô
(`'1240.50'`, không ký hiệu tiền, không phân cách nghìn) — JSDoc của
`reports-view.ts` nói rõ vì sao: *"Excel đọc '$1,240.50' thành text và mọi phép
SUM chết."* Tức file hiện tại đã phải **hy sinh cách trình bày để cứu tính
toán**. Đó chính là cái đánh đổi mà CSV bắt phải chọn: một ô CSV chỉ có văn
bản, không mang được định dạng số.

**2. "Xuất PDF" là Print của trình duyệt.** Trang `/reports` được dựng để in
(tiêu đề + kỳ + mốc chốt sổ nằm TRONG trang, khối định nghĩa đi kèm mọi bản
in). Cái này **giữ nguyên** — nó vẫn là đường ra giấy rẻ nhất và vẫn hoạt động.

## Quyết định

### 1. Thêm ExcelJS, và ghi rõ vì sao được phép

`exceljs` vào `apps/admin`. Freeze dependency là **15/10/2026**; hôm nay 05/09,
nên đây là thêm dep trong thời hạn cho phép, không phải phá luật freeze.

Vì sao ExcelJS chứ không SheetJS: SheetJS mạnh ở phần **đọc** rất nhiều định
dạng bảng tính — thứ ta không cần một mảy may nào. Việc của ta là **ghi** một
file có định dạng đẹp, và đó là chỗ ExcelJS kiểm soát tốt hơn (style ô, viền,
số hoá, thiết lập in) trên một code base còn được bảo trì tích cực.

### 2. Số phải là SỐ — đây mới là lý do đổi, không phải cái đuôi file

Mọi ô tiền ghi xuống là **`number` JavaScript kèm `numFmt`**, không phải chuỗi:

| Loại ô | `numFmt` |
| --- | --- |
| Tiền | `#,##0.00;(#,##0.00)` — âm trong ngoặc, quy ước báo cáo tài chính |
| Biên gộp / thuế suất | `0.0%` |
| Đếm | `#,##0` |
| Ngày | `dd mmm yyyy` |

Nhờ vậy file mở ra vừa **đọc được như tiền** vừa **SUM được** — đúng cái đánh
đổi mà CSV bắt phải chọn một. Đây là lập luận chính của ADR, không phải chuyện
thẩm mỹ.

⚠️ Tiền trong hệ thống là `Prisma.Decimal` → chuỗi decimal trên contract
(CLAUDE.md: *tiền không bao giờ đi qua float*). Chỗ `Number(...)` **duy nhất
được phép** là ngay tại lớp ghi ô, vì Excel không có kiểu decimal. Nó nằm sau
mọi phép cộng — không một phép tính nào chạy trên `number`.

### 3. Hình dạng workbook

Năm sheet, mỗi sheet một việc:

| Sheet | Nội dung |
| --- | --- |
| **Summary** | Khối đầu (tên site · tên báo cáo · kỳ · lúc chốt sổ · đơn vị tiền · **thuế suất**), rồi hai khối số: Dòng tiền và Kết quả kinh doanh |
| **Bookings** | Phân rã theo trạng thái + dòng Total |
| **Operations** | Hoàn tiền · quyết định huỷ · duyệt review |
| **Detail** | Từng booking TẠO trong tháng, có autofilter (xem §AMEND 1a) |
| **Definitions** | Đúng khối *"How to read these numbers"* đang có trên trang |

**Sheet Detail là điều kiện để báo cáo đáng tin.** Một tờ chỉ có tổng thì không
kiểm được; có Detail thì người đọc chọn một cột, nhìn thanh trạng thái Excel, và
đối chiếu với sheet *Bookings*. Đó là khác biệt giữa một báo cáo và một ảnh
chụp màn hình dán vào bảng tính.

⚠️ Câu *"sheet này cũng là nơi `costDataMissing` chỉ ra được booking NÀO thiếu
giá vốn"* từng đứng ở đây đã bị GỠ — xem §AMEND 1a.

**Sheet Definitions không phải phần phụ.** Nó đã đi kèm mọi bản in vì lý do đã
ghi ở `page.tsx`: khi báo cáo rời khỏi màn hình thì không còn tooltip nào để
hỏi. File Excel rời đi xa hơn giấy.

### 4. Quy ước trình bày

Theo quy ước báo cáo tài chính, và mỗi mục đều có lý do vận hành:

- **Không merge ô trong vùng dữ liệu.** Ô merge phá sort, phá filter, phá
  tham chiếu. Merge chỉ được dùng ở khối tiêu đề của Summary.
- **Nhãn canh trái, số canh phải.** Dòng chi phí thụt lề một cấp dưới nhóm của
  nó; dòng tổng in đậm và có viền trên.
- **Đóng băng hàng tiêu đề** ở mọi sheet có bảng; **autofilter** ở Detail.
- **Độ rộng cột đặt tay** — mặc định của ExcelJS cho ra một cột nhãn chật và
  một cột số thừa, tức mở file ra là thấy `####`.
- **Thiết lập in**: vừa 1 trang ngang, lặp hàng tiêu đề trên mọi trang, Detail
  nằm ngang giấy.
- **Tên file `nexora-report-<tháng>-<ngày xuất>.xlsx`** — giữ nguyên quy ước
  đang có, và giữ nguyên lý do: hai bản tải cùng một tháng ở hai ngày khác nhau
  là hai ảnh chụp khác nhau, không được trùng tên.

### 5. Chạy ở đâu, và điều gì KHÔNG đổi

Sinh file ngay trong route handler `/reports/export` đang có, dùng lại **nguyên
vẹn** `guardExportAccess()` và `logExportAudit()` của `lib/export-route.ts`.
Không mở bề mặt an ninh mới: JSDoc của file ấy đã ghi vì sao khối gác quyền
phải dùng chung — *"route handler KHÔNG chạy qua `(admin)/layout.tsx`, nên quên
gác ở route thứ tư là mọi user đăng nhập tải được cả danh sách email."*

Route đổi **định dạng phản hồi**, không đổi hợp đồng: vẫn đọc `?month=` bằng
chính `parseReportsSearchParams` của trang, vẫn trả 401/403/502 dạng text (một
cú tải file mà bị đá sang `/login` chỉ để lại một file HTML mang đuôi `.xlsx`).

`csvExportResponse` ở lại nguyên trong `lib/export-route.ts` cho hai consumer
còn lại; thêm `xlsxExportResponse` cạnh nó.

### 6. CSV không bị xoá khỏi dự án — nó lui về đúng chỗ

| Đường xuất | Định dạng | Vì sao |
| --- | --- | --- |
| `/reports/export` | **XLSX** | Là một **báo cáo** — có cấu trúc, có tổng, để người đọc |
| `/bookings/export` | CSV | Là **dữ liệu đổ ra** — một bảng phẳng để đưa sang chỗ khác |
| `/subscribers/export` | CSV | như trên |

Ranh giới: *báo cáo thì Excel, dữ liệu thì CSV.* Đổi hai route kia sang Excel
là thêm việc mà không thêm gì cho người dùng — một bảng phẳng không có gì để
định dạng, và CSV thì mọi công cụ đều nuốt được.

Trang `/reports` vì thế có **một** nút tải, ghi *Export Excel*. Không giữ song
song hai nút: hai nút cạnh nhau bắt người dùng chọn giữa hai thứ mà một trong
hai luôn tệ hơn.

### 7. Bản in giấy giữ nguyên

Khối `@media print` và bố cục để-in của `/reports` **không đụng tới**. Excel và
giấy là hai đích khác nhau: giấy để đọc và ký, Excel để cộng lại và dán vào chỗ
khác. Bỏ một cái để có cái kia là mất chứ không phải đổi.

## AMEND 1 — hai chỗ thi công đã sửa lại thiết kế (05/09, cùng ngày)

**a. Sheet *Detail* là booking TẠO trong tháng, KHÔNG phải tập của khối P&L.**

§3 bản đầu viết "từng booking của kỳ" và hứa rằng sheet ấy chỉ ra được booking
NÀO thiếu giá vốn. Cả hai sai, và thi công mới lộ ra:

`admin.bookings.list` lọc khoảng ngày theo `created_at` — ADR-0028 chốt giữ cột
ấy và cố ý KHÔNG thêm `dateField`. Trong khi khối P&L neo `departure_end_date`.
**Hai tập khác nhau**, nên người đọc thử cộng cột `Total` của *Detail* để ra
`Revenue recognised` sẽ không bao giờ khớp — một sheet mời hiểu nhầm còn tệ hơn
một sheet vắng mặt.

Chốt: *Detail* trở thành phần chi tiết của sheet **Bookings** (cùng tập
created-in-month), và **tên sheet nói thẳng điều đó** — `Detail (created this
month)`. Bỏ luôn lời hứa về `costDataMissing`: cột `cost_per_person` không có
trong `BookingSchema` của contract, và thêm nó vào chỉ để phục vụ một sheet là
nới một base schema dùng rộng — đúng đường dẫn tới OOM mà vòng review 05/09 đã
đo được. Con số `costDataMissing` vẫn hiện ở *Summary* và trên màn hình; truy
ra từng booking là việc của phase `/tours`.

**b. §4 thiếu hẳn phần MÀU, và file đầu tiên trông như dữ liệu thô.**

Bản đầu của §4 chỉ khai bố cục: không merge trong vùng dữ liệu, canh lề, đóng
băng tiêu đề, autofilter, độ rộng cột, thiết lập in. User mở bản xuất đầu và
chốt: đúng số nhưng **trông như dữ liệu dán vào bảng tính**. §4 vì thế thiếu
một nửa yêu cầu gốc của giảng viên (*"rõ ràng + đẹp mắt"*).

Bổ sung: dải tiêu đề nền thương hiệu chữ trắng; hai khối tiền trong *Summary*
có dải riêng vì chúng KHÔNG cộng vào nhau được; viền bốn cạnh mọi ô dữ liệu;
dải xen kẽ cho bảng nhiều hàng; dòng tổng có viền trên đậm; dòng thành phần
thụt lề; số âm dùng `#,##0.00;[Red](#,##0.00)`.

Bảng màu quy đổi từ CHÍNH token dự án (`oklch` → ARGB hex), mỗi hằng ghi kèm
`oklch` gốc. **Ngoại lệ có chủ đích** với luật tokens-only (CLAUDE.md #6), cùng
họ với khối `@media print` và lớp bề mặt admin ở `globals.css`: một file
`.xlsx` không có CSS custom property nào để tham chiếu, ExcelJS đòi hex tuyệt
đối.

## Phương án đã cân nhắc và bỏ

**Giữ CSV, chỉ làm đẹp trang in.** Rẻ nhất, không dep. Bỏ vì nó không giải quyết
điều được góp ý, và vì giới hạn thật của CSV — ô chỉ có văn bản — thì không
trang in nào chữa được.

**Sinh XLSX ở API rồi cho admin tải hộ.** Đặt việc sinh file cạnh dữ liệu. Bỏ vì
nó bắt thêm một endpoint trả binary qua oRPC, trong khi route handler admin đã
có sẵn nguyên bộ gác quyền + audit và đang phục vụ đúng ba đường xuất khác.

**SheetJS (`xlsx`).** Nhiều lượt tải hơn, đọc được nhiều định dạng hơn. Bỏ vì
việc ở đây thuần là GHI có định dạng, đúng vào chỗ ExcelJS mạnh hơn; phần đọc
20 định dạng là năng lực ta không dùng một dòng nào.

**Thư viện PDF.** Vẫn không. Print của trình duyệt đang làm được việc, và
quyết định 31/08 chỉ bị đảo **đúng phần xlsx** — phần PDF giữ nguyên.

## Giới hạn đã biết

1. **Không có biểu đồ trong file.** Excel chart qua ExcelJS còn nhiều góc khuất;
   một báo cáo tháng đọc bằng số. Người cần biểu đồ dựng trên sheet Detail bằng
   ba cú bấm.
2. **Sheet Detail không phân trang.** Báo cáo tháng của dự án này cỡ vài trăm
   dòng nên không cần trần như `/bookings/export` đã phải đặt; nếu ngày nào một
   tháng vượt vài nghìn booking thì trần và streaming là việc của cùng đợt đó.
3. **Một đồng tiền.** File in nhãn tiền lấy từ `report.currency`, kế thừa
   nguyên giới hạn một-đồng-tiền đã ghi ở `schemas/stats.ts`.

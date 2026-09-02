# ADR-0027 — Bề mặt riêng cho admin: vỏ tối, ruột trắng lạnh

- **Trạng thái:** Accepted (2026-09-01)
- **Bối cảnh thi hành:** nhánh `fix/p4b-ui-polish`, đi trước code theo luật
  CLAUDE.md #5
- **Liên quan:** [ADR-0019](0019-color-token-roles.md) (vai token màu + phương
  pháp đo) · [ADR-0013](0013-wuling-theme-tokens.md) (bộ token gốc) ·
  [ADR-0026](0026-p4-admin-app.md) §3 ("admin dùng CHUNG theme + tokens, không
  mở hệ thẩm mỹ mới" — ADR này **sửa** điều đó, xem §Hệ quả)

## Bối cảnh

User báo 01/09: nhìn giao diện admin thấy "hơi tối", đoán do nền không trắng.

Đo lại thì **nền không tối**: `--background` sáng 97.7%, gần trắng. Nguyên nhân
thật là ba thứ khác, và cả ba đều đo được:

### 1. Bốn bề mặt chồng nhau trong 3 điểm sáng

Admin dựng trên block `dashboard-01` với `variant="inset"`. Ở chế độ đó,
`SidebarProvider` sơn nền CẢ TRANG bằng `--sidebar`
(`has-data-[variant=inset]:bg-sidebar`), còn nội dung là một tấm
`--background` bo góc nổi lên (`sidebar.tsx` dòng 136 và 301).

| Lớp | Token | L |
| --- | --- | --- |
| Nền cả trang (khung) | `--sidebar` | 96.6% |
| Tấm inset (nội dung) | `--background` | 97.7% |
| Thẻ số liệu | `--card` | 99.6% |
| Đầu bảng, rãnh toggle | `--muted` | 91.4% |
| Nét kẻ | `--border` | 78.1% |

Khung và tấm nội dung **chỉ cách nhau 1.1 điểm sáng**. Tấm inset đáng lẽ phải
nổi thì chìm, nên cả màn hình đọc ra thành một mảng phẳng thay vì "thẻ trắng
trên khung". Mắt không có điểm trắng nào làm mốc — và một màn hình không có
điểm trắng thì luôn trông xỉn.

### 2. Sắc xanh lá trong màu trung tính

Mọi bề mặt nhuộm hue **170–184**. Chroma rất thấp (0.002–0.015) nên không ai
gọi được tên màu, nhưng ở vùng gần trắng một sắc ngả lá đọc ra là **ngà**, chứ
không phải trắng. Cùng độ sáng ấy mà ngả xanh dương thì lại đọc ra "trắng
sạch". Đây chính là thứ user mô tả.

### 3. Gradient hàng stat card

`stat-card.tsx` đắp `bg-linear-to-t from-primary/5 to-card`: một dải teal 5% ở
đáy card nhạt dần lên trắng. Sắc teal ấy **trùng đúng hue với nền** phía sau,
nên mép dưới card tan vào nền thay vì dừng dứt khoát — thứ user gọi là "mờ mờ
ảo ảo".

### Vì sao không sửa thẳng token gốc

`libs/shared/tokens` → `libs/shared/ui/globals.css` → **cả `apps/web` lẫn
`apps/admin`**. `apps/web` đang chạy thật tại `www.nexora-travel.agency`, và
push lên `main` là Vercel tự deploy (ADR-0024). Sửa token gốc để chỉnh admin
là **đổi màu luôn trang khách** — cái giá không ai xin.

## Quyết định

Khai **một lớp đè token khoanh riêng cho admin**, không đụng nguồn dùng chung.

### Phạm vi khoanh

Lớp đè gắn vào `[data-admin-surface]`, thuộc tính do `(admin)/layout.tsx` đặt.
Trang `login`, `not-authorized`, `not-found` nằm NGOÀI nhóm route `(admin)` nên
tự động không nhận — đúng yêu cầu "trừ trang login ra" mà không cần một ngoại
lệ nào phải nhớ.

### Diện mạo: vỏ tối, ruột trắng lạnh (phương án "D2")

User duyệt qua hai vòng demo artifact 01/09, chọn D2 trong bốn phương án.

- **Vỏ** (`--sidebar-*`) mượn độ tối của bộ dark web (L ~0.29) nhưng **kéo hue
  về 252** cho khớp ruột. Bản mượn nguyên hue 178 đã dựng và bị loại: vỏ ngả
  rêu cạnh ruột ngả xanh, hai nửa cãi nhau thấy rõ ở chỗ giáp ranh.
- **Ruột** (bề mặt nội dung) trung tính lạnh hue 250, `--card` trắng tuyệt đối.

Khoảng cách vỏ ↔ ruột từ 1.1 điểm lên **68 điểm sáng** (đo được 13.99:1) —
nguyên nhân #1 bị xoá sổ chứ không phải xoa dịu.

### Gradient stat card: GIỮ

Phân tích đề xuất bỏ (trên nền lạnh, vệt teal đọc ra là *ố* chứ không còn
*hoà*). **User chốt giữ 01/09** — quyết định của user, ghi lại ở đây để lần
sau không ai "sửa lại cho đúng phân tích". Đo lại với nền mới: chữ trên đáy
card (chỗ teal đậm nhất) vẫn 14.79:1, chữ phụ 5.69:1 — giữ nó không tạo lỗi
tiếp cận nào.

### Không đụng tới

`--primary`, `--primary-foreground`, `--primary-emphasis`, `--destructive`,
`--destructive-emphasis` — toàn bộ phần ADR-0019 đã đo và ghi hồ sơ. Nền sáng
lên chỉ làm chữ tối **tăng** tương phản, nên không phép đo nào của ADR-0019 bị
lật. `--input` giữ vai riêng (đậm hơn `--border`) vì viền là thứ DUY NHẤT cho
biết một ô nhập ở đâu — nó chịu ngưỡng 3:1 phi-văn-bản, còn `--border` chỉ chia
ô bảng nên nhạt đi được.

## Số đo

Cùng phương pháp ADR-0019 (OKLCH → sRGB kẹp → luminance tương đối → WCAG 2.x).
Công cụ tái lập đúng ba số ADR-0019 đã ghi cho bộ sáng (5.57 · 5.88 · 4.62)
trước khi dùng để đo bộ mới.

### Chữ (ngưỡng 4.5)

| Cặp | Đo | |
| --- | --- | --- |
| `foreground` / `background` | 15.21 | ✅ |
| `foreground` / `card` | 15.43 | ✅ |
| `foreground` / `muted` (đầu bảng) | 13.82 | ✅ |
| `muted-foreground` / `background` | 5.86 | ✅ |
| `muted-foreground` / `muted` | 5.32 | ✅ |
| `primary-foreground` / `primary` (nhãn nút) | 5.52 | ✅ |
| `primary` làm chữ / `background` | 5.86 | ✅ |
| `secondary-foreground` / `muted` (pill) | 7.66 | ✅ |
| `sidebar-foreground` / `sidebar` | 11.56 | ✅ |
| `sidebar-foreground` / `sidebar-accent` | 8.41 | ✅ |
| `foreground` / đáy card (dải teal 5%) | 14.79 | ✅ |
| `muted-foreground` / đáy card | 5.69 | ✅ |

### Phi văn bản (ngưỡng 3.0)

| Cặp | Đo | |
| --- | --- | --- |
| `input` (viền ô nhập) / `background` | 3.06 | ✅ |
| `input` / `card` | 3.11 | ✅ |
| `primary` (bề mặt nút) / `background` | 5.86 | ✅ |
| `sidebar` / `background` (vỏ vs ruột) | 13.99 | ✅ |

### Hai chỗ đo ra ĐỎ, và cách xử

**1. Nút CTA trong sidebar — do ADR này gây ra, đã giải.**
`nav-main.tsx` dùng `bg-primary` (L 0.494). Trên vỏ tối mới, bề mặt nút/nền chỉ
**2.39** ❌. Quét L cho thấy đúng thế kẹt ADR-0019 mô tả ở chế độ tối: không L
nào của teal đồng thời đạt nút/nền ≥3 và chữ-gần-trắng/nút ≥4.5 (giao nhau
giữa 0.54 và 0.56).

Lối ra là **lật chiều chữ**, thứ ADR-0019 không làm được ở dark vì ở đó cả nền
lẫn card đều tối. Ở đây vỏ tối mà nút có thể sáng: `--sidebar-primary` L 0.68
với `--sidebar-primary-foreground` là mực tối → nút/nền **5.11** ✅, chữ/nút
**5.55** ✅. Hai token này tồn tại sẵn đúng cho việc đó; cụm sidebar chỉ chưa
dùng chúng (xem §Hệ quả).

**2. `success` làm chữ trên card — LỖI CÓ SẴN, không do ADR này.**
`text-success` (stat card, delta tốt) đo **3.37** trên card hiện tại và **3.40**
trên card mới — chênh không đáng kể, tức nó đã trượt 4.5 từ trước. Vá trong
phạm vi admin vì ở đây `success` chỉ đóng vai MỰC; `apps/web` dùng nó làm BỀ
MẶT (`bg-success`) nên hạ L bên đó là chuyện khác, để nguyên — nợ có hồ sơ.

**AMEND 01/09** (vòng nút approve/deny, khuôn `button-23`): hạ tiếp xuống
**0.48**. Token này nay còn phải làm mực TRÊN CHÍNH NỀN NHẠT CỦA NÓ
(`bg-success/10`, hover `/20`), và nền càng đậm thì mực càng phải tối — ở 0.52
trạng thái hover chỉ còn **4.28** ❌. Chọn 0.48 chứ không phải 0.50 (4.56, sát
mép):

| Cặp | Đo | |
| --- | --- | --- |
| `text-success` / card trơn | 5.99 | ✅ |
| `text-success` / `bg-success/10` trên card | 5.49 | ✅ |
| `text-success` / `bg-success/20` (hover) trên card | 4.99 | ✅ |
| `text-success` / `bg-success/20` trên `background` | 4.93 | ✅ |

Đây đúng bài toán ADR-0019 giải cho `destructive` bằng cách tách
`destructive-emphasis`. Ở đây **không cần tách**: trong admin `success` chỉ
đóng một vai (mực), không chỗ nào dùng nó làm bề mặt đặc — nên hạ thẳng L là
đủ, không phải nuôi thêm một token.

Nhánh deny của cặp nút KHÔNG cần đo lại: variant `destructive` của
`@tourism/ui` vốn đã là `bg-destructive/10 text-destructive-emphasis`, tức
`destructive-emphasis` đã sinh ra cho đúng ca này (5.52 nghỉ · 5.05 hover).

## Hệ quả

### Cụm sidebar phải thôi với tay sang token vùng sáng

Bốn chỗ dùng token không thuộc họ `--sidebar-*`. Hiện vô hại vì sidebar cũng
sáng; đổi vỏ sang tối là chúng **hỏng câm**:

| File | Trước | Sau |
| --- | --- | --- |
| `logo.tsx` | `text-foreground` | `text-sidebar-foreground` |
| `nav-user.tsx` | `text-foreground/70` | `text-sidebar-foreground/70` |
| `nav-user.tsx` | `aria-expanded:bg-muted` | `aria-expanded:bg-sidebar-accent` |
| `nav-main.tsx` | `bg-primary text-primary-foreground` | `bg-sidebar-primary text-sidebar-primary-foreground` |

Đây là điều kiện để lớp đè chạy được, không phải việc dọn dẹp kèm theo.

### ADR-0026 §3 bị sửa một phần

§3 chốt "admin dùng CHUNG theme + tokens, không mở hệ thẩm mỹ mới". ADR này
**không** mở hệ thẩm mỹ mới — thang chữ, bo góc, khoảng cách, và toàn bộ họ
`--primary`/`--destructive` giữ nguyên — nhưng nó **có** cho admin một bộ bề
mặt riêng. Ranh giới mới: admin dùng chung *hệ*, khác *bề mặt*.

### Chế độ tối của admin

Admin nay chỉ có MỘT diện mạo cố định (user chốt: "ở admin không cần làm sáng
tối như bản web"). Lớp đè khai giá trị tuyệt đối, không rẽ nhánh theme.

### AMEND 02/09 — hai lỗ của cơ chế đè, và gói `motion`

Review nhánh `fix/p4b-ui-polish` (8 mũi) đo ra bản đầu của cơ chế này hở ở hai
chỗ, cả hai đều nằm ở *cách gắn* chứ không ở *giá trị*:

1. **`.dark` vẫn được gắn theo OS.** `app/layout.tsx` giữ nguyên script
   pre-paint của web (`prefers-color-scheme` → `classList.add('dark')`), mà
   lớp đè chỉ khai ~23 token trong khi `.dark` của tokens.css khai 48 — cùng
   specificity, lớp đè thắng ở token nó có, `.dark` thắng ở phần còn lại. Máy
   để dark mode nhận `--accent`/`--secondary` bị ép gần trắng cạnh
   `--accent-foreground`/`--secondary-foreground` vẫn gần trắng (badge trạng
   thái, hover menu ~1.4:1), `--destructive-emphasis` 0.72 trên card trắng
   ~2.6:1 thay vì 5.52 ở bảng đo trên. **Xử:** gỡ hẳn script — admin không
   có toggle theme và câu "một diện mạo cố định" phải đúng theo cấu trúc.
   Trang `login`/`not-authorized` vì thế cũng luôn sáng; chúng vốn được
   thiết kế sáng.
2. **Overlay portal ra `body`.** Popover/DropdownMenu/Select/Dialog của
   `@tourism/ui` và toast Sonner render ngoài cây của div mang thuộc tính,
   nên lịch, menu Columns, dialog xác nhận và toast vẽ bằng palette web (hue
   174) cạnh bảng palette admin (hue 250) — mọi số đo ở trên chỉ đúng cho
   phần không-portal. **Xử:** selector thành `[data-admin-surface],
   body:has([data-admin-surface])` — `body` nhận token khi (và chỉ khi) trong
   cây có thuộc tính, nên ngoại lệ login vẫn tự động.

Cùng vòng, `motion@^12.23.0` (đúng bản `apps/web` đang dùng — ADR-0026 §3
"tái dùng tokens/ui/motion") được kéo vào `apps/admin` cho pill trượt của
`StatusFilterTabs`, `DecisionButton` và nút Export. Ghi ở đây vì plan cùng
ngày viết "không thêm dependency mới": gói không mới với workspace, nhưng mới
với app admin và cần một bản ghi. **Nợ ghi sổ:** kit import full `motion/react`
(~34KB gzip) vào mọi trang bảng chỉ để `layoutId` cho một viên pill —
`LazyMotion`/`domMax` hoặc pill CSS thuần là đường rẻ hơn, xử khi P4d chạm
lại kit.

### Điều KHÔNG được suy ra

Đây là bề mặt của **admin**, không phải một đề xuất cho web. Bộ token gốc giữ
nguyên; ai muốn đổi web phải đo lại từ đầu vì `success`/`primary` bên đó còn
đóng vai bề mặt.

## Phương án đã cân nhắc rồi loại

| | Vì sao loại |
| --- | --- |
| **A — giãn bậc, giữ hue** | Sửa ít nhất và có tác dụng, nhưng giữ nguyên sắc ngà — chữa nguyên nhân #1, bỏ qua #2. |
| **C — trắng thuần, chroma 0** | Sạch nhất nhưng admin mất hẳn liên hệ với nhận diện teal của trang khách. |
| **D1 — vỏ tối nguyên hue web** | Vỏ hue 178 cạnh ruột hue 250 cãi nhau thấy rõ ở chỗ giáp ranh. |
| **D3 — tối toàn phần** | Đi ngược lời user, và thừa hưởng luôn thang bậc chật của bộ dark (background 27.5 · sidebar 29.0 · card 30.9 — 3.4 điểm, còn chật hơn bộ sáng). |
| **Sửa thẳng token gốc** | Đổi màu luôn trang khách đang chạy thật. |

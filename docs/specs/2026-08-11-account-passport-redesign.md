# Spec — Đập-xây-lại khu Account theo thế giới "Hộ chiếu"

- **Ngày:** 2026-08-11 · **Trạng thái:** chờ user duyệt
- **Nguồn quyết định:** user bác visual account hướng A (11/08, "vẫn là trang cũ
  chỉnh lại — muốn đập đi xây lại từ a-z") → demo vòng 2 ba kiến trúc từ-số-0 →
  **user chọn Hộ chiếu** → demo bộ 4 màn (artifact "Hộ chiếu — bộ màn account
  đầy đủ") → **user duyệt bộ 4 màn**.
- **Khảo sát nền:** 2 báo cáo vòng 2 (kiến trúc: adiClub/Strava/Duolingo/
  Spotify/Revolut/N26/airline-hotel loyalty/Linear/Headspace · trend: Stampie/
  Passyport/Polarsteps/Flighty/bento 2026/danh sách "mùi AI" phải né).

## 1. Triết lý & phạm vi

**Account = cuốn hộ chiếu của người đi**, không phải khu quản trị. Thứ user
muốn ngắm (tem, stats, hành trình) chiếm mặt tiền; form lùi về tầng sau một
link ⚙. Cùng vũ trụ ấn phẩm với tấm vé boarding-pass bên checkout (đã merge
11/08): lưới nhãn-trên-giá-trị-dưới, mono cho mã/số, serif cho tên, mực dấu
một tông, "khuyết tật thủ công" có chủ đích.

**Đụng:** toàn khu `/account/**` — đập tầng trình bày, vẽ lại cấu trúc route.
**KHÔNG đụng:** tầng logic đã test (session, `lib/api/*`, `booking-vm`,
`BookingActions`, review slot/form, profile/password/delete handlers,
saved-grid logic, proxy matcher `/account/:path*` — route mới vẫn khớp);
trang public + checkout; tokens màu/font.

## 2. Cấu trúc route mới

| Route | Vai trò mới |
| --- | --- |
| `/account` | **Trang hộ chiếu (M1)** — mặt tiền duy nhất: header passport + tem + stats + bản đồ + Your journey (thay cả hub LẪN trang Trips) + ngăn Saved thu gọn. Redirect hiện tại `/account → /account/bookings` ĐẢO CHIỀU. |
| `/account/bookings` | Redirect → `/account` (link/bookmark cũ sống). |
| `/account/bookings/[code]` | **Trang visa (M2)** — giữ route. |
| `/account/settings` | **Tầng sau (M3)** — route MỚI, gộp nội dung profile+security hiện tại. `/account/profile` và `/account/security` redirect về đây. |
| `/account/saved` | Giữ route — lưới hiện có khoác nền giấy + header "Tucked inside". |

**`AccountNav` (3 tab) GỠ HẲN** — điều hướng nội khu bằng link trong trang:
⚙ Settings góc phải header, "Open →" ở ngăn Saved, back-link "← Passport" ở
mọi trang con. Layout khu giữ `pt-36` né navbar; section giấy được bleed
ngang hết viewport (kỹ thuật âm-margin như hero các trang public).

## 3. Dữ liệu — một mở rộng contract + các hàm thuần

### 3.1 Contract (đường mòn `tourImage` đã đi 11/08)

> **AMENDED (plan T2, 11/08):** tái dùng `DestinationLinkSchema`
> `{slug, name, isPrimary}` thay vì `{name, region}` như câu dưới — `region`
> không cần trên booking vì bản đồ join catalog theo slug; `isPrimary` lại cần
> cho nhãn tem. Join qua hằng `bookingTourInclude` dùng chung 9 call site.

`BookingSchema` thêm **`tourDestinations: z.array(z.object({ name, region }))`**
— snapshot join lúc đọc từ `tour.destinations` (name ≤120, region nullable ≤80
theo `DestinationSchema`), KHÔNG cột DB mới, không migration. Phủ cùng cơ chế
`toBooking` (kiểu ép compile-error), int test assert giá trị ở list + byCode.
Đây là nguồn cho tem, "places visited" và bản đồ.

### 3.2 Hàm thuần mới (lib web, TDD ≥80%)

- `passportStats(bookings, catalogTotal)` → `{ trips, places, exploredPct,
  daysOnRoad }`: `trips` = booking hoàn thành (PAID/REFUNDED* có
  `departureEndDate < today` — đọc qua `bookingView`, không if/else status
  thô); `places` = distinct destination name từ các chuyến hoàn thành;
  `exploredPct` = places / `catalogTotal` (tổng destination catalog, lấy từ
  API destinations đã có) — 0 khi chưa có chuyến, ngược lại làm tròn xuống
  nhưng tối thiểu 1%; `daysOnRoad` = tổng
  (end − start + 1) chuyến hoàn thành.
- `passportStamps(bookings)` → tem cho MỖI chuyến hoàn thành: `{ label:
  destination đầu tiên của tour (fallback: 2 từ đầu tourTitle, UPPERCASE),
  month: 'Jul 2026', shape: round|square, rotation: −7°..+7° }` — shape/rotation
  **deterministic từ booking.code** (khuyết tật thủ công, không Math.random).
  Luôn kèm 1 tem ghost "next stamp" ở cuối.
- `memberNumber(userId)` + `mrzLine(name, memberNo, year)` — deterministic,
  cùng họ serial vé checkout; MRZ chỉ là trang trí typography (`P<TOURISM<<…`),
  KHÔNG mang dữ liệu nhạy cảm ngoài tên hiển thị.
- `mapDots(catalogDestinations, visitedNames)` → mảng dot `{ region-cluster,
  visited }`: bản đồ là **lưới chấm cách điệu** — mỗi dot = một destination
  THẬT của catalog, gom cụm theo `region` (Bắc/Trung/Nam), tô jade khi đã đi,
  `opacity .4` khi có booking sắp tới. KHÔNG phải bản đồ địa lý thật — caption
  nói rõ ("N of our 19 destinations").

### 3.3 Copy trung thực (English-only, i18n khối `passport*`)

"2% of Việt Nam explored" của demo đổi thành **`{pct}% of the map explored`** +
caption bản đồ đếm theo catalog thật — không hứa địa lý mình không đo. Các
copy demo còn lại giữ tinh thần ("Every passport starts blank", "Your first
stamp is waiting", "Tucked inside").

## 4. Bốn màn (theo demo đã duyệt — điểm neo cho reviewer)

- **M1 `/account`**: paper section (texture + guilloche ≤5%) → kicker
  "TRAVELER PASSPORT · TOURISM" + tên Literata + "TRAVELER SINCE {year} ·
  {location?}" + MRZ + ⚙ Settings; cụm tem (xoay/hình deterministic, tem ghost
  nét đứt); hàng 4 stat (số serif lớn); "Your journey" = MỌI booking, dòng
  chấm-màu theo `bookingView.tone` (primary/warning/muted) + động từ đúng
  trạng thái (`View →` / `Pay now →` / `Review →`), load-more giữ pattern
  server hiện có; cột phải: bản đồ chấm + ngăn Saved (3 thumbnail + Open →).
  Mobile: một cột, tem xuống dưới header.
- **M2 `/account/bookings/[code]`**: back-link "← Passport"; khối `v-doc`
  (dải tone mảnh trên đầu — cùng logic màu mép cuống vé) → header kicker
  "ENTRY · TOUR BOOKING" + title + "View tour →" + **mộc trạng thái đóng
  nghiêng** (một ngôn ngữ dấu cho cả 5 status, màu mực theo `bookingView.tone`;
  PENDING: mộc "AWAITING PAYMENT" + nút Pay now thế chỗ View voucher) → ảnh
  tour (null → bỏ) → lưới IATA 4 ô (Dates mono `24 → 26 AUG` · Travellers ·
  Reference · Total) → hàng action (View voucher → `/checkout/success?code=…`
  tái dùng nguyên TẤM VÉ, Contact us) → fine print mono mang lead traveler +
  booked date + provider (thay section Contact cũ). Dưới doc: câu hủy text-link
  `destructive-emphasis` + policy link (flow `BookingActions` giữ nguyên);
  section review giữ (id="review", slot logic cũ).
- **M3 `/account/settings`**: back-link; heading "Traveler details" + "The
  information printed in your passport."; section Identity + Sign-in dùng
  NGUYÊN các component nở-inline hiện có (đổi khung, không đổi logic); delete
  account text-link cuối. Trang nền giấy nhạt.
- **M4 empty (`/account`, 0 booking)**: header passport đầy đủ + tem ghost
  cỡ lớn + "Every passport starts blank" + CTA Browse tours + hàng stat số 0
  (không giấu), bản đồ chưa nhuộm. Saved rỗng → ngăn kẹp ẩn.

## 5. Hệ quả kỹ thuật

- Tokens-only; token giấy dùng cặp `--paper`/`--ink` CÓ SẴN chưa? — KIỂM khi
  plan: nếu tokens chưa có vai giấy/mực thì thêm cặp token semantic mới qua
  Style Dictionary (quy trình ADR-0013), KHÔNG hex trong component.
- Component account cũ bị thay: `account-nav` (gỡ), `trip-card` (thay bằng
  journey row — logic status-aware GIỮ làm nguồn tham chiếu test),
  `account-section` (chỉ còn dùng ở settings nếu tiện — không thì gỡ, không
  để mã chết). Spec/test đi theo số phận component.
- Route redirect: 3 redirect mới (`bookings→account`, `profile→settings`,
  `security→settings`) — permanentRedirect, giữ mọi deep-link cũ.
- Ảnh `<img>` thuần + biome-ignore lý do inline (nếp đã chốt); tem/mộc/MRZ
  là CSS + chữ, KHÔNG vector minh hoạ tự vẽ (luật chống mùi AI).
- Test: hàm thuần TDD trước; component test cho tem-deterministic, journey
  row 5 status, mộc 5 trạng thái, empty state; test logic cũ (BookingActions,
  profile, saved) phải sống nguyên hoặc chuyển chỗ có chủ đích.
- Thi công: branch riêng; KHÔNG build web trong repo chính (worktree khi
  nghiệm thu); screenshot light/dark + mobile trước khi mời user review;
  `gate:int`/CI đầy đủ trước merge (luật 11).

## 6. Ngoài scope

Tier/loyalty (chưa có hệ điểm — để ngỏ, KHÔNG dựng vỏ rỗng) · bản đồ địa lý
tương tác thật · wishlist tim trên card + form review mới (cụm B) ·
refundedTotal (cụm C) · đồng bộ pill badge các trang tour (sổ nợ 11/08).

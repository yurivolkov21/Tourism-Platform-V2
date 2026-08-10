# Sổ nợ kỹ thuật còn mở — chốt 06/08/2026

> **Đây là sổ SỐNG, không phải ảnh chụp.** Khác với
> [progress report 04/08](2026-08-04-progress-report.md) (bản chụp một thời
> điểm, đừng sửa), file này được cập nhật mỗi khi một khoản nợ được trả hoặc
> một khoản mới sinh ra. Trả xong thì **gạch bỏ tại chỗ kèm hash**, đừng xoá —
> để còn truy được vì sao từng có.
>
> Lý do lập: trước 06/08 nợ nằm rải trong "Nợ mở" của từng entry
> [CHANGELOG](../CHANGELOG.md). Đọc được nếu biết tìm ở entry nào, nhưng một
> session mới (đặc biệt session **redesign giao diện**) không có cách nào gom
> lại. Sổ này là chỗ gom.

## Cách dùng

- **Trước khi mở một cụm việc mới**, đọc mục tương ứng ở đây xem có nợ nào nên
  trả tiện thể không.
- **Sau khi trả nợ**, gạch bỏ dòng đó kèm hash commit, và ghi vào entry
  CHANGELOG của cụm đã trả.
- Cột **Chặn?** trả lời: khoản này có chặn việc gì đang xếp hàng không. `—` là
  không chặn ai, làm lúc nào cũng được.

---

## A. Ảnh hưởng TRỰC TIẾP tới session redesign giao diện

Đọc mục này trước nếu bạn đang thiết kế lại trang.

| # | Nợ | Bề mặt | Chặn? |
| --- | --- | --- | --- |
| A1 | **Khu Account cần thiết kế lại.** Cụm A merge 06/08 ở mức "dựng tạm" — user duyệt visual với điều kiện rõ ràng là sẽ redesign ở session riêng. 6 route: `/account`, profile, settings, bookings, booking detail, wishlist. | `/account/*` | Chờ session redesign |
| A2 | **`textarea` lý do huỷ booking bị bỏ sót.** Spec cụm A §3 đòi ô nhập lý do, A1 không dựng; lý do huỷ hiện **hardcode**. Khoá "không-đụng-visual" chặn vá lúc đó → làm khi redesign khu account. | Booking detail | Gộp vào A1 |
| A3 | **Nợ tương phản dark chưa đóng.** `primary` trên nền tối đo được 2.91 và 2.57 — dưới ngưỡng 4.5:1 mà chính design brief §6 mục 5 đặt ra. Nền dark đã nâng 10% (`121cff6`) nhưng chưa đủ. | Toàn site, chế độ tối | Nên gộp vào vòng redesign |
| A4 | **Booking/checkout chưa có thiết kế.** Cụm C chờ user chốt bản thiết kế Claude Design; prompt đã giao tại [design/prompts/booking.md](../design/prompts/booking.md), mockup nguồn ở [design/mockups/](../design/mockups/). | Luồng booking | Chặn cụm C |
| A5 | **Con dấu tem thư `/contact` ghi "Hà Nội · Sa Pa".** Sau 06/08 văn phòng Sa Pa đã bị xoá khỏi dữ liệu (nay là Hà Nội + Hồ Chí Minh), nên đây là **tham chiếu mồ côi** tới dữ liệu không còn. User chốt 06/08 **giữ nguyên** vì Sa Pa là motif truyện thương hiệu (`contact-hero`, `about-timeline`). Ghi lại để lần redesign sau không tưởng là lỗi. | `contact-split.tsx:237` | — (đã chốt giữ) |
| A6 | **Khu Account phải THIẾT KẾ LẠI TỪ ĐẦU — user đã chốt giao session khác.** Vòng 11/08 (`a471711`) sửa được phần KỶ LUẬT (lưới ba toạ độ 128·536·1312, một khai báo lưới dùng chung cho năm màn, padding về chuẩn site) nhưng user đánh giá kết quả thẩm mỹ là **chắp vá** và dừng lại. Nguyên nhân là lỗi QUY TRÌNH, ghi rõ để session sau không lặp: mỗi lần user nói "làm lại", agent giữ khung cũ rồi vá góp ý mới lên trên, ba lần liên tiếp. **Nghe "làm lại" thì phải bỏ hẳn bản cũ và dựng từ đầu.** Thứ ĐÁNG GIỮ lại từ vòng này: lưới ba toạ độ và `account-section.tsx`, số đo tương phản đã kiểm chứng, và hai lỗi WCAG đã vá (pill `warning` 1.90 · `destructive` dark). Thứ user đã bác: cột dọc có ray + chấm (10/08), hairline ngăn mục (11/08 vòng 1), hub khối + card (11/08 vòng 2) | web `/account/*` | Không chặn |
| A7 | **Khu checkout/booking chưa bao giờ được rà cùng khu account.** Cụm C merge 08/08 rồi không đụng lại; ba vòng thiết kế 10–11/08 chỉ chạm `/account/*`. Hai khu này dùng chung navbar, token và hằng số `pt-36` nên thiết kế lệch nhau sẽ lộ ngay khi khách đi từ checkout sang account. Session redesign phải rà CẢ HAI | web `/checkout/*` | Không chặn |

**Lưu ý quan trọng cho mockup:** khu Location của `/contact` nay là **bản đồ
MapLibre thật**, không phải ô placeholder — xem [ADR-0018](../adr/0018-web-map-library.md)
và ghi chú đã thêm vào [design brief §5](../design/claude-design-brief.md).

---

## B. Dọn dẹp dữ liệu / nội dung

| # | Nợ | Chi tiết | Chặn? |
| --- | --- | --- | --- |
| B1 | **Khối `contact.*` trong `@tourism/i18n` mồ côi TRỌN** | 8 khoá (`heading`, `breadcrumb`, `subtitle`, `intro`, `inquiry`, `info`, `ctaBand`, `faq`) cộng `footer.phone` và `footer.email` — **0 consumer**, đã grep xác nhận. `contact/page.tsx` tự hardcode `metadata` riêng. Cụm 06/08 đã xoá 4 khoá văn phòng nhưng để lại phần còn lại vì xoá ~90 dòng là thay đổi riêng có bán kính ảnh hưởng riêng. **Cẩn thận:** comment `// Kept for the site footer's Information column.` từng nói dối (đã sửa ở `1e8270f`) — `site-footer.tsx` chưa bao giờ import `messages`. | — |
| B2 | **`mocks/regions.ts` vẫn sống, CỐ Ý** | Khung 3 miền (key/slug/name) không có endpoint tương ứng. Không phải nợ cần trả, ghi để khỏi ai "dọn nhầm". | — |
| B3 | **Mock không có endpoint: `faq` · `testimonials` · `moments` · `team` · `offices`** | [ADR-0016](../adr/0016-web-data-layer.md) chốt sống tiếp như nội dung biên tập tĩnh. `offices` nay là **nguồn sự thật của địa chỉ toàn site** (từ 06/08), đừng xoá. | — |

---

## C. Lỗ hổng kiểm thử

| # | Nợ | Vì sao đáng quan tâm | Chặn? |
| --- | --- | --- | --- |
| C1 | **Không có gì canh việc gom nguồn liên hệ** | Cụm 06/08 gom email/phone/địa chỉ về `lib/site.ts` và `mocks/offices.ts`. Nhưng nếu ai hardcode lại một địa chỉ khác ở đâu đó, **không test, lint hay build nào chặn**. Rẻ nhất: một test khẳng định `termsDoc`/`privacyDoc` chứa `PHONE` từ `@/lib/site` (~5 dòng) — bắt được lệch giữa hai bản văn xuôi pháp lý viết tay. | — |
| C2 | **Hoán đổi chỉ-kinh-độ giữa 2 văn phòng không bị bắt** | Test hiện neo bằng vĩ độ (Hà Nội phải ở bắc Hồ Chí Minh) và số nhà trong `mapHref`. Đảo riêng `coords[0]` thì lọt. Reviewer đánh giá **không đáng vá** (không ai đảo nửa cặp số, và pin lệch ~85km thì nhìn là thấy). Ghi để khỏi phát hiện lại. | — |
| C3 | **Hoán đổi `addressLines[1]` giữa 2 văn phòng không bị bắt** | Cùng dạng lỗi với C2 nhưng hậu quả nhẹ hơn (chỉ sai text dòng phụ). | — |
| C4 | **`contact-map.tsx` không có test** | CÓ CHỦ ĐÍCH — jsdom không có WebGL, test chỉ kiểm được cái mock của chính mình. Ghi ở [ADR-0018](../adr/0018-web-map-library.md). `contact-location.spec.tsx` phủ phần đường nối thật sự có thể hỏng (nạp lười, `mapHref`, `target`/`rel`). | — |

---

## D. Thư viện bên thứ ba

| # | Nợ | Chi tiết | Chặn? |
| --- | --- | --- | --- |
| D1 | **`input-otp@1.4.2` rò rỉ timer — đang chỉ giảm thiểu, chưa sửa gốc** | Thư viện hẹn 3 `setTimeout` **thật** (0/10/50ms) mỗi lần giá trị OTP hoặc focus đổi, qua một `useEffect` **không trả cleanup function** → React không có gì để huỷ, kể cả lúc unmount. Timer nổ sau khi Vitest tháo jsdom thì ném `ReferenceError: window is not defined` và làm **đỏ CI dù 100% test pass**. Đã làm đỏ `main` ngày 06/08 (run `31098351988`). Vá tạm bằng `afterEach` cấp-file đợi thật 150ms trong `otp-form.spec.tsx` (`adaedf3`) — tái hiện 2/35 trước vá, 0/35 sau vá. **Đây là biện pháp giảm thiểu cho lỗi upstream, không sửa được tại gốc.** Nếu upstream vá thì nâng version rồi gỡ đoạn đợi này. ⚠️ Freeze dependency **15/10/2026** — muốn nâng thì phải trước mốc đó. | — |

---

## E. Nợ có từ trước, vẫn mở

Gom lại đây cho đủ mặt; chi tiết ở entry CHANGELOG tương ứng.

| # | Nợ | Nguồn |
| --- | --- | --- |
| E1 | `EnquiryCta` component dùng chung (cuối trang FAQ) | [spec 25/07](../specs/2026-07-25-legal-utility-pages-design.md) |
| E2 | Gắn API cho `/faq` — ứng viên bảng `faqs` | [spec 25/07](../specs/2026-07-25-legal-utility-pages-design.md) |
| E3 | 5 nợ contract cụm Tours (media tour · next-departure trên card · sort rating · filter price/duration/difficulty · suitableFor+badges) — #2–#5 cần ADR mới | [spec 27/07](../specs/2026-07-27-tours-pages-design.md) §8 |
| E4 | Media thật thay `ImagePlaceholder` toàn site — CÓ chủ đích, chờ user | [README dòng P3b](../README.md) |
| E5 | `user-menu` label hardcode (`auth.menu.*` mồ côi) · `connected-accounts` một dòng cứng · `saved-grid` 401 thiếu nhánh `sessionExpired` · Load-more cap 50 không lối thoát · terminal-note "số tiền đã hoàn" không nguồn · DENIED không hiện lý do | [CHANGELOG 06/08 cụm A](../CHANGELOG.md) |
| E6 | Two-factor PARK | [ADR-0017](../adr/0017-web-session-better-auth.md) §5b |
| E7 | PayPal checkout UI chưa đo trong cụm (env dev thiếu webhook id) | [CHANGELOG 06/08 cụm A](../CHANGELOG.md) |

---

## Đã trả

Chưa có mục nào. Khi trả thì chuyển dòng xuống đây kèm hash, đừng xoá.

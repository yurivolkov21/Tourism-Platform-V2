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

| # | Nợ | Bề mặt | Trạng thái |
| --- | --- | --- | --- |
| ~~A1~~ | ~~Khu Account cần thiết kế lại~~ | `/account/*` | ✅ **trả 10/08** ([`feat/account-redesign`](../CHANGELOG.md)) rồi đập-xây-lại thành "Hộ chiếu" 11/08 (`bf20383`) |
| ~~A2~~ | ~~`textarea` lý do huỷ booking bị bỏ sót~~ | Booking detail | ✅ **trả 10/08** cùng A1 — `booking-actions.tsx` gửi `reason` thật, có trần theo `CancelBookingInputSchema.max(1000)` |
| ~~A3~~ | ~~Nợ tương phản dark chưa đóng~~ | Toàn site, chế độ tối | ✅ **trả 10/08** — và sổ này từng ghi SAI ngưỡng: 2.91/2.57 là cặp BỀ MẶT (WCAG 1.4.11, ngưỡng **3:1**), không phải chữ (4.5:1). Xem [ADR-0019](../adr/0019-color-token-roles.md) |
| ~~A4~~ | ~~Booking/checkout chưa có thiết kế~~ | Luồng booking | ✅ **trả 07/08** (`4959455`), thiết kế lại hướng B 10/08 (`05d4d1c`) |
| A5 | **Con dấu tem thư `/contact` ghi "Hà Nội · Sa Pa".** Văn phòng Sa Pa đã bị xoá khỏi dữ liệu (nay là Hà Nội + Hồ Chí Minh) nên đây là **tham chiếu mồ côi**. User chốt 06/08 **giữ nguyên** vì Sa Pa là motif truyện thương hiệu. Ghi lại để lần redesign sau không tưởng là lỗi. | `contact-split.tsx:237` | — (đã chốt giữ) |
| ~~A6~~ | ~~Khu Account phải thiết kế lại TỪ ĐẦU~~ | `/account/*` | ✅ **trả 11/08** ("Hộ chiếu", `b2959c5..bf20383`). **Bài học quy trình vẫn còn giá trị, đừng xoá:** nghe user nói "làm lại" thì phải bỏ hẳn bản cũ và dựng từ đầu — giữ khung cũ rồi vá góp ý lên trên, ba lần liên tiếp, là cách vòng đó hỏng. Lỗi này **lặp lại ở vòng Tour Details 13/08** và tốn nguyên một đợt thi công |
| ~~A7~~ | ~~Khu checkout/booking chưa bao giờ được rà cùng khu account~~ | `/checkout/*` | ✅ **trả 10/08** — hai khu rà cùng một lượt (`feat/redesign-checkout-account`) |

### A′. Nợ MỚI từ vòng Tour Details (13/08)

| # | Nợ | Bề mặt | Chặn? |
| --- | --- | --- | --- |
| A13 | **Ba thẻ chính sách cuối tab Departures bị bỏ sót ở R6** — bản duyệt có `fcard ×3`, bản ship có 0. Đã vá 14/08 (`ee051c6`). **Ghi lại vì bài học còn giá trị**: bộ so nghiệm thu R9 báo "0 lệch" mà vẫn lọt, do nó chỉ đối chiếu phần tử CÓ Ở CẢ HAI bên — phần tử app thiếu hẳn thì không có gì để so nên nó im lặng. Lần nghiệm thu sau phải có **phép đếm khối theo pane**, không chỉ bảng so thuộc tính | `/tours/[slug]` | ✅ đã vá |
| A8 | ~~**Ảnh tour vẫn rỗng**, không có lệnh nào lấp được~~ — **đường ống đã dựng xong 14/08** (nhánh `feat/media-inbox`, CHANGELOG cùng ngày): cây `media-inbox/` + 4 lệnh `media:tree`/`fetch`/`scan`/`upload`; user gửi link, máy khuân, duyệt mắt trước upload. **Nợ còn lại giờ là NỘI DUNG chứ không phải công cụ** (cập nhật cuối 17/08): 5/30 tour có cover, **9/19 địa danh có ảnh**, 5/19 địa danh có gallery, **15 khe site thì 10 đã có ảnh**, và **9/9 ảnh bìa bài viết đã đủ** (nhánh `posts/` mở 17/08). Gallery 7 thumb và nhánh HAI CỘT của `TourMediaPanel` vẫn **chưa render từ dữ liệu thật** vì chưa địa danh nào đủ ~7 ảnh | `/tours/[slug]` | 🚧 công cụ xong, còn thiếu ảnh |
| ~~A9~~ | ~~Mô tả cho bốn card dữ kiện~~ | `/tours/[slug]` | ✅ **trả 14/08** (`cacb8d5`) — 4 cột `fact*Note` + 120 câu; card nay cao **199** so với 197 của bản duyệt |
| ~~A10~~ | ~~Tiêu đề riêng cho thẻ policy~~ | `/tours/[slug]` | ✅ **trả 14/08** (`cacb8d5`) — 90 tiêu đề, mỗi cái nén câu đầu của `body`; đúng như dự đoán KHÔNG cần cột mới |
| ~~A11~~ | ~~`freeCancellationDays` trên `Tour`~~ | `/tours/[slug]` | ✅ **trả 14/08** (`cacb8d5`) — và đo được vì sao KHÔNG parse được từ `body`: regex bắt 12/29 câu, 15/30 tour ghi bằng GIỜ |
| ~~A12~~ | ~~Thu phóng trong lightbox~~ | `/tours/[slug]` | ✅ **trả 14/08** (`6e17bcc`) — thang rời 1/1.5/2/3, kéo để rê, tắt theo mặc định nên trang vùng không bị thêm nút |

**Lưu ý quan trọng cho mockup:** khu Location của `/contact` nay là **bản đồ
MapLibre thật**, không phải ô placeholder — xem [ADR-0018](../adr/0018-web-map-library.md)
và ghi chú đã thêm vào [design brief §5](../design/claude-design-brief.md).

---

## A″. Nợ MỚI 19/08 (sweep sửa lỗi)

| # | Nợ | Bề mặt | Trạng thái |
| --- | --- | --- | --- |
| ~~A14~~ | ~~Thẻ `/tours` in `basePrice` "from $129" trong khi chi tiết có đợt $119~~ | `/tours`, card khắp nơi | ✅ **trả 19/08** — contract `TourCard.priceFrom` (min effectivePrice đợt OPEN sắp tới, API tính một query/trang), card dùng `priceFrom ?? basePrice` (rơi về để API deploy sau web không vỡ trang) |
| A15 | Hero `/register` vẫn cuộn ở laptop 768p nếu mọi ô đều hiện lỗi **và** viewport < 681 | `/register` | — (đã nén tối đa trong thiết kế hiện tại; dưới đó cần đổi bố cục) |

## B. Dọn dẹp dữ liệu / nội dung

| # | Nợ | Chi tiết | Chặn? |
| --- | --- | --- | --- |
| ~~B1~~ | ~~Khối `contact.*` trong `@tourism/i18n` mồ côi TRỌN~~ | ✅ **trả 19/08** (`chore/p3b-debt-sweep`) — và mở rộng: quét mọi khoá cấp-1 của `messages` theo `messages.<khoá>` ở apps/web + libs/ui (bỏ spec) lộ **21 khối mồ côi / 774 dòng** (auth · hero · features · about · footer · fieldErrors · contact …) — nháp static-first/port Nexora đã bị thay bằng copy trong component hoặc khối mới; xoá hết. GIỮ `mobile` (P5), `chatBot`/`contactLauncher` (P6), `brand`. Nợ còn lại thuộc họ này: copy Home/user-menu đang literal trong component (luật 7) — là một "i18n sweep" riêng, không phải nợ nhỏ | — |
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
| E5 | ~~`connected-accounts` một dòng cứng~~ (đã qua i18n) · ~~`saved-grid` 401 thiếu nhánh `sessionExpired`~~ (có, có test) · ~~terminal-note "số tiền đã hoàn" không nguồn~~ (`refundedTotal` trên contract) · ~~DENIED không hiện lý do~~ (CỐ Ý — `decisionNote` không mở ra contract khách, ghi ở `booking-vm.ts`) — rà 19/08. **Còn:** `user-menu` label literal (họ "i18n sweep", xem B1) · Load-more cap 50 không lối thoát | [CHANGELOG 06/08 cụm A](../CHANGELOG.md) |
| E6 | Two-factor PARK | [ADR-0017](../adr/0017-web-session-better-auth.md) §5b |
| E7 | PayPal checkout UI chưa đo trong cụm (env dev thiếu webhook id) | [CHANGELOG 06/08 cụm A](../CHANGELOG.md) |

---

## Đã trả

Chưa có mục nào. Khi trả thì chuyển dòng xuống đây kèm hash, đừng xoá.

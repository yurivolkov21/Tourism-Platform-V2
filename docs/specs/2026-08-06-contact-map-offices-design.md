# Bản đồ thật + gom một nguồn sự thật cho thông tin liên hệ (trang /contact)

> Ngày 06/08/2026 · trạng thái: **user đã duyệt thiết kế, chờ plan**
> Liên quan: [ADR-0016 tầng dữ liệu web](../adr/0016-web-data-layer.md) ·
> [ADR-0011 kiến trúc web P3b](../adr/0011-p3b-web-architecture.md) ·
> ADR-0018 (SẼ VIẾT — thư viện bản đồ)

## 1. Vấn đề

Hai việc, phát hiện khi đối chiếu Nexora theo luật CLAUDE.md #10.

### 1a. Ba nguồn thông tin liên hệ chỏi nhau, cả ba đều live

| Nguồn | Nói gì | Hiện ở đâu |
| --- | --- | --- |
| `apps/web/src/mocks/offices.ts` | Hà Nội 12 Hàng Bạc + **Sa Pa** 45 Fansipan Road | 2 card §Location `/contact` |
| `contact-split.tsx:36` · `top-bar.tsx:17-18` | 12 Hàng Bạc · `hello@tourism.example` · `+84 24 3826 0126` | Khối info cạnh form · topbar |
| `libs/shared/i18n` (port nguyên từ Nexora) | Hà Nội 18 Tam Trinh + **Hồ Chí Minh** 184 Lê Đại Hành · `tourism.platform.online@gmail.com` · `1900 292 958` | `/terms` + `/privacy` in địa chỉ bưu chính Hồ Chí Minh |

Hệ quả đang chạy trên production build: `/contact` nói công ty ở Hà Nội và Sa
Pa, còn `/terms` của **cùng site đó** ghi trụ sở ở Hồ Chí Minh. Block
`messages.contact.offices` đã port đủ sang v2 nhưng **0 nơi trong `apps/web`
đọc** — dữ liệu mồ côi, không ai canh nên trôi tự do.

### 1b. Bản đồ là ô placeholder, nút chỉ đường là link chết

| | Nexora | v2 hiện tại |
| --- | --- | --- |
| Bản đồ | MapLibre tương tác (vendor mapcn), tile OpenFreeMap sáng/tối theo theme, marker thương hiệu có vòng ping | `ImagePlaceholder` tĩnh |
| Nút Get directions | `href={office.mapHref}` → Google Maps, `target="_blank"` | `href="#visit"` — **trỏ ngược về chính section** |
| Toạ độ | `[105.8606, 20.9895]`, chỉ Hà Nội | không có trường nào |
| Primitive | `libs/web/ui/.../map.tsx` 2177 dòng, `maplibre-gl ^5.24.0` | `@tourism/ui` 66 component, **0 component bản đồ**; toàn repo **0 dependency map** |

Chính sách ảnh static-first (`docs/README.md` dòng P3b) **không** che được chỗ
này: chính sách đó nói về ảnh/media, còn bản đồ là component **chức năng**.
Toàn bộ `docs/` v2 không có một lần nhắc `maplibre`/`mapcn`/`iframe` — nên
đây là thụt lùi chưa từng được ghi nhận, không phải "cố ý bỏ".

## 2. Quyết định user chốt (06/08)

1. **Địa chỉ theo Nexora** — Hà Nội + Hồ Chí Minh City. Khớp luôn `/terms`,
   `/privacy` và câu `officesSubtitle` đang có, nên mâu thuẫn 1a tự tan.
2. **Bản đồ MapLibre như Nexora**, 2 marker.
3. **`mocks/offices.ts` là nguồn duy nhất** — mở rộng type, đúng ADR-0016
   (đã chốt `offices` sống tiếp như nội dung biên tập tĩnh, không endpoint).
4. **Email theo Nexora** (`tourism.platform.online@gmail.com`);
   **điện thoại GIỮ `+84 24 3826 0126`** — `1900 292 958` là hotline thật đang
   hoạt động của VTC Academy, site demo không được in số đó.
5. Trường `name`: `'Headquarters'` / `'Ho Chi Minh City office'`.

## 3. Dữ liệu — `mocks/offices.ts`

`MockOffice` thêm 2 trường bắt buộc:

```ts
export interface MockOffice {
  city: string;
  name: string;
  addressLines: string[];
  hours: string;
  /** [kinh độ, vĩ độ] — thứ tự của MapLibre, KHÔNG phải [lat, lng] */
  coords: [number, number];
  /** Link Google Maps mở tab mới cho nút Get directions */
  mapHref: string;
}
```

Giá trị chốt:

| Trường | Hà Nội | Hồ Chí Minh |
| --- | --- | --- |
| `city` | `Hà Nội` | `Hồ Chí Minh City` |
| `name` | `Headquarters` | `Ho Chi Minh City office` |
| `addressLines` | `['18 Tam Trinh, Tương Mai', 'Hà Nội, Vietnam']` | `['184 Lê Đại Hành, Phú Thọ', 'Hồ Chí Minh City, Vietnam']` |
| `hours` | `Mon–Fri · 8:00 am – 6:00 pm (GMT+7)` | giống Hà Nội |
| `coords` | `[105.8618052, 20.9949485]` | `[106.6556413, 10.7646196]` |
| `mapHref` | `https://www.google.com/maps?q=18+Tam+Trinh,+Tuong+Mai,+Ha+Noi` | `https://www.google.com/maps?q=184+Le+Dai+Hanh,+Phu+Tho,+Ho+Chi+Minh` |

**Nguồn toạ độ**: tra OpenStreetMap Nominatim, cả hai đều trúng bản ghi *toà
nhà* chứ không phải điểm giữa đường — `Tòa nhà VTC Online, 18, Đường Tam Trinh`
(`class=building`, `type=office`) và `The Emporium Lê Đại Hành, 184, Đường Lê
Đại Hành`. Cùng nguồn dữ liệu với tile OpenFreeMap sẽ render, nên pin rơi đúng
toà nhà.

**KHÔNG port toạ độ Nexora**: `[105.8606, 20.9895]` trong `contact-map.tsx` của
Nexora lệch ~600m khỏi toà VTC Online — chấm bằng mắt, không phải geocode.

Không ghi số tầng ("Tầng 4"/"Tầng 5" của VTC Academy) — đây là công ty tour hư
cấu mượn địa chỉ toà nhà, số tầng của trường sẽ thừa và sai ngữ cảnh.

## 4. Component bản đồ

### 4a. Vị trí và phạm vi port

Đặt tại **`apps/web/src/components/contact/contact-map.tsx`**, KHÔNG nhét vào
`@tourism/ui`. Lý do: chỉ một trang dùng, và để `maplibre-gl` nằm trong
`apps/web/package.json` thay vì ghim vào lib dùng chung. Nâng lên
`@tourism/ui` khi nào admin/mobile thật sự cần bản đồ.

~~Chỉ port **4/14 primitive** mà `/contact` Nexora thật sự tiêu thụ — `Map`,
`MapMarker`, `MarkerContent`, `MapControls`. Không bê 2177 dòng.~~ **AMENDED
06/08 (lúc lập plan, trước khi code)**: đọc source thật
`libs/web/ui/src/components/ui/map.tsx` thấy 4 primitive đó vẫn kéo theo
~700 dòng máy móc tổng quát không dùng tới (basemap trong suốt, `projection`,
viewport có kiểm soát, popup/tooltip/label, nút la bàn + định vị + toàn màn
hình). Quyết định cuối: **viết riêng ~180 dòng dùng thẳng `maplibre-gl`**,
KHÔNG port primitive nào — xem [ADR-0018](../adr/0018-web-map-library.md) và
mục "Sai lệch có chủ đích so với spec §4a" ở đầu
[plan](../plans/2026-08-06-contact-map-offices.md). Thực tế đã ship đúng theo
quyết định này.

### 4b. Hành vi

- Tile OpenFreeMap `positron` (sáng) / `dark` (tối), đổi theo theme. Miễn phí,
  không API key — Nexora chọn nó thay basemap CARTO mặc định của mapcn vì
  CARTO cần licence thương mại. Giữ nguyên lý do đó.
- `scrollZoom={false}` + `dragRotate={false}` — bản đồ không cướp cuộn trang.
- **2 marker + `fitBounds`** thay `center`/`zoom` cứng. Hà Nội ↔ Hồ Chí Minh
  cách ~1150km; zoom cứng sẽ mất một đầu. `fitBounds` cho ra bản đồ hình chữ S
  với 2 pin hai đầu — hợp công ty tour Việt Nam hơn map một-thành-phố của
  Nexora. Nếu primitive `Map` port sang không có prop `bounds`, gọi
  `map.fitBounds()` trong effect qua `useMap()`.
- Marker dùng token (`bg-primary`, `text-primary-foreground`, `ring-background`)
  — luật CLAUDE.md #6, không hex. Vòng ping có `motion-reduce:hidden`.
- Nạp y hệt Nexora: `dynamic(() => import('./contact-map'), { ssr: false })` +
  skeleton pulse, bọc `IntersectionObserver` `rootMargin: '200px'` — chunk map
  không tải cho khách không cuộn tới §Location.

**Lưu ý bố cục**: §Location của v2 có `AnimatedGridPattern` làm nền và nội dung
bọc trong `div` `z-10`. Bản đồ phải nằm trong lớp `z-10` đó, không để nền lưới
động đè lên hoặc chọc thủng khung bo `rounded-2xl`.

**Điểm URL bên ngoài vs luật token**: style URL của MapLibre là JSON host bởi
OpenFreeMap, không biểu diễn được bằng `@tourism/tokens`. Đây là ngoại lệ có
chủ đích, ghi vào ADR-0018 — mọi thứ ta tự vẽ đè lên (marker, control) vẫn
tuyệt đối dùng token.

## 5. Hạ tầng phải đụng

| Việc | Vì sao |
| --- | --- |
| **ADR-0018** viết **TRƯỚC** code | Luật CLAUDE.md #5. Nội dung: chọn MapLibre + OpenFreeMap, lý do không dùng iframe, ngoại lệ token cho style URL, tiền lệ mock thư viện render nặng, ràng buộc freeze 15/10 |
| `IntersectionObserver` stub vào `apps/web/vitest.setup.ts` | jsdom không hiện thực nó; setup hiện chỉ vá `matchMedia`/`ResizeObserver`/`elementFromPoint` |
| `vi.mock('./contact-map')` trong spec §Location | jsdom không có WebGL. **Repo chưa từng mock thư viện render nặng nào** (recharts/embla/lenis/motion đều test thật) — tiền lệ đầu tiên, ghi rõ trong ADR-0018 |
| `import 'maplibre-gl/dist/maplibre-gl.css'` | Đặt trong chính `contact-map.tsx`. v2 dùng subpath exports, không có barrel, nên CSS không lây sang trang khác — Nexora phải khai `sideEffects` vì barrel kéo `maplibre-gl` vào **mọi** trang, khiến 3 spec phải `jest.mock('@tourism/ui')`. v2 miễn nhiễm, giữ vậy |
| Reset DOM nội bộ maplibre | Nexora reset `.maplibregl-popup-*` trong globals.css. Ta chỉ dùng marker + control nên rà xem cần tối thiểu những gì, đừng copy cả khối |

## 6. Vá kèm để hết mâu thuẫn (cùng branch)

| File | Sửa gì |
| --- | --- |
| `contact-location.tsx:100` | `href="#visit"` (link chết) → `office.mapHref` + `target="_blank"` + `rel="noopener noreferrer"` |
| `contact-location.tsx:49-61` | `ImagePlaceholder` → `<ContactMap />` lazy |
| `contact-split.tsx:36` | Bỏ hằng `LOCATION` hardcode, đọc `OFFICES[0]` (trụ sở Hà Nội) |
| `home/contact.tsx:27` | `EMAIL` → `tourism.platform.online@gmail.com`. `PHONE` giữ nguyên |
| `top-bar.tsx:17-18` | ~~Bỏ khai lại `EMAIL`/`PHONE`, **import từ `home/contact`** — đúng quy ước đã chốt 24/07 ("export EMAIL/PHONE từ home/contact thay vì nhân bản"), top-bar là chỗ duy nhất còn sót~~ **AMENDED 06/08 (lúc triển khai)**: import từ `home/contact` làm `next build` vỡ ở prerender — module đó có `'use client'`, mà `top-bar.tsx` là Server Component; Server Component import bất kỳ export nào từ module `'use client'` chỉ nhận về client-reference proxy chứ không phải giá trị gốc, nên `PHONE.replace(...)` ném `TypeError` lúc prerender, giết mọi trang tĩnh. Vá đúng: tách `EMAIL`/`PHONE` sang module thường mới **`apps/web/src/lib/site.ts`** (không `'use client'`); cả `top-bar.tsx` lẫn `home/contact.tsx` cùng import từ đó. Chi tiết cơ chế ghi ở comment đầu `lib/site.ts` (commit `76720c5`) |
| `libs/shared/i18n/.../messages.ts:1442` · `:1503` · `:2018` | `1900 292 958` → `+84 24 3826 0126` |
| `libs/shared/i18n/.../legal/terms.ts:131` · `legal/privacy.ts:105` | như trên (địa chỉ bưu chính Hồ Chí Minh giữ nguyên — nay đã khớp) |
| `libs/shared/i18n/.../messages.ts` block `contact` | Xoá `offices` / `getDirections` / `officesSubtitle` mồ côi để không còn hai bản dữ liệu văn phòng |

Heading `"Two doors, always open."` **giữ nguyên** — vẫn đúng với 2 văn phòng.

## 7. Test

- `mocks.spec.ts` — siết test `offices` hiện có (đang chỉ kiểm `toHaveLength(2)`
  và các trường non-empty): thêm kiểm `coords` là cặp số trong khung Việt Nam
  (kinh độ 102–110, vĩ độ 8–24) và `mapHref` bắt đầu bằng `https://`.
  Test hiện tại lỏng nên thêm trường **không** phá gì.
- `contact-location.spec.tsx` — **spec mới** (hiện chưa có): mock `contact-map`,
  khẳng định render đúng 2 card, mỗi card có link chỉ đường trỏ `mapHref` đúng
  và mở tab mới. Đây là test chặn tái diễn link chết.
- Không viết test cho `contact-map.tsx` — nó là vỏ mỏng bọc MapLibre, test dưới
  jsdom chỉ kiểm được cái mock của chính mình.
- TDD trên logic thuần theo luật #4; phần render bản đồ không thuộc diện đó.

## 8. Ngoài phạm vi

Đều là thụt lùi thật so với Nexora nhưng lệch khỏi việc user giao — ghi lại để
không quên:

- JSON-LD `PostalAddress` / `Organization` (Nexora có `json-ld.tsx`, v2 không có).
- Khối "Office hours / Offices / Call us / Email us" ở footer (Nexora có qua
  `messages.contact.info`; v2 footer chỉ có link, newsletter, social).
- `CONTACT_LINE` trong template email API (Nexora `email.templates.ts:109`).
- Kênh WhatsApp env-driven (`NEXT_PUBLIC_CHAT_WHATSAPP`).
- Gom `EMAIL`/`PHONE`/địa chỉ thành `site-config` dùng chung — user đã cân nhắc
  và chọn không làm ở vòng này.

## 9. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| `maplibre-gl` là dependency nặng, freeze 15/10/2026 khoá version | Ghim version chính xác trong ADR-0018; thêm trước freeze còn kịp vá |
| Mock WebGL là tiền lệ đầu trong repo | Giới hạn mock đúng một module `contact-map`, không mock cả `@tourism/ui` như Nexora phải làm |
| OpenFreeMap là dịch vụ tile miễn phí của bên thứ ba, có thể chết | Chấp nhận — capstone không doanh thu. Nếu tile chết thì khung map vẫn còn, chỉ nền trắng; cân nhắc `onError` về `ImagePlaceholder` |
| Toạ độ OSM có thể lệch nếu toà nhà bị vẽ lại | Đã đối chiếu tên toà nhà khớp chính xác cả hai; ghi nguồn vào comment để sau này truy được |
| Ward trong OSM cho Emporium ghi "Phường Minh Phụng, Thủ Đức" (dữ liệu OSM cũ sau sáp nhập 2025) | Dùng "Phú Thọ" theo Nexora và theo trang chính thức — chỉ lấy toạ độ từ OSM, không lấy tên hành chính |

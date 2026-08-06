# ADR-0018 — Bản đồ web: `maplibre-gl` pin `5.24.0` + tile OpenFreeMap

> ⚠️ **Mục 4 và "Hệ quả" AMENDED 06/08 (cùng nhánh, trước merge — review cuối
> phát hiện):** hai chỗ ghi quyết định mà code KHÔNG thi hành. Mục 4 nói
> "chỉ port đúng 4/14 primitive" nhưng `contact-map.tsx` đã ship KHÔNG port
> primitive nào — viết riêng, gọi thẳng API `maplibre-gl`. "Hệ quả" nói cần
> thêm stub `IntersectionObserver` vào `vitest.setup.ts` nhưng đó chính là
> việc đã thử và HOÀN TÁC sau khi đo (19 test ở 3 file khác gãy) — stub nằm
> CỤC BỘ trong spec. Xem đánh dấu AMENDED tại từng mục bên dưới; quyết định
> gốc vẫn giữ nguyên câu chữ, không xoá dấu vết.

- **Trạng thái:** Accepted (2026-08-06)
- **Bối cảnh thi hành:** nhánh `feat/contact-map-offices`, đi trước code theo
  luật CLAUDE.md #5
- **Liên quan:** [spec 06/08 bản đồ + gom nguồn liên hệ](../specs/2026-08-06-contact-map-offices-design.md) ·
  [ADR-0016](0016-web-data-layer.md) (`mocks/offices.ts` sống tiếp như nội
  dung biên tập tĩnh) · [ADR-0011](0011-p3b-web-architecture.md) (Biome
  không ESLint, `@tourism/ui` là lib UI dùng chung web+admin)

## Bối cảnh

`/contact` §Location hiện render `ImagePlaceholder` tĩnh thay bản đồ — đúng
chính sách "toàn site dùng `ImagePlaceholder`, chỉ đổi ảnh thật khi user yêu
cầu riêng" ghi ở `docs/README.md` dòng P3b Web. Nhưng chính sách đó nói về
**ảnh/media**; bản đồ ở đây là component **chức năng** (marker, zoom, nút chỉ
đường), không phải nội dung chờ ảnh thật — chính sách static-first không che
được chỗ này. Đối chiếu Nexora (luật CLAUDE.md #10) lộ đây là thụt lùi chưa
từng được ghi nhận: `/contact` của Nexora có bản đồ MapLibre tương tác thật
(vendor mapcn, `libs/web/ui/.../map.tsx`, 2177 dòng), tile OpenFreeMap
sáng/tối theo theme, marker thương hiệu có vòng ping; toàn bộ `docs/` v2
trước ADR này không có một lần nhắc `maplibre`/`mapcn`/`iframe`.

Nút "Get directions" đi kèm cũng là link chết (`href="#visit"`, trỏ ngược về
chính section) — vá cùng nhánh này nhưng không phải phần ADR quyết định
(xem spec §6).

## Quyết định

### 1. `maplibre-gl` — pin chính xác `5.24.0`, không caret

Cài vào `apps/web/package.json`: `"maplibre-gl": "5.24.0"` (KHÔNG `^5.24.0`).
Đây đúng là version Nexora ghim (`libs/web/ui/package.json`) và đã đo resolve
thật trong `node_modules/.pnpm/maplibre-gl@5.24.0` của repo đó — biết chắc nó
tồn tại và chạy được, không phải version suy đoán. Pin chính xác (không
caret) vì freeze 15/10/2026 khoá version phụ thuộc (xem §Ràng buộc lịch bên
dưới) — không có nhu cầu nhận minor/patch tự động trong quãng ngắn còn lại
tới freeze, và một con số cụ thể là thứ tái lập được 1-1 khi ai đó `pnpm
install` lại từ đầu.

Task này (Task 1 của plan) chỉ ghi quyết định — KHÔNG cài dependency; Task 3
mới thêm vào `package.json` và chạy `pnpm install`.

### 2. Tile: OpenFreeMap, không phải CARTO mặc định của mapcn

```text
light: https://tiles.openfreemap.org/styles/positron
dark:  https://tiles.openfreemap.org/styles/dark
```

mapcn (nguồn primitive `Map` mà Nexora vendor) mặc định trỏ CARTO
(`basemaps.cartocdn.com/gl/{positron,dark-matter}-gl-style/style.json`).
Nexora đã chủ động đổi sang OpenFreeMap — comment gốc trong
`contact-map.tsx` của họ ghi rõ: CARTO "needs a commercial licence" cho việc
dùng thương mại, còn OpenFreeMap free, không cần API key, cùng dữ liệu
OpenStreetMap. v2 giữ nguyên lý do đó, không tự đặt lại vấn đề.

### 3. Vì sao không dùng `<iframe>` nhúng Google Maps/OpenStreetMap

Đây là lựa chọn rẻ hơn về effort nhưng bị loại:

- **Không theo được theme sáng/tối** — iframe là tài liệu độc lập, không có
  cách truyền `class="dark"` của `<html>` vào bên trong; site sẽ có một ô bản
  đồ sáng chọc giữa nền tối, ngược mọi nguyên tắc còn lại của trang.
- **Không style được theo token** — không vẽ marker bằng `bg-primary`/
  `text-primary-foreground` theo luật CLAUDE.md #6, không kiểm soát được
  border-radius/khung khớp `rounded-2xl` của §Location.
- **Nhúng script bên thứ ba không kiểm soát được** — iframe Google Maps tải
  script ngoài tầm quản lý CSP/bundle của ta, khác hẳn mô hình "mọi
  dependency đi qua `pnpm` + lockfile" mà repo đang giữ.

Nexora đã đứng trước lựa chọn này và chủ động bỏ iframe để thay bằng MapLibre
thật — v2 kế thừa quyết định đó, không tự đặt lại vấn đề.

### 4. Viết riêng `contact-map.tsx` trong `apps/web`, KHÔNG port primitive nào của mapcn vào `@tourism/ui`

Đặt tại `apps/web/src/components/contact/contact-map.tsx`.

~~Chỉ port đúng 4/14 primitive mà `/contact` Nexora thật sự tiêu thụ — `Map`,
`MapMarker`, `MarkerContent`, `MapControls` — không bê nguyên 2177 dòng
`map.tsx` (popup, GeoJSON layer, choropleth, `blank` style, imperative
handle… những thứ `/contact` không dùng).~~

**AMENDED 06/08 (lúc lập plan, trước khi viết code — xem
[plan](../plans/2026-08-06-contact-map-offices.md) mục "Sai lệch có chủ đích
so với spec §4a")**: đọc source thật `libs/web/ui/src/components/ui/map.tsx`
lộ ra 4 primitive đó vẫn kéo theo ~700 dòng máy móc tổng quát mà `/contact`
không dùng tới — basemap trong suốt, `projection`, viewport có kiểm soát,
popup/tooltip/label, nút la bàn + định vị + toàn màn hình. Port dù chỉ 4/14
vẫn là bê nguyên phần khung tổng quát đó vào, không né được cái giá đang
muốn né. Quyết định cuối: **viết riêng 146 dòng dùng thẳng API của
`maplibre-gl`, KHÔNG port một primitive nào** — `Map`/`MapMarker`/
`MarkerContent`/`MapControls` không tồn tại ở đâu trong `apps/web`, giữ
nguyên mọi hành vi spec yêu cầu. Code đã ship đúng quyết định này
(`contact-map.tsx`, đo bằng `wc -l` = 146).

Không nhét vào `@tourism/ui` (lib dùng chung web+admin) vì hiện chỉ một
trang tiêu thụ; đặt `maplibre-gl` trong `apps/web/package.json` thay vì ghim
vào lib chung giữ đúng biên giới dependency theo trang. Nâng lên
`@tourism/ui` là việc của khi admin/mobile thật sự cần bản đồ — YAGNI cho
tới lúc đó.

### 5. Ngoại lệ luật token: URL style là JSON host ngoài

Luật CLAUDE.md #6 ("Frontend: tokens-only, không hex") áp cho mọi giá trị
màu/kích thước ta tự định nghĩa. URL style OpenFreeMap (`https://tiles.
openfreemap.org/styles/positron` / `/dark`) trỏ tới một **tài liệu JSON style
host bởi bên thứ ba** — nó không phải giá trị thiết kế của ta, không thể
biểu diễn bằng `@tourism/tokens` (token sinh CSS variable, không sinh URL).
Đây là ngoại lệ có chủ đích, phạm vi hẹp: hai hằng chuỗi URL. Mọi thứ ta tự
vẽ đè lên bản đồ (marker, nút zoom, control) vẫn tuyệt đối dùng token —
`bg-primary`, `text-primary-foreground`, `ring-background` cho marker theo
đúng luật #6, không có ngoại lệ ở lớp đó.

### 6. Tiền lệ mock đầu tiên cho thư viện render nặng — phạm vi hẹp

Repo chưa từng `vi.mock` một thư viện render nặng: recharts, embla, lenis,
motion đều được test thật dưới jsdom cho tới nay. `maplibre-gl` khác — nó
cần WebGL, thứ jsdom không hiện thực; test thật sẽ throw ngay khi gọi `new
MapLibreGL.Map(...)`. `contact-location.spec.tsx` (spec mới, xem spec §7) vì
vậy sẽ `vi.mock('./contact-map')`.

**Phạm vi bắt buộc hẹp**: chỉ mock đúng module `contact-map`, KHÔNG mock cả
`@tourism/ui` như Nexora buộc phải làm. Nexora vendor `Map`/`MapMarker`/…
vào barrel `@tourism/ui` (họ dùng tên package trùng) nên import `maplibre-gl`
lọt vào **mọi** trang qua barrel đó; hệ quả đo được: ít nhất 9 spec phía
Nexora (`change-email-form.spec.tsx`, `auth-form-field.spec.tsx`,
`password-field.spec.tsx`, `testimonials.spec.tsx`, `trust-band.spec.tsx`,
`review-card.spec.tsx`, `see-all-reviews.spec.tsx`, `floating-contact.spec.tsx`,
`chat-panel.spec.tsx` — không cái nào liên quan tới bản đồ) phải
`jest.mock('@tourism/ui', () => ({ ... }))` chỉ để né maplibre-gl nạp khi
test những component khác trong cùng barrel; họ còn phải khai `sideEffects`
trong `package.json` để tree-shake CSS. v2 không có barrel (subpath exports
theo ADR-0011), `contact-map.tsx` chỉ được import trực tiếp từ đúng một chỗ
(`contact-location.tsx` qua `dynamic(..., { ssr: false })`), nên mock của nó
không lây sang bất kỳ spec nào khác. Tiền lệ này KHÔNG mở đường mock các thư
viện render khác đã và đang test thật.

### 7. Attribution là ràng buộc licence, không phải chi tiết UI

Dữ liệu bản đồ đến từ OpenStreetMap qua tile OpenFreeMap — licence ODbL của
OSM bắt buộc hiện attribution. Giữ nguyên `AttributionControl` mặc định của
MapLibre (bật sẵn khi dựng `Map`, không truyền `attributionControl: false`).
Đây không phải điểm thẩm mỹ tuỳ chọn — tắt attribution là vi phạm licence dữ
liệu, không được đánh đổi vì lý do "gọn UI".

### 8. `scrollZoom={false}` + `dragRotate={false}`, 2 marker + `fitBounds`

Bản đồ không được cướp cuộn trang khi khách lướt qua §Location — tắt
`scrollZoom` và `dragRotate`, giữ zoom bằng nút bấm (`MapControls`). Hai văn
phòng Hà Nội ↔ Hồ Chí Minh cách ~1150km nên dùng `fitBounds` với cả hai toạ
độ thay `center`/`zoom` cứng của Nexora (bản đồ một-thành-phố) — zoom cứng
sẽ luôn mất một đầu. Chi tiết toạ độ, `mapHref`, và các trường mở rộng của
`MockOffice` không thuộc phạm vi ADR này — xem spec §3.

## Ràng buộc lịch

Freeze 15/10/2026 khoá version dependency (chính sách capstone, xem
`CLAUDE.md`). Thêm `maplibre-gl` bây giờ (06/08) còn hơn hai tháng trước
freeze — đủ thời gian để lộ và vá lỗi nếu version pin có vấn đề trên môi
trường build/deploy thật, trước khi cửa sổ nâng cấp đóng lại.

## Hệ quả

- `apps/web` nặng thêm một chunk lazy chứa `maplibre-gl` (~200KB gzip theo
  kinh nghiệm thư viện). Chunk chỉ tải khi khách cuộn tới §Location của
  `/contact`, nhờ `dynamic(() => import('./contact-map'), { ssr: false })`
  bọc trong `IntersectionObserver` (`rootMargin: '200px'`) — không tải cho
  khách không bao giờ cuộn tới đó, không chặn `next build` hay ISR của các
  trang khác.
- ~~`apps/web/vitest.setup.ts` cần thêm stub `IntersectionObserver` — jsdom
  không hiện thực API này, setup hiện tại mới vá `matchMedia`/
  `ResizeObserver`/`elementFromPoint`.~~ **AMENDED 06/08 (lúc triển khai Task
  4)**: đã thử đúng việc này và HOÀN TÁC sau khi đo — dời stub (cả bản no-op
  lẫn bản báo-ngay `isIntersecting`) lên `vitest.setup.ts` làm **19 test ở 3
  file khác gãy**, vì có global `IntersectionObserver` thì framer-motion đi
  nhánh khác hẳn so với khi không có (cùng phát hiện đã ghi ở
  `apps/web/src/components/destinations/region-group.spec.tsx:12-16`). jsdom
  vẫn không hiện thực API này nên polyfill vẫn cần, chỉ khác phạm vi: stub
  đặt CỤC BỘ trong `contact-location.spec.tsx`, không đụng file setup chung.
- `import 'maplibre-gl/dist/maplibre-gl.css'` đặt ngay trong
  `contact-map.tsx` (không phải file global) — vì v2 dùng subpath exports
  không có barrel, CSS này không lây sang trang khác qua import chain, khác
  hẳn Nexora phải khai `sideEffects` để chặn tree-shake xoá mất nó.
- Đây là dependency map đầu tiên của toàn repo (`grep maplibre` hiện ra 0 hit
  ngoài repo Nexora tham chiếu) — không có primitive bản đồ nào khác cạnh
  tranh hoặc trùng lặp cần dọn.
- Test coverage của `contact-map.tsx`: không viết test cho chính nó (vỏ mỏng
  bọc MapLibre, test dưới jsdom chỉ kiểm được cái mock của chính mình — luật
  TDD #4 áp cho logic thuần, không áp cho phần render bản đồ này). Logic
  thuần liên quan (toạ độ, `mapHref`) vẫn theo TDD trong `mocks.spec.ts`.

## Đã cân nhắc và loại

- **`<iframe>` Google Maps/OSM** — loại vì không theo theme, không style
  token, script bên thứ ba ngoài tầm quản lý (xem mục 3).
- **Basemap CARTO mặc định của mapcn** — cần licence thương mại (xem mục 2).
- **Port nguyên `map.tsx` 2177 dòng, hoặc chỉ 4/14 primitive nó có, vào
  `@tourism/ui`** — cả hai đều quá tải cho một trang tiêu thụ: ngay cả 4/14
  primitive cũng kéo theo ~700 dòng máy móc tổng quát không dùng tới (mục 4,
  AMENDED 06/08); nâng cấp lên lib dùng chung khi có consumer thứ hai thật sự
  cần.
- **`vi.mock('@tourism/ui')` toàn barrel như Nexora buộc phải làm** — không
  cần thiết ở v2 vì kiến trúc subpath exports đã tránh được vấn đề gốc
  (barrel kéo maplibre-gl vào mọi trang); mock rộng hơn phạm vi cần thiết chỉ
  làm loãng độ chính xác của test các component khác (xem mục 6).
- **Tắt `AttributionControl` để UI gọn hơn** — vi phạm licence ODbL của dữ
  liệu OSM, không đánh đổi được (xem mục 7).

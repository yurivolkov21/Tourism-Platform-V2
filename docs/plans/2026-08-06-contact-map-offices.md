# Bản đồ thật `/contact` + gom một nguồn sự thật liên hệ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay ô placeholder bản đồ trên `/contact` bằng bản đồ MapLibre thật 2 marker (Hà Nội + Hồ Chí Minh), đồng thời gom ba nguồn thông tin liên hệ đang chỏi nhau về một nguồn duy nhất.

**Architecture:** `mocks/offices.ts` là nguồn sự thật duy nhất (đúng [ADR-0016](../adr/0016-web-data-layer.md) — `offices` sống tiếp như nội dung biên tập tĩnh, không endpoint). Component bản đồ **viết riêng cho `/contact`**, đặt trong `apps/web`, dùng thẳng API của `maplibre-gl` — KHÔNG port lớp primitive tổng quát của Nexora. Nạp lười: `dynamic(ssr:false)` + `IntersectionObserver` để chunk map không tải cho khách không cuộn tới.

**Tech Stack:** Next.js 16.3.0 · React 19.2.4 · `maplibre-gl` 5.24.0 (MỚI) · tile OpenFreeMap · Vitest 4.1.10 + jsdom · Tailwind v4 + `@tourism/tokens`.

## Global Constraints

Áp cho MỌI task, không nhắc lại trong từng task:

- **Comment code bằng tiếng Việt** (luật CLAUDE.md #8) — cả `//` lẫn JSDoc. Tên biến/hàm/identifier vẫn tiếng Anh.
- **Copy user-facing bằng tiếng Anh** (luật #7) — nhãn nút, `aria-label`, nội dung nhìn thấy được.
- **Tokens-only, KHÔNG hex** (luật #6) — dùng class token (`bg-primary`, `text-primary-foreground`, `ring-border`…). Ngoại lệ DUY NHẤT đã ghi trong [spec §4b](../specs/2026-08-06-contact-map-offices-design.md): URL style JSON của OpenFreeMap.
- **Commit: Conventional Commits, message tiếng Việt CÓ DẤU đầy đủ** (luật #12); type/scope giữ tiếng Anh. **KHÔNG AI attribution** — sau mỗi commit chạy `git log -1 --format=%B` và nếu thấy trailer `Co-Authored-By` thì `git commit --amend` bỏ đi.
- **`noUncheckedIndexedAccess` đang BẬT** — `arr[0]` có kiểu `T | undefined`. Đừng truy cập theo chỉ số; dùng `for...of`, `.map()`, hoặc destructure-with-default.
- **Nhánh:** toàn bộ plan chạy trên `feat/contact-map-offices` (luật #1). Tạo ở Task 1.
- **KHÔNG sửa gì trong repo Nexora** (`/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform`) — tham chiếu chỉ đọc.
- **Trước khi bắt tay mỗi task, rà [docs/skills.md](../skills.md)** xem có skill phủ đúng việc không (luật #9).

### Sai lệch có chủ đích so với spec §4a

Spec viết "port 4/14 primitive từ Nexora". Khi đọc source thật
(`libs/web/ui/src/components/ui/map.tsx`) thấy 4 primitive đó vẫn kéo theo
~700 dòng máy móc tổng quát ta không dùng: basemap trong suốt, `projection`,
viewport có kiểm soát, popup/tooltip/label, nút la bàn + định vị + toàn màn
hình. **Quyết định: viết riêng ~180 dòng dùng thẳng `maplibre-gl`**, giữ
nguyên mọi hành vi spec yêu cầu. Phần DUY NHẤT bê nguyên từ Nexora là hook
dò theme (`useResolvedTheme`) — nó theo dõi class `.dark` trên
`documentElement`, đúng y cơ chế đổi theme của v2 (`app/layout.tsx:54` +
`AnimatedThemeToggler`), nên không viết lại được gọn hơn.

---

## Danh sách file

| File | Trách nhiệm | Task |
| --- | --- | --- |
| `docs/adr/0018-web-map-library.md` | **Tạo** — quyết định thư viện bản đồ | 1 |
| `apps/web/src/mocks/types.ts` | **Sửa** — `MockOffice` thêm `coords` + `mapHref` | 2 |
| `apps/web/src/mocks/offices.ts` | **Sửa** — dữ liệu 2 văn phòng theo Nexora + toạ độ OSM | 2 |
| `apps/web/src/mocks/mocks.spec.ts` | **Sửa** — siết test `offices` | 2 |
| `apps/web/src/lib/use-resolved-theme.ts` | **Tạo** — hook dò theme sáng/tối | 3 |
| `apps/web/src/components/contact/contact-map.tsx` | **Tạo** — bản đồ MapLibre, client-only | 3 |
| `apps/web/package.json` | **Sửa** — thêm `maplibre-gl` | 3 |
| `apps/web/vitest.setup.ts` | **Sửa** — stub `IntersectionObserver` | 4 |
| `apps/web/src/components/contact/contact-location.tsx` | **Sửa** — lắp map lười + vá link chết | 4 |
| `apps/web/src/components/contact/contact-location.spec.tsx` | **Tạo** — spec đầu tiên cho section này | 4 |
| `apps/web/src/components/contact/contact-split.tsx` | **Sửa** — bỏ `LOCATION` hardcode | 5 |
| `apps/web/src/components/home/contact.tsx` | **Sửa** — `EMAIL` | 5 |
| `apps/web/src/components/top-bar.tsx` | **Sửa** — import EMAIL/PHONE thay vì khai lại | 5 |
| `libs/shared/i18n/src/lib/messages.ts` | **Sửa** — điện thoại + xoá block `offices` mồ côi | 5 |
| `libs/shared/i18n/src/lib/legal/terms.ts` · `legal/privacy.ts` | **Sửa** — điện thoại | 5 |
| `docs/CHANGELOG.md` · `docs/README.md` | **Sửa** — docs sweep | 6 |

---

## Task 1: ADR-0018 — chốt thư viện bản đồ

Luật CLAUDE.md #5 bắt **ADR đi TRƯỚC code**. Task này không đụng code.

**Files:**
- Create: `docs/adr/0018-web-map-library.md`
- Modify: `docs/README.md` (bảng ADR)

**Interfaces:**
- Consumes: không có (task đầu)
- Produces: quyết định `maplibre-gl@5.24.0` pin chính xác + tile OpenFreeMap — Task 3 cài đúng version này

- [ ] **Step 1: Tạo nhánh**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/contact-map-offices
```

- [ ] **Step 2: Viết ADR**

Tạo `docs/adr/0018-web-map-library.md`. Theo đúng khuôn các ADR hiện có (đọc `docs/adr/0016-web-data-layer.md` làm mẫu về giọng văn + độ chi tiết). Nội dung BẮT BUỘC có:

- **Bối cảnh**: `/contact` đang là `ImagePlaceholder`; Nexora có map thật; chính sách ảnh static-first không che chỗ này vì bản đồ là component *chức năng* không phải *media*.
- **Quyết định**: `maplibre-gl` **pin chính xác `5.24.0`** (không caret) + tile OpenFreeMap `https://tiles.openfreemap.org/styles/positron` (sáng) / `.../dark` (tối).
- **Vì sao không dùng `<iframe>` Google/OSM**: không theo được theme sáng/tối, không style được theo token, nhúng script bên thứ ba. Nexora đã chủ động bỏ iframe để thay bằng MapLibre.
- **Vì sao OpenFreeMap chứ không phải basemap CARTO mặc định của mapcn**: CARTO cần licence thương mại.
- **Vì sao viết riêng chứ không port primitive mapcn**: xem "Sai lệch có chủ đích" ở đầu plan này.
- **Ngoại lệ luật token**: URL style là JSON host ngoài, không biểu diễn được bằng `@tourism/tokens`. Mọi thứ ta tự vẽ đè lên (marker, nút zoom) vẫn dùng token tuyệt đối.
- **Tiền lệ mới**: đây là lần đầu repo `vi.mock` một thư viện render nặng (jsdom không có WebGL). Ghi rõ phạm vi: chỉ mock đúng module `contact-map`, KHÔNG mock cả `@tourism/ui` như Nexora buộc phải làm.
- **Attribution là ràng buộc licence**: dữ liệu OpenStreetMap bắt buộc hiện attribution — giữ `AttributionControl` mặc định của MapLibre, không tắt.
- **Ràng buộc lịch**: freeze 15/10/2026 khoá version; thêm bây giờ còn kịp vá nếu lỗi.
- **Hệ quả**: `apps/web` nặng thêm một chunk lazy; chunk chỉ tải khi khách cuộn tới §Location của `/contact`.

- [ ] **Step 3: Thêm ADR vào bản đồ docs**

Trong `docs/README.md`, bảng ADR (quanh dòng 36–42, cạnh dòng `0017`), thêm một dòng cho `0018-web-map-library` — mô tả một câu, theo đúng giọng các dòng đang có.

- [ ] **Step 4: Kiểm tra dấu tiếng Việt + không có `+` đầu dòng**

`docs/CHANGELOG.md` có luật riêng về dấu `+` cột 0 (xem CLAUDE.md), nhưng task này không đụng CHANGELOG. Vẫn xem diff .md trước khi stage:

```bash
git diff docs/
```
Expected: chỉ có ADR mới + 1 dòng thêm vào `docs/README.md`. Không có dòng nào trong file cũ bị formatter đổi `+` thành `-` hay chèn dòng trắng.

- [ ] **Step 5: Commit**

```bash
git add docs/adr/0018-web-map-library.md docs/README.md
git commit -m "docs(adr): ADR-0018 chốt maplibre-gl + tile OpenFreeMap cho bản đồ /contact"
git log -1 --format=%B
```
Expected: message hiện đúng, KHÔNG có dòng `Co-Authored-By`. Nếu có → `git commit --amend` bỏ đi.

---

## Task 2: Dữ liệu văn phòng — một nguồn sự thật

TDD (luật #4): test trước, implementation sau.

**Files:**
- Modify: `apps/web/src/mocks/types.ts:153-158`
- Modify: `apps/web/src/mocks/offices.ts` (toàn file)
- Modify: `apps/web/src/mocks/mocks.spec.ts:46-56`

**Interfaces:**
- Consumes: ADR-0018 (Task 1) — không có ràng buộc kỹ thuật
- Produces:
  - `interface MockOffice { city: string; name: string; addressLines: string[]; hours: string; coords: [number, number]; mapHref: string }`
  - `export const OFFICES: MockOffice[]` — đúng 2 phần tử, thứ tự **Hà Nội trước, Hồ Chí Minh sau** (Task 5 dùng `OFFICES` phần tử đầu làm trụ sở)

- [ ] **Step 1: Viết test thất bại**

Trong `apps/web/src/mocks/mocks.spec.ts`, THAY THẾ khối `it('2 văn phòng đủ trường', ...)` hiện có bằng:

```ts
  it('2 văn phòng đủ trường, toạ độ nằm trong khung Việt Nam', async () => {
    const { OFFICES } = await import('./offices.js');
    expect(OFFICES).toHaveLength(2);
    for (const o of OFFICES) {
      expect(o.city.length).toBeGreaterThan(0);
      expect(o.name.length).toBeGreaterThan(0);
      expect(o.addressLines.length).toBeGreaterThan(0);
      expect(o.hours.length).toBeGreaterThan(0);
      // Toạ độ MapLibre là [kinh độ, vĩ độ] — KHÔNG phải [lat, lng]. Khung
      // Việt Nam: kinh độ 102–110, vĩ độ 8–24. Test này chặn lỗi đảo cặp số,
      // thứ sẽ ném marker sang giữa Ấn Độ Dương mà nhìn map vẫn thấy "có pin".
      const [lng, lat] = o.coords;
      expect(lng).toBeGreaterThan(102);
      expect(lng).toBeLessThan(110);
      expect(lat).toBeGreaterThan(8);
      expect(lat).toBeLessThan(24);
      expect(o.mapHref.startsWith('https://')).toBe(true);
    }
  });

  it('trụ sở đứng đầu danh sách văn phòng', async () => {
    const { OFFICES } = await import('./offices.js');
    const [hq] = OFFICES;
    expect(hq?.city).toBe('Hà Nội');
  });
```

- [ ] **Step 2: Chạy test để chắc chắn nó ĐỎ**

```bash
pnpm --filter @tourism/web test -- mocks.spec
```
Expected: FAIL — `o.coords` là `undefined` nên destructure ném, và `o.name` chưa có trên type.

- [ ] **Step 3: Mở rộng type**

Trong `apps/web/src/mocks/types.ts`, thay `interface MockOffice`:

```ts
export interface MockOffice {
  city: string;
  name: string;
  addressLines: string[];
  hours: string;
  /** [kinh độ, vĩ độ] — thứ tự của MapLibre, KHÔNG phải [lat, lng] */
  coords: [number, number];
  /** Link Google Maps cho nút Get directions, mở tab mới */
  mapHref: string;
}
```

- [ ] **Step 4: Sửa dữ liệu**

Thay TOÀN BỘ `apps/web/src/mocks/offices.ts`:

```ts
import type { MockOffice } from './types.js';

// 2 văn phòng cho trang Contact — NGUỒN SỰ THẬT DUY NHẤT của thông tin địa chỉ
// toàn site (topbar, khối info cạnh form, bản đồ). Trước 06/08 có ba nguồn
// chỏi nhau: mock này, hằng hardcode trong contact-split/top-bar, và block
// `contact.offices` mồ côi trong @tourism/i18n — /contact nói Hà Nội + Sa Pa
// còn /terms in trụ sở Hồ Chí Minh. Nay gom về đây, đối chiếu Nexora.
// Vẫn là "ứng viên schema offices" theo ADR-0016 (không có endpoint, sống tiếp
// như nội dung biên tập tĩnh).
//
// Toạ độ geocode từ OpenStreetMap Nominatim, trúng bản ghi TOÀ NHÀ chứ không
// phải điểm giữa đường — cùng nguồn dữ liệu với tile OpenFreeMap đang render
// nên pin rơi đúng toà. KHÔNG dùng lại toạ độ của Nexora: [105.8606, 20.9895]
// của họ lệch ~600m khỏi toà VTC Online (chấm bằng mắt, không geocode).
export const OFFICES: MockOffice[] = [
  {
    city: 'Hà Nội',
    name: 'Headquarters',
    addressLines: ['18 Tam Trinh, Tương Mai', 'Hà Nội, Vietnam'],
    hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
    // OSM: "Tòa nhà VTC Online, 18, Đường Tam Trinh" (class=building, type=office)
    coords: [105.8618052, 20.9949485],
    mapHref: 'https://www.google.com/maps?q=18+Tam+Trinh,+Tuong+Mai,+Ha+Noi',
  },
  {
    city: 'Hồ Chí Minh City',
    name: 'Ho Chi Minh City office',
    addressLines: ['184 Lê Đại Hành, Phú Thọ', 'Hồ Chí Minh City, Vietnam'],
    hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
    // OSM: "The Emporium Lê Đại Hành, 184, Đường Lê Đại Hành"
    coords: [106.6556413, 10.7646196],
    mapHref: 'https://www.google.com/maps?q=184+Le+Dai+Hanh,+Phu+Tho,+Ho+Chi+Minh',
  },
];
```

- [ ] **Step 5: Chạy test để chắc chắn nó XANH**

```bash
pnpm --filter @tourism/web test -- mocks.spec
```
Expected: PASS, cả 2 test mới.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @tourism/web typecheck
```
Expected: FAIL ở `contact-location.tsx`? **Không** — component hiện chỉ đọc `city`/`name`/`addressLines`/`hours`, thêm trường không phá gì. Nếu có lỗi khác thì đọc kỹ, đừng bỏ qua.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/mocks/types.ts apps/web/src/mocks/offices.ts apps/web/src/mocks/mocks.spec.ts
git commit -m "feat(web): gom dữ liệu văn phòng về mock OFFICES — địa chỉ đối chiếu Nexora, toạ độ geocode OSM"
git log -1 --format=%B
```
Expected: không có trailer `Co-Authored-By`.

---

## Task 3: Component bản đồ MapLibre

**Files:**
- Create: `apps/web/src/lib/use-resolved-theme.ts`
- Create: `apps/web/src/components/contact/contact-map.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `OFFICES` + `MockOffice['coords']` từ Task 2
- Produces:
  - `apps/web/src/lib/use-resolved-theme.ts` → `export function useResolvedTheme(): 'light' | 'dark'`
  - `apps/web/src/components/contact/contact-map.tsx` → `export default function ContactMap(): JSX.Element` (default export — Task 4 nạp bằng `dynamic(() => import('./contact-map'))`, cần default)

- [ ] **Step 1: Cài dependency, pin chính xác**

```bash
pnpm --filter @tourism/web add maplibre-gl@5.24.0
```
Expected: `apps/web/package.json` có `"maplibre-gl": "5.24.0"` (không caret — sửa tay nếu pnpm thêm `^`).

- [ ] **Step 2: Viết hook dò theme**

Tạo `apps/web/src/lib/use-resolved-theme.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

// v2 đổi theme bằng cách bật/tắt class `.dark` trên <html> (script chặn nháy
// ở app/layout.tsx + AnimatedThemeToggler), KHÔNG dùng next-themes — nên phải
// tự theo dõi class đó thay vì gọi useTheme(). Logic bê từ Nexora
// (libs/web/ui/.../map.tsx useResolvedTheme) vì cơ chế trùng khớp.

export type Theme = 'light' | 'dark';

function getDocumentTheme(): Theme | null {
  if (typeof document === 'undefined') return null;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (document.documentElement.classList.contains('light')) return 'light';
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Theme đang hiển thị, đọc ĐỒNG BỘ ngay lúc gọi. Dùng cho thứ phải đúng màu
 * từ lần vẽ đầu (vd style của MapLibre lúc dựng map) — chờ state của hook thì
 * map đã nháy sáng rồi mới sang tối.
 */
export function resolveThemeNow(): Theme {
  return getDocumentTheme() ?? getSystemTheme();
}

/** Theme đang hiển thị thật, tự cập nhật khi user bấm nút đổi theme. */
export function useResolvedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(resolveThemeNow);

  useEffect(() => {
    // Nút đổi theme sửa class trên <html> — MutationObserver bắt được, còn
    // event listener thì không có gì để nghe.
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) setTheme(docTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Khi user CHƯA chọn thủ công thì bám theo cài đặt hệ điều hành.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getDocumentTheme()) setTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  return theme;
}
```

- [ ] **Step 3: Viết component bản đồ**

Tạo `apps/web/src/components/contact/contact-map.tsx`:

```tsx
'use client';

import MapLibreGL from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPinIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveThemeNow, useResolvedTheme } from '@/lib/use-resolved-theme';
import { OFFICES } from '@/mocks/offices';

// Bản đồ §Location của /contact — thay ô ImagePlaceholder (ADR-0018).
// Viết riêng dùng thẳng maplibre-gl thay vì port lớp primitive mapcn của
// Nexora: ta chỉ cần 2 marker + 2 nút zoom, còn primitive kia kéo theo ~700
// dòng máy móc tổng quát (popup, tooltip, GeoJSON, arc, cluster, projection).
// Client-only + WebGL nên PHẢI nạp qua dynamic(ssr:false) — xem contact-location.

// Tile OpenFreeMap: miễn phí, không API key, dữ liệu OpenStreetMap. Đây là
// ngoại lệ luật tokens-only đã ghi trong ADR-0018 — URL style là JSON host
// ngoài, không biểu diễn được bằng @tourism/tokens. Mọi thứ ta vẽ đè lên
// (marker, nút zoom) vẫn dùng token tuyệt đối.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

// Hà Nội ↔ Hồ Chí Minh cách ~1150km: đặt center/zoom cứng là mất một đầu, nên
// khung nhìn tính từ chính toạ độ 2 văn phòng. Thêm văn phòng thứ ba thì map
// tự giãn, không phải chỉnh số.
function officeBounds(): MapLibreGL.LngLatBounds {
  const bounds = new MapLibreGL.LngLatBounds();
  for (const office of OFFICES) bounds.extend(office.coords);
  return bounds;
}

/** Pin thương hiệu — vòng ping tắt khi user xin giảm chuyển động. */
function MarkerPin() {
  return (
    <span className="relative flex size-9 items-center justify-center">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
      <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background">
        <MapPinIcon className="size-4.5" aria-hidden="true" />
      </span>
    </span>
  );
}

export default function ContactMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreGL.Map | null>(null);
  // Mỗi marker là một <div> rỗng do MapLibre định vị; nội dung React đổ vào
  // bằng portal để vẫn viết được JSX + icon lucide + class token.
  const [markerHosts, setMarkerHosts] = useState<{ city: string; el: HTMLElement }[]>([]);
  const theme = useResolvedTheme();

  // Khởi tạo map ĐÚNG MỘT LẦN. `theme` cố tình không nằm trong deps — đổi
  // theme thì setStyle ở effect dưới, dựng lại cả map sẽ nháy trắng và mất
  // vị trí khách đang kéo tới.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = new MapLibreGL.Map({
      container,
      // Đọc theme đồng bộ để lần vẽ đầu đã đúng màu, không nháy sáng rồi tối.
      style: STYLES[resolveThemeNow()],
      bounds: officeBounds(),
      fitBoundsOptions: { padding: 64 },
      // Không cướp cuộn trang: lăn chuột vẫn cuộn trang, muốn zoom thì bấm nút.
      scrollZoom: false,
      dragRotate: false,
      touchZoomRotate: false,
      // Attribution OpenStreetMap là ràng buộc licence (ADR-0018) — GIỮ, đừng tắt.
      attributionControl: { compact: true },
    });

    setMap(instance);

    const hosts = OFFICES.map((office) => {
      const el = document.createElement('div');
      new MapLibreGL.Marker({ element: el }).setLngLat(office.coords).addTo(instance);
      return { city: office.city, el };
    });
    setMarkerHosts(hosts);

    return () => {
      instance.remove();
      setMap(null);
      setMarkerHosts([]);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: cố ý chạy 1 lần
  }, []);

  // Đổi theme → đổi style tile, giữ nguyên khung nhìn.
  useEffect(() => {
    if (!map) return;
    map.setStyle(STYLES[theme]);
  }, [map, theme]);

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" />

      {markerHosts.map(({ city, el }) => createPortal(<MarkerPin />, el, city))}

      {/* Nút zoom tự vẽ thay NavigationControl mặc định — control của MapLibre
          có style riêng, không theo token được. */}
      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg shadow-md ring-1 ring-border">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map?.zoomIn()}
          className="flex size-9 items-center justify-center bg-background text-foreground transition-colors hover:bg-muted"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map?.zoomOut()}
          className="flex size-9 items-center justify-center border-t border-border bg-background text-foreground transition-colors hover:bg-muted"
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: KHÔNG thêm CSS reset cho maplibre**

Spec §5 nêu việc rà reset DOM nội bộ của maplibre. Kết luận: **không cần thêm
gì**. Nexora phải reset `.maplibregl-popup-*` trong `globals.css` vì họ dùng
popup/tooltip; ta chỉ dùng marker (DOM của mình, class token) và
`AttributionControl`. Đừng copy khối reset của Nexora sang.

Chỗ DUY NHẤT còn mang style gốc của maplibre là dòng attribution — kiểm bằng
mắt ở Task 6 Step 2 mục 4. Nếu nó chọi theme tối (nền trắng đục trên map tối),
vá tối thiểu bằng cách thêm vào `apps/web/src/app/globals.css`:

```css
/* Attribution của maplibre mang style gốc — kéo về token cho khớp theme.
   Chỉ chỉnh màu, KHÔNG ẩn: attribution OpenStreetMap là ràng buộc licence. */
.maplibregl-ctrl-attrib {
  background-color: var(--background);
  color: var(--muted-foreground);
}
.maplibregl-ctrl-attrib a {
  color: var(--muted-foreground);
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @tourism/web typecheck
```
Expected: PASS.

**Nếu FAIL với lỗi kiểu `Cannot find type definition file for 'geojson'`**: `.d.ts` của `maplibre-gl` tham chiếu kiểu GeoJSON. Nexora đã dính đúng lỗi này. Vá:

```bash
pnpm --filter @tourism/web add -D @types/geojson
```
rồi thêm `"geojson"` vào mảng `compilerOptions.types` trong `apps/web/tsconfig.json`. Chạy lại typecheck.

- [ ] **Step 6: Lint**

```bash
pnpm lint:fix && pnpm --filter @tourism/web test
```
Expected: Biome sạch; test cũ vẫn xanh (chưa có test nào import `contact-map`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/use-resolved-theme.ts apps/web/src/components/contact/contact-map.tsx pnpm-lock.yaml
git commit -m "feat(web): component bản đồ MapLibre 2 marker cho /contact (ADR-0018)"
git log -1 --format=%B
```
Expected: không có trailer `Co-Authored-By`.

---

## Task 4: Lắp bản đồ vào §Location + vá link chết

**Files:**
- ~~Modify: `apps/web/vitest.setup.ts`~~ **AMENDED 06/08**: stub `IntersectionObserver` ở CỤC BỘ trong spec dưới đây, không đụng file setup chung (xem Step 1)
- Modify: `apps/web/src/components/contact/contact-location.tsx:1-9, 49-61, 98-104`
- Create: `apps/web/src/components/contact/contact-location.spec.tsx`

**Interfaces:**
- Consumes: `ContactMap` default export (Task 3) · `OFFICES` với `mapHref` (Task 2)
- Produces: `/contact` §Location render bản đồ thật; nút chỉ đường trỏ `office.mapHref`

- [ ] **Step 1: Stub `IntersectionObserver` cho jsdom**

~~Thêm vào CUỐI `apps/web/vitest.setup.ts`~~ **AMENDED 06/08 (lúc triển khai)**:
KHÔNG dời lên `vitest.setup.ts` — đã thử và **19 test ở 3 file khác gãy**
(có global này thì framer-motion đi nhánh khác hẳn so với khi không có, cùng
lớp phát hiện đã ghi ở `region-group.spec.tsx:12-16`). Đặt CỤC BỘ trong
`beforeAll()` của chính `contact-location.spec.tsx` (Task 4 Step 2), không
đụng file setup chung:

```ts
// jsdom KHÔNG hiện thực IntersectionObserver. ContactLocation dùng nó để hoãn
// nạp chunk bản đồ tới khi khách cuộn tới — thiếu polyfill thì effect ném
// ReferenceError ngay lúc mount và mọi test render section này fail.
// Stub gọi callback NGAY với isIntersecting=true: test luôn thấy trạng thái
// "đã cuộn tới", đúng thứ ta muốn khẳng định.
//
// CỤC BỘ trong spec này, KHÔNG dời lên vitest.setup.ts — đã thử dời lên global
// và 19 test ở 3 file khác gãy vì có global này thì framer-motion đi nhánh
// khác hẳn so với khi không có (xem region-group.spec.tsx:12-16).
class IntersectionObserverStub {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
```

- [ ] **Step 2: Viết test thất bại**

Tạo `apps/web/src/components/contact/contact-location.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OFFICES } from '@/mocks/offices';
import { ContactLocation } from './contact-location';

// jsdom không có WebGL nên maplibre-gl không chạy được. Mock ĐÚNG module bản
// đồ (không mock cả @tourism/ui như Nexora buộc phải làm — v2 dùng subpath
// export nên không có barrel kéo theo) — xem ADR-0018.
vi.mock('./contact-map', () => ({
  default: () => <div data-testid="contact-map" />,
}));

describe('ContactLocation', () => {
  it('render đủ card cho mọi văn phòng', () => {
    render(<ContactLocation />);
    for (const office of OFFICES) {
      expect(screen.getByRole('heading', { name: new RegExp(office.city) })).toBeInTheDocument();
    }
  });

  it('nút chỉ đường trỏ Google Maps và mở tab mới — KHÔNG phải link chết #visit', () => {
    render(<ContactLocation />);
    const links = screen.getAllByRole('link', { name: /Get directions/i });
    expect(links).toHaveLength(OFFICES.length);
    links.forEach((link, index) => {
      const office = OFFICES[index];
      expect(link).toHaveAttribute('href', office?.mapHref);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  it('hiện địa chỉ và giờ mở cửa của từng văn phòng', () => {
    render(<ContactLocation />);
    for (const office of OFFICES) {
      for (const line of office.addressLines) {
        expect(screen.getByText(line)).toBeInTheDocument();
      }
      expect(screen.getAllByText(office.hours).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó ĐỎ**

```bash
pnpm --filter @tourism/web test -- contact-location
```
Expected: FAIL — `href` hiện là `#visit`, không phải `mapHref`; và `target` không tồn tại.

- [ ] **Step 4: Sửa `contact-location.tsx`**

**4a.** Đổi khối import ở đầu file — bỏ `ImagePlaceholder`, thêm `dynamic` + `useEffect`/`useRef`/`useState`:

```tsx
'use client';

import { Clock8Icon, MapPinIcon } from 'lucide-react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { AnimatedGridPattern } from '@/components/motion/animated-grid-pattern';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { OFFICES } from '@/mocks/offices';

// Contact §3 — map thật MapLibre (ADR-0018, thay ImagePlaceholder 06/08) +
// lưới 2 card văn phòng (địa chỉ · giờ mở cửa · nút Get directions trỏ Google
// Maps). Data từ mock OFFICES — nguồn sự thật duy nhất của địa chỉ toàn site.

// maplibre-gl nặng và cần WebGL (client-only) → chunk lười, bỏ SSR.
const ContactMap = dynamic(() => import('./contact-map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-muted" aria-hidden="true" />;
}
```

**4b.** Ngay đầu thân `ContactLocation`, thêm cơ chế chỉ mount map khi cuộn tới:

```tsx
export function ContactLocation() {
  // Chunk bản đồ chỉ tải khi khách thật sự cuộn tới khu này — rootMargin 200px
  // để nó kịp tải xong trước khi lọt vào tầm mắt.
  const mapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);
```

**4c.** Thay khối `<motion.div>` bọc `ImagePlaceholder` (dòng ~50–61) bằng:

```tsx
        {/* Bản đồ MapLibre — nằm trong lớp z-10 để nền lưới động không đè lên */}
        <motion.div
          ref={mapRef}
          className="relative h-90 overflow-hidden rounded-2xl ring-1 ring-border sm:h-110"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          {inView ? <ContactMap /> : <MapSkeleton />}
        </motion.div>
```

**4d.** Thay thẻ `<a>` nút chỉ đường (dòng ~98–104) bằng:

```tsx
              {/* Chỉ đường mở Google Maps ở tab mới — trước 06/08 đây là
                  href="#visit", một link chết trỏ ngược về chính section. */}
              <a
                href={office.mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Get directions →
              </a>
```

- [ ] **Step 5: Chạy test để chắc chắn nó XANH**

```bash
pnpm --filter @tourism/web test -- contact-location
```
Expected: PASS, cả 3 test.

- [ ] **Step 6: Chạy toàn bộ test web + typecheck**

```bash
pnpm --filter @tourism/web test && pnpm --filter @tourism/web typecheck
```
Expected: PASS cả hai. Nếu spec khác vỡ vì stub `IntersectionObserver` mới — đọc lỗi, đừng gỡ stub.

- [ ] **Step 7: Commit**

```bash
git add apps/web/vitest.setup.ts apps/web/src/components/contact/contact-location.tsx apps/web/src/components/contact/contact-location.spec.tsx
git commit -m "feat(web): §Location /contact dùng bản đồ thật, vá nút chỉ đường link chết"
git log -1 --format=%B
```

---

## Task 5: Gom nguồn liên hệ, xoá dữ liệu mồ côi

**Files:**
- Modify: `apps/web/src/components/contact/contact-split.tsx:36, 148-151`
- Modify: `apps/web/src/components/home/contact.tsx:27`
- Modify: `apps/web/src/components/top-bar.tsx:1-2, 17-18`
- Modify: `libs/shared/i18n/src/lib/messages.ts` (2 chỗ điện thoại + xoá block `offices`)
- Modify: `libs/shared/i18n/src/lib/legal/terms.ts:131` · `legal/privacy.ts:105`

**Interfaces:**
- Consumes: `OFFICES` (Task 2)
- Produces: không còn hằng địa chỉ/điện thoại nào bị nhân bản trong `apps/web`

- [ ] **Step 1: `contact-split.tsx` đọc từ `OFFICES`**

Xoá dòng 36 (`const LOCATION = ['12 Hàng Bạc, Hoàn Kiếm', 'Hà Nội, Vietnam'];`).

Thêm `OFFICES` vào import (cạnh các import `@/mocks/...` đang có):

```tsx
import { OFFICES } from '@/mocks/offices';
```

Thay khối hiển thị trụ sở (dòng ~148–151):

```tsx
            <p className="text-sm text-muted-foreground">Headquarters</p>
            <p className="text-base font-medium text-primary">
              {OFFICES[0]?.addressLines.join(', ')}
            </p>
```

> `OFFICES[0]?.` chứ không phải `OFFICES[0].` — `noUncheckedIndexedAccess` đang bật.

- [ ] **Step 2: `home/contact.tsx` đổi email**

Dòng 27:

```tsx
export const EMAIL = 'tourism.platform.online@gmail.com';
```

`PHONE` ở dòng 28 **GIỮ NGUYÊN** `'+84 24 3826 0126'` — xem spec §2.4: `1900 292 958` là hotline thật đang hoạt động của VTC Academy, site demo không được in số đó.

- [ ] **Step 3: `top-bar.tsx` thôi nhân bản hằng**

~~Xoá 2 dòng 17–18 (`const EMAIL = ...` và `const PHONE = ...`), thêm vào khối
import đầu file: `import { EMAIL, PHONE } from '@/components/home/contact';`~~
**AMENDED 06/08 (lúc triển khai)**: import từ `home/contact` làm `next build`
vỡ ở prerender. `home/contact.tsx` có `'use client'`; `top-bar.tsx` là Server
Component (không có `'use client'`) nằm trong layout gốc mọi route đều có.
Server Component import BẤT KỲ export nào từ module `'use client'` chỉ nhận
về client-reference proxy chứ không phải chuỗi thật — nên `PHONE.replace(...)`
ném `TypeError` lúc prerender, giết mọi trang tĩnh (đo bằng `next build`).

Vá đúng: tạo module thường mới **`apps/web/src/lib/site.ts`** (KHÔNG
`'use client'`) khai `EMAIL`/`PHONE`, rồi cả `top-bar.tsx` lẫn
`home/contact.tsx` cùng import từ đó — không còn ai "xuất" hằng từ một module
client nữa. Xoá 2 dòng 17–18 cũ trong `top-bar.tsx`, thêm:

```tsx
import { EMAIL, PHONE } from '@/lib/site';
```

Sửa luôn comment ở dòng 7 — `// Email/phone mock — thay bằng site-config khi gắn API.` thành (bản cuối, sau một vòng tự-sửa comment ở `76720c5` vì bản đầu chẩn đoán sai cơ chế RSC):

```tsx
// Email/phone lấy từ `@/lib/site` — module THƯỜNG, không 'use client'. File
// này là Server Component nên nếu import hằng từ một module 'use client' thì
// nhận về client-reference proxy chứ không phải chuỗi, và `.replace()` sẽ ném
// TypeError lúc prerender. Chi tiết ghi ở đầu `lib/site.ts`.
```

> Quy ước "export EMAIL/PHONE từ `home/contact` thay vì nhân bản" chốt 24/07
> vẫn đúng tinh thần (một nguồn duy nhất) nhưng SAI vị trí đặt nguồn đó — nguồn
> phải là module thường, không phải module `'use client'`. `contact-split.tsx`
> an toàn khi import từ `home/contact` không phải vì nó "chỉ dùng ở một
> trang", mà vì CHÍNH NÓ có `'use client'` (import client→client trả giá trị
> thật) — biến quyết định duy nhất là consumer nằm ở graph server hay graph
> client. Xem `lib/site.ts` (commit `76720c5`).

- [ ] **Step 4: Sửa điện thoại trong `@tourism/i18n`**

Đổi `'1900 292 958'` → `'+84 24 3826 0126'` tại **4 chỗ**:

- `libs/shared/i18n/src/lib/messages.ts` — `contact.inquiry.details` (dòng ~1442, `{ label: 'Phone', value: ... }`)
- `libs/shared/i18n/src/lib/messages.ts` — `contact.info` mục `'Call us'` (dòng ~1503)
- `libs/shared/i18n/src/lib/messages.ts` — `footer.phone` (dòng ~2018)
- `libs/shared/i18n/src/lib/legal/terms.ts:131` và `legal/privacy.ts:105` — trong câu văn `…by phone at 1900 292 958, or by post at…`

Kiểm lại không sót:

```bash
grep -rn "1900 292 958" libs/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "/dist/"
```
Expected: **rỗng**.

- [ ] **Step 5: Xoá block văn phòng mồ côi trong i18n**

Trong `libs/shared/i18n/src/lib/messages.ts`, xoá 4 khoá trong object `contact` (dòng ~1478–1495): `officesHeading`, `officesSubtitle`, `getDirections`, và mảng `offices`. **GIỮ** `info` (dòng ~1497 trở đi) — nó phục vụ cột Information của footer, khác chuyện.

> Đã xác nhận **0 nơi trong repo đọc 4 khoá này** (`grep` trả rỗng). Chúng là bản sao thứ hai của dữ liệu văn phòng, nguồn gốc của mâu thuẫn ba-nguồn.

Kiểm lại:

```bash
grep -rn "officesHeading\|officesSubtitle\|getDirections" libs/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "/dist/"
```
Expected: **rỗng**.

- [ ] **Step 6: Gate nhanh**

```bash
pnpm gate
```
Expected: PASS (build + typecheck + unit test + lint).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/contact/contact-split.tsx apps/web/src/components/home/contact.tsx apps/web/src/components/top-bar.tsx libs/shared/i18n/src/lib/messages.ts libs/shared/i18n/src/lib/legal/terms.ts libs/shared/i18n/src/lib/legal/privacy.ts
git commit -m "fix(web): gom thông tin liên hệ về một nguồn, xoá block văn phòng mồ côi trong i18n"
git log -1 --format=%B
```

---

## Task 6: Nghiệm thu sống + docs sweep

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md` (bảng plan + cập nhật dòng spec)

**Interfaces:**
- Consumes: toàn bộ Task 1–5
- Produces: nhánh sẵn sàng merge

- [ ] **Step 1: Gate ĐẦY ĐỦ**

```bash
pnpm gate:int
```
Expected: PASS. Luật CLAUDE.md #11 — `gate` trần KHÔNG đủ để khai xong.

- [ ] **Step 2: Xem bằng mắt trên dev server**

> Luật vệ sinh tiến trình: **KHÔNG** chạy `next build` song song với dev server của user, và kill tiến trình mình tự mở trước khi bàn giao.

```bash
pnpm --filter @tourism/web dev
```

Mở `http://localhost:3000/contact`, cuộn tới §"Two doors, always open." và kiểm 7 mục:

1. Bản đồ hiện tile thật (không phải ô sọc chéo), thấy dáng Việt Nam với **2 pin** — một Bắc một Nam.
2. Bấm nút đổi theme trên navbar → tile đổi sáng/tối, **khung nhìn không nhảy**.
3. Lăn chuột trên bản đồ → **trang vẫn cuộn**, bản đồ không zoom.
4. Bấm nút `+`/`−` → zoom được; dòng attribution OpenStreetMap có hiện.
5. Hai card: `Hà Nội · Headquarters` và `Hồ Chí Minh City · Ho Chi Minh City office`, địa chỉ + giờ đúng bảng spec §3.
6. Bấm "Get directions →" của từng card → mở **tab mới** đúng Google Maps đúng địa chỉ.
7. Mở DevTools → Network, tải lại trang ở đầu trang: chunk `maplibre` **chưa** tải; chỉ tải khi cuộn gần tới §Location.

Kiểm thêm 2 chỗ ngoài `/contact`: topbar hiện `tourism.platform.online@gmail.com` · `+84 24 3826 0126`; `/terms` và `/privacy` in `+84 24 3826 0126` và địa chỉ bưu chính Hồ Chí Minh (nay đã khớp `/contact`).

Xong thì **kill dev server**.

- [ ] **Step 3: Entry CHANGELOG**

Thêm entry mới vào ĐẦU `docs/CHANGELOG.md` theo khuôn các entry hiện có: ngày · hash · nội dung · review findings · số test.

> ⚠️ **KHÔNG để dấu `+` ở đầu dòng** (gotcha CLAUDE.md — formatter markdown biến nó thành bullet và nói sai con số). Viết "và", hoặc gói cả tổng test vào một dòng.
> ⚠️ **KHÔNG sửa entry cũ** — chúng là bản ghi lịch sử, cùng luật với `migration.sql`.

- [ ] **Step 4: Cập nhật bản đồ docs**

Trong `docs/README.md`:
- Bảng plan (quanh dòng 89–92): thêm dòng cho plan này, theo giọng các dòng đang có.
- Dòng spec `2026-08-06-contact-map-offices-design` đã thêm sẵn 06/08 — đổi `📝 spec duyệt, chờ plan` thành trạng thái đã merge + hash.
- Dòng `P3b Web` (dòng 54): nối thêm mốc bản đồ `/contact` vào chuỗi trạng thái.

- [ ] **Step 5: Xem diff .md trước khi stage**

```bash
git diff docs/
```
Expected: chỉ có phần mình thêm. **Không** có dòng `+` cột 0 nào trong entry cũ bị đổi thành `-`, **không** có dòng trắng lạ được chèn.

- [ ] **Step 6: Kiểm docs-freshness**

```bash
./scripts/docs-freshness.sh
```
Expected: PASS — không còn commit `feat`/`fix` nào mới hơn entry CHANGELOG mới nhất.

- [ ] **Step 7: Commit**

```bash
git add docs/CHANGELOG.md docs/README.md
git commit -m "docs: entry CHANGELOG bản đồ thật /contact và gom nguồn liên hệ"
git log -1 --format=%B
```

- [ ] **Step 8: DỪNG — xin phép user trước khi merge**

Luật CLAUDE.md #2: **xác nhận trước mọi merge/push**. Báo cáo user:
- 6 task xong, `pnpm gate:int` xanh, 7 mục nghiệm thu sống đã kiểm.
- Đề xuất merge kiểu rebase + fast-forward (luật #1):
  ```bash
  git rebase main && git checkout main && git merge --ff-only feat/contact-map-offices
  ```
- Sau khi push: **liếc đèn CI** (luật #14) — `gh run list --branch main --limit 1`, chờ run mới nhất success rồi mới khai xong.

---

## Rủi ro đã lường

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| `maplibre-gl` .d.ts đòi kiểu `geojson` | `typecheck` fail "Cannot find type definition file for 'geojson'" | Task 3 Step 4 — cài `@types/geojson` + thêm vào `compilerOptions.types` |
| Tile OpenFreeMap chết | Khung map trắng, console lỗi mạng | Chấp nhận (capstone không doanh thu). Khung + marker vẫn còn. Nếu muốn chắc: thêm `map.on('error', …)` fallback về `MapSkeleton` |
| `setStyle` xoá marker khi đổi theme | Đổi theme xong pin biến mất | MapLibre giữ `Marker` (DOM overlay) qua `setStyle` — chỉ layer trong style mới bị thay. Nếu vẫn mất: đăng ký lại marker trong `map.on('styledata', …)` |
| Nền `AnimatedGridPattern` đè lên map | Lưới nhấp nháy phủ trên tile | Nội dung đã bọc trong `div` `z-10` (dòng 34 của `contact-location.tsx`) — giữ map bên trong lớp đó |
| Stub `IntersectionObserver` làm vỡ spec khác | Spec không liên quan bỗng fail | Stub gọi callback ngay lập tức; nếu spec nào cần trạng thái "chưa cuộn tới" thì `vi.stubGlobal` đè riêng trong spec đó, ĐỪNG gỡ stub chung |

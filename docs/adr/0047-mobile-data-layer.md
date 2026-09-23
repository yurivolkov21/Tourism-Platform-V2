# ADR-0047 — Tầng dữ liệu mobile: oRPC `OpenAPILink` + TanStack Query · client-first

- **Trạng thái:** Accepted (2026-09-23)
- **Bối cảnh:** T0 của cụm xem tour mobile (P5b-2), theo
  [docs/handoff/mobile-browse-handoff.md](../handoff/mobile-browse-handoff.md). Nối tiếp
  [ADR-0040](0040-mobile-app-expo.md) (nền tảng Expo), [ADR-0016](0016-web-data-layer.md)
  (tầng dữ liệu web — mẫu tham chiếu, KHÔNG chép nguyên vì khác ràng buộc render).

## Bối cảnh

`apps/mobile` (P5a khung, P5b-1 auth) chưa có client nào gọi API thật —
`package.json` không có `@tourism/contract` lẫn `@orpc/*`. Cụm auth hiện tại
dùng bản giả lập (`AuthActions` interface, xem `auth-actions.ts`) chờ hạ tầng
`@better-auth/expo` — KHÔNG thuộc phạm vi ADR này. ADR này chỉ chốt đường ĐỌC
công khai (destinations, tours, reviews) mà 5 màn còn lại của T1–T7 đều cần.

Khác biệt nền tảng so với web (ADR-0016) quyết định mọi lựa chọn dưới đây:

- **Không SSR/ISR.** React Native không có khái niệm Server Component hay
  render tĩnh — mọi fetch đều chạy trên máy khách, luôn luôn. Quyết định "hoãn
  TanStack Query vì server-first" của ADR-0016 vì vậy KHÔNG áp dụng: mobile
  không có gì để hoãn, vì không có gì khác ngoài client-fetch từ đầu.
  Ngược lại, RN cần pull-to-refresh, cache qua lại giữa tab, và retry theo
  focus — đúng bài toán TanStack Query giải sẵn.
- **Không cache-tag / revalidate.** Không route tĩnh nào cần "làm tươi lại
  sau khi publish" qua webhook — app luôn fetch mới khi mở màn hoặc kéo
  refresh. `tags.ts` của web (taxonomy cache-tag cho on-demand revalidation)
  không có việc tương đương ở đây.
- **Ảnh qua Cloudinary** cần build URL transform (`f_auto,q_auto,w_<n>`)
  giống loader web (`apps/web/src/lib/cloudinary-loader.ts`, ADR-0020 §Hệ quả)
  nhưng RN không có `next/image` — cần hàm thuần tương đương + component ảnh
  RN riêng (`expo-image`).

## Quyết định

### 1. Client: oRPC `OpenAPILink` từ contract — giống cơ chế web, khác gói

Cài vào `apps/mobile`: `@tourism/contract` (workspace) + `@orpc/client` +
`@orpc/openapi-client` + `@orpc/tanstack-query` + `@tanstack/react-query`,
ghim `1.14.8` khớp bộ `@orpc/*` của API/contract/web.

- `OpenAPILink` (không phải `RPCLink`) — API mount contract theo path REST
  qua `@orpc/nest`, lý do y hệt ADR-0016 §1.
- Custom fetch: `AbortSignal.timeout(10_000)`, cùng số với web.
- `apps/mobile/src/lib/api/client.ts` — dựng link + export `orpc` client.
  Base URL lấy từ `apiUrl` đã có ở `src/lib/env.ts` (đã xử lý LAN
  auto-derive cho Expo Go, không viết lại).
- **Không auto-retry mutation** — cùng lý lẽ ADR-0016 §1 (ghi hai lần là bug
  tiềm ẩn). TanStack Query mặc định đã không retry mutation; giữ nguyên
  default, không cấu hình thêm.
- Chỗ móc session (header `Authorization`/cookie cho wishlist) để **comment
  rõ vị trí, chưa nối** — nối thật là việc của ADR hạ tầng auth riêng
  (`@better-auth/expo`), ngoài phạm vi ADR này. Tất cả 5 màn T0 phủ đều là đọc
  công khai (xem bảng dữ liệu ở handoff §5), nên chưa cần token để chạy.

### 2. Cache/state: TanStack Query qua `@orpc/tanstack-query` — không tự viết tri-state fetch

Ngược quyết định "chưa cần" của ADR-0016 §Đã cân nhắc — mobile cần NGAY vì
không có gì khác làm việc này (xem Bối cảnh). Mỗi màn gọi thẳng
`useQuery(orpc.catalog.tours.list.queryOptions(...))` tại route (route giữ
state, màn chỉ vẽ — đúng khuôn `apps/mobile/src/features/auth`). Không dựng
module fetch-riêng-từng-resource như `apps/web/src/lib/api/tours.ts`: không
có ranh giới Server/Client Component cần giữ, nên lớp trung gian đó chỉ là
thừa. Logic phái sinh thật (nhóm theo `region`, lọc thời lượng/giá ở máy vì
API chưa lọc được — xem handoff §5–6) vẫn là hàm thuần riêng, có test,
KHÔNG nhét vào JSX — giữ nguyên luật 4 (TDD trên logic thuần), khác chỗ đặt
so với web chứ không khác chuẩn.

### 3. Tri-state tải/lỗi/rỗng: port `settle()`/`contentState()`, không viết lại từ đầu

`apps/mobile/src/lib/api/resilience.ts` — port thuần `settle()` (không
throw, trả `{ok, data}`) + `contentState()` (`'error' | 'empty' | 'content'`,
failed thắng isEmpty) từ web, có test riêng. Component `LoadErrorState`
(panel "không tải được" + nút retry = `refetch()` của query) ở
`@tourism/mobile-ui`, dùng chung cho khối "icon vuông + câu + nút" ở H3/H4/
E5/D7 (handoff §T0 primitive list).

- Khung xám cùng bố cục cho trạng thái đang tải; **sau ~3 giây** thêm câu
  `home.slowServer` (API Render ngủ) — hẹn giờ bằng `setTimeout` trong hook
  màn, không phải trong `resilience.ts` (đó là logic UI theo thời gian, khác
  tri-state thuần).
- **Cấm hiện empty-state khi lỗi** — cùng luật ADR-0016 §4.

### 4. Ảnh: hàm thuần `cloudinaryUrl()` port từ loader web + `AppImage` bọc `expo-image`

`apps/mobile/src/lib/cloudinary-url.ts` — port nguyên thuật toán của
`apps/web/src/lib/cloudinary-loader.ts` (idempotent, escape-hatch URL ký
`s--…--`, nhận diện segment transformation chắc chắn, publicId phẳng không
bị nuốt), đổi chữ ký cho hợp RN:
`cloudinaryUrl(src: string, width: number, quality?: number): string` —
không theo shape `{src, width, quality}` của `next/image` loader vì RN không
có hợp đồng đó. **Không sửa file web gốc** — hai bản pure function độc lập,
cùng thuật toán, khác chữ ký gọi; hợp nhất về sau (nếu cần) không thuộc T0.

`AppImage` (primitive mới, `@tourism/mobile-ui`) bọc `expo-image`: gọi
`cloudinaryUrl()` dựng `source.uri`, có placeholder blurhash/màu nền `muted`
lúc tải. Chọn `expo-image` thay `Image` gốc RN vì cache đĩa sẵn có và tránh
tự viết lại loading-state ảnh cho từng nơi dùng.

### 5. Env

Dùng nguyên `apiUrl` từ `apps/mobile/src/lib/env.ts` (đã có, đã test LAN
auto-derive) — không thêm biến env mới cho ADR này.

## Hệ quả

- Type + error code chảy một chiều contract → mobile, giống web — lệch
  contract là lỗi biên dịch.
- Thêm 5 dependency vào `apps/mobile`: `@tourism/contract`, `@orpc/client`,
  `@orpc/openapi-client`, `@orpc/tanstack-query`, `@tanstack/react-query`.
- `QueryClientProvider` mount một lần ở `src/app/_layout.tsx`, cạnh
  `AuthActionsProvider` đã có.
- Wishlist (`D6` — tim khi chưa đăng nhập) và mọi ghi cần auth vẫn CHỜ hạ
  tầng `@better-auth/expo` — ADR này không chốt cơ chế session, chỉ để chỗ
  móc. Ghi CÒN TREO ở CHANGELOG khi T0 merge.
- `cloudinaryUrl()` mobile và `cloudinaryLoader()` web là hai bản trùng
  thuật toán có chủ đích — không phải nợ kỹ thuật cần dọn ngay, vì chữ ký gọi
  khác nền tảng buộc phải có lớp bọc riêng dù có hợp nhất lõi.

## Đã cân nhắc và loại

- **`fetch` trần không TanStack Query:** đúng bước 1 của web, nhưng mobile
  không có gì bù lại việc thiếu cache/pull-to-refresh/retry (web bù bằng
  ISR). Tự viết tay tri-state + refetch cho từng màn là dựng lại một phần
  TanStack Query kém hơn — loại.
- **`RPCLink`:** sai giao thức, cùng lý do ADR-0016.
- **Module fetch-riêng-từng-resource kiểu `lib/api/tours.ts` của web:** không
  có ranh giới Server/Client Component để phục vụ; thêm tầng gọi qua không
  lý do là thừa cho mobile — loại, gọi thẳng `orpc.*.queryOptions()` tại route.
- **Hợp nhất `cloudinaryUrl()` mobile vào `@tourism/core` dùng chung web:**
  web đang export qua shape loader `next/image` ép buộc
  (`{src, width, quality}`), còn cần lớp bọc riêng dù lõi chung — hợp nhất
  bây giờ là refactor không ai yêu cầu, ngoài phạm vi T0 (không đụng code
  web đang chạy production). Để dành, xét lại nếu có nhu cầu thật.

## AMEND 1 — 2026-09-23 (đối chiếu code sau khi merge T0)

Ba chỗ ADR lệch với code thật đã merge — đối chiếu sau khi T0 xong, không
sửa quyết định gốc ở trên.

### §3 — không có `LoadErrorState` riêng; gộp vào `EmptyState` qua prop `icon`

ADR gốc đặt tên một component `LoadErrorState` tách biệt. Lúc thi công, thấy
"khối icon vuông + câu + nút" cho panel lỗi giống hệt `EmptyState` đã có (chỉ
khác icon) — dựng thêm component song song là trùng lặp không lý do. Chốt:
thêm prop `icon?: ReactNode` vào `EmptyState` sẵn có
([libs/mobile/ui/src/lib/empty-state.tsx](../../libs/mobile/ui/src/lib/empty-state.tsx))
thay vì tạo `LoadErrorState` mới — quyết định reuse-over-build lúc thi công,
không phải quên làm.

### §4 — `AppImage` KHÔNG tự gọi `cloudinaryUrl()`; nhận `transformUrl` tiêm từ ngoài

Câu "`AppImage` … gọi `cloudinaryUrl()` dựng `source.uri`" sai: `AppImage`
([libs/mobile/ui/src/lib/app-image.tsx](../../libs/mobile/ui/src/lib/app-image.tsx))
nhận prop `transformUrl?: (source: string, width: number) => string`, mặc
định identity (`(src) => src`) — giữ đúng ranh giới phụ thuộc một chiều của
ADR-0040 §2 (`@tourism/mobile-ui` không được import ngược `apps/mobile`).
Tầng app ghép `cloudinaryUrl()` vào ở
[apps/mobile/src/components/app-image.tsx](../../apps/mobile/src/components/app-image.tsx)
(re-export `AppImage` đã curry sẵn `transformUrl={cloudinaryUrl}`) — màn nào
cần ảnh Cloudinary import từ đây, không import thẳng bản `@tourism/mobile-ui`.

Câu "placeholder blurhash" cũng chưa đúng: bản đã build chỉ có nền màu
`muted` lúc tải (`backgroundColor: theme.colors.muted`), CHƯA có blurhash —
ghi nhận đây là việc CHƯA LÀM, không phải lời hứa bị phá.

### Hệ quả — số dependency thêm vào `apps/mobile` là 7, không phải 5

5 dependency ADR gốc liệt kê (`@tourism/contract`, `@orpc/client`,
`@orpc/openapi-client`, `@orpc/tanstack-query`, `@tanstack/react-query`) đúng
nhưng thiếu hai cái phát sinh lúc thi công:

- `@orpc/contract` — cần làm dependency trực tiếp để TypeScript resolve được
  kiểu `ContractRouterClient`, phát hiện ở Task 1 (không tự kéo theo qua
  `@tourism/contract`/`@orpc/client`).
- `expo-image` — thêm ở Task 7 cho `AppImage`, cả hai phía: `apps/mobile`
  (dùng qua binding module ở trên) VÀ `libs/mobile/ui` (component gốc).

Đối chiếu `apps/mobile/package.json`/`libs/mobile/ui/package.json` hiện tại:
đúng 7 dependency mới trong `apps/mobile` so với trước T0 (5 gốc +
`@orpc/contract` + `expo-image`); `libs/mobile/ui` thêm `expo-image` riêng,
không tính vào con số 7 vì ADR gốc chỉ đếm `apps/mobile`.

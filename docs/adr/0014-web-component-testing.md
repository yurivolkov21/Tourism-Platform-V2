# ADR-0014 — Test tầng component cho `apps/web`: Vitest 2 project (node + jsdom)

- **Trạng thái:** Accepted (2026-07-27)
- **Bối cảnh:** Nối tiếp [ADR-0011](0011-p3b-web-architecture.md) (kiến trúc web
  P3b, Biome-không-ESLint, một tool cho mỗi việc). Mở đường cho
  [cụm trang Tours](../specs/2026-07-27-tours-pages-design.md) — cụm tương tác
  nặng nhất từ trước tới nay.

## Bối cảnh

`apps/web` từ P3b tới giờ chỉ test **logic thuần**: `vitest.config.ts` đặt
`environment: 'node'`, và mọi spec nằm ở `src/lib/` hoặc `src/mocks/`. Không có
một dòng nào render component.

Cái giá đã trả: `docs/CHANGELOG.md` ghi thiếu test tầng component là **gốc rễ
của 2 lỗi lọt CI** ở cụm Blog — cả hai đều là lỗi hành vi trong component
client (trạng thái lọc và điều kiện render), thứ mà test logic thuần theo định
nghĩa không với tới.

Cụm Tours làm rủi ro đó tăng bậc. Nó có: bộ lọc nhiều chiều ghi vào URL, phân
trang, dải chọn đợt khởi hành đồng bộ ba nơi, accordion, drawer mobile. Đây
không còn là "vài component tĩnh" mà là một máy trạng thái.

Nexora đã có sẵn thứ này (`review-card.spec.tsx`, `see-all-reviews.spec.tsx`
chạy jsdom + React Testing Library). Không có nó ở v2 là **thụt lùi** theo luật
CLAUDE.md #10.

## Quyết định

1. **Thêm môi trường `jsdom` + `@testing-library/react`, cấu hình bằng
   `test.projects` của Vitest 4 — MỘT runner, hai project.**
   - `node`: `src/lib/**/*.spec.ts` + `src/mocks/**/*.spec.ts` (nhanh, không DOM).
   - `dom`: `src/components/**/*.spec.tsx` + `src/lib/**/*.spec.tsx` (jsdom +
     setup file). **Cập nhật 06/08** (nhánh `feat/contact-map-offices`,
     `958d582`): mở rộng thêm `src/lib/**/*.spec.tsx` vì spec của hook render
     React (vd `use-resolved-theme.spec.tsx`) thuộc bên `dom` theo ranh giới ở
     mục 4 dưới đây dù file hook nằm vật lý trong `src/lib/` — nó cần môi
     trường jsdom và `vitest.setup.ts` để có `cleanup()` của RTL, thứ project
     `node` không có.
   - *Bỏ qua:* thêm Jest — vi phạm thẳng luật "một tool cho mỗi việc" của
     CLAUDE.md, và sẽ tranh cấu hình với Vitest như Prettier từng tranh với Biome.
   - *Bỏ qua:* `happy-dom` — nhanh hơn nhưng lệch chuẩn DOM ở form và dialog,
     mà cụm này dùng cả hai (drawer filter, accordion FAQ).
   - *Bỏ qua:* Playwright component testing — chồng chéo với việc chụp ảnh kiểm
     tra bằng `playwright-core` đang làm thủ công, và nặng hơn nhiều cho thứ
     chạy mỗi lần `pnpm gate`.

2. **Không cần `@vitejs/plugin-react`.** `apps/web/tsconfig.json` đã đặt
   `"jsx": "react-jsx"` (automatic runtime); esbuild của Vite đọc thẳng setting
   đó và transform `.tsx` đúng. Đã đo bằng spike, không suy đoán.

3. **Cleanup RTL phải gọi tay.** Repo không bật `globals: true` (test import
   `describe`/`it`/`expect` tường minh), nên RTL không tự gắn `afterEach(cleanup)`.
   `vitest.setup.ts` gọi tường minh. Thiếu nó thì DOM của test trước còn nguyên
   và query của test sau khớp nhầm phần tử — kiểu lỗi rất khó truy.

4. **Ranh giới với test logic thuần — đây là phần quan trọng nhất của ADR này.**
   Logic thuần ở lại `lib/*.spec.ts` môi trường `node`. `*.spec.tsx` **chỉ**
   dùng cho thứ không kiểm được ở tầng thuần:
   - tương tác (click/gõ/bàn phím) làm đổi trạng thái,
   - hợp đồng trợ năng (role, label, `aria-pressed`, `aria-live`),
   - đồng bộ trạng thái giữa nhiều component.

   **Không** viết lại test logic dưới dạng component test. Lọc, sắp xếp, định
   dạng tiền, phân trang đều là hàm thuần — test chúng qua DOM thì chậm hơn một
   bậc, khó đọc lỗi hơn, và ràng buộc test vào markup vốn sẽ đổi.

5. **Workspace ghim MỘT bản React duy nhất** (`pnpm-workspace.yaml` →
   `overrides: react / react-dom = 19.2.4`). Xem "Hệ quả" — đây không phải chi
   tiết triển khai mà là ràng buộc mới cho toàn repo.

## Quả bom âm ỉ mà quyết định này gỡ ra

Spike xác minh 27/07 làm lộ một thứ không ai biết: **workspace có HAI bản React**.

`apps/web` ghim cứng `react: "19.2.4"` (khớp Next 16.2.11), còn
`libs/shared/ui` khai peer `"^19"` nên pnpm tự cài thêm `19.2.7`, và
`@base-ui/react` bám vào bản đó.

Next bundler tự dedupe nên **dev và build không bao giờ lộ ra**. Vitest thì lộ
ngay: `react-dom@19.2.4` render component gọi hook của `react@19.2.7` →
dispatcher null → mọi component Base UI ném
`TypeError: Cannot read properties of null (reading 'useRef')`.

Hai cách chữa ở tầng test đã thử và **đều trượt** — ghi lại để không ai tốn
thời gian thử lại:

| Cách | Vì sao trượt |
| --- | --- |
| `resolve.dedupe: ['react','react-dom']` | Store cô lập của pnpm — symlink react riêng của `@base-ui/react` vẫn thắng |
| `resolve.alias` trỏ react về `apps/web/node_modules` | Vitest **externalize** `node_modules`, Node resolve thẳng nên không đi qua alias của Vite |

Cách ăn: override ở `pnpm-workspace.yaml`. Lưu ý pnpm 11 **không còn đọc**
`pnpm.overrides` trong `package.json` — nó cảnh báo rồi bỏ qua.

Ghim `19.2.4` là **hạ xuống cho khớp bản `apps/web` vốn đang chạy, KHÔNG phải
nâng cấp** — nhất quán với chính sách freeze 15/10/2026.

## Đối chiếu Nexora (luật #10)

| Hạng mục | Nexora | v2 | Phân loại |
| --- | --- | --- | --- |
| Test component web | jsdom + RTL, 2 spec (`review-card`, `see-all-reviews`) | ADR này mở đường | **thụt lùi đang vá** |
| Test runner | Jest cho web, Vitest chỗ khác | Vitest duy nhất, 2 project | **v2 tốt hơn** — một tool, một cấu hình |
| Ranh giới thuần ↔ component | không ghi ở đâu | mục 4 ADR này | **v2 tốt hơn** |
| Số bản React trong workspace | không kiểm | ghim 1 bản, có lý do ghi lại | **v2 tốt hơn** |

## Hệ quả

**Tích cực**

- Lớp lỗi từng lọt CI ở cụm Blog giờ có lưới canh.
- Gỡ được duplicate React — vốn có thể gây lỗi context xuyên ranh giới package
  ngay cả ở runtime, Next chỉ đang che đi.
- Nhãn project (`node` / `dom`) hiện trong output test nên biết ngay tầng nào đỏ.

**Tiêu cực / phải sống chung**

- **Nâng React từ nay phải nâng ở HAI chỗ**: `overrides` trong
  `pnpm-workspace.yaml` và `apps/web/package.json`. Lệch nhau thì test component
  vỡ trước tiên — đó là tín hiệu tốt, nhưng phải biết mà đọc.
- `apps/web` thêm 4 devDependency: `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`.
- Test web chậm hơn (jsdom phải dựng môi trường). Số đo thật: 83 test / 1,5s,
  trong đó `environment` chiếm ~0,7s.

**Số đo tại thời điểm chấp nhận** (`pnpm gate`, 27/07): 18/18 turbo task xanh ·
API 188 test · web 83 test · `next build` compile sạch 27 trang tĩnh · Biome
không lỗi · toàn gate 8,0s với 15/18 task cached.

**Đã dò trước những component Base UI mà cụm Tours sẽ dùng** — `Badge`,
`Button`, `Accordion`, `Sheet` (có portal), cộng `userEvent`, mock
`next/navigation`, và đọc `messages` từ `@tourism/i18n` trong jsdom. Tất cả
chạy. Nếu về sau chúng vỡ thì là lỗi mới, không phải hạ tầng.

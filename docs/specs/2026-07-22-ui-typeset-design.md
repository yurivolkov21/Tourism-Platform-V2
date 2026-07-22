# Spec — Tích hợp shadcn/typeset vào `@tourism/ui` (2026-07-22)

Quyết định nền: [ADR-0012](../adr/0012-typeset-typography.md). Phạm vi user chốt:
dựng nền đầy đủ một lần (docs + chat + reading) để P3b dùng ngay, P4/P6 khỏi mở
lại chủ đề.

## Mục tiêu

Nội dung render (markdown/rich-text từ backend, chat streaming sau này) có
typography thống nhất toàn hệ, điều khiển tập trung, theme-aware, không thêm
runtime dependency.

## Không thuộc phạm vi (non-goals)

- KHÔNG dựng trang/markdown renderer — đó là bước "dựng trang" P3b (điều phối riêng).
- KHÔNG wire `@tourism/tokens` vào theme — task treo riêng; typeset đọc biến
  `--color-*` nên tự hưởng khi task kia xong.
- KHÔNG thêm font serif cho `typeset-reading` — chưa có font token; dùng font
  hiện có, nâng cấp khi làm P7 polish.
- KHÔNG đụng apps/api, prisma, migrations.

## Thay đổi theo file

| File | Thay đổi |
| --- | --- |
| `libs/shared/ui/src/styles/typeset.css` | MỚI — lõi vendor upstream (490 dòng, giữ nguyên) + header nguồn/ngày + khối 3 preset tự viết |
| `libs/shared/ui/src/styles/globals.css` | Thêm `@import "./typeset.css";` sau các import hiện có |
| `libs/shared/ui/src/components/typeset.tsx` | MỚI — wrapper `<Typeset>` (cva + `data-slot`, comment tiếng Việt) |
| `libs/shared/ui/src/components/typeset.spec.ts` | MỚI — unit test `typesetVariants` (TDD, viết trước) |
| `libs/shared/ui/vitest.config.ts` | MỚI — environment `node` (test logic thuần, không cần jsdom) |
| `libs/shared/ui/package.json` | Thêm script `"test": "vitest run"` + devDep `vitest@4.1.10` (khớp root/api) |

Không đổi exports map — `typeset.tsx` khớp pattern `./components/*` sẵn có;
`typeset.css` đi trong `globals.css`, không cần entry mới.

## Giá trị preset (chốt)

| Preset | `--typeset-size` | `--typeset-leading` | `--typeset-flow` | Dùng cho |
| --- | --- | --- | --- | --- |
| `.typeset-docs` | `1em` | `1.75` | `1.25em` | Mô tả tour, itinerary, FAQ, admin preview |
| `.typeset-chat` | `0.875em` | `1.6` | `1em` | AI concierge streaming (P6) — tương đương `prose-sm` Nexora |
| `.typeset-reading` | `1.0625em` | `1.8` | `1.5em` | Trang đọc dài: about, policy, blog |

`typeset-docs` = giá trị mặc định của lõi, khai tường minh để preset tự mô tả
và không gãy nếu upstream đổi default. Leading 1.6 cho chat và 1.75 cho docs
theo đúng ví dụ chính thức của shadcn.

## API component

```tsx
import { Typeset } from "@tourism/ui/components/typeset"

<Typeset preset="chat">{renderedMarkdown}</Typeset>
// preset?: "docs" | "chat" | "reading" — mặc định "docs"
// Nhận đủ props của <div> (className merge qua cn())
```

Escape hatch: component lồng trong vùng nội dung dùng `not-typeset` /
`data-not-typeset`. Dùng chuỗi class `typeset typeset-docs` trực tiếp vẫn hợp
lệ khi không tiện import component.

## Kiểm thử & nghiệm thu

1. TDD: `typeset.spec.ts` viết TRƯỚC `typeset.tsx` — cover `typesetVariants`
   (logic thuần cva): default → `typeset typeset-docs`; từng preset đúng class;
   ≥80% trên logic mới (luật #4).
2. `pnpm gate:int` xanh (build + typecheck + unit + lint + int; luật #11).
3. Kiểm chứng thủ công (báo cáo kèm bằng chứng): page tạm trong apps/web render
   một khối HTML mẫu với 3 preset — xác nhận CSS ăn qua chuỗi import
   `@tourism/ui/globals.css` → `typeset.css`, rồi gỡ page tạm trước khi giao.

## Rủi ro & lưu ý

- `margin-trim` trong lõi upstream là thuộc tính mới — trình duyệt chưa hỗ trợ
  sẽ bỏ qua, đã có fallback `:first-child` ở cuối file (upstream tự xử lý).
- Biome sẽ format/lint file CSS vendor: nếu `biome check` đòi sửa phần lõi,
  thêm ignore riêng cho file này thay vì để Biome viết lại (giữ khả năng diff
  upstream — cùng tinh thần ADR-0012 #3).

# ADR-0012 — Typography cho nội dung render: shadcn/typeset trong `@tourism/ui`

- **Trạng thái:** Accepted (2026-07-22)
- **Bối cảnh:** Nối tiếp [ADR-0011](0011-p3b-web-architecture.md) (shared UI `@tourism/ui`,
  59 component base-nova). P3b cần style cho nội dung render từ markdown/rich-text
  (mô tả tour, itinerary, trang tĩnh); P6 cần typography cho chat streaming; P4 cần
  preview nội dung trong admin.

## Bối cảnh

Nội dung do backend trả về (markdown/HTML render) không thể style từng thẻ bằng
utility class — cần một hệ typography bao trùm. Nexora giải quyết bằng plugin
`@tailwindcss/typography` (`prose prose-sm dark:prose-invert` ở chat-panel,
post-content, tour-itinerary). Ngày 10/07/2026 shadcn phát hành **Typeset**
([changelog](https://ui.shadcn.com/docs/changelog/2026-07-typeset) ·
[docs](https://ui.shadcn.com/docs/typeset)): hệ typography đóng gói trong **một
file CSS thuộc sở hữu repo**, điều khiển bằng 3 biến (`--typeset-size`,
`--typeset-leading`, `--typeset-flow`), thiết kế cho streaming (block mới không
restyle block cũ), tự ăn theo biến theme `--color-*`.

## Quyết định

1. **Dùng shadcn/typeset thay `@tailwindcss/typography`.** Lý do: (a) file CSS
   nằm trong repo, sửa trực tiếp — không thêm plugin dependency, đúng triết lý
   copy-and-own của bộ 59 component hiện có; (b) 3 biến điều khiển gọn hơn hệ
   modifier `prose-*`; (c) thiết kế cho streaming — đúng nhu cầu AI concierge
   (P6); (d) đọc biến theme `--color-foreground/muted-foreground/border` đã khai
   trong `globals.css` → dark mode và việc wire `@tourism/tokens` (task treo)
   hưởng tự động, không config thêm.
2. **Vị trí: `libs/shared/ui/src/styles/typeset.css`**, `@import` ngay trong
   `globals.css` (sau các import Tailwind). Mọi app (web, admin sau này) hưởng
   qua entry duy nhất `@tourism/ui/globals.css` — không thêm entry export mới.
3. **Nguồn: vendor từ upstream** `shadcn-ui/ui@main`
   (`apps/v4/app/(app)/(typeset)/typeset.css`, tải 2026-07-22 — Typeset không có
   registry item, không cài được qua `shadcn add`; quy trình chính thức là
   chép file về sở hữu). **Phần lõi giữ nguyên nguyên bản kể cả comment tiếng
   Anh** — ngoại lệ có chủ đích của luật comment-tiếng-Việt (CLAUDE.md #8),
   coi như vendored artifact, để diff được với upstream khi cần cập nhật.
   Phần preset tự viết bên dưới comment tiếng Việt như thường lệ.
4. **Ba preset dùng chung** (class đặt 3 biến điều khiển, định nghĩa trong
   `typeset.css`):
   - `.typeset-docs` — mặc định rộng rãi: mô tả tour, itinerary, FAQ, admin preview (P3b/P4);
   - `.typeset-chat` — chặt, cỡ chữ nhỏ (tương đương `prose-sm` Nexora): AI concierge (P6);
   - `.typeset-reading` — thoáng, cỡ chữ lớn hơn: trang đọc dài (about, policy, blog).
5. **Wrapper component `<Typeset preset="docs|chat|reading">`** trong
   `@tourism/ui/components/typeset` (cva, pattern `data-slot` như 59 component
   hiện có) — preset type-safe, khỏi gõ chuỗi class tay. Dùng thẳng class
   `typeset typeset-*` vẫn hợp lệ (ví dụ trong RSC thuần HTML).

## Đối chiếu Nexora (luật #10)

| Nexora | v2 | Phân loại |
| --- | --- | --- |
| `prose prose-sm dark:prose-invert` (chat-panel) | `typeset typeset-chat` (dark tự theo theme) | v2 tốt hơn (streaming-safe, ít class) |
| `prose` (post-content admin, tour-itinerary) | `typeset typeset-docs` | Tương đương, làm khác |
| Plugin `@tailwindcss/typography` trong deps | Không dependency — CSS vendored | v2 tốt hơn |

## Hệ quả

- KHÔNG cài `@tailwindcss/typography` vào repo này (tranh vai với typeset).
- Component lồng trong vùng nội dung cần thoát style: class `not-typeset` hoặc
  attr `data-not-typeset`.
- Cập nhật upstream sau này = diff thủ công phần lõi (đã pin nguồn + ngày ở
  header file); preset của mình không bị ảnh hưởng.
- `@tourism/ui` bắt đầu có unit test (vitest) — trước đây chỉ typecheck.

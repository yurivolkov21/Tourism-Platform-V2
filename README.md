# tourism-v2

Nền tảng đặt tour du lịch trực tuyến — **đồ án tốt nghiệp**, xây lại và nâng cấp
từ dự án trước (Nexora). Khách tìm tour, đặt chỗ, trả tiền, tự huỷ và viết đánh
giá; nhân viên quản trị theo dõi đơn, duyệt hoàn tiền và ra báo cáo. Site chạy
thật tại **[www.nexora-travel.agency](https://www.nexora-travel.agency)** nhưng
**không có doanh thu**: cổng thanh toán luôn ở chế độ thử nghiệm.

Kho mã là monorepo **pnpm + Turborepo**; máy dev Windows native (từ 14/09/2026).

> Tên thương hiệu là **Nexora** (chốt 19/08/2026). Scope `@tourism/*` cố ý giữ
> nguyên: đó là tên gói nội bộ, người dùng không thấy.

## Mười gói trong kho mã

| Gói | Đường dẫn | Là gì | Stack | Trạng thái |
| --- | --- | --- | --- | --- |
| `@tourism/api` | `apps/api` | Máy chủ: mọi luật nghiệp vụ và tiền bạc | NestJS 11 · Prisma 7 · oRPC · Better Auth · pg-boss · Stripe/PayPal | ✅ chạy thật trên Render |
| `@tourism/web` | `apps/web` | Trang khách hàng | Next.js 16 · React 19 · Tailwind 4 | ✅ chạy thật trên Vercel |
| `@tourism/admin` | `apps/admin` | Trang quản trị nội bộ | Next.js 16 · React 19 · Tailwind 4 | ✅ P4a–P4e và P4f Users chạy thật (13/10) · Media chưa có spec |
| `@tourism/mobile` | `apps/mobile` | App điện thoại | Expo SDK 57 · RN 0.86 (New Arch) | ✅ đủ năm cụm màn (12/10) · đăng nhập Google native (13/10) · demo bằng APK Android |
| `@tourism/contract` | `libs/shared/contract` | Bản hợp đồng dữ liệu giữa máy chủ và các app | Zod 4 + oRPC (kiểu dữ liệu thông suốt hai đầu) | ✅ |
| `@tourism/core` | `libs/shared/core` | Luật nghiệp vụ thuần, không dính khung nào | TypeScript | ✅ |
| `@tourism/ui` | `libs/shared/ui` | Component dùng chung cho web và admin | React 19 · Tailwind 4 | ✅ |
| `@tourism/mobile-ui` | `libs/mobile/ui` | Component dùng chung cho app điện thoại | React Native | ✅ |
| `@tourism/tokens` | `libs/shared/tokens` | Bảng màu, phông chữ, khoảng cách — một nguồn cho cả bốn app | Style Dictionary · oklch → CSS vars + theme RN | ✅ |
| `@tourism/i18n` | `libs/shared/i18n` | Toàn bộ chữ hiển thị cho người dùng (tiếng Anh) + văn bản pháp lý | TypeScript | ✅ |

## Yêu cầu

- **Node 24 LTS** (khớp CI + Dockerfile) · **pnpm 11.9** (ghim ở `packageManager`) ·
  **Docker Desktop** (Postgres cho `test:int`) · **GitHub CLI** đã `gh auth login`
  (luật 14 CLAUDE.md)
- Windows: `pnpm config set script-shell "C:\Devs\Git\bin\bash.exe"` — lý do
  và các bẫy còn lại ở CLAUDE.md → Gotchas
- 8 file env KHÔNG nằm trong git: `.env.local` + `.env.production` của `apps/api`,
  `apps/web`, `apps/admin`, `apps/mobile` — dựng lại từ `.env.example` hoặc bản sao lưu

## Lệnh thường dùng (từ repo root)

```bash
pnpm install
pnpm build          # turbo run build (cache)
pnpm test           # turbo run test
pnpm typecheck      # turbo run typecheck (TypeScript 7 / tsgo-native)
pnpm lint           # biome check
pnpm gate           # build + typecheck + test + lint — vòng lặp nhanh khi đang code
pnpm gate:int       # gate + integration test (cần Docker) — chạy TRƯỚC khi khai xong việc
```

## Tài liệu

Mới vào dự án thì đọc theo thứ tự này:

1. **[docs/overview.md](docs/overview.md)** — sản phẩm làm gì, ai dùng, sáu
   luồng chính. Không cần biết lập trình.
2. **[docs/glossary.md](docs/glossary.md)** — từ điển thuật ngữ dùng khắp mã
   nguồn và tài liệu.
3. **[docs/README.md](docs/README.md)** — bản đồ toàn bộ tài liệu.
4. **[docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md)** — chọn công
   nghệ nào và vì sao.
5. **[CLAUDE.md](CLAUDE.md)** — quy ước làm việc trong kho mã này.

Việc đang còn nợ: **[docs/open-items.md](docs/open-items.md)**.

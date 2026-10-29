# Nexora: nền tảng đặt tour du lịch

[English summary](#english-summary)

Nexora là website bán tour du lịch Việt Nam, làm đồ án tốt nghiệp. Khách tìm tour,
đặt chỗ, trả tiền, tự huỷ và viết đánh giá. Nhân viên quản trị theo dõi đơn, xử lý
hoàn tiền và quản lý nội dung trên một trang riêng. Ngoài ra còn có app Android cho
khách và một trợ lý AI tư vấn tour trên web.

Xem nhanh sản phẩm trong clip 70 giây:

<!-- markdownlint-disable-next-line MD034 -->
https://github.com/user-attachments/assets/dc471888-7a3e-4f68-a40a-71e0c756a5d0

Site chạy thật tại [www.nexora-travel.agency](https://www.nexora-travel.agency)
nhưng không thu tiền thật: Stripe và PayPal luôn ở chế độ thử, chỉ nhận thẻ thử do
chính hai cổng thanh toán cấp. Chữ trên sản phẩm là tiếng Anh; tài liệu và comment
trong code viết bằng tiếng Việt.

Repo này viết lại và nâng cấp một dự án cũ cùng tên Nexora. Các gói trong code
mang tên `@tourism/*`; đó là tên nội bộ, người dùng không thấy.

## Repo gồm những gì

Repo là monorepo dùng pnpm và Turborepo, gồm bốn ứng dụng và sáu gói dùng chung.

| Gói | Thư mục | Vai trò | Công nghệ chính |
| --- | --- | --- | --- |
| `@tourism/api` | `apps/api` | Máy chủ API: mọi luật nghiệp vụ, thanh toán, email và việc chạy nền | NestJS 11, Prisma 7, oRPC, Better Auth, pg-boss |
| `@tourism/web` | `apps/web` | Website cho khách | Next.js 16, React 19, Tailwind CSS 4 |
| `@tourism/admin` | `apps/admin` | Trang quản trị cho nhân viên và chủ trang | Next.js 16, React 19, Tailwind CSS 4 |
| `@tourism/mobile` | `apps/mobile` | App điện thoại cho khách | Expo SDK 57, React Native 0.86 |
| `@tourism/contract` | `libs/shared/contract` | Hợp đồng dữ liệu giữa API và các app, để hai đầu dùng chung kiểu dữ liệu | Zod 4, oRPC |
| `@tourism/core` | `libs/shared/core` | Luật nghiệp vụ thuần, dùng chung cho web và app điện thoại | TypeScript |
| `@tourism/i18n` | `libs/shared/i18n` | Toàn bộ chữ hiển thị cho người dùng và văn bản pháp lý | TypeScript |
| `@tourism/tokens` | `libs/shared/tokens` | Màu, phông chữ và khoảng cách, một nguồn cho mọi ứng dụng | Style Dictionary |
| `@tourism/ui` | `libs/shared/ui` | Component giao diện dùng chung cho web và admin | React 19, Tailwind CSS 4 |
| `@tourism/mobile-ui` | `libs/mobile/ui` | Component giao diện dùng chung cho app điện thoại | React Native |

Bản chạy thật đặt API trên Render, web và admin trên Vercel, cơ sở dữ liệu
PostgreSQL trên Supabase, ảnh trên Cloudinary, email gửi qua Resend. App Android
hiện chạy bằng bản build thử (APK) dùng cho demo, chưa đưa lên cửa hàng ứng dụng.

## Chạy trên máy

Các bước dưới đây đã chạy thử ngày 26/10/2026 trên một bản clone mới. Giá trị
mặc định trong file mẫu đủ để chạy, không cần khoá hay tài khoản dịch vụ nào.

### Cần cài sẵn

- Node.js 24.
- pnpm 11.9: `npm install -g pnpm@11.9.0`.
- Docker, để chạy PostgreSQL 17 (trên Windows và macOS dùng Docker Desktop).
- Git.

### Dựng lần đầu

```bash
git clone https://github.com/yurivolkov21/Tourism-Platform-V2.git
cd Tourism-Platform-V2
pnpm install

# File cấu hình cho máy, chép từ file mẫu của từng ứng dụng
for app in api web admin mobile; do cp apps/$app/.env.example apps/$app/.env.local; done

# PostgreSQL 17 trong Docker, cổng 5432
docker compose up -d postgres

# Dựng các gói dùng chung và API, kèm sinh Prisma client
pnpm turbo run build --filter=@tourism/api --filter="./libs/**"

# Tạo bảng rồi nạp dữ liệu mẫu: 29 tour, 18 điểm đến, 120 khách, 730 đơn
pnpm --filter @tourism/api exec prisma migrate deploy
pnpm --filter @tourism/api db:seed
```

### Mở ứng dụng

Mỗi lệnh chạy trong một cửa sổ terminal riêng:

```bash
pnpm --filter @tourism/api dev     # API ở http://localhost:3001
pnpm --filter @tourism/web dev     # web cho khách ở http://localhost:3000
pnpm --filter @tourism/admin dev   # trang quản trị ở http://localhost:3002
```

App điện thoại chạy bằng Expo Go hoặc bản build thử; các bước nằm ở
[docs/conventions/mobile-dev-loop.md](docs/conventions/mobile-dev-loop.md).

### Đăng nhập thử

- **Khách:** dữ liệu mẫu có 120 khách, email dạng `ten.ho@example.com` (ví dụ
  `aisha.rahman@example.com`), dùng chung mật khẩu `Nexora!Demo2026`. Mật khẩu này
  chỉ dùng cho cơ sở dữ liệu trong Docker; khi seed lên production, script từ chối
  mật khẩu mặc định.
- **Quản trị:** tài khoản `admin@tourism.test` có quyền chủ trang nhưng chưa có
  mật khẩu. Thêm `WORKER_INLINE=true` vào `apps/api/.env.local` để API tự chạy
  việc nền, trong đó có gửi email, rồi khởi động lại API. Vào
  <http://localhost:3000/forgot-password> và nhập email trên. Khoảng một phút sau,
  log của API in dòng `deliver PASSWORD_RESET` kèm link đặt lại mật khẩu. Mở link,
  đặt mật khẩu mới, rồi đăng nhập ở <http://localhost:3002>.
- **Tài khoản mới:** đăng ký trên web thì cần nhập mã xác minh email. Mã in ngay
  trong log của API, ở dòng `deliver EMAIL_OTP`.

### Ở máy khác site thật ở đâu

Với file cấu hình mặc định:

- Không có ảnh, vì dữ liệu mẫu không kèm ảnh; ảnh của site thật nằm trên
  Cloudinary.
- Không thanh toán được. Muốn thử thì điền khoá chế độ thử của Stripe hoặc PayPal
  (nhóm 3 trong `apps/api/.env.example`). Webhook của Stripe về máy qua lệnh
  `stripe listen --forward-to localhost:3001/api/webhooks/stripe`.
- Email không gửi đi mà in ra log của API.
- Đăng nhập bằng Google và trợ lý AI đang tắt; bật bằng các biến tương ứng trong
  `apps/api/.env.example`.
- Lịch chuyến trong dữ liệu mẫu nằm trong năm 2026, nên từ năm 2027 dữ liệu mẫu
  không còn chuyến nào để đặt.

### Chạy trên Windows

Script của pnpm cần Bash. Cài Git for Windows rồi trỏ pnpm sang Git Bash, ví dụ:

```bash
pnpm config set script-shell "C:\Program Files\Git\bin\bash.exe"
```

Chạy các lệnh ở trên từ Git Bash, không chạy từ PowerShell. Các bẫy khác của
Windows ghi ở mục Gotchas trong [CLAUDE.md](CLAUDE.md).

## Kiểm tra trước khi gửi thay đổi

```bash
pnpm gate       # build, typecheck, unit test, lint
pnpm gate:int   # như trên, thêm integration test chạy trên PostgreSQL trong Docker
```

Bản build của web gọi API thật để dựng sẵn trang, nên khi chạy hai lệnh này API
phải đang chạy ở cổng 3001 với dữ liệu mẫu, còn server dev của web thì phải tắt.
Định dạng và lint dùng Biome (`pnpm lint:fix` tự sửa); repo không dùng Prettier
hay ESLint. Quy ước làm việc đầy đủ (nhánh, commit, ADR trước code) nằm ở
[CLAUDE.md](CLAUDE.md).

## Tài liệu

Đọc lần đầu thì theo thứ tự này:

1. [docs/overview.md](docs/overview.md): sản phẩm làm gì, ai dùng, các luồng
   chính. Không cần biết lập trình.
2. [docs/glossary.md](docs/glossary.md): thuật ngữ và các mã nội bộ như P4e, W2,
   G41.
3. [docs/README.md](docs/README.md): bản đồ toàn bộ tài liệu, phần nào còn cập
   nhật và phần nào là lịch sử.
4. [docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md): chọn công nghệ
   nào và vì sao.

Việc còn mở nằm ở [docs/open-items.md](docs/open-items.md).

## Giấy phép

Code và tài liệu viết cho dự án này dùng giấy phép MIT, toàn văn ở
[LICENSE](LICENSE): ai cũng được dùng, sửa và phát hành lại, kể cả cho mục đích
thương mại, miễn là giữ nguyên dòng bản quyền và lời giấy phép.

Giấy phép MIT không áp cho phần của tác giả khác có trong repo: ảnh mẫu trong
`apps/web/public/mock/` (Unsplash và Wikimedia Commons), component chép từ
shadcn/ui, ReUI, Magic UI và React Bits, hình logo lấy từ mẫu miễn phí của
PrebuiltUI, và các skill cho agent trong `.claude/skills/`. Mỗi phần giữ giấy
phép riêng, liệt kê ở [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Ảnh trên
site thật nằm trên Cloudinary chứ không nằm trong repo, và mỗi ảnh cũng giữ giấy
phép riêng.

## English summary

Nexora is a tour booking platform for travel in Vietnam, built as a graduation
project. Customers browse tours, book a departure, pay, cancel by themselves and
write reviews; staff manage bookings, refunds and content in a separate admin
site. There is also an Android app and an AI assistant that answers questions
about tours. The live site is
[www.nexora-travel.agency](https://www.nexora-travel.agency). Payments always run
in Stripe and PayPal test mode, so no real money changes hands. The 70-second
video at the top of this page gives a quick tour of the product.

The repository is a pnpm and Turborepo monorepo: a NestJS API, two Next.js apps
(customer site and admin), an Expo app, and shared packages for the API contract,
business rules, copy and design tokens. The product's UI copy is in English;
documentation and code comments are in Vietnamese.

To run it locally you need Node.js 24, pnpm 11.9 and Docker. The commands in
[Chạy trên máy](#chạy-trên-máy) above work as they are: copy each app's
`.env.example` to `.env.local`, start PostgreSQL with Docker Compose, build the
shared packages and the API, migrate and seed the database, then start the API
(port 3001), the customer site (port 3000) and the admin site (port 3002). Seed
customers use `@example.com` addresses with the password `Nexora!Demo2026`, which
only works against the local Docker database.

The project's own code and documentation are released under the MIT license
(see [LICENSE](LICENSE)). Third-party material in the repository keeps its own
license: the sample photos, UI components copied from shadcn/ui, ReUI, Magic UI
and React Bits, the logo mark taken from a PrebuiltUI sample, and the vendored
agent skills. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists each item
with its license.

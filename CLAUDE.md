# CLAUDE.md — tourism-v2

Quy ước cho AI agent (và người) làm việc trong repo này. Kế thừa hợp đồng vận
hành đã chứng minh ở Nexora, cập nhật cho toolchain mới.

> **Code là nguồn sự thật.** Doc lệch code thì sửa doc.

## Dự án là gì

Capstone tốt nghiệp (bảo vệ dự kiến sau ~10/11/2026) — nền tảng đặt tour vận
hành như trang thương mại thật nhưng **không doanh thu**: Stripe/PayPal luôn ở
test/sandbox mode. Rebuild nâng cấp từ Nexora; repo cũ tại
`/mnt/c/Dev Program Files/Dev/Projects/Tourism-Platform` là **tham chiếu chỉ
đọc — tuyệt đối không sửa**.

Stack đã chốt + lý do: [docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md).
Roadmap: P0 khung xương ✅ → P1 API lõi → P2 money-path → P3 web → P4 admin →
P5 mobile → P6 AI concierge → freeze 15/10.

## Quy ước làm việc (bất di bất dịch trừ khi user nói khác)

1. **One feature = one branch.** Branch → implement → user review → merge →
   xóa branch. Docs/meta nhỏ được vào thẳng `main`.
   **Merge kiểu rebase + fast-forward** (quy ước 18/07): trước khi merge, rebase
   branch lên `main` mới nhất rồi `git merge --ff-only` — lịch sử tuyến tính,
   không merge commit.
2. **Hỏi trước khi bắt đầu feature/phase mới; xác nhận trước mọi merge/push.**
3. **Spec → plan → execute** cho feature nhiều bước; spec đặt trong `docs/`.
4. **TDD trên logic thuần** — test trước, ≥80% trên logic mới.
5. **ADR đi TRƯỚC code** cho mọi quyết định kiến trúc (sửa lỗi ADR-retroactive
   của Nexora). ADR đánh số trong `docs/adr/`.
6. **Frontend: tokens-only, không hex** — dùng `@tourism/tokens`.
7. **English-only** cho copy user-facing, tập trung trong `@tourism/i18n`.
8. **`pnpm gate` trước khi khai xanh** (build + typecheck + test + lint).
9. **Commits: Conventional Commits.** KHÔNG AI attribution (quy ước user).
10. **Docs sweep sau mỗi feature merge**: 1 entry vào `docs/CHANGELOG.md`
    (ngày · hash · nội dung · số test) + cập nhật doc hiện-trạng bị ảnh hưởng.

## Chính sách theo lịch (capstone)

- NestJS v12: chỉ migrate nếu GA trước **30/09/2026**, sau đó ở lại v11.
- **Freeze 15/10/2026**: không nâng cấp dependency, không đổi nơi deploy.

## Lệnh

```bash
pnpm gate                        # quality gate đầy đủ
pnpm turbo run test --filter=@tourism/tokens   # một package
pnpm lint:fix                    # biome tự sửa format + lint
```

## Gotchas

- Repo phải nằm trong WSL ext4 (`~/projects/tourism-v2`) — không bao giờ làm
  việc qua `/mnt/c`.
- `.gitattributes` ép LF toàn repo — bài học 797-file CRLF churn của Nexora.
- tsconfig bật `noUncheckedIndexedAccess` (nghiêm hơn Nexora) — code port từ
  Nexora có thể cần chỉnh nhỏ kiểu destructure-with-default.
- `libs/shared/tokens/generated/` là build artifact (gitignored) — build bằng
  `pnpm turbo run build --filter=@tourism/tokens`, không sửa tay.
- Postgres: kết nối direct/session với pool ~10 — **cấm transaction pooler**
  (nguồn gốc mọi contortion của Nexora).

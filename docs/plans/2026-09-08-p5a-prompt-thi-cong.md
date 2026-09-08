# Prompt session THI CÔNG — P5a template mobile (08/09/2026)

Mở session Claude Code mới trong `~/projects/tourism-v2`, dán **nguyên khối**
bên dưới là chạy. Đây là prompt do session gốc sinh ra sau vòng hỏi–đáp ngày
08/09; văn bản nguồn của nó là [ADR-0040](../adr/0040-mobile-app-expo.md) và
[spec P5a](../specs/2026-09-08-p5a-mobile-template-design.md) — prompt chỉ dẫn
đường, **spec mới là hợp đồng**.

Khác với [prompt các phase còn lại](2026-09-08-prompts-cac-phase-con-lai.md)
(toàn prompt "session gốc"), file này là prompt **session thi công**: nhánh
mới, 7 commit, không merge, không push, không chạm hạ tầng sống.

> Vì sao có file này: bản đầu chỉ nằm ở scratchpad tạm của session — user
> **không tìm ra đường dẫn**, phải đợi agent dán lại vào khung chat mới đọc
> được. Deliverable dành cho người thì phải nằm trong repo và trong bản đồ
> `docs/README.md`, không nằm ở `/tmp`.

```text
Bạn là session THI CÔNG của tourism-v2 (~/projects/tourism-v2). Đọc theo thứ tự:
CLAUDE.md (15 luật + gotcha), docs/README.md (bản đồ doc), rồi ba văn bản của
việc này — đã nằm sẵn trên main, KHÔNG phải viết lại:
  docs/adr/0040-mobile-app-expo.md          (quyết định kiến trúc, 9 mục)
  docs/specs/2026-09-08-p5a-mobile-template-design.md   (spec: 7 task, §4 ràng buộc đã ĐO)
  docs/adr/0001-tech-stack.md §AMEND 1  ·  docs/adr/0017-web-session-better-auth.md §9

Việc: P5a — dựng template app mobile (Expo SDK 57 + expo-router + libs/mobile/ui).
Mở nhánh mới `feat/p5a-mobile-template` từ main. ADR + spec đã commit main rồi
nên nhánh này KHÔNG cần commit docs(adr) mở đầu.

LUẬT BẤT DI BẤT DỊCH CỦA SESSION NÀY
- KHÔNG merge, KHÔNG push, KHÔNG subagent.
- KHÔNG chạm hạ tầng sống (CLAUDE.md §15): không deploy migration, không tạo
  webhook, không set env / redeploy Render / Vercel, không đổi Cloudinary.
  Việc P5a không có migration và không đụng apps/api — nếu bạn thấy mình sắp
  sửa apps/api, apps/web hay apps/admin thì DỪNG và hỏi tôi.
- KHÔNG bật/tắt dev server; tôi giữ. Nghiệm thu bằng `bundle` + `typecheck` +
  `test`, không bằng `expo start`.
- KHÔNG BAO GIỜ `git add docs/navel/` (187 MB untracked cố ý). Add theo path
  tường minh, liếc `git diff --cached --stat` trước mỗi commit.
- Comment code TIẾNG VIỆT (luật 8); copy user-facing TIẾNG ANH, tập trung ở
  @tourism/i18n (luật 7). Tokens-only, không hex (luật 6).
- Rà danh sách skill TRƯỚC khi bắt tay (luật 9, docs/skills.md). Cụ thể ở việc
  này: `superpowers:test-driven-development` cho mọi task có code,
  `superpowers:verification-before-completion` trước khi khai xong,
  `expo:expo-project-structure` và `expo:expo-router` cho cây route,
  `turborepo` khi sửa turbo.json. Có skill thì gọi, đừng tự chế lại.

COMMIT
- Conventional Commits, message TIẾNG VIỆT CÓ DẤU đầy đủ (type/scope tiếng Anh:
  `feat(mobile): dựng …`). KHÔNG AI attribution.
- Sau MỖI commit chạy:
    git log -1 --format='%B' | grep -inE '^(co-authored-by|signed-off-by):' \
      && git commit --amend -q --no-edit  # rồi kiểm lại
  Trailer hay tự chèn dù brief cấm — phải kiểm bằng máy, không bằng trí nhớ.
- Mỗi task một commit. 7 task = 7 commit.

BẢY TASK (thứ tự bắt buộc, chi tiết ở spec §2 và §3)

T1  Scaffold apps/mobile + nối toolchain.
    Ma trận version chép NGUYÊN từ spec §4.2 — đừng sáng tác, đừng `expo install`
    thêm gì ngoài danh sách đó. KHÔNG cài @expo/ui, expo-glass-effect,
    expo-symbols, expo-device, reanimated, gesture-handler, react-native-web,
    react-dom (spec §4.2 nói vì sao).
    app.json: name "Nexora Travel", scheme `nexora`, newArchEnabled.
    Gỡ SẠCH eslint + eslint-config-expo + file config mà scaffold sinh ra
    (spec §4.3) — CLAUDE.md cấm tuyệt đối ESLint/Prettier.
    KHÔNG sửa pnpm-workspace.yaml; KHÔNG tạo metro.config.js trừ khi có lý do
    cụ thể, và nếu tạo thì cấm 4 khoá ở spec §4.4.
    turbo.json: thêm task `bundle` (outputs dist/**), KHÔNG đặt tên `build`.
    .env.example (commit) + .env.local (gitignored) + src/lib/env.ts fail-fast.

    *** CỔNG BẮT BUỘC (spec §4.1) ***
    Chạy `pnpm turbo run typecheck --filter=@tourism/mobile`.
    Repo dùng tsgo (TS 7); Expo ghim TS ~6. Chưa ai đo tsgo trên React Native.
    - Xanh  → đi tiếp, ghi một dòng vào CHANGELOG là đã đo.
    - Đỏ    → thử trước gotcha 04/08 (tsgo đòi khai `types` tường minh trong
              tsconfig). Vẫn đỏ → DỪNG LẠI, BÁO TÔI, không tự quyết.
              TUYỆT ĐỐI KHÔNG lặng lẽ cấp cho apps/mobile một compiler riêng.

T2  libs/mobile/ui (@tourism/mobile-ui) + ThemeProvider/useTheme — TDD.
    Đọc @tourism/tokens/theme; theo useColorScheme cho dark/light.
    ThemeProvider là chỗ DUY NHẤT import theme (ADR-0040 §3).
    CẤM phụ thuộc @tourism/ui.
T3  Primitive Screen + AppText — TDD.
T4  Primitive Button + Card + EmptyState — TDD.
T5  Copy mobile vào @tourism/i18n (nhãn 5 tab, tiêu đề màn, EmptyState) — TDD.
    Đứng TRƯỚC T6 để T6 không đẻ chuỗi inline rồi phải gỡ.
T6  Cây route expo-router 12 file (spec §3) — TDD. Mỗi màn là placeholder có
    tiêu đề + EmptyState. KHÔNG mock data giả, KHÔNG gọi API, KHÔNG auth thật,
    KHÔNG bố cục theo docs/navel — đó là P5b.
T7  CI: thêm step `pnpm turbo run bundle --filter=@tourism/mobile` vào
    .github/workflows/ci.yml (không cần Postgres/API). Runbook dev loop
    (tunnel là mặc định vì WSL NAT; lối LAN khi tôi bật mirrored; nhắc phải
    build tokens trước — spec §4.5). Docs sweep.

TEST — bảng bắt buộc ở spec §5. Đặc biệt phải có spec quét regex
`#[0-9a-fA-F]{3,8}` trong libs/mobile/ui/src/lib và assert RỖNG (canh luật
tokens-only bằng máy).

KẾT THÚC — trước khi khai xong, chạy đủ và DÁN OUTPUT THẬT (luật 11):
 1. pnpm gate:int  trọn — cần API tạm :3001 trên docker `tourism` theo công
    thức CI; KHÔNG dùng .env.local của apps/api (trỏ Supabase prod). Kill sau.
 2. pnpm turbo run bundle --filter=@tourism/mobile     ← gate KHÔNG chạy cái này
 3. cd apps/mobile && pnpm exec expo-doctor            ← không mục đỏ
 4. ./scripts/check-rls.sh
 5. grep -rn "eslint\|prettier" apps/mobile libs/mobile   → phải RỖNG
 6. git status --short docs/navel                          → phải RỖNG
Rồi: entry docs/CHANGELOG.md ghi rõ "CHƯA merge, chờ review session riêng" —
ngày · nội dung · số test · kết quả CỔNG tsgo · mục CÒN TREO; cập nhật
docs/README.md hàng P5. CHÚ Ý: entry mới KHÔNG được có dòng bắt đầu bằng `+`
(gotcha CHANGELOG), và `git diff` file .md trước khi stage.

Xong thì báo tôi "thi công xong" kèm danh sách commit — tôi mang sang session
gốc để review 8 mũi rồi mới merge.
```

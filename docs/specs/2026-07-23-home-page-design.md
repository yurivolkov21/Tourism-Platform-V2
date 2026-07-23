# Spec — Trang Home tĩnh + shell chung (2026-07-23)

Mở màn giai đoạn "dựng trang" P3b theo quy trình **static-first** đã chốt với user:
dựng tĩnh bằng mock → user review nhiều vòng → chốt trang mới gắn API (mock là
công cụ khám phá schema). Tham chiếu thẩm mỹ: template Estate (PrebuiltUI,
licensed) — **chỉ mượn cấu trúc section + pattern motion, viết lại toàn bộ bằng
component @tourism/ui + tokens Wuling** (code template hardcode màu, không shadcn
— không copy).

## Phạm vi (KHÓA — theo yêu cầu user)

CHỈ: trang Home (`/`) + shell chung (header/footer/logo) + hạ tầng mock + dep
`motion`. KHÔNG dựng trang nào khác (auth, listing, chi tiết…) — các trang sau
phải được phân tích và chốt riêng với user trước khi làm.

## Quyết định thiết kế (đã duyệt trong brainstorm)

1. **Animation: dùng `motion` (framer-motion v12), phong cách ĐẬM** — chỉ đạo
   của user: motion là lý do chọn template tham khảo, không tiết chế. Pattern
   chính (học Estate): hero stagger spring khi load; section reveal
   `whileInView` (once); counter đếm số; hover lift card. Baseline bất khả
   xâm phạm: mọi animation tôn trọng `prefers-reduced-motion` (dùng
   `useReducedMotion`/`MotionConfig reducedMotion="user"`).
2. **Logo: mark "Slidex"** (PrebuiltUI free placeholder logos — hai viên kim
   cương bo góc lồng nhau; user chọn ở review vòng 1, thay mark "Vectory" ban
   đầu) — CHỈ dùng phần mark; viên sau nhuộm ngọc (`--primary`), viên trước mực
   (`--foreground`); wordmark là chữ "tourism" render bằng Literata. Ghi chú:
   placeholder logo = không độc quyền, đủ cho capstone; thương mại hóa nghiêm
   túc thì đặt mark riêng (P7+).
3. **Ảnh mock**: ~8 ảnh Unsplash (license cho phép) TẢI VỀ `apps/web/public/mock/`
   — không hotlink (bài học từ template Forged). Tối ưu qua `next/image`.
4. **RSC-first**: page + section là Server Component; `"use client"` chỉ ở
   island: `Reveal` (wrapper motion), `AnimatedCounter`, `SearchCard`
   (tương tác giả), header (mobile menu). Copy user-facing tiếng Anh (#7),
   comment tiếng Việt (#8), màu 100% semantic token (#6 — không hex).

## Cấu trúc file

| File | Vai trò |
| --- | --- |
| `apps/web/src/app/page.tsx` | Compose 8 section (RSC) |
| `apps/web/src/components/logo.tsx` | Mark SVG inline (fill theo token) + wordmark Literata |
| `apps/web/src/components/site-header.tsx` | Sticky, nền sương blur, nav links, CTA; mobile: Sheet |
| `apps/web/src/components/site-footer.tsx` | Nền đêm trúc, cột link + newsletter mini |
| `apps/web/src/components/motion/reveal.tsx` | Client island: `whileInView` reveal (stagger tùy chọn) |
| `apps/web/src/components/motion/animated-counter.tsx` | Client island: đếm số spring |
| `apps/web/src/components/home/hero.tsx` | Panorama Wuling (gradient token + sương + trúc CSS) + headline + SearchCard + trust meta |
| `apps/web/src/components/home/search-card.tsx` | Client island: Where/Dates/Travelers (Field + InputGroup + Button) — UI thuần, submit no-op |
| `apps/web/src/components/home/tour-card.tsx` | Card + next/image + Badge + ★ rating (`text-rating`) + giá tabular — linh kiện tái dùng toàn site |
| `apps/web/src/components/home/featured-tours.tsx` | Grid 6 TourCard + section head |
| `apps/web/src/components/home/regions-strip.tsx` | 3 card `data-region` — gradient mini theo `--region-*` (page-level được phép dùng, ADR-0013 #4) |
| `apps/web/src/components/home/why-us.tsx` | 4 điểm mạnh, icon lucide, nền celadon (`bg-muted`) |
| `apps/web/src/components/home/stats.tsx` | 4 AnimatedCounter |
| `apps/web/src/components/home/testimonials.tsx` | 3 quote card + rating |
| `apps/web/src/components/home/journal-preview.tsx` | 3 bài mock, heading Literata |
| `apps/web/src/components/home/cta-band.tsx` | Dải jade đậm + email input (no-op) |
| `apps/web/src/mocks/types.ts` | `MockTour`, `MockRegion`, `MockTestimonial`, `MockJournalPost` — khai tường minh, TỰ DO theo nhu cầu UI (không ép theo Prisma) |
| `apps/web/src/mocks/{tours,regions,testimonials,journal}.ts` | Dữ liệu: 6 tour VN thật tên tiếng Anh + địa danh có dấu; 3 vùng; 3 review; 3 bài |
| `apps/web/public/mock/*.jpg` | ~8 ảnh tải về |
| `apps/web/package.json` | + `motion` |

## Nội dung 8 section (thứ tự trên trang)

1. **Hero** — jade moment lớn nhất; search card nổi như demo landing đã duyệt.
2. **Featured tours** — 6 tour: Ha Long Bay Cruise, Sa Pa Terraces Trek, Hoi An
   Lantern Evening, Hue Imperial Day, Mekong Delta Boats, Da Nang Coast Ride.
3. **Regions strip** — North/Central/South, tint `--region-*`, copy tiếng Anh
   (không codename game).
4. **Why us** — Local guides · Small groups · Free cancellation 48h · Best price.
5. **Stats** — 68 tours · 12,400+ travelers · 140+ guides · ★ 4.9.
6. **Testimonials** — 3 quote + tên + tour đã đi.
7. **Journal preview** — 3 bài (mist season, street food, packing).
8. **CTA band** + footer.

## Kiểm thử & nghiệm thu

1. TDD cho logic thuần duy nhất phát sinh: helper format giá/`formatUsd`
   (nếu chỉ dùng `Intl` trực tiếp inline thì không cần test riêng — không chế
   helper thừa). Mock data hợp lệ: 1 spec validate bằng type + vài bất biến
   (6 tour, mỗi tour có ảnh tồn tại trong public/mock — kiểm tra tên file).
2. Build + typecheck + biome xanh; `pnpm gate:int` trước khi khai xong (#11).
3. Kiểm chứng visual: screenshot full-page light + dark + mobile (390px) —
   nộp cho user vòng review 1. Không merge — trang chỉ "chốt" khi user duyệt
   qua các vòng chỉnh.

## Rủi ro & lưu ý

- `motion` v12: import từ `motion/react`; RSC — motion component phải nằm trong
  client island, không import motion trong Server Component.
- Ảnh Unsplash: chọn ảnh đúng chủ đề VN, nén về ~1600px width (sharp có sẵn) để
  repo không phình; ghi nguồn ảnh trong `public/mock/CREDITS.md`.
- Header sticky + blur: dùng token (`bg-background/85` + `backdrop-blur`) —
  không hex.
- Logo SVG: path trích từ gallery đã lưu scratchpad; đưa vào component phải
  strip width/height cứng, fill = `currentColor`/var để theo theme.

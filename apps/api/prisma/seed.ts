/**
 * Database seed — bản port v2 của seed Nexora, chỉnh cho schema v2.
 *
 * Seed những gì (catalog cốt lõi + functional overlay):
 *   1. Catalog fixtures (`./fixtures/catalog/index.ts`, tách theo miền Bắc/
 *      Trung/Nam từ 2026-07-31 — trước đó một file `catalog.ts` port từ
 *      Nexora, đã xoá): tour category, destination, tour (+ M:N destination,
 *      itinerary, FAQ, policy, departure). `createMany({ skipDuplicates })` →
 *      chạy lại được nhiều lần.
 *   2. Site media slot — 9 slot key brand-chrome (Nexora seed chúng bằng
 *      migration; ở đây seed upsert chúng).
 *   3. Một CUSTOMER đăng nhập được (`customer@tourism.test`) + một ADMIN (entry
 *      đầu của `ADMIN_EMAILS`, mặc định `admin@tourism.test`) — chỉ là User row
 *      thường; Better Auth đọc cùng bảng, đăng ký cùng email để link vào.
 *   4. Một PAID booking tự ký (`BK-SEEDPAID`) thuộc về customer đó, kèm các cột
 *      snapshot v2 (tourTitle/ngày departure/unitPrice), để các luồng review /
 *      "my bookings" thử được mà không cần payment thật.
 *   5. 9 bài blog port từ mock journal đã duyệt của web (`./fixtures/posts.ts`)
 *      — upsert theo slug, tag connectOrCreate theo slug, authorId = admin.
 *   6. 84 review CURATED cho 24/30 tour (`./fixtures/catalog/reviews.ts`, spec
 *      2026-07-31-tours-catalogue-api §4/§5) — `createMany({ skipDuplicates })`
 *      với `source: CURATED`, `isApproved: true`, không userId/bookingId.
 *   6b. Recompute `ratingAvg`/`ratingCount` cho MỌI tour ngay sau bước 6 —
 *      CÙNG một công thức với `ReviewsService.moderate` ③ (quyết định 31/07:
 *      mọi review approved có tourId đều tính, kể cả CURATED): chỉ lọc
 *      `isApproved = true` + `tourId` khớp, KHÔNG lọc theo `source`
 *      (`AVG(rating)::numeric(2,1)`) — xem doc-comment tại chỗ gọi bên dưới.
 *
 * KHÔNG port từ Nexora (các fixture phụ thuộc user, vốn giả định identity
 * Supabase): user mẫu, booking, payment event, wishlist, enquiry, outbox,
 * media asset/rác.
 *
 * Chạy: pnpm --filter @tourism/api db:seed  (compile qua swc, xem package.json)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  BookingStatus,
  DepartureStatus,
  PaymentProvider,
  PostStatus,
  ReviewSource,
  UserRole,
} from '../src/generated/prisma/enums.js';
import * as catalog from './fixtures/catalog/index.js';
import { posts as blogPosts } from './fixtures/posts.js';

/** Code của PAID booking tự ký (thuộc về customer trong overlay). */
const PAID_BOOKING_CODE = 'BK-SEEDPAID';
/**
 * Gắn PAID booking vào tour này nếu nó đủ điều kiện; nếu không thì departure
 * đủ điều kiện gần nhất (`pickPaidDeparture` có fallback nên KHÔNG throw nếu
 * slug này không khớp). Chọn lại 31/07 theo roster mới (spec
 * 2026-07-31-tours-catalogue-api-design.md §3): `hoi-an-lantern-evening` —
 * day tour rẻ, published, nhiều departure OPEN tương lai còn đủ chỗ trống
 * (vd Aug 2026), hợp cho luồng "my bookings"/review thử mà không cần payment
 * thật.
 */
const PREFERRED_PAID_TOUR_SLUG = 'hoi-an-lantern-evening';
const PAID_SEATS = 2;

/** Các slot key brand-chrome — bản sao của slot catalog phía API (site-media). */
const SITE_SLOT_KEYS = [
  'home-hero',
  'home-experiences',
  'home-why-choose',
  'home-trust',
  'cta-band',
  'content-hero',
  'destinations-hero',
  'auth-panel',
  'about-story',
] as const;

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Ép một giá trị fixture dạng `YYYY-MM-DD` trần về `Date` — Prisma 7
 * `createMany` từ chối string chỉ có ngày cho cột `@db.Date`.
 * `new Date('2026-07-31')` parse thành nửa đêm UTC nên ngày lịch lưu vào không
 * đổi.
 */
const toDate = (value: string): Date => new Date(value);

async function insertCatalog(): Promise<number> {
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    [
      'tourCategories',
      () =>
        prisma.tourCategory.createMany({
          data: catalog.tourCategories,
          skipDuplicates: true,
        }),
    ],
    [
      'destinations',
      () =>
        prisma.destination.createMany({
          data: catalog.destinations,
          skipDuplicates: true,
        }),
    ],
    [
      'tours',
      // UPSERT chứ không `createMany({ skipDuplicates })` (ADR-0023): bảng này
      // giữ NỘI DUNG BÁN HÀNG (mô tả card dữ kiện, cửa sổ huỷ, highlights…) mà
      // biên tập viên còn sửa. `skipDuplicates` bỏ qua row đã tồn tại, nên
      // thêm cột mới hay sửa chữ đều KHÔNG bao giờ tới được DB đang chạy.
      // Đã dính đúng lỗi này ngày 14/08: 5 cột mới của ADR-0023 vẫn null trên
      // cả hai DB sau khi seed báo thành công.
      //
      // Chỉ cập nhật phần NỘI DUNG; `createdAt` và các khoá giữ nguyên.
      async () => {
        for (const t of catalog.tours) {
          const { id, categoryId, createdAt, ...content } = t;
          await prisma.tour.upsert({
            where: { id },
            create: {
              id,
              createdAt,
              category: { connect: { id: categoryId } },
              ...content,
            } as unknown as Prisma.TourCreateInput,
            update: content as unknown as Prisma.TourUpdateInput,
          });
        }
        return { count: catalog.tours.length };
      },
    ],
    [
      'tourDestinations',
      () =>
        prisma.tourDestination.createMany({
          data: catalog.tourDestinations,
          skipDuplicates: true,
        }),
    ],
    [
      'tourItineraryDays',
      () =>
        prisma.tourItineraryDay.createMany({
          data: catalog.tourItineraryDays,
          skipDuplicates: true,
        }),
    ],
    ['tourFaqs', () => prisma.tourFaq.createMany({ data: catalog.tourFaqs, skipDuplicates: true })],
    [
      'tourPolicies',
      // UPSERT chứ không `createMany({ skipDuplicates })` như các bảng cấu trúc
      // khác (ADR-0023 §3): tiêu đề và nội dung chính sách là NỘI DUNG BIÊN
      // TẬP, còn sửa nhiều lần. `skipDuplicates` bỏ qua row đã tồn tại, nên
      // sửa fixture mà giữ cơ chế đó thì DB đang chạy KHÔNG BAO GIỜ nhận nội
      // dung mới — người sửa tưởng đã sửa, trang thì vẫn hiện chữ cũ. Cùng
      // cách `siteMediaSlot`/`posts`/`users` đang làm.
      async () => {
        for (const p of catalog.tourPolicies) {
          const data = { kind: p.kind, order: p.order, title: p.title, body: p.body };
          await prisma.tourPolicy.upsert({
            where: { id: p.id },
            // `connect` thay vì `tourId` trần: `…CreateInput` (dạng upsert dùng)
            // khai quan hệ chứ không khai khoá ngoại, khác `…CreateManyInput`.
            create: { id: p.id, tour: { connect: { id: p.tourId } }, ...data },
            update: data,
          });
        }
        return { count: catalog.tourPolicies.length };
      },
    ],
    [
      'tourDepartures',
      () =>
        prisma.tourDeparture.createMany({
          // Cột @db.Date → ép các string chỉ có ngày (xem toDate).
          data: catalog.tourDepartures.map((d) => ({
            ...d,
            startDate: toDate(d.startDate),
            endDate: toDate(d.endDate),
          })) as unknown as Prisma.TourDepartureCreateManyInput[],
          skipDuplicates: true,
        }),
    ],
  ];

  let total = 0;
  for (const [label, run] of steps) {
    const { count } = await run();
    total += count;
    console.log(`  ${label.padEnd(20)} +${count}`);
  }
  return total;
}

/**
 * Chọn một departure OPEN (trên tour đã publish) còn trống ít nhất `seats` chỗ.
 * Ưu tiên {@link PREFERRED_PAID_TOUR_SLUG} nếu nó đủ điều kiện, nếu không thì
 * departure đủ điều kiện gần nhất. Prisma không so sánh hai cột trong `where`
 * được nên số seat trống được filter ở JS.
 */
async function pickPaidDeparture(seats: number) {
  const candidates = await prisma.tourDeparture.findMany({
    where: { status: DepartureStatus.OPEN, tour: { isPublished: true } },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      tourId: true,
      startDate: true,
      endDate: true,
      seatsTotal: true,
      seatsBooked: true,
      priceOverride: true,
      tour: { select: { slug: true, title: true, basePrice: true, currency: true } },
    },
  });
  const free = candidates.filter((d) => d.seatsTotal - d.seatsBooked >= seats);
  return free.find((d) => d.tour.slug === PREFERRED_PAID_TOUR_SLUG) ?? free[0] ?? null;
}

async function main(): Promise<void> {
  // 1. Fixtures catalog.
  console.log('[seed] loading catalog fixtures...');
  const inserted = await insertCatalog();
  console.log(`[seed] catalog: ${inserted} rows inserted (duplicates skipped).`);

  // 2. Site media slot — uuid ổn định theo từng key để asset gắn vào sau này.
  for (const key of SITE_SLOT_KEYS) {
    await prisma.siteMediaSlot.upsert({ where: { key }, create: { key }, update: {} });
  }
  console.log(`[seed] site media slots: ${SITE_SLOT_KEYS.length} keys upserted.`);

  // 3. Functional overlay — một CUSTOMER đã biết + một ADMIN (upsert theo email
  //    unique kiểu citext). Chỉ là row thường trong bảng `users` của Better
  //    Auth: đăng ký qua Better Auth cùng email sẽ link vào row đó (v2 không có
  //    supabaseId).
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@tourism.test';
  const customer = await prisma.user.upsert({
    where: { email: 'customer@tourism.test' },
    create: {
      email: 'customer@tourism.test',
      name: 'Seed Customer',
      emailVerified: true,
      phone: '+84900000001',
      role: UserRole.CUSTOMER,
    },
    update: { name: 'Seed Customer', role: UserRole.CUSTOMER },
  });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Seed Admin',
      emailVerified: true,
      role: UserRole.ADMIN,
    },
    update: { role: UserRole.ADMIN },
  });
  console.log(`[seed] overlay users: customer=${customer.email} admin=${admin.email}`);

  // 4. PAID booking tự ký với các snapshot lúc create của v2 (audit H3):
  //    tourTitle + ngày departure + unitPrice được đóng băng trên row. Tạo một
  //    lần; seat được claim nguyên tử nên không thể overbook.
  const existing = await prisma.booking.findUnique({
    where: { code: PAID_BOOKING_CODE },
    select: { id: true, tourTitle: true },
  });
  if (existing) {
    console.log(`[seed] PAID booking ${PAID_BOOKING_CODE} already exists — skipped`);
  } else {
    const departure = await pickPaidDeparture(PAID_SEATS);
    if (!departure) {
      throw new Error('[seed] no OPEN fixture departure with free seats for the PAID booking');
    }
    const unitPrice = departure.priceOverride ?? departure.tour.basePrice; // Prisma.Decimal
    await prisma.$transaction(async (tx) => {
      await tx.booking.create({
        data: {
          code: PAID_BOOKING_CODE,
          userId: customer.id,
          tourId: departure.tourId,
          departureId: departure.id,
          numAdults: PAID_SEATS,
          numChildren: 0,
          totalAmount: unitPrice.mul(PAID_SEATS),
          currency: departure.tour.currency,
          status: BookingStatus.PAID,
          // snapshot v2 (audit H3)
          tourTitle: departure.tour.title,
          departureStartDate: departure.startDate,
          departureEndDate: departure.endDate,
          unitPrice,
          contactName: 'Seed Customer',
          contactEmail: customer.email,
          contactPhone: '+84900000001',
          paymentProvider: PaymentProvider.STRIPE,
          providerSessionId: 'cs_seed_paid_1',
          providerPaymentId: 'pi_seed_paid_1',
          paidAt: new Date(),
        },
      });
      await tx.tourDeparture.update({
        where: { id: departure.id },
        data: { seatsBooked: { increment: PAID_SEATS } },
      });
    });
    console.log(
      `[seed] created PAID booking ${PAID_BOOKING_CODE} on ${departure.tour.slug} (${PAID_SEATS} seats)`,
    );
  }

  // 5. Blog posts — 9 bài port từ mock journal đã duyệt của web (spec
  //    2026-07-31-blog-api-design §2B). Upsert theo slug; tag connectOrCreate
  //    theo slug. Ngày đã dời hết về quá khứ (publishedPostWhere lọc
  //    publishedAt <= now — ADR-0004).
  for (const post of blogPosts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(post.publishedAt),
        authorId: admin.id,
        tags: {
          create: post.tags.map((tag) => ({
            tag: { connectOrCreate: { where: { slug: tag.slug }, create: tag } },
          })),
        },
      },
      // Cố ý KHÔNG reconcile: `update: {}` nghĩa là sửa fixture rồi re-seed
      // sẽ KHÔNG đổi 9 row đã tồn tại — slug là khoá match, không phải khoá
      // đồng bộ nội dung. Muốn cập nhật nội dung đã seed thì sửa thẳng DB
      // hoặc xoá row đó rồi seed lại (giống nếp `fixtures/catalog/`).
      update: {},
    });
  }
  console.log(`[seed] blog posts: ${blogPosts.length} upserted.`);

  // 6. Reviews CURATED cho tour (spec 2026-07-31-tours-catalogue-api §4) —
  //    row curated không cần booking/user (FK nullable có chủ đích trong
  //    schema). Idempotent nhờ id tĩnh + skipDuplicates.
  const { count: reviewCount } = await prisma.review.createMany({
    data: catalog.tourReviews.map((review) => ({
      ...review,
      createdAt: new Date(review.createdAt),
      source: ReviewSource.CURATED,
      isApproved: true,
    })),
    skipDuplicates: true,
  });
  console.log(`[seed] tour reviews: +${reviewCount}`);

  // 6b. Recompute ratingAvg/ratingCount cho MỌI tour (kể cả 0 review → null/0)
  //     — CÙNG MỘT công thức với `ReviewsService.moderate` ③
  //     (`src/modules/reviews/reviews.service.ts` ~dòng 250-296) kể từ quyết
  //     định 31/07: `AVG(rating)::numeric(2,1)` trong một câu `UPDATE tours …
  //     FROM (SELECT AVG…)`, lọc `is_approved = true` + `tour_id` khớp,
  //     KHÔNG lọc theo `source` — mọi review approved có tourId đều tính, kể
  //     cả CURATED. (Trước 31/07, service còn lọc thêm
  //     `AND source = 'VERIFIED'` để loại CURATED khỏi rating sản xuất — seed
  //     khi đó CỐ Ý bỏ filter đó vì toàn bộ review seed đều là CURATED, lọc
  //     VERIFIED sẽ luôn ra `ratingAvg = null` bất kể bước 6 vừa insert bao
  //     nhiêu review, vô nghĩa với mục đích của bước này — spec §5: Vũng Tàu
  //     phải ra 4.7/3 từ đúng 3 review CURATED của nó. Quyết định 31/07 đảo
  //     bất biến đó ở service nên hai công thức giờ TRÙNG NHAU — không còn là
  //     một ngoại lệ cố ý của seed nữa, chỉ tình cờ seed đã viết đúng từ đầu.)
  //     Không cần `FOR UPDATE`/transaction như moderate(): seed chạy đơn
  //     luồng, không có ai ghi concurrent vào bảng reviews lúc này.
  for (const tour of catalog.tours) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE tours t
      SET rating_avg = s.avg_rating,
          rating_count = s.cnt,
          updated_at = now()
      FROM (
        SELECT AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS cnt
        FROM reviews
        WHERE tour_id = ${tour.id}::uuid
          AND is_approved = true
      ) s
      WHERE t.id = ${tour.id}::uuid
    `);
  }
  console.log(`[seed] recomputed ratingAvg/ratingCount for ${catalog.tours.length} tours.`);

  console.log('[seed] done.');
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

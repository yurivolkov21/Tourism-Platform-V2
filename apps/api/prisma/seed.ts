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
 *   3. Một ADMIN (entry đầu của `ADMIN_EMAILS`) + 120 KHÁCH GIẢ đăng nhập được
 *      (`fixtures/people/customers.ts`), mật khẩu chung băm bằng chính hàm của
 *      Better Auth.
 *   4. TẦNG VẬN HÀNH đầy đủ (`fixtures/operations/bookings.ts`): ~570 booking
 *      trải 12 tháng theo `paidAt`, payment event, refund và yêu cầu huỷ cho
 *      các chuyến bị công ty huỷ, rồi đặt lại `seatsBooked` từ booking thật.
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
import { auth } from '../src/auth/auth.config.js';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  PaymentProvider,
  PostStatus,
  ReviewSource,
  UserRole,
} from '../src/generated/prisma/enums.js';
import {
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
} from '../src/modules/catalog/tour-costs.js';
import * as catalog from './fixtures/catalog/index.js';
import {
  bookingsGia,
  cancellationRequestsGia,
  gheDaDat,
  paymentEventsGia,
  refundsGia,
} from './fixtures/operations/bookings.js';
import { reviewModerationEventsGia, reviewsGia } from './fixtures/operations/reviews-verified.js';
import { khachGia } from './fixtures/people/customers.js';
import { posts as blogPosts } from './fixtures/posts.js';
import { idTinh } from './fixtures/stable-id.js';

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
  'about-hero',
  // Năm ảnh của khối "why choose us" trên Home — đặt tên theo CHỦ THỂ ảnh
  // (guide/food/river/evening/heritage) chứ không theo câu tiêu đề, để đổi chữ
  // sau này không làm tên khe lạc nghĩa.
  'why-guide',
  'why-food',
  'why-river',
  'why-evening',
  'why-heritage',
  // Ảnh chân khung thông tin ở /contact §2 — khe riêng chứ không mượn
  // `content-hero`: khe đó dùng chung 11 trang, gắn ảnh vào là đổi cả 11.
  'contact-panel',
  // 4 ô bento Gallery ở /about §"The country we call the office"
  'about-gallery-north',
  'about-gallery-central',
  'about-gallery-south',
  'about-gallery-all',
  // 4 mốc Timeline ở /about §"Twelve years, counted the slow way"
  'about-timeline-2014',
  'about-timeline-2017',
  'about-timeline-2021',
  'about-timeline-2026',
  // 4 avatar đội ngũ ở /about §Team — khoá theo chức danh, không theo tên người
  'about-team-ceo',
  'about-team-routes',
  'about-team-guides',
  'about-team-ops',
  // 5 ô khối "Moments from the journey" ở /destinations. Đặt tên theo CHỦ THỂ
  // trong khung hình (kayak/thung lũng/sông/cổng/chợ nổi) chứ không theo câu
  // caption — cùng lý lẽ với cụm `why-*`: đổi chữ sau này không làm tên khe
  // lạc nghĩa. Mỗi khoảnh khắc TỰ KHAI khoá khe của mình ở `mocks/moments.ts`
  // thay vì suy ra từ vị trí trong mảng: suy theo index thì sắp xếp lại mảng
  // là ảnh gắn nhầm chỗ mà không có gì báo.
  // Tên khe đặt theo ĐỊA DANH CÓ ẢNH, không theo ý tưởng ban đầu. Bốn khe đổi
  // tên ngày 18/08 vì Hạ Long / Sa Pa / Huế / Cần Thơ không có tấm nào trong
  // kho, còn Lan Hạ / Hà Giang / Mỹ Sơn / Bến Tre thì có sẵn và hợp cảnh. Giữ
  // tên cũ mà nhét ảnh nơi khác vào là gài bẫy người đọc sau: khoá khe cũng là
  // `publicId` trên Cloudinary, tra `moment-hue-gate` mà ra tháp Chăm thì mất
  // cả buổi mới hiểu. Khe cũ không có row media nào nên đổi tên là miễn phí.
  'moment-lanha-kayak',
  'moment-hagiang-valley',
  'moment-hoian-river',
  'moment-myson-towers',
  'moment-bentre-canal',
  // Video nền dải CTA cuối /about — khe VIDEO đầu tiên của dự án
  'about-cta-video',
  // 15 ô section "… in photos" của ba trang vùng (`RegionGallery`, thêm
  // 19/08): Bắc 6 ô (biến thể peaks) · Trung 6 (lanterns) · Nam 3 (panorama).
  // Khoá theo VÙNG + VỊ TRÍ Ô (không theo địa danh/chủ thể như `moment-*`) vì
  // hình ô là bất biến của bố cục đã duyệt (ô 3 miền Bắc cao ~vuông, ô 4 rất
  // dẹt…) — ảnh chọn theo hình ô, đổi ảnh vẫn giữ khoá; caption đi theo ảnh ở
  // i18n `regions[key].galleryTiles`, cùng chỉ số 1-based với khoá.
  'region-gallery-north-1',
  'region-gallery-north-2',
  'region-gallery-north-3',
  'region-gallery-north-4',
  'region-gallery-north-5',
  'region-gallery-north-6',
  'region-gallery-central-1',
  'region-gallery-central-2',
  'region-gallery-central-3',
  'region-gallery-central-4',
  'region-gallery-central-5',
  'region-gallery-central-6',
  'region-gallery-south-1',
  'region-gallery-south-2',
  'region-gallery-south-3',
  // 3 bưu thiếp khối "Signature" trang Nam (`RegionSignaturePostcards`, thêm
  // 19/08, cùng luật khoá theo vị trí như `region-gallery-*`; tiêu đề/caption
  // ở i18n `regions.south.signature.postcards` cùng chỉ số). Bắc/Trung không
  // có khối này (intro chữ / timeline chữ).
  'region-signature-south-1',
  'region-signature-south-2',
  'region-signature-south-3',
] as const;

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';

// ── Chốt chặn production ────────────────────────────────────────────────────
// `db:seed` chạy qua `--env-file-if-exists=.env.local`, mà file đó trỏ Session
// pooler của Supabase PROD. Nghĩa là gõ `pnpm db:seed` không kèm gì thì đích
// MẶC ĐỊNH LÀ PRODUCTION — ngược hẳn trực giác, và khác hẳn hai script anh em
// (`data:reset`, `media:alt`) vốn đòi cờ tường minh. Đợt rà 10/09 xếp đây là
// phát hiện NẶNG: seed ghi đè nội dung biên tập của 29 tour và 87 policy.
const LA_PROD = /supabase\.(com|co)$/i.test(new URL(connectionString).hostname);
if (LA_PROD && !process.argv.includes('--toi-biet-day-la-production')) {
  console.error(`
✖ TỪ CHỐI: ${new URL(connectionString).hostname} là Supabase production.

  Seed sẽ GHI ĐÈ nội dung biên tập của 29 tour và 87 policy (cả hai dùng
  upsert), và chèn toàn bộ tầng vận hành. Muốn chạy thật thì thêm cờ:

      pnpm --filter @tourism/api db:seed -- --toi-biet-day-la-production

  Chạy ở docker: đặt DATABASE_URL tường minh (biến môi trường thắng --env-file).
`);
  process.exit(1);
}
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
    [
      'tourCostItems',
      () =>
        prisma.tourCostItem.createMany({
          data: catalog.tourCostItems as unknown as Prisma.TourCostItemCreateManyInput[],
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
  console.log(`[seed] admin: ${admin.email}`);

  // 3b. KHÁCH GIẢ (120, xem SO_KHACH) (đợt làm mới dữ liệu 10/09/2026) — người đứng tên cho
  //     ≈400 booking và ≈116 review sắp seed. Không có họ thì không seed được
  //     hai bảng đó: `bookings.user_id` là FK RESTRICT, và review `VERIFIED`
  //     bị CHECK `reviews_source_shape` bắt buộc có `user_id` + `booking_id`.
  //
  //     Mật khẩu băm bằng CHÍNH hàm của Better Auth (`auth.$context.password`)
  //     chứ không phải bcrypt tự chọn: định dạng hash phải khớp cái mà đường
  //     đăng nhập dùng để verify, sai là cả bộ tài khoản không vào được mà
  //     KHÔNG có lỗi nào báo ra — chỉ là "sai mật khẩu" ở màn login.
  //
  //     Hash KHÔNG nằm trong fixture: repo này public. Mật khẩu đọc từ env,
  //     mặc định là chuỗi demo ghi trong `.env.example`.
  const matKhau = process.env.SEED_CUSTOMER_PASSWORD?.trim() || 'Nexora!Demo2026';
  const { count: soKhach } = await prisma.user.createMany({
    data: khachGia.map((k) => ({
      id: k.id,
      email: k.email,
      name: k.name,
      phone: k.phone,
      emailVerified: true,
      role: UserRole.CUSTOMER,
      createdAt: k.createdAt,
    })),
    skipDuplicates: true,
  });

  // Chỉ băm cho tài khoản CHƯA có: scrypt cố ý chậm, băm lại 120 lần mỗi lượt
  // seed là vài giây đốt không lý do.
  const daCo = new Set(
    (
      await prisma.account.findMany({
        where: { providerId: 'credential', userId: { in: khachGia.map((k) => k.id) } },
        select: { userId: true },
      })
    ).map((a) => a.userId),
  );
  const canTao = khachGia.filter((k) => !daCo.has(k.id));
  let soTaiKhoan = 0;
  if (canTao.length > 0) {
    const ctx = await auth.$context;
    const duLieu = [];
    for (const k of canTao) {
      duLieu.push({
        id: idTinh('seed-account', k.email),
        userId: k.id,
        // Better Auth đặt `accountId = userId` cho provider `credential` —
        // đọc ra từ chính dòng account của admin trên prod, không phải đoán.
        accountId: k.id,
        providerId: 'credential',
        password: await ctx.password.hash(matKhau),
        createdAt: k.createdAt,
      });
    }
    const r = await prisma.account.createMany({ data: duLieu, skipDuplicates: true });
    soTaiKhoan = r.count;
  }
  console.log(
    `[seed] khách giả: +${soKhach} user, +${soTaiKhoan} credential account (mật khẩu chung từ SEED_CUSTOMER_PASSWORD)`,
  );

  // 4. TẦNG VẬN HÀNH — booking + payment event + refund + yêu cầu huỷ.
  //
  //    Thay cho booking demo `BK-SEEDPAID` đơn lẻ và tài khoản
  //    `customer@tourism.test`: cả hai bị gỡ ngày 10/09/2026 vì đợt làm mới
  //    dựng một tầng vận hành đầy đủ, và một dòng demo lạc loài giữa 570 dòng
  //    thật chỉ làm bẩn số liệu báo cáo.
  //
  //    `costPerPerson` tính TẠI ĐÂY chứ không khai trong fixture: nó là
  //    SNAPSHOT, và phải sinh ra từ cùng một hàm mà `bookings.service.ts` dùng
  //    (`perPersonTotal`), nếu không số lịch sử và số tương lai sẽ nói khác
  //    nhau mà không test nào bắt được.
  const giaVonTheoTour = new Map<string, Prisma.Decimal | null>();
  for (const tour of catalog.tours) {
    // Ép `Decimal` giống hệt bước 8 bên dưới: fixture giữ tiền dạng chuỗi để
    // khớp cột `Decimal(14,2)`, còn `perPersonTotal` nhận `Prisma.Decimal`.
    const items = catalog.tourCostItems
      .filter((c) => c.tourId === tour.id)
      .map((c) => ({ amount: new Prisma.Decimal(c.amount), basis: c.basis }));
    giaVonTheoTour.set(tour.id, items.length > 0 ? perPersonTotal(items) : null);
  }

  const { count: soBooking } = await prisma.booking.createMany({
    data: bookingsGia.map((b) => ({
      id: b.id,
      code: b.code,
      userId: b.userId,
      tourId: b.tourId,
      departureId: b.departureId,
      numAdults: b.numAdults,
      numChildren: b.numChildren,
      totalAmount: b.totalAmount,
      currency: b.currency,
      status: b.status as BookingStatus,
      tourTitle: b.tourTitle,
      departureStartDate: toDate(b.departureStartDate),
      departureEndDate: toDate(b.departureEndDate),
      unitPrice: b.unitPrice,
      costPerPerson: giaVonTheoTour.get(b.tourId) ?? null,
      contactName: b.contactName,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      specialRequests: b.specialRequests,
      paymentProvider: b.paymentProvider as PaymentProvider,
      providerSessionId: b.providerSessionId,
      providerPaymentId: b.providerPaymentId,
      paidAt: b.paidAt ? new Date(b.paidAt) : null,
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : null,
      createdAt: new Date(b.createdAt),
    })) as unknown as Prisma.BookingCreateManyInput[],
    skipDuplicates: true,
  });

  const { count: soSuKien } = await prisma.paymentEvent.createMany({
    data: paymentEventsGia.map((e) => ({
      id: e.id,
      provider: e.provider as PaymentProvider,
      eventId: e.eventId,
      type: e.type,
      payload: e.payload,
      amount: e.amount,
      currency: e.currency,
      bookingId: e.bookingId,
      processedAt: new Date(e.processedAt),
      receivedAt: new Date(e.receivedAt),
    })) as unknown as Prisma.PaymentEventCreateManyInput[],
    skipDuplicates: true,
  });

  // `skipDuplicates` KHÔNG cứu được bảng `refunds`: nó biên dịch thành
  // `ON CONFLICT DO NOTHING`, mà trigger `refunds_sum_within_total` là
  // BEFORE INSERT — nó chạy TRƯỚC lúc Postgres kịp bỏ qua dòng trùng, thấy
  // tổng hoàn đã bằng tổng tiền booking rồi nên ném check_violation. Lượt seed
  // thứ hai vì thế đổ sập. Phải tự lọc dòng đã có trước khi chèn.
  const refundDaCo = new Set(
    (
      await prisma.refund.findMany({
        where: { id: { in: refundsGia.map((r) => r.id) } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const { count: soHoanTien } = await prisma.refund.createMany({
    data: refundsGia
      .filter((r) => !refundDaCo.has(r.id))
      .map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        amount: r.amount,
        currency: r.currency,
        providerRefundId: r.providerRefundId,
        providerPaymentId: r.providerPaymentId,
        reason: r.reason,
        adminId: admin.id,
        createdAt: new Date(r.createdAt),
      })) as unknown as Prisma.RefundCreateManyInput[],
    skipDuplicates: true,
  });

  const { count: soYeuCau } = await prisma.cancellationRequest.createMany({
    data: cancellationRequestsGia.map((c) => ({
      id: c.id,
      bookingId: c.bookingId,
      userId: c.userId,
      reason: c.reason,
      freeCancellationDays: c.freeCancellationDays,
      status: c.status as CancellationRequestStatus,
      decisionNote: c.decisionNote || null,
      // Yêu cầu đang CHỜ chưa có ai quyết — hai cột này phải là null, không
      // phải "quyết định lúc 1970". Fixture để chuỗi rỗng cho nhánh REQUESTED.
      decidedById: c.decidedAt ? admin.id : null,
      decidedAt: c.decidedAt ? new Date(c.decidedAt) : null,
      createdAt: new Date(c.createdAt),
    })) as unknown as Prisma.CancellationRequestCreateManyInput[],
    skipDuplicates: true,
  });

  // Ghế đã đặt là số DẪN XUẤT — đặt lại từ booking thật, KHÔNG cộng dồn.
  // `increment` sẽ nhân đôi ở lượt seed thứ hai; `set` thì chạy lại bao nhiêu
  // lần cũng ra cùng một con số. Bộ cũ khai tay 438 ghế mà chỉ 2 booking đứng
  // sau — đúng kiểu sai mà một phép cộng dồn tạo ra.
  for (const [departureId, ghe] of gheDaDat) {
    await prisma.tourDeparture.updateMany({
      where: { id: departureId },
      data: { seatsBooked: ghe },
    });
  }
  console.log(
    `[seed] vận hành: +${soBooking} booking, +${soSuKien} payment event, +${soHoanTien} refund, +${soYeuCau} yêu cầu huỷ; ghế đặt lại cho ${gheDaDat.size} chuyến`,
  );

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

  // 6. Reviews VERIFIED — thay TRỌN 84 review CURATED cũ (quyết định user
  //    10/09/2026). CHECK `reviews_source_shape` của DB cấm review CURATED
  //    mang `user_id`, nên muốn review đứng tên khách giả thì buộc phải là
  //    VERIFIED, mà VERIFIED đòi cả `booking_id` — đó là lý do bước này đứng
  //    SAU booking chứ không phải sở thích sắp xếp.
  //
  //    Giữ CHỮ, thay NGƯỜI: 84 đoạn văn cũ viết tay cho từng tour được gắn lại
  //    vào khách giả + booking đã hoàn thành của chính tour đó, cộng 35 đoạn
  //    mới cho những tour phủ chưa đủ.
  const { count: reviewCount } = await prisma.review.createMany({
    data: reviewsGia.map((r) => ({
      id: r.id,
      tourId: r.tourId,
      userId: r.userId,
      bookingId: r.bookingId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.authorName,
      source: ReviewSource.VERIFIED,
      isApproved: r.isApproved,
      rejectedAt: r.rejectedAt ? new Date(r.rejectedAt) : null,
      rejectedById: r.rejectedAt ? admin.id : null,
      moderatedAt: r.moderatedAt ? new Date(r.moderatedAt) : null,
      moderatedById: r.moderatedAt ? admin.id : null,
      retractedAt: r.retractedAt ? new Date(r.retractedAt) : null,
      createdAt: new Date(r.createdAt),
    })) as unknown as Prisma.ReviewCreateManyInput[],
    skipDuplicates: true,
  });

  const { count: soSuKienDuyet } = await prisma.reviewModerationEvent.createMany({
    data: reviewModerationEventsGia.map((e) => ({
      id: e.id,
      reviewId: e.reviewId,
      actorId: admin.id,
      fromApproved: e.fromApproved,
      toApproved: e.toApproved,
      toRejected: e.toRejected,
      note: e.note,
      createdAt: new Date(e.createdAt),
    })) as unknown as Prisma.ReviewModerationEventCreateManyInput[],
    skipDuplicates: true,
  });
  console.log(`[seed] reviews: +${reviewCount} VERIFIED, +${soSuKienDuyet} sự kiện duyệt`);

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

  // 8. Hai con số DẪN XUẤT của mô hình giá vốn (ADR-0033 §2, §3).
  //
  //    Tính ở đây chứ không khai trong fixture: chúng là hàm của
  //    `tour_cost_items`, và một fixture khai sẵn con số dẫn xuất là hai nguồn
  //    sự thật cho một phép tính — sửa một dòng giá vốn mà quên sửa nó là hai
  //    thứ nói khác nhau, im lặng.
  //
  //    `costPrice` là số BÁN HÀNG (một con số mỗi khách, để đặt giá và xem
  //    biên); `fixedCostAmount` là snapshot vế theo-chuyến, đóng băng lên
  //    từng departure vì báo cáo tính nó một lần cho mỗi chuyến đã chạy.
  //    Đây cũng đúng thứ mà form tạo chuyến trong admin sẽ làm khi phase
  //    `/tours` tới.
  for (const tour of catalog.tours) {
    const items = catalog.tourCostItems
      .filter((item) => item.tourId === tour.id)
      .map((item) => ({ amount: new Prisma.Decimal(item.amount), basis: item.basis }));
    if (items.length === 0) continue;

    // CHỈ điền chỗ còn trống. Hai cột này là SNAPSHOT (ADR-0033 §3: đóng
    // băng lúc tạo chuyến, admin sửa đè được) — seed chạy lại trên DB dùng
    // chung mà ghi đè `where: { tourId }` trần là viết lại giá vốn của chuyến
    // đã lên báo cáo tháng trước và xoá giá admin đã đè tay (vòng vá review
    // 05/09).
    await prisma.tour.updateMany({
      where: { id: tour.id, costPrice: null },
      data: { costPrice: derivedCostPrice(items, tour.maxGroupSize) },
    });
    await prisma.tourDeparture.updateMany({
      where: { tourId: tour.id, fixedCostAmount: null },
      data: { fixedCostAmount: perDepartureTotal(items) },
    });
  }
  console.log(
    `[seed] derived costPrice + departure fixedCost (chỉ chỗ còn null) for ${catalog.tours.length} tours.`,
  );

  console.log('[seed] done.');
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

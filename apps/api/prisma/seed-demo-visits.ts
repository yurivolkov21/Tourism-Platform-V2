/**
 * Seed PHỤ cho dev — đắp lịch sử "đã đi" nhiều nơi × nhiều lần cho các tài
 * khoản demo, phục vụ test giao diện Travel log/hộ chiếu khu account (vòng
 * review 11/08: stepper theo địa danh cần nơi đi 2-3 lần trở lên mới thấy
 * trọn hành vi).
 *
 * Làm gì: với MỖI destination trong danh sách mục tiêu (có tour PUBLISHED
 * nhận nó làm primary), tạo 2-3 departure QUÁ KHỨ trên tour của nơi đó +
 * booking PAID tương ứng cho từng tài khoản demo tìm thấy. Mã booking
 * `BK-SEED####` (khớp BookingCodeSchema `BK-[A-Z0-9]{8}`).
 *
 * Idempotent kiểu cầu dao: thấy bất kỳ BK-SEED0### nào là DỪNG (đã seed) —
 * departure không có unique tự nhiên nên không dựa skipDuplicates được.
 *
 * Chạy (từ apps/api — dùng chung pipeline compile của db:seed, xem
 * package.json, rồi gọi file này thay seed.js):
 *   npx swc src prisma -d dist-seed --ignore "spec-glob của db:seed"
 *   node --env-file-if-exists=.env.local dist-seed/prisma/seed-demo-visits.js
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import { BookingStatus, PaymentProvider } from '../src/generated/prisma/enums.js';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Các tài khoản demo cần đắp lịch sử — thiếu account nào thì bỏ qua account đó. */
const DEMO_EMAILS = ['demo-1786424905268@tourism.test', 'demo-1786334962122@tourism.test'];

/**
 * Nơi × các cửa sổ ngày QUÁ KHỨ (trước 11/08/2026) cho từng lần đi — ngày
 * viết cứng cho deterministic, rải qua nhiều tháng/năm để stepper + tem có
 * nhịp thời gian thật.
 */
const VISIT_PLAN: Array<{ slug: string; windows: Array<[string, string]> }> = [
  {
    slug: 'hoi-an',
    windows: [
      ['2025-11-03', '2025-11-05'],
      ['2026-02-14', '2026-02-16'],
      ['2026-06-20', '2026-06-21'],
    ],
  },
  {
    slug: 'sa-pa',
    windows: [
      ['2025-12-19', '2025-12-22'],
      ['2026-04-10', '2026-04-13'],
    ],
  },
  {
    slug: 'hue',
    windows: [
      ['2026-01-08', '2026-01-10'],
      ['2026-05-01', '2026-05-03'],
      ['2026-07-28', '2026-07-30'],
    ],
  },
  {
    slug: 'da-lat',
    windows: [
      ['2026-03-06', '2026-03-08'],
      ['2026-07-02', '2026-07-04'],
    ],
  },
];

async function main() {
  // Cầu dao idempotent: đã có mã BK-SEED0 nào là coi như seed rồi.
  const existing = await prisma.booking.findFirst({ where: { code: { startsWith: 'BK-SEED0' } } });
  if (existing) {
    console.log(`Đã seed trước đó (thấy ${existing.code}) — không làm gì.`);
    return;
  }

  const users = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } } });
  if (users.length === 0) {
    console.log('Không tìm thấy tài khoản demo nào — dừng.');
    return;
  }
  console.log(`Đắp lịch sử cho ${users.length} tài khoản: ${users.map((u) => u.email).join(', ')}`);

  let seq = 0;
  for (const plan of VISIT_PLAN) {
    // Tour PUBLISHED nhận nơi này làm PRIMARY — lấy 1 tour đại diện.
    const link = await prisma.tourDestination.findFirst({
      where: {
        isPrimary: true,
        destination: { slug: plan.slug },
        tour: { isPublished: true },
      },
      include: { tour: true, destination: true },
    });
    if (!link) {
      console.log(`  ${plan.slug}: không có tour PUBLISHED nhận làm primary — bỏ qua.`);
      continue;
    }
    const { tour } = link;
    const unitPrice = tour.basePrice;

    for (const [start, end] of plan.windows) {
      const departure = await prisma.tourDeparture.create({
        data: {
          tourId: tour.id,
          startDate: new Date(start),
          endDate: new Date(end),
          seatsTotal: 12,
          seatsBooked: 0,
        },
      });
      for (const user of users) {
        seq += 1;
        // Đặt trước ngày đi ~3 tuần; trả tiền ngay hôm sau — mốc quá khứ nhất quán.
        const createdAt = new Date(new Date(start).getTime() - 21 * 86_400_000);
        const paidAt = new Date(createdAt.getTime() + 86_400_000);
        await prisma.booking.create({
          data: {
            code: `BK-SEED${String(seq).padStart(4, '0')}`,
            userId: user.id,
            tourId: tour.id,
            departureId: departure.id,
            numAdults: 2,
            numChildren: 0,
            unitPrice,
            totalAmount: new Prisma.Decimal(unitPrice).mul(2),
            currency: 'USD',
            status: BookingStatus.PAID,
            tourTitle: tour.title,
            departureStartDate: departure.startDate,
            departureEndDate: departure.endDate,
            contactName: user.name,
            contactEmail: user.email,
            paymentProvider: PaymentProvider.STRIPE,
            paidAt,
            createdAt,
          },
        });
        await prisma.tourDeparture.update({
          where: { id: departure.id },
          data: { seatsBooked: { increment: 2 } },
        });
      }
      console.log(`  ${plan.slug}: ${tour.title} · ${start} → ${end} ✓`);
    }
  }
  console.log(`Xong — ${seq} booking PAID quá khứ.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Route TẠM để đo bố cục bản in G40 bằng Edge headless — KHÔNG commit.
import type { BookingDetail } from '@tourism/contract';
import { ReceiptPrint } from '@/components/print/receipt-print';
import { VoucherPrint } from '@/components/print/voucher-print';
import type { BookingTourData } from '@/lib/get-ready';
import { receiptPrintView } from '@/lib/print/receipt-print';
import { voucherPrintView } from '@/lib/print/voucher-print';
import { voucherView } from '@/lib/voucher';
import { makeBooking, makeTourData } from '@/test/fixtures/booking';
import {
  CANCELLED_AFTER_PAYING,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  voucherBooking,
  voucherNowOn,
} from '@/test/fixtures/voucher';
import tours from './tours.json';

const IMAGE = {
  url: 'https://res.cloudinary.com/dbkgeehow/image/upload/v1787024520/tourism/catalog/tour/hoi-an-lantern-evening/hero.jpg',
  alt: 'Lanterns over the Thu Bồn river',
} as unknown as BookingDetail['tourImage'];

const DAY_ONE = makeTourData({
  itinerary: [
    {
      dayNumber: 1,
      title: 'Temples and the Old Quarter',
      description:
        '08:00 — Hotel pickup in the Old Quarter\n09:30 — Temple of Literature and the Imperial Academy\n11:30 — Lunch at a family-run kitchen\n13:00 — Hỏa Lò Prison museum\n15:00 — Free time by Hoàn Kiếm Lake',
    },
  ],
  included: ['English-speaking guide', 'Entrance tickets', 'Lunch', 'Bottled water'],
  excluded: ['Tips', 'Personal expenses'],
});

const TWELVE = makeTourData({
  itinerary: Array.from({ length: 12 }, (_, i) => ({
    dayNumber: i + 1,
    title:
      ['Hà Nội arrival', 'Hạ Long Bay cruise', 'Ninh Bình', 'Huế', 'Hội An', 'Mekong Delta'][
        i % 6
      ] ?? 'Day',
    description: '08:00 — Breakfast',
  })),
});

const LONG_TITLE =
  'Hà Giang Loop by Motorbike: Rice Terraces, Lũng Cú Flag Tower & Mã Pí Lèng Pass';

function voucher(
  overrides: Partial<BookingDetail>,
  tour: BookingTourData | null,
  now: Date = VOUCHER_NOW,
) {
  const booking = voucherBooking({ tourImage: IMAGE, ...overrides });
  const view = voucherView(booking, now);
  if (view === null) return <p>not a voucher</p>;
  return <VoucherPrint view={voucherPrintView(booking, view, tour, now)} />;
}

function receipt(overrides: Partial<BookingDetail>, now: Date) {
  const booking = makeBooking({
    code: 'BK-EET0JBTH',
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    tourTitle: 'Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
    tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    tourImage: IMAGE,
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
    unitPrice: '39.00',
    totalAmount: '39.00',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Nora Dahl',
    contactEmail: 'nora.dahl@example.com',
    paymentProvider: 'STRIPE',
    ...overrides,
  });
  return <ReceiptPrint view={receiptPrintView(booking, now)} />;
}

const AT = new Date('2026-10-09T11:02:00.000Z');

const VARIANTS: Record<string, () => React.ReactNode> = {
  'v-upcoming-1d': () => voucher({}, DAY_ONE),
  'v-upcoming-12d': () =>
    voucher({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-14' }, TWELVE),
  'v-upcoming-nophoto': () => voucher({ tourImage: null }, DAY_ONE),
  'v-ontour-3d': () =>
    voucher(
      THREE_DAY_TRIP,
      makeTourData({
        itinerary: [1, 2, 3].map((n) => ({
          dayNumber: n,
          title: `Day ${n} on the road`,
          description: `0${6 + n}:00 — Start of day ${n}\n12:00 — Lunch\n15:00 — Afternoon visit`,
        })),
      }),
      voucherNowOn('2026-11-04'),
    ),
  'v-travelled': () => voucher({}, DAY_ONE, voucherNowOn('2026-11-10')),
  'v-cancelled': () => voucher(CANCELLED_AFTER_PAYING, DAY_ONE),
  'v-cancelled-refunded': () =>
    voucher({ ...CANCELLED_AFTER_PAYING, status: 'REFUNDED', refundedTotal: '147.00' }, DAY_ONE),
  'v-longtitle': () => voucher({ tourTitle: LONG_TITLE }, DAY_ONE),
  'v-hue-seed': () =>
    voucher(
      { tourTitle: tours.hue.title, tourSlug: tours.hue.slug },
      tours.hue.tourData as BookingTourData,
    ),
  'v-grand-seed': () =>
    voucher(
      {
        tourTitle: tours.grand.title,
        tourSlug: tours.grand.slug,
        departureStartDate: '2026-11-03',
        departureEndDate: '2026-11-14',
      },
      tours.grand.tourData as BookingTourData,
    ),
  'v-grand-seed-longtitle': () =>
    voucher(
      {
        tourTitle: LONG_TITLE,
        tourSlug: tours.grand.slug,
        departureStartDate: '2026-11-03',
        departureEndDate: '2026-11-14',
      },
      tours.grand.tourData as BookingTourData,
    ),
  'r-pending': () => receipt({}, AT),
  'r-closed': () => receipt({ status: 'CANCELLED', cancelledAt: '2026-10-09T12:05:00.000Z' }, AT),
  'r-refunded': () =>
    receipt(
      { status: 'REFUNDED', refundedTotal: '39.00', cancelledAt: '2026-10-09T11:30:00.000Z' },
      AT,
    ),
  'r-lapsed': () => receipt({}, new Date('2026-10-29T03:00:00.000Z')),
  'r-longtitle-email': () =>
    receipt(
      { tourTitle: LONG_TITLE, contactEmail: 'constance.wellington-hart@example-travel.com' },
      AT,
    ),
};

export default async function ZzPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const render = v === undefined ? undefined : VARIANTS[v];
  return (
    <div>
      <div className="print:hidden">
        <p>zz-print — {Object.keys(VARIANTS).join(' · ')}</p>
      </div>
      {render ? render() : null}
    </div>
  );
}

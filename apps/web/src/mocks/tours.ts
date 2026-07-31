// Import KHÔNG đuôi `.js` — đây là VALUE import nên Turbopack phải resolve thật, mà
// nó không map './tour-media.js' sang './tour-media.ts' (Vitest thì có, nên test
// xanh mà `next build` đỏ). Các `import type` khác trong thư mục này giữ đuôi .js
// được vì chúng bị xoá lúc biên dịch, chẳng ai phải resolve. Bẫy này đã ghi trong
// lib/toc.ts và vừa tái diễn đúng như comment ở đó dự đoán.
import { averageRating } from '@/lib/tours';
import { TOUR_MEDIA } from './tour-media';
import { TOUR_REVIEWS } from './tour-reviews';
import type { MockTourDetail } from './types.js';

// 16 tour mock gương theo TourCardSchema/TourDetailSchema.
//
// THỨ TỰ MẢNG CHÍNH LÀ THỨ TỰ `createdAt desc`: contract không trả `createdAt`
// (nó chỉ là sort key phía server), nên ở tầng tĩnh sort "Newest" = giữ nguyên
// thứ tự mảng này. Khi gắn API thật, quy ước này biến mất — server sắp hộ.
//
// Dữ liệu cố tình ép MỌI nhánh nullable lộ ra (rating null, không departures,
// hết chỗ, không độ khó, không tóm tắt, không FAQ) — trang chỉ đẹp với dữ liệu
// đẹp là trang chưa xong. Bất biến canh ở mocks.spec.ts.
//
// Địa danh giữ dấu tiếng Việt; mọi copy user-facing khác là tiếng Anh (luật #7).
//
// `media` KHÔNG viết trong từng object dưới đây mà được ghép ở bước cuối file, từ
// `tour-media.ts`. Đó là chủ ý: trong API thật ảnh nằm ở bảng `MediaAsset` và do
// `MediaService.resolveForOwners('TOUR', ids)` lấy theo lô rồi mới merge vào
// detail — đúng như `posts.service.ts` đang làm. Mock ghép cùng cách nên lúc gắn
// API là bỏ bước ghép, không phải sửa 16 object.
const TOURS_WITHOUT_MEDIA: Omit<MockTourDetail, 'media' | 'ratingAvg' | 'ratingCount'>[] = [
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e40',
    slug: 'ha-long-bay-cruise',
    title: 'Ha Long Bay Cruise',
    summary:
      'Two days aboard a traditional junk boat with kayaking, a cave visit, and fresh seafood dinners under lantern light.',
    basePrice: '189.00',
    compareAtPrice: '236.00',
    currency: 'USD',
    durationDays: 2,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: true,
    destinations: [
      { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    category: { slug: 'cruises', name: 'Cruises' },
    suitableFor: ['COUPLE', 'FAMILY', 'FRIENDS'],
    badges: ['BEST_VALUE', 'POPULAR'],
    included: [
      'One night aboard a traditional wooden junk',
      'All meals from lunch on day one to breakfast on day two',
      'Kayak hire and a guided paddle through Luon cave',
      'Round-trip transfer from Hanoi old quarter',
      'English-speaking guide for the full trip',
    ],
    excluded: [
      'International and domestic flights',
      'Travel insurance',
      'Drinks outside the welcome tea service',
      'Tips for the crew',
    ],
    highlights: [
      'Wake up anchored between limestone karsts, before the day boats arrive',
      'Paddle into a cave that only opens at low tide',
      'Cook spring rolls with the boat chef on the sun deck',
    ],
    meetingPoint: 'Hanoi Opera House, west steps — 7:45am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Hanoi to the bay',
        description:
          'Morning transfer through the delta, boarding at midday, then an afternoon of kayaking before dinner on deck.',
      },
      {
        dayNumber: 2,
        title: 'Sunrise, caves, and back to the city',
        description:
          'Tai chi at first light, a cave walk after breakfast, and a slow cruise back to port for the afternoon road transfer.',
      },
    ],
    faqs: [
      {
        question: 'Do I need to be able to swim?',
        answer:
          'No. Kayaking is optional and every guest wears a buoyancy aid. The crew stays alongside in a tender for the whole paddle.',
      },
      {
        question: 'What happens if the weather turns?',
        answer:
          'The harbour authority can close the bay at short notice. When that happens we move you to the next available departure at no cost, or refund in full.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 7 days before departure',
        body: 'Cancel more than seven days ahead and you get a full refund. Between seven days and 48 hours we hold 50%. Inside 48 hours the departure is non-refundable, because the boat crew and provisions are already committed.',
      },
      {
        kind: 'BOOKING',
        title: 'Deposit and balance',
        body: 'A deposit confirms your seats and the balance falls due 14 days before departure. Bookings made inside 14 days are payable in full at checkout.',
      },
    ],
    departures: [
      {
        id: 'd1a00001-0000-4000-8000-000000000001',
        startDate: '2026-08-21',
        endDate: '2026-08-22',
        seatsLeft: 4,
        effectivePrice: '175.00',
        compareAtPrice: '236.00',
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000002',
        startDate: '2026-09-04',
        endDate: '2026-09-05',
        seatsLeft: 9,
        effectivePrice: '189.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000003',
        startDate: '2026-09-18',
        endDate: '2026-09-19',
        seatsLeft: 0,
        effectivePrice: '189.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00001-0000-4000-8000-000000000004',
        startDate: '2026-10-02',
        endDate: '2026-10-03',
        seatsLeft: 12,
        effectivePrice: '199.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    // Tour MỚI mở bán: chưa ai đánh giá (ratingAvg null ≠ 0), chưa mở đợt nào,
    // chưa có tóm tắt, chưa có FAQ, chưa chốt điểm hẹn. Đây là mock ép nhiều
    // nhánh rỗng nhất — trang detail phải trông vẫn ổn với nó.
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e41',
    slug: 'phu-quoc-reef-days',
    title: 'Phú Quốc Reef Days',
    summary: null,
    basePrice: '340.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: null,
    maxGroupSize: 8,
    isFeatured: false,
    destinations: [{ slug: 'phu-quoc', name: 'Phú Quốc', isPrimary: true }],
    category: { slug: 'beaches', name: 'Beaches & islands' },
    suitableFor: ['COUPLE', 'SOLO'],
    badges: ['NEW'],
    included: [
      'Three nights in a beachfront guesthouse',
      'Two guided snorkel trips with reef-safe sunscreen provided',
      'Airport transfers on the island',
    ],
    excluded: ['Flights to the island', 'Lunch and dinner', 'Dive certification courses'],
    highlights: [
      'Snorkel the An Thới archipelago before the tour boats arrive',
      'Eat at the night market with a guide who grew up on the island',
    ],
    meetingPoint: null,
    itinerary: [
      { dayNumber: 1, title: 'Arrive and settle in', description: null },
      {
        dayNumber: 2,
        title: 'The southern reefs',
        description: 'A full day on the water with two snorkel stops and lunch cooked aboard.',
      },
      { dayNumber: 3, title: 'Slow morning, late flight', description: null },
    ],
    faqs: [],
    policies: [
      {
        kind: 'GENERAL',
        title: 'Reef conduct',
        body: 'We hand out reef-safe sunscreen and ask you to use it. Touching or standing on coral ends the snorkel session for the whole group — the reefs here are recovering and we would rather lose a booking than a reef.',
      },
    ],
    departures: [],
  },
  {
    // Tour DÀI, độ khó cao — ép nhánh CHALLENGING và itinerary nhiều ngày.
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e42',
    slug: 'northern-highlands-loop',
    title: 'Northern Highlands Loop',
    summary:
      'Eight days riding the far north — hairpin passes above the terraces, hill-tribe markets, and nights in village homestays.',
    basePrice: '1480.00',
    compareAtPrice: '1690.00',
    currency: 'USD',
    durationDays: 8,
    difficulty: 'CHALLENGING',
    maxGroupSize: 10,
    isFeatured: true,
    destinations: [
      { slug: 'sa-pa', name: 'Sa Pa', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    category: { slug: 'trekking', name: 'Trekking' },
    suitableFor: ['FRIENDS', 'SOLO'],
    badges: ['EXCLUSIVE', 'LIMITED_OFFER'],
    included: [
      'Seven nights in homestays and small guesthouses',
      'All breakfasts and six dinners',
      'Support vehicle and mechanic for the full loop',
      'Permits for the border zone',
    ],
    excluded: [
      'Motorbike hire',
      'Lunches along the route',
      'Travel insurance — mandatory for this trip',
    ],
    highlights: [
      'Ride the Ô Quy Hồ pass, the highest road in the country, with the valley a thousand metres below',
      'Sunday market at Bắc Hà, where four language groups trade in one square',
      'Sleep in a stilt house with the family that built it',
    ],
    meetingPoint: 'Sa Pa town square, by the stone church — 6:30am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Gather in Sa Pa',
        description:
          'Bike fitting, a briefing over dinner, and an early night before the first long day.',
      },
      {
        dayNumber: 2,
        title: 'Into the Mường Hoa valley',
        description:
          'The first pass climbs out of town in a series of switchbacks that keep going long after you expect them to stop.',
      },
      {
        dayNumber: 3,
        title: 'Over Ô Quy Hồ to Lai Châu',
        description:
          'The long climb over the pass, a stop at Thác Bạc waterfall, and a night on the far side.',
      },
      { dayNumber: 4, title: 'Bắc Hà Sunday market', description: null },
      {
        dayNumber: 5,
        title: 'The Bắc Hà high road',
        description:
          'The stretch everyone comes for. We ride it slowly, stop often, and finish with a boat trip on the Chảy river.',
      },
      {
        dayNumber: 6,
        title: 'Tả Van and the back roads',
        description: 'Off the main loop onto dirt, ending at a waterfall you can swim in.',
      },
      { dayNumber: 7, title: 'Back towards Sa Pa', description: null },
      {
        dayNumber: 8,
        title: 'Return transfer',
        description: 'Morning ride into town, hand the bikes back, and the night train south.',
      },
    ],
    faqs: [
      {
        question: 'Do I need a motorbike licence?',
        answer:
          'Yes, and it must be valid in Vietnam. If you would rather not ride, book the same departure with a driver — say so in your enquiry and we pair you with one.',
      },
      {
        question: 'How hard is the riding, really?',
        answer:
          'Expect six to seven hours in the saddle on the longest days, on roads that are being repaired more or less permanently. Previous experience on loose surfaces matters more than raw distance.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Cancellation on expedition trips',
        body: 'Permits for the border zone are bought in your name 30 days out and cannot be transferred. Cancel before that and we refund in full minus the deposit; after it, we refund half.',
      },
      {
        kind: 'GENERAL',
        title: 'Fitness and riding experience',
        body: 'This is not a first-week-of-riding trip. If you have never ridden on gravel or in rain, tell us at booking and we will suggest a shorter loop instead of finding out on day two.',
      },
    ],
    departures: [
      {
        id: 'd1a00003-0000-4000-8000-000000000001',
        startDate: '2026-09-12',
        endDate: '2026-09-19',
        seatsLeft: 2,
        effectivePrice: '1480.00',
        compareAtPrice: '1690.00',
      },
      {
        id: 'd1a00003-0000-4000-8000-000000000002',
        startDate: '2026-10-10',
        endDate: '2026-10-17',
        seatsLeft: 7,
        effectivePrice: '1480.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e43',
    slug: 'sa-pa-terraces-trek',
    title: 'Sa Pa Terraces Trek',
    summary:
      'Walk the mist-covered terraces with a local guide, sleep in a village homestay, and wake to valley sunrise.',
    basePrice: '145.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'MODERATE',
    maxGroupSize: 10,
    isFeatured: true,
    destinations: [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }],
    category: { slug: 'trekking', name: 'Trekking' },
    suitableFor: ['FRIENDS', 'SOLO', 'COUPLE'],
    badges: ['POPULAR'],
    included: [
      'Two nights in a family homestay in Tả Van',
      'All meals, cooked by your hosts',
      'Black Hmong guide from the valley you walk through',
      'Overnight train from Hanoi in a four-berth cabin',
    ],
    excluded: ['Drinks', 'Porter service', 'Travel insurance'],
    highlights: [
      'Walk the terraces at the hour the cloud lifts off them',
      'Learn indigo dyeing from the family that hosts you',
      'Cross the Mường Hoa river on a suspension bridge that sways',
    ],
    meetingPoint: 'Hanoi railway station, platform 2 — 9:30pm the night before',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Sa Pa town to Tả Van',
        description:
          'Arrive by train, breakfast in town, then a five-hour walk down the valley to the homestay.',
      },
      {
        dayNumber: 2,
        title: 'The high terraces',
        description:
          'A full day loop above the village, with lunch cooked over a fire at the top of the climb.',
      },
      { dayNumber: 3, title: 'Down to the road, and the train home', description: null },
    ],
    faqs: [
      {
        question: 'How fit do I need to be?',
        answer:
          'You need to be comfortable walking five hours on uneven ground, some of it steep and often wet. No technical skill required.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 7 days before departure',
        body: 'Train tickets are booked in your name and are the only non-refundable component inside seven days.',
      },
      {
        kind: 'GENERAL',
        title: 'Staying with a host family',
        body: 'The homestay is a working home, not a guesthouse. Rooms are shared, the bathroom is outside, and the family eats with you. That is the point of the trip.',
      },
    ],
    departures: [
      {
        id: 'd1a00004-0000-4000-8000-000000000001',
        startDate: '2026-08-28',
        endDate: '2026-08-30',
        seatsLeft: 3,
        effectivePrice: '145.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00004-0000-4000-8000-000000000002',
        startDate: '2026-09-25',
        endDate: '2026-09-27',
        seatsLeft: 8,
        effectivePrice: '145.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00004-0000-4000-8000-000000000003',
        startDate: '2026-10-16',
        endDate: '2026-10-18',
        seatsLeft: 10,
        effectivePrice: '158.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e44',
    slug: 'hoi-an-lantern-evening',
    title: 'Hoi An Lantern Evening',
    summary:
      'Wander the old town as thousands of lanterns light up, then eat your way through the night market.',
    basePrice: '59.00',
    compareAtPrice: '72.00',
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 14,
    isFeatured: true,
    destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    category: { slug: 'culture', name: 'Culture & heritage' },
    suitableFor: ['COUPLE', 'FAMILY', 'FRIENDS'],
    badges: ['POPULAR', 'BEST_VALUE'],
    included: [
      'Guided walk through the old town with entry tickets',
      'Six tasting stops at the night market',
      'A paper lantern to float on the Thu Bồn river',
    ],
    excluded: ['Hotel pickup outside the old town', 'Alcoholic drinks'],
    highlights: [
      'Watch the street lights go out and the lanterns come on, all at once',
      'Eat cao lầu where it was invented, from a family on their fourth generation',
    ],
    meetingPoint: 'Japanese Covered Bridge, east side — 4:30pm',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Old town, lanterns, night market',
        description:
          'Four hours on foot: the merchant houses while there is still light, then the river as the lanterns come on, finishing at the market.',
      },
    ],
    faqs: [
      {
        question: 'Is this suitable for children?',
        answer:
          'Yes. It is flat, slow, and finishes by 8:30pm. Under-sixes go free but still need a place reserved.',
      },
      {
        question: 'What if it rains?',
        answer:
          'The walk runs in light rain — bring a poncho. If the river floods, which happens most Octobers, we move you to the food-only version of the evening and refund the difference.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'Cancel a day ahead for a full refund. After that we hold the cost of the entry tickets, which are bought in advance.',
      },
    ],
    departures: [
      {
        id: 'd1a00005-0000-4000-8000-000000000001',
        startDate: '2026-08-14',
        endDate: '2026-08-14',
        seatsLeft: 6,
        effectivePrice: '52.00',
        compareAtPrice: '72.00',
      },
      {
        id: 'd1a00005-0000-4000-8000-000000000002',
        startDate: '2026-08-29',
        endDate: '2026-08-29',
        seatsLeft: 14,
        effectivePrice: '59.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00005-0000-4000-8000-000000000003',
        startDate: '2026-09-13',
        endDate: '2026-09-13',
        seatsLeft: 2,
        effectivePrice: '59.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00005-0000-4000-8000-000000000004',
        startDate: '2026-09-27',
        endDate: '2026-09-27',
        seatsLeft: 11,
        effectivePrice: '59.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e45',
    slug: 'hue-imperial-day',
    title: 'Hue Imperial Day',
    summary:
      'Walk the Meridian Gate into the Imperial City, then finish with a royal-style lunch by the Perfume River.',
    basePrice: '75.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hue', name: 'Huế', isPrimary: true }],
    category: { slug: 'culture', name: 'Culture & heritage' },
    suitableFor: ['COUPLE', 'FAMILY', 'BUSINESS'],
    badges: [],
    included: [
      'Citadel and Imperial City entry',
      'Royal-style lunch of seven small courses',
      'Dragon boat crossing on the Perfume River',
      'Guide trained by the Huế Monuments Conservation Centre',
    ],
    excluded: ['Tomb entry tickets outside the citadel', 'Drinks at lunch'],
    highlights: [
      'Stand in the Thái Hòa palace where the last emperor abdicated',
      'Eat the small-plate court cuisine that the city still cooks daily',
    ],
    meetingPoint: 'Ngọ Môn ticket gate — 8:00am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Citadel, lunch, river',
        description:
          'Three hours inside the walls before the heat, lunch in a garden house, then the river in the afternoon.',
      },
    ],
    faqs: [
      {
        question: 'How much walking is there?',
        answer:
          'About four kilometres, all flat, but on stone in full sun. We start at eight for exactly that reason.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'Entry tickets are bought on the morning of the tour, so a day of notice costs us nothing and costs you nothing.',
      },
    ],
    departures: [
      {
        id: 'd1a00006-0000-4000-8000-000000000001',
        startDate: '2026-08-18',
        endDate: '2026-08-18',
        seatsLeft: 9,
        effectivePrice: '75.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00006-0000-4000-8000-000000000002',
        startDate: '2026-09-08',
        endDate: '2026-09-08',
        seatsLeft: 12,
        effectivePrice: '75.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00006-0000-4000-8000-000000000003',
        startDate: '2026-10-06',
        endDate: '2026-10-06',
        seatsLeft: 12,
        effectivePrice: '82.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e46',
    slug: 'mekong-delta-boats',
    title: 'Mekong Delta Boats',
    summary:
      'Catch the dawn floating market at Cái Răng, drift through coconut canals, and stay the night with a farming family.',
    basePrice: '129.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 2,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [
      { slug: 'can-tho', name: 'Cần Thơ', isPrimary: true },
      { slug: 'ho-chi-minh-city', name: 'Sài Gòn', isPrimary: false },
    ],
    category: { slug: 'cruises', name: 'Cruises' },
    suitableFor: ['FAMILY', 'COUPLE', 'FRIENDS'],
    badges: [],
    included: [
      'One night in a homestay on an orchard island',
      'All meals including a hotpot dinner with the family',
      'Sampan through the narrow canals',
      'Return transfer from Ho Chi Minh City',
    ],
    excluded: ['Drinks', 'Bicycle hire on the island'],
    highlights: [
      'Reach the floating market at 5:30am, when it is still traders and not tourists',
      'Eat fruit from the tree it was picked off ten minutes earlier',
    ],
    meetingPoint: 'Bến Thành market, north gate — 7:00am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'City to the delta',
        description:
          'Road transfer south, lunch at a noodle house in Cần Thơ, then the sampan to the island before dark.',
      },
      {
        dayNumber: 2,
        title: 'Floating market at first light',
        description:
          'Out on the water before sunrise, breakfast bought from a boat, then back to the city by mid-afternoon.',
      },
    ],
    faqs: [
      {
        question: 'How early is the early start?',
        answer:
          'We leave the homestay at 5:00am on day two. The market winds down by eight, so there is no later version of this.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 5 days before departure',
        body: 'Inside five days the homestay is already paid for, so we hold 40% and refund the rest.',
      },
      {
        kind: 'BOOKING',
        title: 'Group size',
        body: 'The sampans take six people each. Bookings of seven or more split across two boats travelling together.',
      },
    ],
    departures: [
      {
        id: 'd1a00007-0000-4000-8000-000000000001',
        startDate: '2026-08-22',
        endDate: '2026-08-23',
        seatsLeft: 5,
        effectivePrice: '129.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00007-0000-4000-8000-000000000002',
        startDate: '2026-09-19',
        endDate: '2026-09-20',
        seatsLeft: 12,
        effectivePrice: '129.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00007-0000-4000-8000-000000000003',
        startDate: '2026-10-17',
        endDate: '2026-10-18',
        seatsLeft: 0,
        effectivePrice: '129.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e47',
    slug: 'da-nang-coast-ride',
    title: 'Da Nang Coast Ride',
    summary:
      'Cross the Golden Bridge at Bà Nà Hills, then ride the Hải Vân pass with photo stops over the coast.',
    basePrice: '89.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 1,
    difficulty: 'MODERATE',
    maxGroupSize: 8,
    isFeatured: false,
    destinations: [
      { slug: 'da-nang', name: 'Đà Nẵng', isPrimary: true },
      { slug: 'hue', name: 'Huế', isPrimary: false },
    ],
    category: { slug: 'scenic', name: 'Scenic routes' },
    suitableFor: ['FRIENDS', 'SOLO', 'COUPLE'],
    badges: [],
    included: [
      'Rider or pillion seat with helmet and rain gear',
      'Bà Nà Hills cable car and Golden Bridge entry',
      'Seafood lunch at Lăng Cô lagoon',
    ],
    excluded: ['Fuel if you ride your own bike', 'Drinks'],
    highlights: [
      'Ride the pass rather than the tunnel — the road Top Gear made famous',
      'Stop at the abandoned French bunkers at the summit',
    ],
    meetingPoint: 'Dragon Bridge, south end car park — 7:30am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Bà Nà, the pass, and the lagoon',
        description:
          'Cable car first thing, back down by eleven, then the coast road north with three photo stops before lunch at Lăng Cô.',
      },
    ],
    faqs: [
      {
        question: 'Can I go as a passenger?',
        answer:
          'Yes. Say so when you book and we assign you an easy-rider driver at no extra cost. Most guests choose this.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'We also cancel and refund in full ourselves if the pass is closed for weather, which happens a few days each autumn.',
      },
      {
        kind: 'GENERAL',
        title: 'Riding your own bike',
        body: 'If you ride, we check your licence at the meeting point. No valid licence means no ride — your insurance would not cover you and neither would ours.',
      },
    ],
    departures: [
      {
        id: 'd1a00008-0000-4000-8000-000000000001',
        startDate: '2026-08-16',
        endDate: '2026-08-16',
        seatsLeft: 3,
        effectivePrice: '89.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00008-0000-4000-8000-000000000002',
        startDate: '2026-09-06',
        endDate: '2026-09-06',
        seatsLeft: 8,
        effectivePrice: '89.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e48',
    slug: 'ninh-binh-river-caves',
    title: 'Ninh Binh River Caves',
    summary:
      'Row through flooded caves under karst peaks, then climb the two-hundred steps to the Múa viewpoint.',
    basePrice: '68.00',
    compareAtPrice: '85.00',
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 14,
    isFeatured: false,
    destinations: [{ slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: true }],
    category: { slug: 'scenic', name: 'Scenic routes' },
    suitableFor: ['FAMILY', 'COUPLE', 'FRIENDS'],
    badges: ['BEST_VALUE'],
    included: [
      'Return transfer from Hanoi',
      'Tam Cốc rowing boat, two hours',
      'Bicycle hire between the sites',
      'Lunch of goat and burnt rice, the local speciality',
    ],
    excluded: ['Tip for the rower', 'Drinks'],
    highlights: [
      'Row through three caves where the ceiling comes down to arms length',
      'Climb Múa for the view down the whole valley',
    ],
    meetingPoint: 'Hanoi old quarter, Hàng Bè corner — 7:15am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Caves, bikes, viewpoint',
        description:
          'Boats in the morning while the water is still, bikes to Bích Động after lunch, then Múa at the end of the day when the light is low.',
      },
    ],
    faqs: [
      {
        question: 'Is the Múa climb hard?',
        answer:
          'Around 500 uneven stone steps. It is optional and about a third of each group skips it and waits at the café below.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'A full refund with a day of notice. On the day itself we cannot refund the boat, which is paid to the rower directly.',
      },
    ],
    departures: [
      {
        id: 'd1a00009-0000-4000-8000-000000000001',
        startDate: '2026-08-12',
        endDate: '2026-08-12',
        seatsLeft: 7,
        effectivePrice: '60.00',
        compareAtPrice: '85.00',
      },
      {
        id: 'd1a00009-0000-4000-8000-000000000002',
        startDate: '2026-08-26',
        endDate: '2026-08-26',
        seatsLeft: 14,
        effectivePrice: '68.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00009-0000-4000-8000-000000000003',
        startDate: '2026-09-16',
        endDate: '2026-09-16',
        seatsLeft: 1,
        effectivePrice: '68.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00009-0000-4000-8000-000000000004',
        startDate: '2026-10-07',
        endDate: '2026-10-07',
        seatsLeft: 14,
        effectivePrice: '68.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e49',
    slug: 'saigon-street-food-night',
    title: 'Saigon Street Food Night',
    summary:
      'Six stops on the back of a scooter, from a broken-rice stall to a dessert cart that only opens after ten.',
    basePrice: '45.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 6,
    isFeatured: true,
    destinations: [{ slug: 'ho-chi-minh-city', name: 'Sài Gòn', isPrimary: true }],
    category: { slug: 'food', name: 'Food & markets' },
    suitableFor: ['COUPLE', 'FRIENDS', 'SOLO'],
    badges: ['POPULAR'],
    included: [
      'Scooter and driver for the evening',
      'Six food stops, enough for a full dinner',
      'One beer or fresh juice per stop',
      'Helmet and rain poncho',
    ],
    excluded: ['Extra drinks', 'Hotel pickup outside District 1 and 3'],
    highlights: [
      'Eat in four districts in one evening, which is only possible on two wheels',
      'Finish at a chè cart that has been on the same corner since 1978',
    ],
    meetingPoint: 'Bùi Viện and Đề Thám corner — 5:45pm',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Six stops, four districts',
        description:
          'Four and a half hours, starting with savoury in District 4 and ending with dessert in Chinatown.',
      },
    ],
    faqs: [
      {
        question: 'I have dietary restrictions — can you work around them?',
        answer:
          'Vegetarian yes, with notice. Coeliac is genuinely hard here because soy sauce and fish sauce are in almost everything; tell us and we will be honest about whether it works.',
      },
      {
        question: 'Is riding pillion safe at night?',
        answer:
          'Our drivers are full-time, insured, and stay off the big arterials after dark. If you would rather not ride, we can run the same route by car for two guests or more.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'Groups are capped at six so a late cancellation costs a seat nobody else can take. A day of notice and you get everything back.',
      },
    ],
    departures: [
      {
        id: 'd1a00010-0000-4000-8000-000000000001',
        startDate: '2026-08-11',
        endDate: '2026-08-11',
        seatsLeft: 2,
        effectivePrice: '45.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00010-0000-4000-8000-000000000002',
        startDate: '2026-08-25',
        endDate: '2026-08-25',
        seatsLeft: 6,
        effectivePrice: '45.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00010-0000-4000-8000-000000000003',
        startDate: '2026-09-15',
        endDate: '2026-09-15',
        seatsLeft: 4,
        effectivePrice: '45.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00010-0000-4000-8000-000000000004',
        startDate: '2026-10-13',
        endDate: '2026-10-13',
        seatsLeft: 6,
        effectivePrice: '48.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4a',
    slug: 'hoi-an-cooking-market',
    title: 'Hoi An Market and Kitchen',
    summary:
      'Shop the morning market with a chef, then cook five central-Vietnamese dishes in a garden kitchen.',
    basePrice: '62.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 10,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    category: { slug: 'food', name: 'Food & markets' },
    suitableFor: ['COUPLE', 'FAMILY', 'SOLO'],
    badges: [],
    included: [
      'Market tour with tasting stops',
      'Basket boat ride to the cooking garden',
      'Five-dish class and the lunch you cook',
      'Printed recipes to take home',
    ],
    excluded: ['Hotel pickup outside the old town', 'Alcoholic drinks'],
    highlights: [
      'Pick your own herbs from the garden that supplies the restaurant',
      'Learn why the noodles for cao lầu can only be made with well water from one well',
    ],
    meetingPoint: 'Hội An central market, fish hall entrance — 8:00am',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Market, garden, kitchen',
        description:
          'Two hours shopping and tasting, a short boat ride, then cooking until a late lunch.',
      },
    ],
    faqs: [
      {
        question: 'Can vegetarians do this class?',
        answer:
          'Yes — the chef swaps the pork and fish courses for tofu and mushroom versions using the same techniques. Tell us at booking, not on the day.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 48 hours before',
        body: 'Ingredients are bought fresh on the morning, so we ask for two days rather than one.',
      },
    ],
    departures: [
      {
        id: 'd1a00011-0000-4000-8000-000000000001',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
        seatsLeft: 5,
        effectivePrice: '62.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00011-0000-4000-8000-000000000002',
        startDate: '2026-09-09',
        endDate: '2026-09-09',
        seatsLeft: 10,
        effectivePrice: '62.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00011-0000-4000-8000-000000000003',
        startDate: '2026-10-14',
        endDate: '2026-10-14',
        seatsLeft: 10,
        effectivePrice: '62.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4b',
    slug: 'can-tho-floating-dawn',
    title: 'Can Tho Floating Dawn',
    summary:
      'Two days on the water with a trader family — the wholesale market before sunrise, the retail one after.',
    basePrice: '118.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 2,
    difficulty: 'EASY',
    maxGroupSize: 8,
    isFeatured: false,
    destinations: [{ slug: 'can-tho', name: 'Cần Thơ', isPrimary: true }],
    category: { slug: 'food', name: 'Food & markets' },
    suitableFor: ['SOLO', 'COUPLE', 'BUSINESS'],
    badges: [],
    included: [
      'One night on a converted trading boat',
      'All meals, cooked in the galley',
      'Two market visits with a trader as your guide',
    ],
    excluded: ['Transfer to Cần Thơ', 'Drinks'],
    highlights: [
      'See what the boats hoist on the bamboo pole and understand the whole market at a glance',
      'Drink coffee poured from a boat that comes alongside yours',
    ],
    meetingPoint: 'Ninh Kiều wharf, boat 12 — 4:00pm',
    itinerary: [
      { dayNumber: 1, title: 'Board and go upriver', description: null },
      {
        dayNumber: 2,
        title: 'Cái Răng before light, Phong Điền after',
        description:
          'The wholesale market at 5am when the barges trade in tonnes, then the small retail market that follows it.',
      },
    ],
    faqs: [
      {
        question: 'What are the sleeping arrangements?',
        answer:
          'A mattress on the deck under a mosquito net, which is how the traders sleep. Cabins are not an option on a boat this size.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 5 days before departure',
        body: 'The boat takes eight and runs whether it is full or not, so late cancellations are held at 50%.',
      },
    ],
    departures: [
      {
        id: 'd1a00012-0000-4000-8000-000000000001',
        startDate: '2026-09-02',
        endDate: '2026-09-03',
        seatsLeft: 6,
        effectivePrice: '118.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00012-0000-4000-8000-000000000002',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        seatsLeft: 8,
        effectivePrice: '118.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4c',
    slug: 'north-to-south-classic',
    title: 'North to South Classic',
    summary:
      'Twelve days end to end — the bay, the imperial city, the lantern town, and the delta, by train and road.',
    basePrice: '1290.00',
    compareAtPrice: '1450.00',
    currency: 'USD',
    durationDays: 12,
    difficulty: 'MODERATE',
    maxGroupSize: 12,
    isFeatured: true,
    destinations: [
      { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
      { slug: 'hue', name: 'Huế', isPrimary: false },
      { slug: 'hoi-an', name: 'Hội An', isPrimary: false },
      { slug: 'ho-chi-minh-city', name: 'Sài Gòn', isPrimary: false },
    ],
    category: { slug: 'culture', name: 'Culture & heritage' },
    suitableFor: ['COUPLE', 'FAMILY', 'FRIENDS', 'SOLO'],
    badges: ['BEST_VALUE', 'POPULAR'],
    included: [
      'Eleven nights: seven hotels, one junk boat, one homestay, two sleeper trains',
      'All breakfasts, four lunches, three dinners',
      'Domestic transport throughout, including the Reunification Express',
      'A single guide for the whole route, not a new one in each city',
    ],
    excluded: [
      'International flights',
      'Travel insurance',
      'Most lunches and dinners — the food is half the point and we leave you free',
    ],
    highlights: [
      'Ride the coastal stretch between Huế and Đà Nẵng in daylight, the best train hour in the country',
      'One guide the whole way, so nobody re-explains the same thing in each city',
      'Two nights in the delta at the end, when everyone else flies home from Saigon',
    ],
    meetingPoint: 'Hanoi, Sofitel Metropole lobby — 6:00pm the evening before day one',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Hanoi on foot',
        description: 'Old quarter, a water puppet show, and dinner where the guide eats.',
      },
      { dayNumber: 2, title: 'Hanoi to Hạ Long', description: null },
      {
        dayNumber: 3,
        title: 'The bay, and the night train south',
        description: 'Kayaking in the morning, back to Hanoi by road, sleeper to Huế at 7pm.',
      },
      {
        dayNumber: 4,
        title: 'Huế citadel',
        description: 'Arrive at dawn, sleep an hour, then the Imperial City before the heat.',
      },
      { dayNumber: 5, title: 'Royal tombs by boat', description: null },
      {
        dayNumber: 6,
        title: 'Hải Vân pass to Hội An',
        description: 'The coastal train in daylight, then the short road hop into the old town.',
      },
      {
        dayNumber: 7,
        title: 'Hội An — tailors, market, lanterns',
        description: 'A free morning, a cooking class after lunch, the river at dusk.',
      },
      { dayNumber: 8, title: 'Mỹ Sơn, then a free afternoon', description: null },
      {
        dayNumber: 9,
        title: 'Fly south to Saigon',
        description: 'Morning flight, the war museum in the afternoon, street food at night.',
      },
      {
        dayNumber: 10,
        title: 'Củ Chi and the city',
        description: 'Tunnels in the morning, then the post office and Bến Thành at your own pace.',
      },
      {
        dayNumber: 11,
        title: 'Into the delta',
        description: 'Road to Cần Thơ, sampan through the canals, homestay on an orchard island.',
      },
      {
        dayNumber: 12,
        title: 'Floating market and farewell',
        description: 'Cái Răng at first light, back to Saigon by mid-afternoon for onward flights.',
      },
    ],
    faqs: [
      {
        question: 'Twelve days — is that enough time in each place?',
        answer:
          'It is one full day plus travel in most places and two in Hội An. If you want longer somewhere specific, tell us and we will price the same route with the extra nights added.',
      },
      {
        question: 'How much of it is travel time?',
        answer:
          'Two overnight trains, one domestic flight, and roughly four hours of road on the longest day. We use the night trains precisely so daylight is not spent moving.',
      },
      {
        question: 'What is the single supplement?',
        answer:
          'There is none on the trains, where berths are shared regardless. For hotel nights we can arrange a single room — ask in your enquiry and we quote it separately.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Cancellation on multi-day itineraries',
        body: 'Free cancellation up to 30 days before departure. Between 30 and 14 days we hold the deposit. Inside 14 days we hold 50%, because trains and internal flights are ticketed in your name by then.',
      },
      {
        kind: 'BOOKING',
        title: 'Deposit and balance',
        body: 'A deposit confirms your place; the balance falls due 30 days before departure. Bookings made inside 30 days are payable in full at checkout.',
      },
      {
        kind: 'GENERAL',
        title: 'Pace and fitness',
        body: 'There is no hard walking, but twelve days of early starts and overnight trains is genuinely tiring. Guests who want a slower version usually add two nights in Hội An.',
      },
    ],
    departures: [
      {
        id: 'd1a00013-0000-4000-8000-000000000001',
        startDate: '2026-09-07',
        endDate: '2026-09-18',
        seatsLeft: 3,
        effectivePrice: '1240.00',
        compareAtPrice: '1450.00',
      },
      {
        id: 'd1a00013-0000-4000-8000-000000000002',
        startDate: '2026-10-05',
        endDate: '2026-10-16',
        seatsLeft: 8,
        effectivePrice: '1290.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00013-0000-4000-8000-000000000003',
        startDate: '2026-11-02',
        endDate: '2026-11-13',
        seatsLeft: 12,
        effectivePrice: '1290.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    // Tour thứ hai chưa có đánh giá — chứng minh nhãn "Not yet reviewed" không
    // phải trường hợp cá biệt của một card.
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4d',
    slug: 'sa-pa-homestay-weekend',
    title: 'Sa Pa Homestay Weekend',
    summary: 'A short version of the terraces trek for anyone with only a weekend to spend.',
    basePrice: '132.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 2,
    difficulty: 'MODERATE',
    maxGroupSize: 10,
    isFeatured: false,
    destinations: [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }],
    category: { slug: 'trekking', name: 'Trekking' },
    suitableFor: ['FRIENDS', 'COUPLE'],
    badges: ['NEW'],
    included: [
      'One night in a family homestay in Tả Van',
      'All meals with your hosts',
      'Local guide from the valley',
    ],
    excluded: ['Train or bus from Hanoi', 'Drinks', 'Travel insurance'],
    highlights: [
      'The same valley as the three-day trek, walked at a faster pace',
      'Back in Hanoi by Sunday evening',
    ],
    meetingPoint: null,
    itinerary: [
      {
        dayNumber: 1,
        title: 'Down into the valley',
        description: 'Four hours on foot from the town to the homestay, mostly downhill.',
      },
      { dayNumber: 2, title: 'The short loop and out', description: null },
    ],
    faqs: [
      {
        question: 'How is this different from the three-day trek?',
        answer:
          'Same valley, same hosts, one night instead of two, and no high-terrace day. If you have the time, take the longer one.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 5 days before departure',
        body: 'Inside five days we hold the homestay cost and refund the rest.',
      },
    ],
    departures: [
      {
        id: 'd1a00014-0000-4000-8000-000000000001',
        startDate: '2026-09-05',
        endDate: '2026-09-06',
        seatsLeft: 10,
        effectivePrice: '132.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00014-0000-4000-8000-000000000002',
        startDate: '2026-09-26',
        endDate: '2026-09-27',
        seatsLeft: 10,
        effectivePrice: '132.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4e',
    slug: 'phu-quoc-sunset-sail',
    title: 'Phú Quốc Sunset Sail',
    summary: 'Four hours on a wooden sailing boat, out past the fish farms and back after dark.',
    basePrice: '78.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 1,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'phu-quoc', name: 'Phú Quốc', isPrimary: true }],
    category: { slug: 'cruises', name: 'Cruises' },
    suitableFor: ['COUPLE', 'FRIENDS', 'BUSINESS'],
    badges: [],
    included: [
      'Four-hour sail with crew',
      'Grilled seafood dinner aboard',
      'Snorkel gear and a swim stop',
    ],
    excluded: ['Hotel transfer', 'Drinks beyond the first two'],
    highlights: [
      'Swim off the boat in water still warm from the day',
      'Sail back under engine-off silence once the sun is down',
    ],
    meetingPoint: 'An Thới harbour, pontoon 3 — 3:30pm',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Out, swim, sunset, back',
        description:
          'Leave at four, anchor for a swim by five, eat as the sun goes, back at the pontoon around eight.',
      },
    ],
    faqs: [
      {
        question: 'Does it run if the wind drops?',
        answer:
          'Yes — the boat motors out and we sail whatever stretch the wind allows. If the sea is too rough to anchor safely we cancel and refund in full.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Free cancellation up to 24 hours before',
        body: 'Weather cancellations by us are always refunded in full, including the same day.',
      },
    ],
    departures: [
      {
        id: 'd1a00015-0000-4000-8000-000000000001',
        startDate: '2026-08-13',
        endDate: '2026-08-13',
        seatsLeft: 8,
        effectivePrice: '78.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00015-0000-4000-8000-000000000002',
        startDate: '2026-08-27',
        endDate: '2026-08-27',
        seatsLeft: 2,
        effectivePrice: '78.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00015-0000-4000-8000-000000000003',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        seatsLeft: 12,
        effectivePrice: '78.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00015-0000-4000-8000-000000000004',
        startDate: '2026-10-08',
        endDate: '2026-10-08',
        seatsLeft: 12,
        effectivePrice: '85.00',
        compareAtPrice: null,
      },
    ],
  },
  {
    id: '9f1c0a6e-1d2b-4c3a-8e5f-7a0b1c2d3e4f',
    slug: 'central-heritage-week',
    title: 'Central Heritage Week',
    summary: 'Six days between three UNESCO sites, moving at the pace of someone who lives there.',
    basePrice: '740.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 6,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [
      { slug: 'hue', name: 'Huế', isPrimary: true },
      { slug: 'hoi-an', name: 'Hội An', isPrimary: false },
      { slug: 'da-nang', name: 'Đà Nẵng', isPrimary: false },
    ],
    category: { slug: 'culture', name: 'Culture & heritage' },
    suitableFor: ['COUPLE', 'FAMILY', 'BUSINESS'],
    badges: [],
    included: [
      'Five nights in small hotels, all central',
      'All breakfasts and two dinners',
      'Entry to the Huế citadel, Mỹ Sơn, and the Hội An old town',
      'Private transport between the three cities',
    ],
    excluded: ['Flights', 'Most meals', 'Travel insurance'],
    highlights: [
      'Three World Heritage sites without a single early-morning coach transfer',
      'A free day in Hội An in the middle, which most itineraries at this length skip',
    ],
    meetingPoint: 'Huế railway station, main hall — 2:00pm',
    itinerary: [
      { dayNumber: 1, title: 'Arrive in Huế', description: null },
      {
        dayNumber: 2,
        title: 'Citadel and tombs',
        description: 'The Imperial City in the morning, two tombs by boat in the afternoon.',
      },
      {
        dayNumber: 3,
        title: 'Over the pass to Hội An',
        description: 'The coast road with stops at Lăng Cô and Marble Mountain.',
      },
      { dayNumber: 4, title: 'Free day in Hội An', description: null },
      {
        dayNumber: 5,
        title: 'Mỹ Sơn at opening time',
        description: 'The Cham towers before the buses arrive, then back for the lantern evening.',
      },
      { dayNumber: 6, title: 'Đà Nẵng and onward', description: null },
    ],
    faqs: [
      {
        question: 'Why is there a free day in the middle?',
        answer:
          'Because six days of scheduled sightseeing is too many. The Hội An day is deliberately empty — tailors, the beach, or nothing at all.',
      },
    ],
    policies: [
      {
        kind: 'CANCELLATION',
        title: 'Cancellation on multi-day itineraries',
        body: 'Free cancellation up to 21 days before departure. Between 21 and 7 days we hold the deposit. Inside 7 days we hold 50%.',
      },
      {
        kind: 'BOOKING',
        title: 'Deposit and balance',
        body: 'A deposit confirms your place; the balance falls due 21 days before departure.',
      },
    ],
    departures: [
      {
        id: 'd1a00016-0000-4000-8000-000000000001',
        startDate: '2026-09-14',
        endDate: '2026-09-19',
        seatsLeft: 4,
        effectivePrice: '740.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00016-0000-4000-8000-000000000002',
        startDate: '2026-10-12',
        endDate: '2026-10-17',
        seatsLeft: 12,
        effectivePrice: '740.00',
        compareAtPrice: null,
      },
      {
        id: 'd1a00016-0000-4000-8000-000000000003',
        startDate: '2026-11-09',
        endDate: '2026-11-14',
        seatsLeft: 12,
        effectivePrice: '790.00',
        compareAtPrice: null,
      },
    ],
  },
];

// Ghép media + DẪN XUẤT rating vào từng tour.
//
// Slug không có trong TOUR_MEDIA / TOUR_REVIEWS thì ra mảng rỗng — đúng nhánh
// "biên tập chưa upload" và "chưa ai đánh giá" mà API cũng sẽ trả về.
//
// `ratingAvg`/`ratingCount` KHÔNG viết tay trong từng object nữa mà tính từ
// TOUR_REVIEWS. Lý do: hero in "4.8 (12)" thì con số đó phải là con số của chính
// danh sách người đọc bấm vào xem được — viết tay 1204 rồi mock 12 review là
// "See all 1,204 reviews" mở ra 12, tức nói dối ngay trong cụm tĩnh. Ở API thật
// hai cột này được denormalize atomically lúc duyệt review, nên dẫn xuất ở đây
// phản chiếu đúng quan hệ đó.
export const TOURS: MockTourDetail[] = TOURS_WITHOUT_MEDIA.map((tour) => {
  const reviews = TOUR_REVIEWS[tour.slug] ?? [];
  return {
    ...tour,
    media: TOUR_MEDIA[tour.slug] ?? [],
    // null ≠ 0: chưa ai đánh giá, không phải bị chấm 0 điểm.
    ratingAvg: reviews.length === 0 ? null : averageRating(reviews),
    ratingCount: reviews.length,
  };
});

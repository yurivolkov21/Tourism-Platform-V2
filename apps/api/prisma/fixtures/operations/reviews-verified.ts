import { tourDepartures } from '../catalog/departures-2026.js';
import { tourReviews as reviewCu } from '../catalog/reviews.js';
import { tours as toursCentral } from '../catalog/tours-central.js';
import { tours as toursNorth } from '../catalog/tours-north.js';
import { tours as toursSouth } from '../catalog/tours-south.js';
import { boSinh, chonTheoTrongSo, idTinh, nguyen } from '../stable-id.js';
import { bookingsGia } from './bookings.js';

/**
 * Review `VERIFIED` — thay TRỌN 84 review `CURATED` cũ.
 *
 * ── Quyết định của user (10/09/2026) ──
 * Bỏ hết review curated, mọi review mới đứng tên khách giả, "cũ xoá hết thì
 * mới cũng thay hết". Kèm một tối ưu user đã duyệt: GIỮ CHỮ, THAY NGƯỜI — 84
 * đoạn văn cũ viết tay riêng cho từng tour, có chi tiết thật của từng chuyến,
 * nên chúng được gắn lại vào một khách giả + một booking đã hoàn thành của
 * CHÍNH tour đó thay vì vứt đi. Mọi dòng vẫn là dòng MỚI (id mới, tác giả mới,
 * booking mới, `VERIFIED`).
 *
 * ── Vì sao review buộc phải đứng CUỐI chuỗi seed ──
 * CHECK `reviews_source_shape` của DB:
 *   VERIFIED ⇒ tour_id, user_id, booking_id đều NOT NULL
 *   CURATED  ⇒ booking_id IS NULL AND user_id IS NULL
 * Review không thể vừa mang user vừa là CURATED. Muốn nó đứng tên khách thì
 * phải là VERIFIED, mà VERIFIED đòi một booking thật phía sau — nên bước này
 * chỉ chạy được SAU khi có booking.
 *
 * ── Lái từ ĐÍCH, không lái từ tỉ lệ ──
 * Cách hiển nhiên là "cho x% khách đã đi để lại review". Cách đó sai: booking
 * không rải đều giữa 29 tour, nên tour ít khách rơi về 0 review và mất sao —
 * đúng vấn đề 5 tour đang gặp trước đợt này. Nên chốt SỐ REVIEW MỖI TOUR trước
 * (≥3), rồi mới lấy booking để chứa chúng.
 *
 * ── `bookingId` là @unique ──
 * DB tự ép một review cho một booking. Bộ sinh chỉ cần không cấp phát một
 * booking hai lần.
 */

export interface ReviewFixture {
  id: string;
  tourId: string;
  userId: string;
  bookingId: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  isApproved: boolean;
  rejectedAt: string | null;
  moderatedAt: string | null;
  retractedAt: string | null;
  createdAt: string;
}

export interface ModerationEventFixture {
  id: string;
  reviewId: string;
  fromApproved: boolean;
  toApproved: boolean;
  toRejected: boolean;
  note: string | null;
  createdAt: string;
}

const NGAY = 86400000;
const ISOT = (t: number): string => new Date(t).toISOString();

const tours = [...toursNorth, ...toursCentral, ...toursSouth];
const bangSlug = new Map(tours.map((t) => [t.slug, t.id]));

/**
 * Đoạn văn BỔ SUNG cho những tour mà bộ 84 review cũ phủ chưa đủ.
 *
 * Sáu tour đầu tiên bên dưới trước đợt này có 0–2 review, tức card của chúng
 * không có sao nào trên site. Mười tour cuối đang có đúng 3 — thêm một cái nữa
 * để trung bình sao của chúng không bị một ý kiến lẻ kéo đi.
 *
 * Mỗi câu neo vào một dữ kiện THẬT của chính tour đó (bàn xoay Bát Tràng, tranh
 * Đông Hồ, đèo Hải Vân, hang Thiên Đường…), không phải lời khen chung chung —
 * cùng luật với đợt viết FAQ và alt text.
 */
const THEM: { slug: string; rating: number; title: string; body: string }[] = [
  // ── Sáu tour trước đây 0–2 review ──
  {
    slug: 'red-river-craft-villages-day',
    rating: 5,
    title: 'The wheel is harder than it looks',
    body: 'I have thrown pots before and still produced something lopsided — the Bát Tràng potter fixed it in about four seconds without making me feel foolish. The Đông Hồ printing in the afternoon was the quieter half and the one I keep thinking about.',
  },
  {
    slug: 'red-river-craft-villages-day',
    rating: 4,
    title: 'Two villages, one river, no rush',
    body: 'A gentle day. The covered ceramics market is a maze and our guide knew which stalls were the workshops rather than resellers. Only note: my bowl needed firing, so it was posted on later at my own cost — worth knowing in advance.',
  },
  {
    slug: 'red-river-craft-villages-day',
    rating: 5,
    title: 'Best thing we did near Hanoi',
    body: 'We wanted something out of the Old Quarter that was not a bus tour. This was it. The kilns are still working, the heat is real, and the woodblock printing gave our kids something to take home that they actually made.',
  },
  {
    slug: 'red-river-craft-villages-day',
    rating: 4,
    title: 'Good for a rainy day',
    body: 'It rained the whole morning and it barely mattered — both village visits are largely under cover. The drive across the Red River is longer than you expect, so bring something to read.',
  },

  {
    slug: 'mai-chau-cycling-2d',
    rating: 5,
    title: 'Flat, green and completely quiet',
    body: 'The valley really is flat, so "cycling trip" here means gliding past rice fields rather than grinding up hills. We stopped whenever we felt like it. The stilt-house night with rice wine and dancing was warmer than I expected, not a performance.',
  },
  {
    slug: 'mai-chau-cycling-2d',
    rating: 5,
    title: 'The homestay makes it',
    body: 'The riding is lovely but the reason to come is sleeping in the stilt house. Thin mattress, mosquito net, the whole family eating together downstairs. Lác village is touristy in daylight and empty by nine at night, which is when it is best.',
  },
  {
    slug: 'mai-chau-cycling-2d',
    rating: 4,
    title: 'Bring a light layer for the evening',
    body: 'Beautiful two days. The bikes were basic but fine for the terrain. It got surprisingly cool after dark in the valley and I had packed for Hanoi heat — my one mistake, easily avoided.',
  },
  {
    slug: 'mai-chau-cycling-2d',
    rating: 4,
    title: 'Good introduction to the northwest',
    body: 'If you cannot spare four days for Hà Giang, this is the honest smaller version. Less dramatic, much easier, and you still end up somewhere that feels a long way from the city.',
  },

  {
    slug: 'my-son-sunrise-halfday',
    rating: 5,
    title: 'Worth the alarm clock',
    body: 'We had Group B almost to ourselves for the first half hour. By the time the coaches arrived we were already walking out. The brickwork detail in that low light is the whole point of going early.',
  },
  {
    slug: 'my-son-sunrise-halfday',
    rating: 4,
    title: 'Small site, big atmosphere',
    body: 'Mỹ Sơn is smaller than the photos suggest and parts are still bomb-damaged, which the guide explained without glossing over it. The Apsara dance at the theatre is short and genuinely good. Back in Hội An before the heat.',
  },
  {
    slug: 'my-son-sunrise-halfday',
    rating: 5,
    title: 'Our guide made the difference',
    body: 'Without the commentary these would be pretty ruins. With it, you understand what the Chăm were building and why the towers stand up without mortar. The coffee stop on the drive back was a small kindness at that hour.',
  },
  {
    slug: 'my-son-sunrise-halfday',
    rating: 3,
    title: 'Good, but the site is compact',
    body: 'No complaints about the running of it — punctual, well explained, genuinely quiet. Just be aware you will have seen everything in about ninety minutes. The sunrise timing is what you are paying for.',
  },

  {
    slug: 'quy-nhon-coastal-3d',
    rating: 5,
    title: 'The coast Nha Trang used to be',
    body: 'Three days and we barely shared a beach. Kỳ Co by speedboat is the postcard, but Eo Gió at the end of the day, with the wind coming through the pass, was the better memory. Quy Nhơn town itself is unhurried and cheap.',
  },
  {
    slug: 'quy-nhon-coastal-3d',
    rating: 4,
    title: 'Turquoise water, real fishing town',
    body: 'The cove genuinely is that colour. The Chăm towers are a short stop rather than a highlight, and that felt right — this is a coast trip with a little history attached, not the other way round.',
  },
  {
    slug: 'quy-nhon-coastal-3d',
    rating: 5,
    title: 'Go before it changes',
    body: 'There is construction along the road north and you can see what is coming. For now it is still a working coastline with a couple of very good beaches on it. The speedboat ride is bumpy; sit at the back.',
  },
  {
    slug: 'quy-nhon-coastal-3d',
    rating: 4,
    title: 'Relaxed pace, good seafood',
    body: 'Two beach days and one exploring, which suited us. The sea caves near Eo Gió depend on the swell — ours was too rough to enter, and the guide said so honestly rather than pretending otherwise.',
  },

  {
    slug: 'ben-tre-coconut-day',
    rating: 5,
    title: 'Everything here is made of coconut',
    body: 'The candy kitchen is hot, loud and completely unstaged — women rolling and cutting at a speed you cannot follow. We ate more samples than was sensible. The canal paddle afterwards is only twenty minutes but it is the picture you came for.',
  },
  {
    slug: 'ben-tre-coconut-day',
    rating: 4,
    title: 'Better than the big Mỹ Tho boats',
    body: 'We had done a delta day trip years ago on a boat with two hundred people. This was a sampan with four. The horse cart is a bit of a novelty and the road is bumpy, but the whole day feels like a province rather than an attraction.',
  },
  {
    slug: 'ben-tre-coconut-day',
    rating: 5,
    title: 'Our guide grew up in the village',
    body: 'That changed the day completely — she knew whose workshop we were standing in and could tell us what the family did before the candy. Nothing felt like a scripted stop.',
  },
  {
    slug: 'ben-tre-coconut-day',
    rating: 4,
    title: 'Long drive, easy day',
    body: 'It is a real drive from Sài Gòn and back, so most of the day is transport. What is at the other end is worth it, but go in knowing that. Nothing about the day is physically demanding.',
  },

  {
    slug: 'vietnam-grand-journey-12d',
    rating: 5,
    title: 'Twelve days that actually connect',
    body: 'We had done Vietnam in pieces before and always felt we were parachuting into places. Doing it end to end, with the internal flights handled, finally made the country read as one thing. Hạ Long into Huế into the delta, in that order, makes sense.',
  },
  {
    slug: 'vietnam-grand-journey-12d',
    rating: 4,
    title: 'Pace is brisk but never rushed',
    body: 'Seven destinations in twelve days sounds punishing and mostly it is not — there are proper rest afternoons built in. The two long transfer days are the price. Packing light matters more than usual.',
  },

  // ── Mười tour đang có đúng 3 review ──
  {
    slug: 'hanoi-heritage-day',
    rating: 5,
    title: 'A thousand years in one walk',
    body: 'The Temple of Literature in the morning and the Old Quarter at dusk bookend the day nicely. Ba Đình is more solemn than I expected — dress code is enforced, so cover your shoulders.',
  },
  {
    slug: 'lan-ha-kayak-cruise-3d',
    rating: 5,
    title: 'The bay without the flotilla',
    body: 'We passed maybe four boats all day. Kayaking through the grotto into the enclosed lagoon is the moment everyone photographs and it deserves it. The beach night after the boat night was a good change of texture.',
  },
  {
    slug: 'northern-highlights-5d',
    rating: 4,
    title: 'Three landscapes, one week',
    body: 'Hà Nội on foot, a night on the water, then Tràng An by rowing boat — each is different enough that it never blurs. Five days is the minimum this route needs; I would not compress it.',
  },
  {
    slug: 'hue-imperial-day',
    rating: 5,
    title: 'Khải Định’s tomb is extraordinary',
    body: 'The Citadel is the headline but the fusion tomb is the thing I would come back for — European concrete outside, glass mosaic inside, unlike anything else in the country. The bún bò Huế by the river was the best version we ate.',
  },
  {
    slug: 'phong-nha-paradise-cave-day',
    rating: 5,
    title: 'The cave is genuinely vast',
    body: 'Photographs do not convey the scale — the wooden walkway goes on and on and you are still in the first chamber. The zipline and mud bath are optional fun; the cave alone justifies the day.',
  },
  {
    slug: 'hoi-an-countryside-cooking-day',
    rating: 5,
    title: 'Herbs, basket boat, then lunch you made',
    body: 'Cycling out to Trà Quế first thing means you pick the herbs you cook with two hours later, which sounds gimmicky and turns out to be the point. The basket boat spin is silly and everyone loved it.',
  },
  {
    slug: 'central-heritage-4d',
    rating: 4,
    title: 'The Hải Vân Pass is the link',
    body: 'Doing Đà Nẵng, Hội An and Huế as one road trip rather than three bases was the right call, and the pass itself is the best hour of driving in the country. Four days is tight but workable.',
  },
  {
    slug: 'central-honeymoon-5d',
    rating: 5,
    title: 'Private where it mattered',
    body: 'The sunset cruise with just the two of us was worth the whole trip. Mỹ Sơn at sunrise on our third morning was the other one. Everything was arranged so we never had to make a decision at seven in the morning.',
  },
  {
    slug: 'vung-tau-coastal-2d',
    rating: 4,
    title: 'The easiest escape from Sài Gòn',
    body: 'You are on a beach two hours after leaving the city. The dawn climb to the lighthouse is short and the view over both beaches is the reason to get up. Seafood by the water in the evening was excellent and absurdly cheap.',
  },
  {
    slug: 'saigon-after-dark-vespa',
    rating: 5,
    title: 'District 4 is the reason to book',
    body: 'The alleys we ate in are not places I would have found or, frankly, walked into alone. Four stops, all different, all excellent. Riding pillion through the night traffic is half the experience — hold on and enjoy it.',
  },

  // ── Ba lời CHÊ ──
  // Bộ 84 review cũ không có dòng nào dưới 3 sao, và bộ bổ sung ban đầu của
  // mình cũng vậy — cho ra một trang không có lấy một lời chê. Đó không phải
  // dữ liệu thật: nó đọc ra như đã lọc, và nó cũng không bao giờ chạy thử được
  // đường hiển thị điểm thấp. Ba dòng dưới đây nêu vấn đề CỤ THỂ và kiểm được
  // (thời tiết, nước rút, xe đông) chứ không phải chê chung chung.
  {
    slug: 'halong-bay-overnight-cruise',
    rating: 2,
    title: 'Cancelled excursion, no alternative',
    body: 'The kayaking was called off for weather, which I accept, but nothing was offered in its place and we sat on the boat for four hours. The cabin and the food were good. The handling of a lost afternoon was not.',
  },
  {
    slug: 'bana-hills-golden-bridge-day',
    rating: 2,
    title: 'Too many people for the bridge to work',
    body: 'We arrived mid-morning and the Golden Bridge was shoulder to shoulder — you shuffle across it rather than walk. That is not the operator’s fault, but the itinerary puts you there at the worst hour and nobody warned us.',
  },
  {
    slug: 'phu-quoc-island-hopping-day',
    rating: 1,
    title: 'Boat left two of our party behind',
    body: 'A miscount at the second snorkelling stop meant the boat pulled away with two of us still in the water. They were picked up within a few minutes and everyone was fine, but there was no headcount and no apology afterwards.',
  },
];

/** Phân bố sao hình chữ J — dạng thật của review du lịch, ⌀ ≈ 4,34. */
const PHAN_BO_SAO: [number, number][] = [
  [5, 55],
  [4, 30],
  [3, 10],
  [2, 4],
  [1, 1],
];

interface Ket {
  reviews: ReviewFixture[];
  moderationEvents: ModerationEventFixture[];
}

function sinh(): Ket {
  const depTheoId = new Map(tourDepartures.map((d) => [d.id, d]));
  // Chỉ booking ĐÃ HOÀN THÀNH mới được review: không ai đánh giá chuyến chưa đi.
  const ungVien = new Map<string, typeof bookingsGia>();
  for (const b of bookingsGia) {
    if (b.status !== 'PAID') continue;
    if (depTheoId.get(b.departureId)?.status !== 'CLOSED') continue;
    const ds = ungVien.get(b.tourId) ?? [];
    ds.push(b);
    ungVien.set(b.tourId, ds);
  }
  for (const ds of ungVien.values()) ds.sort((a, b) => a.id.localeCompare(b.id));

  const daDung = new Map<string, number>();
  const reviews: ReviewFixture[] = [];
  const moderationEvents: ModerationEventFixture[] = [];

  /** Cấp một booking chưa ai review của tour này. */
  const layBooking = (tourId: string) => {
    const ds = ungVien.get(tourId);
    if (!ds) return null;
    const k = daDung.get(tourId) ?? 0;
    if (k >= ds.length) return null;
    daDung.set(tourId, k + 1);
    return ds[k] ?? null;
  };

  const them = (
    tourId: string,
    rating: number,
    title: string | null,
    body: string,
    hat: string,
  ) => {
    const bk = layBooking(tourId);
    if (!bk) return;
    const rnd = boSinh(`rv:${hat}`);
    const ketThuc = Date.parse(`${bk.departureEndDate}T00:00:00.000Z`);
    // Viết review 1–21 ngày sau khi chuyến kết thúc. Ràng buộc này tự rải
    // review khắp 12 tháng mà không cần luật riêng.
    const viet = ketThuc + nguyen(rnd, 1, 21) * NGAY;
    const id = idTinh('review', bk.id);

    // ── Trạng thái duyệt ──
    // Bộ cũ để cả 84 dòng `isApproved=true, moderatedAt=null`, nên hàng đợi
    // moderation của admin trống trơn. Chia lại để hai màn ấy có việc.
    const boc = rnd();
    let isApproved = true;
    let rejectedAt: string | null = null;
    let moderatedAt: string | null = ISOT(viet + nguyen(rnd, 1, 3) * NGAY);
    let retractedAt: string | null = null;
    if (boc < 0.07) {
      // chờ duyệt — chưa ai xem
      isApproved = false;
      moderatedAt = null;
    } else if (boc < 0.1) {
      isApproved = false;
      rejectedAt = moderatedAt;
    } else if (boc < 0.11) {
      // tác giả rút lại review đã duyệt (đường W4 U2)
      isApproved = false;
      retractedAt = ISOT(viet + nguyen(rnd, 20, 60) * NGAY);
    }

    reviews.push({
      id,
      tourId,
      userId: bk.userId,
      bookingId: bk.id,
      rating,
      title,
      body,
      // Snapshot tên hiển thị — service copy từ `user.name` lúc tạo.
      authorName: bk.contactName,
      isApproved,
      rejectedAt,
      moderatedAt,
      retractedAt,
      createdAt: ISOT(viet),
    });

    if (moderatedAt) {
      moderationEvents.push({
        id: idTinh('rv-event', id),
        reviewId: id,
        fromApproved: false,
        toApproved: isApproved,
        toRejected: rejectedAt !== null,
        note: rejectedAt ? 'Off-topic: the review discusses a different tour.' : null,
        createdAt: moderatedAt,
      });
    }
  };

  // 1) 84 đoạn văn cũ — giữ chữ và số sao, gắn lại vào khách giả + booking thật.
  for (const r of reviewCu) them(r.tourId, r.rating, r.title ?? null, r.body, `cu:${r.id}`);

  // 2) 32 đoạn bổ sung cho những tour phủ chưa đủ.
  for (const [i, t] of THEM.entries()) {
    const tourId = bangSlug.get(t.slug);
    if (tourId) them(tourId, t.rating, t.title, t.body, `moi:${i}`);
  }

  // 3) Nâng mọi tour lên tối thiểu ba review ĐÃ DUYỆT — nếu bước 1+2 chưa đủ
  //    (ví dụ vì một dòng rơi vào nhánh chờ duyệt/bị bác), thêm cho đủ. Không
  //    có bước này thì "29/29 tour có sao" là điều cầu may chứ không phải
  //    ràng buộc.
  const TOI_THIEU = 3;
  for (const tour of tours) {
    let coSao = reviews.filter((r) => r.tourId === tour.id && r.isApproved).length;
    let vong = 0;
    while (coSao < TOI_THIEU && vong < 6) {
      const rnd = boSinh(`bu:${tour.slug}:${vong}`);
      const truoc = reviews.length;
      them(
        tour.id,
        chonTheoTrongSo(rnd, PHAN_BO_SAO),
        null,
        'Everything ran to time and the guide was excellent — we would book with them again.',
        `bu:${tour.slug}:${vong}`,
      );
      // `them` có thể rơi vào nhánh chưa duyệt; đếm lại thay vì giả định.
      if (reviews.length > truoc) {
        const moi = reviews[reviews.length - 1];
        if (moi) {
          moi.isApproved = true;
          moi.rejectedAt = null;
          moi.retractedAt = null;
        }
      }
      coSao = reviews.filter((r) => r.tourId === tour.id && r.isApproved).length;
      vong++;
    }
  }

  return { reviews, moderationEvents };
}

const ket = sinh();
export const reviewsGia = ket.reviews;
export const reviewModerationEventsGia = ket.moderationEvents;

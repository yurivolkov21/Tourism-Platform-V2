import type { MockMoment } from './types.js';

// Khoảnh khắc trải nghiệm của khách (review #11 — thay danh mục tour trong
// slider Stats): bằng chứng sống đứng cạnh số liệu social proof. Đây là ứng
// viên schema mới khi gắn API (bảng trip moments / UGC gallery).
// 3 tourSlug đã sửa (cruise/Sa Pa/Mekong) trỏ lại tour THẬT sau khi catalogue
// lên API (Task 4, cụm destinations-api) — bản cũ trỏ slug mock đã chết
// (`ha-long-bay-cruise`, `sa-pa-terraces-trek`, `mekong-delta-boats`), bấm vào
// ra 404. `hoi-an-lantern-evening`/`hue-imperial-day` là slug THẬT sẵn từ
// trước — giữ nguyên, KHÔNG đổi. Toàn bộ `credit` (cả 5) đổi theo tiêu đề
// THẬT của tour trong `apps/api/prisma/fixtures/catalog/` (không còn tiêu đề
// rút gọn của mock `tours.ts` đã chết) — test `mocks.spec.ts` canh cả hai
// chiều: slug tồn tại VÀ credit nhắc đúng tên tour slug đó trỏ tới.
export const MOMENTS: MockMoment[] = [
  {
    title: 'Paddling out between the karsts, just the two of us',
    credit: 'Sarah, Hạ Long Bay Overnight Cruise 2D1N',
    tourSlug: 'halong-bay-overnight-cruise',
  },
  {
    title: 'The valley opens up on the climb to the homestay',
    credit: 'Daniel, Sa Pa Terraces & Homestay Trek 2D1N',
    tourSlug: 'sapa-terraces-homestay-2d',
  },
  {
    title: 'Releasing paper lanterns on the Hoài river',
    credit: 'Emma, Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
  },
  {
    title: 'The Ngọ Môn gate before the morning crowds arrive',
    credit: 'Kenji, Huế Imperial City & Royal Tombs',
    tourSlug: 'hue-imperial-day',
  },
  {
    title: 'Drifting between the boats as the market wakes up',
    credit: 'Tom, Mekong Delta & Cái Răng Floating Market 2D1N',
    tourSlug: 'mekong-can-tho-2d',
  },
];

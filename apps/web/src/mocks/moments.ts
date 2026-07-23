import type { MockMoment } from './types.js';

// Khoảnh khắc trải nghiệm của khách (review #11 — thay danh mục tour trong
// slider Stats): bằng chứng sống đứng cạnh số liệu social proof. Đây là ứng
// viên schema mới khi gắn API (bảng trip moments / UGC gallery).
export const MOMENTS: MockMoment[] = [
  {
    title: 'Kayaking into the hidden lagoon at golden hour',
    credit: 'Sarah, Ha Long Bay Cruise',
  },
  {
    title: 'Sunrise over the terraces from the homestay porch',
    credit: 'Daniel, Sa Pa Terraces Trek',
  },
  {
    title: 'Releasing paper lanterns on the Hoài river',
    credit: 'Emma, Hoi An Lantern Evening',
  },
  {
    title: 'Learning royal recipes with chị Lan in her garden kitchen',
    credit: 'Kenji, Hue Imperial Day',
  },
  {
    title: 'Coffee on the boat as the floating market wakes up',
    credit: 'Tom, Mekong Delta Boats',
  },
];

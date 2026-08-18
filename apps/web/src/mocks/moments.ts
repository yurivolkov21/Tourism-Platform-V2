import type { MockMoment } from './types.js';

// Khoảnh khắc trải nghiệm của khách (review #11 — thay danh mục tour trong
// slider Stats): bằng chứng sống đứng cạnh số liệu social proof. Đây là ứng
// viên schema mới khi gắn API (bảng trip moments / UGC gallery).
//
// ── Vòng 18/08: viết lại 4/5 mục cho KHỚP ẢNH CÓ THẬT ──
// Bản trước đặt caption trước rồi mới đi tìm ảnh, và ba trong năm cảnh
// (hang Hạ Long, thung lũng Sa Pa, chợ nổi Cái Răng) không có tấm nào trong
// kho — Hạ Long / Sa Pa / Huế / Cần Thơ đều là địa danh KHÔNG có ảnh nào đã
// tải về. Chờ tìm đủ ảnh cho một caption đã viết sẵn là hướng tốn thời gian
// nhất mà lại chặn cả phần còn lại, nên đảo chiều: chọn từ ảnh ĐANG CÓ trước,
// rồi sửa caption + `tourSlug` + `credit` theo đúng thứ trong ảnh.
//
// Đổi cả ba trường một lượt là BẮT BUỘC, không phải cho gọn: `mocks.spec.ts`
// canh hai chiều — `tourSlug` phải nằm trong roster tour thật, và `credit`
// phải NHẮC ĐÚNG tiêu đề của chính tour đó. Sửa caption mà quên slug thì
// caption kể một tour còn link dẫn sang tour khác.
//
// Mục Hội An giữ NGUYÊN văn: `hoi-an/gallery/01.jpg` đúng là thuyền đậu bên
// sông Hoài giữa ban ngày, tức là "hours before the lanterns" theo nghĩa đen.
export const MOMENTS: MockMoment[] = [
  {
    title: 'Paddling out under the karst wall, the water goes green',
    credit: 'Sarah, Lan Hạ Bay & Cát Bà Kayak Cruise 3D2N',
    tourSlug: 'lan-ha-kayak-cruise-3d',
    slot: 'moment-lanha-kayak',
  },
  {
    title: 'The road bends once more and the whole valley opens up',
    credit: 'Daniel, Hà Giang Loop by Easyrider 4D3N',
    tourSlug: 'ha-giang-loop-4d',
    slot: 'moment-hagiang-valley',
  },
  {
    title: 'Boats on the Hoài river, hours before the lanterns',
    credit: 'Emma, Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
    slot: 'moment-hoian-river',
  },
  {
    title: 'The Chăm brick towers at Mỹ Sơn, before the crowds arrive',
    credit: 'Kenji, Mỹ Sơn Sanctuary at Sunrise',
    tourSlug: 'my-son-sunrise-halfday',
    slot: 'moment-myson-towers',
  },
  {
    title: 'Drifting into the coconut canals as the palms close overhead',
    credit: 'Tom, Bến Tre Coconut Country Day Trip',
    tourSlug: 'ben-tre-coconut-day',
    slot: 'moment-bentre-canal',
  },
];

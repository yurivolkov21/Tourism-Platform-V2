import type { MockOffice } from './types.js';

// 2 văn phòng cho trang Contact — NGUỒN SỰ THẬT DUY NHẤT của thông tin địa chỉ
// toàn site (topbar, khối info cạnh form, bản đồ). Trước 06/08 có ba nguồn
// chỏi nhau: mock này, hằng hardcode trong contact-split/top-bar, và block
// `contact.offices` mồ côi trong @tourism/i18n — /contact nói Hà Nội + Sa Pa
// còn /terms in trụ sở Hồ Chí Minh. Nay gom về đây, đối chiếu Nexora.
// Vẫn là "ứng viên schema offices" theo ADR-0016 (không có endpoint, sống tiếp
// như nội dung biên tập tĩnh).
//
// Toạ độ geocode từ OpenStreetMap Nominatim, trúng bản ghi TOÀ NHÀ chứ không
// phải điểm giữa đường — cùng nguồn dữ liệu với tile OpenFreeMap đang render
// nên pin rơi đúng toà. KHÔNG dùng lại toạ độ của Nexora: [105.8606, 20.9895]
// của họ lệch ~600m khỏi toà VTC Online (chấm bằng mắt, không geocode).
export const OFFICES: MockOffice[] = [
  {
    city: 'Hà Nội',
    name: 'Headquarters',
    addressLines: ['18 Tam Trinh, Tương Mai', 'Hà Nội, Vietnam'],
    hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
    // OSM: "Tòa nhà VTC Online, 18, Đường Tam Trinh" (class=building, type=office)
    coords: [105.8618052, 20.9949485],
    mapHref: 'https://www.google.com/maps?q=18+Tam+Trinh,+Tuong+Mai,+Ha+Noi',
  },
  {
    city: 'Hồ Chí Minh City',
    name: 'Ho Chi Minh City office',
    addressLines: ['184 Lê Đại Hành, Phú Thọ', 'Hồ Chí Minh City, Vietnam'],
    hours: 'Mon–Fri · 8:00 am – 6:00 pm (GMT+7)',
    // OSM: "The Emporium Lê Đại Hành, 184, Đường Lê Đại Hành"
    coords: [106.6556413, 10.7646196],
    mapHref: 'https://www.google.com/maps?q=184+Le+Dai+Hanh,+Phu+Tho,+Ho+Chi+Minh',
  },
];

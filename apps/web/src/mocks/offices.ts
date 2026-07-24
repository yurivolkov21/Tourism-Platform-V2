import type { MockOffice } from './types.js';

// 2 văn phòng cho trang Contact (static-first) — ứng viên schema `offices`
// (city · name · address_lines · hours · lat/lng cho map thật sau này).
export const OFFICES: MockOffice[] = [
  {
    city: 'Hà Nội',
    name: 'Headquarters',
    addressLines: ['12 Hàng Bạc, Hoàn Kiếm', 'Hà Nội, Vietnam'],
    hours: 'Mon–Fri 8:30–18:00 · Sat 9:00–12:00',
  },
  {
    city: 'Sa Pa',
    name: 'Basecamp — where it all started',
    addressLines: ['45 Fansipan Road', 'Sa Pa, Lào Cai'],
    hours: 'Every day 7:00–19:00',
  },
];

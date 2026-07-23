import type { MockTeamMember } from './types.js';

// Đội sáng lập/vận hành cho About §5 (quyết định user 23/07: CHỈ founder,
// không hồ sơ guide). Khớp chuyện §2 Story: "two brothers and a neighbour" =
// 3 đồng sáng lập 2014, + trưởng vận hành gia nhập 2017 khi mở miền Trung.
// Ứng viên schema khi gắn API: bảng team_members (name · role · line ·
// portrait · sort_order).
export const TEAM: MockTeamMember[] = [
  {
    name: 'Đức Anh',
    role: 'Co-founder & CEO',
    line: 'The elder brother. Still drives the first route every spring.',
  },
  {
    name: 'Minh Quân',
    role: 'Co-founder & Head of Routes',
    line: 'The younger brother. Walks every path before it goes on the map.',
  },
  {
    name: 'Thu Hà',
    role: 'Co-founder & Head of Guides',
    line: 'The neighbour. Hired every guide we have — and trained most.',
  },
  {
    name: 'Ngọc Lan',
    role: 'Head of Operations',
    line: 'Joined when the centre opened. Keeps 560 departures on time.',
  },
];

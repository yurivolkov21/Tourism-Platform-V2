import type { MockTeamMember } from './types.js';

// Đội sáng lập/vận hành cho About §5 (quyết định user 23/07: CHỈ founder,
// không hồ sơ guide).
//
// Đổi 17/08: 4 tên nay là NGƯỜI THẬT — thành viên nhóm capstone. Vì vậy phần
// `line` đã bỏ hết mối quan hệ gia đình của bản cũ ("The elder brother" / "The
// younger brother" / "The neighbour"): gán quan hệ anh em bịa cho người có
// tên thật là chuyện khác hẳn với gán cho nhân vật hư cấu. Chuyện gốc ở §2
// Story vẫn giữ nguyên câu "two brothers and a neighbour" — nó KHÔNG nêu tên
// ai nên vẫn đọc được như chuyện khởi nghiệp chung.
//
// Cũng bỏ luôn con số "560 departures" trong `line` cũ: đó là số cứng nằm
// trong copy, đúng loại lỗi đã ghi ở CHANGELOG 14/08 (lời hứa toàn cục về
// một con số thuộc dữ liệu thì sớm muộn cũng sai).
//
// Ứng viên schema khi gắn API: bảng team_members (name · role · line ·
// portrait · sort_order).
export const TEAM: MockTeamMember[] = [
  {
    name: 'Giang Tử Dương',
    role: 'Co-founder & CEO',
    slot: 'about-team-ceo',
    line: 'Sets the direction, and still answers the phone.',
  },
  {
    name: 'Huỳnh Đại Nghĩa',
    role: 'Co-founder & Head of Routes',
    slot: 'about-team-routes',
    line: 'Walks every path before it goes on the map.',
  },
  {
    name: 'Mạnh Duy An',
    role: 'Co-founder & Head of Guides',
    slot: 'about-team-guides',
    line: 'Hired every guide we have — and trained most.',
  },
  {
    name: 'Nguyễn Khánh Minh',
    role: 'Head of Operations',
    slot: 'about-team-ops',
    line: 'Keeps every departure running on time.',
  },
];

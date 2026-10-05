import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Thứ tự tag của một bài — MỘT bản cho mọi đường đọc, admin lẫn công khai. Theo
 * `post_tag_links.order` (thứ tự admin xếp, tag đầu làm chip danh mục ở web), rồi theo tên
 * cho các dòng có từ trước cột ấy (đều là 0). Thiếu nó thì "tag đầu" là thứ tự vật lý của
 * Postgres và chip đổi sau một lần lưu (vòng review P4e-4).
 */
export const POST_TAG_ORDER: Prisma.PostTagLinkOrderByWithRelationInput[] = [
  { order: 'asc' },
  { tag: { name: 'asc' } },
];

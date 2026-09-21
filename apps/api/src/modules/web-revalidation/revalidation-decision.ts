/**
 * Taxonomy cache-tag của web, nhìn từ phía API (ADR-0016 §3) — gương của
 * `apps/web/src/lib/api/tags.ts`. Đổi tên tag ở một bên thì phải đổi ở đây.
 *
 * ⚠️ Gương này là NỢ, không phải giới hạn kỹ thuật. Cả `apps/web` lẫn `apps/api`
 * đều khai `@tourism/contract` là phụ thuộc workspace, nên contract CHÍNH LÀ
 * đường build chung và taxonomy tag đặt được ở đó. Chưa dời vì nằm ngoài phạm
 * vi F11. Cái giá của việc để nguyên: ngày web đổi tên tag, API vẫn POST chuỗi
 * cũ, `/api/revalidate` trả 200 cho một tag không khớp gì,
 * `WebRevalidationService` chỉ cảnh báo khi khác 200 nên không ai thấy, và
 * trang tour công khai phục vụ nội dung cũ trọn 300 giây trong khi admin nhận
 * toast thành công. Không test nào bắt được vì hai bên không bao giờ gặp nhau
 * trong một tiến trình.
 *
 * MỘT bản cho cả API (F11, 21/09): `admin.tours.setPublished` bust đúng cặp
 * tag mà `ReviewsService.moderate` đã bust từ 03/08. Hai chuỗi `'tour:' + …`
 * ở hai file là hai thứ sẽ trôi lệch nhau.
 */
export function tourRevalidationTags(slug: string): string[] {
  return ['tours', `tour:${slug}`];
}

/**
 * Quyết định bust cache web sau moderate (spec 03/08 §3): chỉ khi review
 * GẮN tour và isApproved THỰC SỰ đổi — hai chiều (duyệt lần đầu, bỏ duyệt)
 * đều đổi bề mặt public (khu reviews + ratingAvg trên card/list/detail).
 * Hàm thuần, tách khỏi service để TDD (luật 4).
 */
export function moderationRevalidationTags(args: {
  tourSlug: string | null;
  fromApproved: boolean;
  toApproved: boolean;
}): string[] | null {
  if (!args.tourSlug) return null;
  if (args.fromApproved === args.toApproved) return null;
  return tourRevalidationTags(args.tourSlug);
}

/**
 * Taxonomy cache-tag của web, nhìn từ phía API (ADR-0016 §3) — gương của
 * `apps/web/src/lib/api/tags.ts`, không import được vì hai app không chung
 * đường build. Đổi tên tag ở một bên thì phải đổi ở đây.
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

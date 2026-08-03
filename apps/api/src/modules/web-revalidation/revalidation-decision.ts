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
  return ['tours', `tour:${args.tourSlug}`];
}

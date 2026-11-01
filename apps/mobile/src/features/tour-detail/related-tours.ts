/**
 * "You might also like" cuối tab Overview (rà web → mobile 01/11) — CÙNG luật với
 * `relatedTours()` của web (`apps/web/src/lib/tours.ts`): ưu tiên tour cùng danh mục, rồi tour
 * khác danh mục nhưng chung địa danh, cuối cùng lấp bằng tour còn lại theo thứ tự API. Bỏ chính
 * tour đang xem.
 */
export function relatedTours<
  T extends { slug: string; category: { slug: string }; destinations: readonly { slug: string }[] },
>(tours: readonly T[], slug: string, limit: number): T[] {
  const current = tours.find((tour) => tour.slug === slug);
  const others = tours.filter((tour) => tour.slug !== slug);
  if (current === undefined) return others.slice(0, limit);

  const destinationSlugs = new Set(current.destinations.map((d) => d.slug));
  const sameCategory = others.filter((tour) => tour.category.slug === current.category.slug);
  const sharesDestination = others.filter(
    (tour) =>
      tour.category.slug !== current.category.slug &&
      tour.destinations.some((d) => destinationSlugs.has(d.slug)),
  );
  const picked = new Set([...sameCategory, ...sharesDestination].map((t) => t.slug));
  const filler = others.filter((tour) => !picked.has(tour.slug));
  return [...sameCategory, ...sharesDestination, ...filler].slice(0, limit);
}

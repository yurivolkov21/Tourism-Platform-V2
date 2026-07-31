import Link from 'next/link';

// Chip lọc tag LUÔN là <Link> thật trỏ tới /blog?tag=<slug> — server-render
// nên crawl được và chạy cả khi JS chưa tải. Khi có `onSelect` (dùng trong
// BlogExplorer phía client) thì chặn hành vi điều hướng mặc định và lọc tức
// thì thay vào đó, khỏi tải lại trang; không có `onSelect` thì click đi qua
// bình thường như một link — progressive enhancement, không đánh đổi cái này
// lấy cái kia.
//
// Nguồn tag đổi từ `postCategories` (chuỗi tự suy ra từ mock) sang
// `fetchPostTags()` (Task 5) — hiển thị `name`, nhưng active/URL so khớp theo
// `slug` vì đó mới là định danh ổn định (hai tag có thể trùng tên hiển thị ở
// ngôn ngữ khác, không bao giờ trùng slug).
export function CategoryChips({
  tags,
  active,
  query,
  onSelect,
}: {
  tags: { slug: string; name: string }[];
  active?: string;
  query?: string;
  onSelect?: (tagSlug?: string) => void;
}) {
  const chipClassName = (isActive: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
    }`;

  const hrefFor = (tagSlug: string | undefined) => {
    const params = new URLSearchParams();
    if (tagSlug) params.set('tag', tagSlug);
    if (query) params.set('q', query);
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const chip = (label: string, tagSlug: string | undefined, isActive: boolean) => (
    <Link
      key={tagSlug ?? 'all'}
      href={hrefFor(tagSlug)}
      aria-current={isActive ? 'page' : undefined}
      onClick={
        onSelect
          ? (e) => {
              e.preventDefault();
              onSelect(tagSlug);
            }
          : undefined
      }
      className={chipClassName(isActive)}
    >
      {label}
    </Link>
  );

  return (
    // `nav`, không phải `div` trần: Biome (useAriaPropsSupportedByRole) từ
    // chối aria-label trên phần tử role generic — nav vừa hợp ARIA vừa đúng
    // ngữ nghĩa (đây là điều hướng lọc, giống on-this-page.tsx).
    <nav className="flex flex-wrap items-center gap-2" aria-label="Filter by topic">
      {chip('All', undefined, !active)}
      {tags.map((tag) => chip(tag.name, tag.slug, tag.slug === active))}
    </nav>
  );
}

import Link from 'next/link';

// Chip lọc chuyên mục LUÔN là <Link> thật trỏ tới /blog?tag=… — server-render
// nên crawl được và chạy cả khi JS chưa tải. Khi có `onSelect` (dùng trong
// BlogExplorer phía client) thì chặn hành vi điều hướng mặc định và lọc tức
// thì thay vào đó, khỏi tải lại trang; không có `onSelect` thì click đi qua
// bình thường như một link — progressive enhancement, không đánh đổi cái này
// lấy cái kia.
export function CategoryChips({
  categories,
  active,
  query,
  onSelect,
}: {
  categories: string[];
  active?: string;
  query?: string;
  onSelect?: (category?: string) => void;
}) {
  const chipClassName = (isActive: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
    }`;

  const hrefFor = (category: string | undefined) => {
    const params = new URLSearchParams();
    if (category) params.set('tag', category);
    if (query) params.set('q', query);
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const chip = (label: string, category: string | undefined, isActive: boolean) => (
    <Link
      key={label}
      href={hrefFor(category)}
      aria-current={isActive ? 'page' : undefined}
      onClick={
        onSelect
          ? (e) => {
              e.preventDefault();
              onSelect(category);
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
      {categories.map((category) => chip(category, category, category === active))}
    </nav>
  );
}

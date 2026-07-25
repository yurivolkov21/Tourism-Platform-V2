import Link from 'next/link';

// Chip lọc chuyên mục dựa hoàn toàn vào URL (?tag=) — server-render nên
// crawl được và chạy cả khi JS chưa tải, khác hẳn lọc bằng state client.
// Khi có `onSelect` (dùng trong BlogExplorer phía client) thì đổi sang
// <button> để lọc tức thì, khỏi tải lại trang; không có thì giữ <Link> cũ
// nên component vẫn server-component-an-toàn ở mọi nơi khác đang dùng nó.
export function CategoryChips({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active?: string;
  onSelect?: (category?: string) => void;
}) {
  const chipClassName = (isActive: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
    }`;

  const chip = (label: string, href: string, category: string | undefined, isActive: boolean) =>
    onSelect ? (
      <button
        key={label}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelect(category)}
        className={chipClassName(isActive)}
      >
        {label}
      </button>
    ) : (
      <Link
        key={label}
        href={href}
        aria-current={isActive ? 'page' : undefined}
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
      {chip('All', '/blog', undefined, !active)}
      {categories.map((category) =>
        chip(category, `/blog?tag=${encodeURIComponent(category)}`, category, category === active),
      )}
    </nav>
  );
}

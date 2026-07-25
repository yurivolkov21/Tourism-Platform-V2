import Link from 'next/link';

// Chip lọc chuyên mục dựa hoàn toàn vào URL (?tag=) — server-render nên
// crawl được và chạy cả khi JS chưa tải, khác hẳn lọc bằng state client.
export function CategoryChips({ categories, active }: { categories: string[]; active?: string }) {
  const chip = (label: string, href: string, isActive: boolean) => (
    <Link
      key={label}
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );

  return (
    // `nav`, không phải `div` trần: Biome (useAriaPropsSupportedByRole) từ
    // chối aria-label trên phần tử role generic — nav vừa hợp ARIA vừa đúng
    // ngữ nghĩa (đây là điều hướng lọc, giống on-this-page.tsx).
    <nav className="flex flex-wrap items-center gap-2" aria-label="Filter by topic">
      {chip('All', '/blog', !active)}
      {categories.map((category) =>
        chip(category, `/blog?tag=${encodeURIComponent(category)}`, category === active),
      )}
    </nav>
  );
}

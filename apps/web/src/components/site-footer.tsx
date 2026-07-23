import { Logo } from './logo';

// Convert bố cục footer Estate: brand trái (logo + mô tả), cột link phải,
// bar cuối. Tối ở CẢ hai theme qua class `dark` (tokens-only, không hex).
const LINK_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Explore',
    links: [
      ['Tours', '#tours'],
      ['Gallery', '#gallery'],
      ['Reviews', '#top'],
      ['Contact', '#contact'],
    ],
  },
  {
    title: 'Social',
    links: [
      ['Instagram', '#top'],
      ['LinkedIn', '#top'],
      ['Twitter', '#top'],
      ['Facebook', '#top'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '#top'],
      ['Journal', '#top'],
      ['Terms', '#top'],
      ['Privacy', '#top'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="dark mt-32 w-full overflow-hidden bg-background px-4 pt-16 pb-8 text-foreground md:px-16 lg:px-24 xl:px-32">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 pb-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            <a href="/" aria-label="tourism — home" className="select-none">
              <Logo />
            </a>
            <p className="max-w-md text-sm/5.5 text-muted-foreground">
              Small-group tours across Vietnam, led by people who grew up there. Limestone bays,
              misty terraces, lantern towns — at your pace.
            </p>
          </div>

          <div className="flex flex-wrap justify-between gap-8 lg:col-span-5">
            {LINK_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-5">
                <span className="text-foreground">{group.title}</span>
                <div className="flex flex-col gap-3 text-xs text-muted-foreground">
                  {group.links.map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      className="transition-colors duration-200 hover:text-foreground"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© 2026 tourism. All rights reserved.</p>
          <p>Photos: Wikimedia Commons contributors &amp; Unsplash (see credits).</p>
        </div>

        {/* Watermark chữ khổng lồ — z ÂM để nét outline nằm DƯỚI chữ nội dung
            (sửa luôn lỗi bản gốc Estate vẽ watermark đè lên link — review #8, phương án B) */}
        <span
          aria-hidden="true"
          className="footer-watermark pointer-events-none absolute -right-4 bottom-9 -z-10 font-heading text-[clamp(7rem,19vw,15rem)] leading-none font-semibold select-none"
        >
          tourism
        </span>
      </div>
    </footer>
  );
}

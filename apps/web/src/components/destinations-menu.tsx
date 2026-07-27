'use client';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@tourism/ui/components/navigation-menu';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';

// Dropdown "Destinations" trên navbar (convert bố cục NavigationMenu của Nexora).
//
// Liệt kê ĐỊA DANH chứ không phải vùng: `ToursListQuerySchema` chỉ nhận
// `destination` (slug), không có tham số `region`. Trỏ một mục "North" sang
// /tours mà không lọc được gì thì vẫn là link nói dối. Vùng vẫn hiện dưới dạng
// tiêu đề nhóm + chấm tint `--region-primary` (data-region ở cấp nhóm — hợp lệ
// ADR-0013 #4, điểm v2 làm được mà Nexora không có).
//
// Trang /destinations riêng là cụm sau; cho tới lúc đó mọi link ở đây đều tới
// một trang CÓ THẬT và lọc ra kết quả thật.
const REGION_HINTS: Record<string, string> = {
  north: 'Misty terraces & limestone bays',
  central: 'Imperial cities & lantern towns',
  south: 'River markets & island dusk',
};

export function DestinationsMenu({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className={triggerClassName}>Destinations</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[34rem] grid-cols-3 gap-x-4 gap-y-1 p-1">
              {REGIONS.map((region) => (
                <div key={region.key} data-region={region.key}>
                  <p className="flex items-center gap-2 px-2 pt-2 pb-1">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: 'var(--region-primary)' }}
                    />
                    <span className="font-medium text-sm">{region.name}</span>
                  </p>
                  <p className="px-2 pb-2 text-xs text-muted-foreground">
                    {REGION_HINTS[region.key]}
                  </p>
                  <ul>
                    {DESTINATIONS.filter((dest) => dest.region === region.key).map((dest) => (
                      <li key={dest.slug}>
                        <NavigationMenuLink render={<a href={`/tours?destination=${dest.slug}`} />}>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm">{dest.name}</span>
                            <span className="text-xs text-muted-foreground">{dest.blurb}</span>
                          </span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

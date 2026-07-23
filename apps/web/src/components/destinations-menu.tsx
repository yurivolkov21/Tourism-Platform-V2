'use client';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@tourism/ui/components/navigation-menu';
import { REGIONS } from '@/mocks/regions';

// Dropdown "Destinations" trên navbar (convert bố cục NavigationMenu của
// Nexora, review navbar): mỗi vùng một item label + hint, kèm chấm màu tint
// vùng qua slot --region-primary (data-region ở page-level — hợp lệ ADR-0013
// #4; điểm v2 làm được mà Nexora không có). Link tạm trỏ #gallery cho tới khi
// có trang vùng riêng.
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
            <ul className="grid w-72 gap-1">
              {REGIONS.map((region) => (
                <li key={region.key} data-region={region.key}>
                  <NavigationMenuLink render={<a href="/#gallery" />}>
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: 'var(--region-primary)' }}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{region.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {REGION_HINTS[region.key]}
                      </span>
                    </span>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

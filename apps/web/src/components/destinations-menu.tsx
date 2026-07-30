'use client';

import { messages } from '@tourism/i18n';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@tourism/ui/components/navigation-menu';
import { REGIONS } from '@/mocks/regions';

/**
 * Dropdown "Destinations" trên navbar — **ĐÚNG BỐN mục**: All, và ba vùng
 * (user chốt 30/07, theo đúng kiểu Nexora).
 *
 * ⚠️ Bản trước liệt kê **9 địa danh** xếp thành 3 cột (menu rộng 42rem), và điều
 * đó từng được ghi trong plan là "điểm v2 hơn Nexora rõ nhất" — Nexora chỉ có 4
 * dòng phẳng nên muốn tới Hội An phải vào trang vùng tìm tiếp. User bác chiều
 * ngược lại: menu điều hướng không phải chỗ trải mục lục. Đừng "khôi phục" 9 link
 * đó như một cải tiến bị mất.
 *
 * Vì sao 4 link này TRUNG THỰC, trong khi comment cũ của file nói ngược:
 * bản cũ cảnh báo *"trỏ một mục 'North' sang /tours mà không lọc được gì thì vẫn
 * là link nói dối"* — đúng ở thời điểm đó, vì `/destinations/[region]` CHƯA tồn
 * tại nên "North" chẳng có đích nào ngoài `/tours` không lọc. Nay ba trang vùng
 * đã có thật, nên mỗi mục trỏ vào đúng trang của vùng mình.
 *
 * Bố cục MỘT cột 4 dòng, không phải 3 cột: bốn mục không cần 42rem, và một vạch
 * mảnh tách "All destinations" khỏi ba vùng vì hai thứ đó khác cấp — một là trang
 * chỉ mục, ba là con của nó.
 *
 * `data-region` trên từng dòng vùng GIỮ LẠI làm móc cấu trúc cho spec: nó khoanh
 * đúng một dòng để test khẳng định link trỏ đúng slug vùng ấy. Nó không còn gán
 * biến CSS nào (lớp tint đã rút — ADR-0015), nên đừng dọn nó đi như tàn dư.
 */
export function DestinationsMenu({ triggerClassName }: { triggerClassName?: string }) {
  const t = messages.nav.destinationsMenu;

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className={triggerClassName}>{t.label}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="w-72 p-1">
              <li>
                <NavigationMenuLink render={<a href="/destinations" />}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t.all}</span>
                    <span className="text-xs text-muted-foreground">{t.allHint}</span>
                  </span>
                </NavigationMenuLink>
              </li>

              {/* Vạch tách cấp: "All destinations" là trang chỉ mục, ba dòng dưới
                  là con của nó. `aria-hidden` vì nó là dấu hiệu thị giác — cấu
                  trúc thật đã nằm ở chính đường dẫn (`/destinations` so với
                  `/destinations/<slug>`). */}
              <li aria-hidden="true" className="mx-2 my-1 h-px bg-border" />

              {REGIONS.map((region) => (
                <li key={region.key} data-region={region.key}>
                  <NavigationMenuLink render={<a href={`/destinations/${region.slug}`} />}>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{region.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.regionHints[region.key]}
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

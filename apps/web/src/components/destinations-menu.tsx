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
/**
 * Khoảng cách từ trigger xuống panel, tính bằng px.
 *
 * **26 + 8**, không phải 8 mặc định của Positioner. Base UI đo `sideOffset` từ chính
 * trigger, nhưng trigger nằm GIỮA dải navbar: nó cao 20px và căn giữa một hàng cao
 * 40px trong `p-4`, nên dải navbar còn thừa đúng **26px** bên dưới nó. Với offset 8
 * thì `popup.top − navbar.bottom = −18px` — panel chui vào navbar, đo được ở CẢ hai
 * trạng thái cuộn (user báo 30/07). Cộng 26 rồi thêm khe 8 thì panel treo đúng 8px
 * dưới dải navbar.
 *
 * MỘT con số cho cả hai trạng thái, không phải `scrolled ? 34 : 16` (user chốt
 * phương án (a) ngày 30/07): navbar là dải tương tác cao 72px ở cả hai trạng thái —
 * lúc chưa cuộn nó chỉ trong suốt, không phải nhỏ đi — nên "panel bắt đầu dưới dải
 * đó" là mô hình đúng, còn khe nhảy khi cuộn thì đọc ra bug.
 *
 * ⚠️ Buộc vào `p-4` của `site-header.tsx` và chiều cao nút "Book a tour". Đổi hai thứ
 * đó thì đo lại: `popup.top − navbar.bottom` phải ra **+8**, không phải số âm.
 * `destinations-menu.spec.tsx` khoá con số nhưng jsdom KHÔNG dựng layout nên nó chỉ
 * canh được phép cộng, không canh được hình học — chốt hình học là phép đo trình duyệt.
 */
export const NAV_DROPDOWN_SIDE_OFFSET = 34;

export function DestinationsMenu({ triggerClassName }: { triggerClassName?: string }) {
  const t = messages.nav.destinationsMenu;

  return (
    <NavigationMenu sideOffset={NAV_DROPDOWN_SIDE_OFFSET}>
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

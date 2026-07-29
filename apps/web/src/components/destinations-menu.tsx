'use client';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@tourism/ui/components/navigation-menu';
import { regionOf } from '@/lib/regions';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';

// Dropdown "Destinations" trên navbar (convert bố cục NavigationMenu của Nexora).
//
// Liệt kê ĐỊA DANH chứ không phải vùng: lọc được theo slug địa danh, không có
// tham số `region` ở đâu cả. Trỏ một mục "North" sang /tours mà không lọc được
// gì thì vẫn là link nói dối. Vùng vẫn hiện dưới dạng tiêu đề nhóm + một chấm
// `bg-primary`. Chấm dùng token BRAND, không còn tint theo vùng (ADR-0015 đảo
// ADR-0013 #4) — ba chấm từ nay giống hệt nhau, chúng là bullet chứ không phải
// tín hiệu phân biệt. `data-region` ở cấp nhóm GIỮ LẠI làm móc CẤU TRÚC:
// `destinations-menu.spec.tsx:37` khoanh vùng theo nó để đếm link, và ba test
// đó canh một bug THẬT (khoá vùng vs tên hiển thị). Đừng dọn nó đi như tàn dư.
//
// Tham số là `destinations` (SỐ NHIỀU) — đó là từ vựng URL của /tours, nơi mỗi
// facet là danh sách ngăn bằng dấu phẩy vì bộ lọc cho chọn nhiều. Đừng viết
// `?destination=` theo tên field của `ToursListQuerySchema`: contract nhận đúng
// MỘT slug, còn trang đọc số nhiều, nên số ít rơi vào hư không — trang mở ra
// KHÔNG lọc gì và không có dấu hiệu nào. Chín link ở đây đã chết đúng kiểu đó
// cho tới 27/07. Khi gắn API, chỗ ánh xạ số nhiều → contract là nơi phải xử lý
// (cùng họ với lỗ contract #4 ở spec §8: facet nhiều lựa chọn chưa có đường
// biểu diễn trong query schema).
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
            <div className="grid w-[42rem] grid-cols-3 gap-x-4 gap-y-1 p-1">
              {REGIONS.map((region) => (
                <div key={region.key} data-region={region.key}>
                  <p className="flex items-center gap-2 px-2 pt-2 pb-1">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full bg-primary"
                    />
                    <span className="font-medium text-sm">{region.name}</span>
                  </p>
                  {/* Cố định 2 dòng: "River markets & island dusk" chỉ dài 1
                      dòng trong khi hai vùng kia 2 dòng, làm cột Nam thụt lên
                      và ba cột lệch nhau. Cùng thủ thuật min-h-[Nlh] như hợp
                      đồng số dòng của card tour.
                      KHÔNG đặt padding-bottom ở đây: box-sizing là border-box
                      nên đệm bị TRỪ vào min-height, và ô 1 dòng vẫn thấp hơn ô
                      2 dòng đúng bằng phần đệm. Khoảng cách chuyển xuống <ul>. */}
                  <p className="min-h-[2lh] px-2 text-xs text-muted-foreground">
                    {REGION_HINTS[region.key]}
                  </p>
                  {/* `dest.region` giờ là chuỗi tự do kiểu contract ('Northern
                      Vietnam'), KHÔNG còn khớp trực tiếp `region.key` ('north') —
                      phải chuẩn hoá qua regionOf() trước khi so sánh, nếu không
                      mọi nhóm vùng rỗng trơn. */}
                  <ul className="mt-2">
                    {DESTINATIONS.filter((dest) => regionOf(REGIONS, dest) === region.key).map(
                      (dest) => (
                        <li key={dest.slug}>
                          <NavigationMenuLink
                            render={<a href={`/tours?destinations=${dest.slug}`} />}
                          >
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm">{dest.name}</span>
                              {/* MỘT dòng cứng: "Coast rides & Golden Bridge"
                                  từng xuống 2 dòng làm mọi mục phía dưới trong
                                  cột đó tụt xuống, ba cột lệch nhau. Menu nới
                                  rộng 34→42rem để description dài nhất vẫn đủ
                                  chỗ; line-clamp là chốt chặn cho dữ liệu tương lai. */}
                              <span className="line-clamp-1 text-xs text-muted-foreground">
                                {dest.description}
                              </span>
                            </span>
                          </NavigationMenuLink>
                        </li>
                      ),
                    )}
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

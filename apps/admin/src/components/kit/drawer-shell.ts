/**
 * Vỏ panel chi tiết bên phải của admin (user chốt 03/09, lý do đầy đủ ở `json-drawer.tsx`), tách
 * khỏi `JsonDrawer` khi ngăn ảnh của `/media` thành nơi dùng thứ hai.
 *
 * Cấu hình vỏ theo drawer-02. `Popup` (lớp ngoài) thành trong suốt, không
 * viền; hình hài panel đắp lên lớp TRONG (`data-slot=drawer-content`). Phải
 * chia hai lớp như vậy vì lớp ngoài còn phải trải hết chiều cao cho phép tính
 * vuốt/xếp chồng của primitive chạy đúng — co nó lại rồi bo góc là gãy chỗ đó.
 */
export const DRAWER_SHELL = [
  'm-0 border-0! bg-transparent! shadow-none! [--drawer-bleed-background:transparent] [--drawer-inset:0px]',
  // 39.125rem = 626px, thay 24rem mặc định của primitive.
  'data-[swipe-axis=x]:[--drawer-content-width:100%] data-[swipe-axis=x]:sm:[--drawer-content-width:39.125rem]',
  '**:data-[slot=drawer-content]:m-4 **:data-[slot=drawer-content]:w-full **:data-[slot=drawer-content]:rounded-2xl **:data-[slot=drawer-content]:border **:data-[slot=drawer-content]:bg-popover **:data-[slot=drawer-content]:text-popover-foreground **:data-[slot=drawer-content]:shadow-2xl',
].join(' ');

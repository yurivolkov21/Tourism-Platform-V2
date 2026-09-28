import { cookies } from 'next/headers';

/**
 * Tên cookie mà `SidebarProvider` của `@tourism/ui` ghi mỗi lần sidebar đổi trạng
 * thái (`sidebar_state=true|false`). Hằng bên gói ui không export, nên tên chép ở
 * đây — đổi một bên thì phải đổi bên kia.
 */
export const SIDEBAR_STATE_COOKIE = 'sidebar_state';

/** Chỉ `"false"` là thu gọn; vắng cookie hay giá trị lạ đều là mở (mặc định của shell). */
export function sidebarOpenFromCookie(value: string | undefined): boolean {
  return value !== 'false';
}

/**
 * Trạng thái sidebar lúc dựng trang ở server (góp ý giao diện 28/09). Mỗi trang vùng
 * tự dựng shell của nó (`AdminShell`, trang `/`), nên thiếu bước này thì thu gọn
 * sidebar rồi chuyển trang là nó lại bung ra — cột icon mất tác dụng.
 */
export async function readSidebarOpen(): Promise<boolean> {
  return sidebarOpenFromCookie((await cookies()).get(SIDEBAR_STATE_COOKIE)?.value);
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { USER_MENU_SIDE_OFFSET, UserMenu } from './user-menu';

/**
 * Spec đầu tiên cho `UserMenu`, thêm 30/07 cùng đợt vá lớp lỗi "dropdown bị navbar
 * đè". Trước đó khu này không có test nào.
 *
 * ⚠️ Hai nhánh của component do `MOCK_SESSION` quyết định, và mock đó là **hằng ở
 * module scope** (`apps/web/src/mocks/auth.ts`) nên không truyền vào được. Hôm nay nó
 * là `null` → component render link "Log in", KHÔNG render dropdown. Vì vậy các test
 * dưới đây chỉ canh được nhánh chưa-đăng-nhập cộng hằng số offset; nhánh dropdown sẽ
 * test được khi phase auth thay mock bằng session thật (lúc đó nhớ thêm test cho nó).
 * Đây là giới hạn nói thẳng, không phải thiếu sót bị bỏ qua.
 */
describe('UserMenu', () => {
  it('chưa đăng nhập thì render LINK "Log in", không phải dropdown', () => {
    render(<UserMenu />);
    const link = screen.getByRole('link', { name: /log in/i });
    expect(link).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('không mở popup nào ở nhánh chưa đăng nhập', async () => {
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole('link', { name: /log in/i }));
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull();
  });

  /**
   * Đo 30/07 (Chromium, MOCK_SESSION tạm bật SAMPLE_USER, cả hai trạng thái cuộn):
   * avatar cao 32px căn giữa hàng cao 40px trong `p-4`, nên dải navbar còn thừa đúng
   * **20px** bên dưới nó. Với `sideOffset` mặc định 4 thì `popup.top − nav.bottom =
   * −16px` — dropdown chui vào navbar, và hit-test giữa vùng chồng cho ra `<nav>`.
   *
   * 20 + 8 = 28. Khác con số 34 của menu Destinations vì trigger ở đó là CHỮ cao 20px,
   * không phải avatar 32px — cùng dải navbar nhưng đệm còn lại khác nhau. Đừng gộp hai
   * hằng số lại làm một.
   */
  it('sideOffset = đệm dải navbar dưới AVATAR cộng khe, không phải mặc định 4', () => {
    expect(USER_MENU_SIDE_OFFSET).toBe(20 + 8);
    // Phải lớn hơn 20, nếu không dropdown vẫn nằm trong dải navbar.
    expect(USER_MENU_SIDE_OFFSET).toBeGreaterThan(20);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailTypeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type OutboxQuery, outboxHref } from '@/lib/outbox-query';
import { OutboxTypeMenu } from './outbox-type-menu';

/**
 * Bộ lọc loại email của `/outbox`, dựng theo khuôn `dropdown-menu-10` của
 * Shadcn Studio (user chốt 03/09) sau khi bản `ToolbarSelect` 14 mục phẳng bị
 * loại: menu rộng `w-66`, separator chia năm họ email, mỗi mục một icon.
 *
 * Spec canh vào ba chỗ ghép — đúng những chỗ bản registry KHÔNG lo hộ:
 *
 * 1. Bản registry là menu THƯỜNG (`DropdownMenuItem`), không có trạng thái
 *    chọn. Đây là bộ LỌC nên phải là `RadioGroup`, và dấu tích phải nói đúng
 *    filter đang nằm trên URL.
 * 2. `MenuRadioItem` của Base UI mặc định `closeOnClick = false` — hợp cho
 *    menu chọn nhiều lần, SAI ở đây: chọn xong là điều hướng, menu treo lại
 *    trên trang mới. Phải bật tường minh, nên phải có test canh.
 * 3. Nhóm theo họ là chỗ dễ nuốt mất mục nhất — khoá đủ 13 loại.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const t = messages.admin.outbox;
const QUERY: OutboxQuery = { page: 3, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

/** Mở menu qua nhãn đọc-màn-hình — nó chứa cả mục đích lẫn giá trị đang lọc. */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(t.list.typeLabel) }));
  await screen.findByRole('menuitemradio', { name: new RegExp(t.list.typeAll) });
}

describe('OutboxTypeMenu', () => {
  it('nút đọc ra loại ĐANG lọc, không phải một chữ "Type" chung chung', () => {
    render(<OutboxTypeMenu query={{ ...QUERY, type: 'PASSWORD_RESET' }} />);

    const trigger = screen.getByRole('button', { name: new RegExp(t.list.typeLabel) });
    // Nhãn nhìn thấy nằm TRONG nhãn đọc-màn-hình (WCAG 2.5.3): người dùng
    // bàn phím nghe được cả "lọc theo cái gì" lẫn "đang lọc cái nào".
    expect(trigger).toHaveTextContent(t.type.PASSWORD_RESET);
    expect(trigger).toHaveAccessibleName(`${t.list.typeLabel}: ${t.type.PASSWORD_RESET}`);
  });

  it('chưa lọc thì nút đứng ở "All types"', () => {
    render(<OutboxTypeMenu query={QUERY} />);

    expect(screen.getByRole('button', { name: new RegExp(t.list.typeLabel) })).toHaveTextContent(
      t.list.typeAll,
    );
  });

  it('mở ra có ĐỦ 13 loại email — chia nhóm không được nuốt mục nào', async () => {
    const user = userEvent.setup();
    render(<OutboxTypeMenu query={QUERY} />);
    await openMenu(user);

    for (const type of EmailTypeSchema.options) {
      expect(screen.getByRole('menuitemradio', { name: t.type[type] })).toBeInTheDocument();
    }
    // 13 loại + mục "All types".
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(EmailTypeSchema.options.length + 1);
  });

  it('chọn một loại thì đẩy loại đó lên URL (và về trang 1)', async () => {
    const user = userEvent.setup();
    render(<OutboxTypeMenu query={QUERY} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: t.type.BOOKING_REFUNDED }));

    // So với chính `outboxHref` chứ không gõ tay chuỗi query: luật đặt lại
    // trang về 1 là của kit, spec này không chép lại nó lần thứ hai.
    expect(push).toHaveBeenCalledWith(outboxHref(QUERY, { type: 'BOOKING_REFUNDED' }));
  });

  it('chọn "All types" thì XOÁ filter khỏi URL, không đẩy chữ ALL lên', async () => {
    const user = userEvent.setup();
    render(<OutboxTypeMenu query={{ ...QUERY, type: 'EMAIL_OTP' }} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: t.list.typeAll }));

    const href = outboxHref({ ...QUERY, type: 'EMAIL_OTP' }, { type: null });
    expect(push).toHaveBeenCalledWith(href);
    expect(href).not.toContain('type=');
  });
});

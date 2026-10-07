import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Đọc source như `dropdown-menu.spec.ts` — env `node` không dựng bố cục. Ở cột icon, nhãn nhóm
 * chỉ mờ đi (`opacity-0`) và trượt lên `-mt-8`, đè nửa dưới mục cuối của nhóm trên mà vẫn nhận
 * chuột: bấm vào đó không có gì xảy ra (đo Task 19 ở nút Quick Create). Tắt chuột phải nằm NGAY
 * ở primitive, cùng điều kiện với `opacity-0` — vá ở nơi gọi thì nhóm nav mới nào quên chép class
 * là vùng chết quay lại (review AL7).
 */
function code(): string {
  return readFileSync(fileURLToPath(new URL('./sidebar.tsx', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('SidebarGroupLabel — cột icon', () => {
  it('nhãn vô hình không nhận chuột, cùng điều kiện với `opacity-0`', () => {
    const label = code().match(/function SidebarGroupLabel[\s\S]*?\n}\n/)?.[0] ?? '';
    expect(label).toContain('group-data-[collapsible=icon]:opacity-0');
    expect(label).toContain('group-data-[collapsible=icon]:pointer-events-none');
  });
});

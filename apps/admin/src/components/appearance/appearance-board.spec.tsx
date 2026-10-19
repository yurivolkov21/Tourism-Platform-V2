import { render, screen, within } from '@testing-library/react';
import { SITE_SLOT_KEYS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toAppearanceBoard } from '@/lib/appearance-view';
import type { AppearanceActions, SetSlotAction, SignSlotAction } from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { allSiteSlots } from '@/test/appearance';
import { AppearanceBoard } from './appearance-board';

/**
 * Bảng `/appearance` (spec P4f Appearance §6.1): tám nhóm có tiêu đề và link mở trang trên site;
 * mỗi khe một mục mang `id` là khoá khe — Media library link thẳng `/appearance#<khoá>`.
 */
const t = messages.admin.appearance;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function renderBoard() {
  const actions: AppearanceActions = {
    setSlot: vi.fn<SetSlotAction>(),
    signUpload: vi.fn<SignSlotAction>(),
  };
  const groups = toAppearanceBoard(allSiteSlots());
  const view = render(
    <AppearanceBoard
      groups={groups}
      actions={actions}
      loadLibrary={vi.fn<LoadPhotoLibraryAction>()}
    />,
  );
  return { ...view, groups };
}

describe('AppearanceBoard', () => {
  it('mỗi nhóm: tiêu đề cấp 2, số khe, link "View on site" mở tab mới', () => {
    const { groups } = renderBoard();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(groups.length);
    for (const group of groups) {
      const section = screen.getByRole('region', { name: group.label });
      expect(within(section).getByText(group.countLabel)).toBeInTheDocument();
      const link = within(section).getByRole('link', { name: t.viewPageLabel(group.label) });
      expect(link).toHaveAttribute('href', group.pageHref);
      expect(link).toHaveAttribute('target', '_blank');
      expect(within(section).getAllByRole('listitem')).toHaveLength(group.slots.length);
    }
  });

  it('đủ 47 khe, mỗi khe một neo đúng khoá của nó', () => {
    const { container } = renderBoard();
    const anchors = [...container.querySelectorAll('li[id]')].map((item) => item.id);
    expect(anchors).toHaveLength(SITE_SLOT_KEYS.length);
    expect(new Set(anchors)).toEqual(new Set(SITE_SLOT_KEYS));
  });
});

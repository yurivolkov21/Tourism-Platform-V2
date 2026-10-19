'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { ChevronDownIcon, ImagePlusIcon } from 'lucide-react';
import Link from 'next/link';
import { MENU_CHEVRON, MENU_HINT, MENU_TOOLBAR_POPUP } from '@/components/kit/menu-style';

/**
 * Nút Add photos to the library của `/media` (spec P4f Media §7.3, ADR-0060 §8): ảnh mới vào thư
 * viện qua trang Photos của MỘT điểm đến, nên nút là menu chọn điểm đến — mỗi mục là link thật tới
 * `/destinations/<slug>/photos`. Điểm đến đã ẩn vẫn chọn được, kèm nhãn phụ mờ.
 */
const t = messages.admin.media.addPhotos;

export interface AddPhotosDestination {
  name: string;
  slug: string;
  isActive: boolean;
}

export function AddPhotosMenu({ destinations }: { destinations: readonly AddPhotosDestination[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
        {t.action}
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" className={MENU_CHEVRON} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_TOOLBAR_POPUP}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.menuLabel}</DropdownMenuLabel>
          {destinations.length === 0 ? (
            <DropdownMenuItem disabled>{t.none}</DropdownMenuItem>
          ) : (
            destinations.map((destination) => (
              <DropdownMenuItem
                key={destination.slug}
                render={<Link href={`/destinations/${destination.slug}/photos`} />}
              >
                <span className="truncate">{destination.name}</span>
                {/* Dấu cách giữa hai span: tên đọc-màn-hình thành "Sa Pa Hidden", không dính chữ.
                    Mục là flex nên khoảng trắng ấy không chiếm chỗ trên màn. */}
                {destination.isActive ? null : (
                  <>
                    {' '}
                    <span className={MENU_HINT}>{t.hidden}</span>
                  </>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

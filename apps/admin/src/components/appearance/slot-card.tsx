'use client';

import type { AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import { Card, CardContent } from '@tourism/ui/components/card';
import { ImageUpIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FramedImage } from '@/components/appearance/framed-image';
import { ReplaceSlotDialog } from '@/components/appearance/replace-slot-dialog';
import { RestoreOriginalAction } from '@/components/appearance/restore-original-action';
import { SLOT_SOURCE_VARIANT, type SlotVM } from '@/lib/appearance-view';
import type { AppearanceActions } from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';

/**
 * Thẻ một khe (spec P4f Appearance §6.1): ảnh đang dùng trong khung desktop đúng tỉ lệ, nhãn khe,
 * chip nguồn, cỡ ảnh, câu chú thích web đặt cạnh ảnh, dòng app mobile; nút Replace và Restore
 * original. Khe video chỉ có ảnh xem. Sau mỗi lệnh đã chạm server thì `router.refresh()` kéo về
 * phiên bản mới — thẻ không tự giữ ảnh.
 */
const t = messages.admin.appearance;

export function SlotCard({
  slot,
  actions,
  library,
  onLibraryChange,
  loadLibrary,
}: {
  slot: SlotVM;
  actions: AppearanceActions;
  library: AdminPhotoLibrary | null;
  onLibraryChange: (library: AdminPhotoLibrary | null) => void;
  loadLibrary: LoadPhotoLibraryAction;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [replaceOpen, setReplaceOpen] = useState(false);
  const settled = () => startRefresh(() => router.refresh());
  const { image, imageKey } = slot;

  return (
    <Card size="sm" className="h-full">
      {/* `grid-cols-1` = `minmax(0, 1fr)`: cột co theo thẻ, nên khung ảnh rộng không đẩy thẻ tràn ở
          lưới hai cột hẹp (768 với sidebar mở). */}
      <CardContent className="grid grid-cols-1 content-start gap-3">
        <div className="grid h-40 grid-cols-1 place-items-center rounded-md bg-muted/50">
          <FramedImage
            src={image?.previewUrl ?? null}
            size={slot.cardFrame}
            placeholder={t.emptyFrame}
          />
        </div>

        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{slot.label}</h3>
            {image !== null ? (
              <Badge variant={SLOT_SOURCE_VARIANT[image.source]}>{image.sourceLabel}</Badge>
            ) : null}
          </div>
          {image?.sizeLabel ? (
            <p className="text-xs text-muted-foreground tabular-nums">{image.sizeLabel}</p>
          ) : null}
          {image === null ? <p className="text-xs text-muted-foreground">{t.empty}</p> : null}
        </div>

        {slot.caption !== null ? (
          <p className="text-sm text-muted-foreground">{t.caption(slot.caption)}</p>
        ) : null}
        {slot.inMobileApp ? <p className="text-xs text-muted-foreground">{t.mobileApp}</p> : null}

        {imageKey === null ? (
          <p className="text-xs text-muted-foreground">{t.video}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t.replaceLabel(slot.name)}
              disabled={isRefreshing}
              focusableWhenDisabled
              onClick={() => setReplaceOpen(true)}
            >
              <ImageUpIcon data-icon="inline-start" aria-hidden="true" />
              {t.replace}
            </Button>
            <RestoreOriginalAction
              slot={slot}
              imageKey={imageKey}
              setSlot={actions.setSlot}
              disabled={isRefreshing}
              onSettled={settled}
            />
          </div>
        )}
      </CardContent>

      {replaceOpen && imageKey !== null ? (
        <ReplaceSlotDialog
          slot={slot}
          imageKey={imageKey}
          setSlot={actions.setSlot}
          signUpload={actions.signUpload}
          library={library}
          onLibraryChange={onLibraryChange}
          loadLibrary={loadLibrary}
          onClose={() => setReplaceOpen(false)}
          onSettled={settled}
        />
      ) : null}
    </Card>
  );
}

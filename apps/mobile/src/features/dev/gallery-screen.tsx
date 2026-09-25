import { AppText, Card, IconButton, Screen, useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { GalleryEntry } from './gallery-entries';

export interface GalleryScreenProps {
  title: string;
  entries: readonly GalleryEntry[];
}

/**
 * Bảng tra một cụm khung, CHỈ có trên bản dev — component DÙNG CHUNG cho mọi
 * cụm (auth ở `app/dev/gallery.tsx`, xem tour ở `app/dev/tour-gallery.tsx`…);
 * `title`/`entries` do route truyền, bản thân màn không biết đang tra cụm nào.
 *
 * Lý do tồn tại: nhiều trạng thái chỉ hiện ra sau một chuỗi thao tác đúng (mã
 * sai, link hết hạn, vừa gửi lại mã, đợt đã qua hạn đặt…). Duyệt thiết kế mà
 * phải diễn lại từng chuỗi thì sẽ có trạng thái không ai kịp nhìn.
 */
export function GalleryScreen({ title, entries }: GalleryScreenProps) {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((entry) => entry.id === openId);

  if (open !== undefined) {
    return (
      <View style={{ flex: 1 }}>
        {open.render()}

        {/* Nút thoát nổi trên màn đang xem: khung được dựng bằng props cứng nên
            chính nút của nó không đi đâu cả. */}
        <View style={{ position: 'absolute', right: theme.spacing(4), bottom: theme.spacing(6) }}>
          <IconButton
            icon="x"
            accessibilityLabel="Đóng khung đang xem"
            variant="glass"
            onPress={() => setOpenId(null)}
          />
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <AppText variant="title">{title}</AppText>
      <AppText tone="muted" style={{ marginTop: theme.spacing(1) }}>
        {entries.length} khung, dựng bằng dữ liệu cứng. Chỉ có ở bản dev.
      </AppText>

      <View style={{ marginTop: theme.spacing(4), gap: theme.spacing(2) }}>
        {entries.map((entry) => (
          <Pressable key={entry.id} testID="gallery-entry" onPress={() => setOpenId(entry.id)}>
            <Card>
              <View style={{ flexDirection: 'row', gap: theme.spacing(3), alignItems: 'center' }}>
                <AppText variant="label" tone="link">
                  {entry.id}
                </AppText>
                <AppText variant="label">{entry.title}</AppText>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

import { AppText, Card, IconButton, Screen, useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GALLERY_ENTRIES } from './gallery-entries';

/**
 * Bảng tra 17 khung của cụm auth, CHỈ có trên bản dev (xem `app/dev/gallery.tsx`).
 *
 * Lý do tồn tại: nhiều trạng thái chỉ hiện ra sau một chuỗi thao tác đúng (mã
 * sai, link hết hạn, vừa gửi lại mã). Duyệt thiết kế mà phải diễn lại từng chuỗi
 * thì sẽ có trạng thái không ai kịp nhìn.
 */
export function GalleryScreen() {
  const theme = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = GALLERY_ENTRIES.find((entry) => entry.id === openId);

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
      <AppText variant="title">Gallery — cụm auth</AppText>
      <AppText tone="muted" style={{ marginTop: theme.spacing(1) }}>
        {GALLERY_ENTRIES.length} khung, dựng bằng dữ liệu cứng. Chỉ có ở bản dev.
      </AppText>

      <View style={{ marginTop: theme.spacing(4), gap: theme.spacing(2) }}>
        {GALLERY_ENTRIES.map((entry) => (
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

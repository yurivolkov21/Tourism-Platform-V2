import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Tấm trượt từ đáy (`.sheet` bản vẽ 18/09 — ADR-0047 T0). Không gesture kéo-thả. */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        testID="bottom-sheet-backdrop"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: theme.spacing(7),
          borderTopRightRadius: theme.spacing(7),
          paddingTop: theme.spacing(4),
          paddingBottom: theme.spacing(6),
          paddingHorizontal: theme.spacing(4),
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: theme.spacing(2),
            left: '50%',
            marginLeft: -18,
            width: 36,
            height: 4,
            borderRadius: 999,
            backgroundColor: withAlpha(theme.colors['muted-foreground'], 0.5),
          }}
        />
        {children}
      </View>
    </Modal>
  );
}

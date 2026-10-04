import Feather from '@expo/vector-icons/Feather';
import { AppText, BottomSheet, type FeatherIconName, useTheme } from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface LegalLinkRow {
  key: string;
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
}

export interface LegalLinksSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  links: readonly LegalLinkRow[];
}

/** Một tấm liệt kê các link trợ giúp/pháp lý (mở trình duyệt ngoài) — gom từ một dòng menu. */
export function LegalLinksSheet({ visible, onClose, title, links }: LegalLinksSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(3) }}>
        <AppText variant="heading">{title}</AppText>
        <View style={{ marginTop: theme.spacing(2) }}>
          {links.map((link, index) => (
            <Pressable
              key={link.key}
              accessibilityRole="link"
              onPress={() => {
                onClose();
                link.onPress();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
                paddingVertical: theme.spacing(3),
                borderBottomWidth: index === links.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Feather name={link.icon} size={18} color={theme.colors.foreground} />
              <AppText variant="label" style={{ flex: 1 }}>
                {link.label}
              </AppText>
              <Feather name="external-link" size={16} color={theme.colors['muted-foreground']} />
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

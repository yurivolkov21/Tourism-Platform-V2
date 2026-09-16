import { AppText, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

/** Vạch "or" giữa nút chính và nút đăng nhập bằng Google (khung 2a, 3a). */
export function OrDivider({ label }: { label: string }) {
  const theme = useTheme();
  const line = { flex: 1, height: 1, backgroundColor: theme.colors.border };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(2.5),
        marginVertical: theme.spacing(2.5),
      }}
    >
      <View style={line} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <View style={line} />
    </View>
  );
}

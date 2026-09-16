import Feather from '@expo/vector-icons/Feather';
import {
  AppText,
  Button,
  type FeatherIconName,
  IconButton,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface InfoStateProps {
  icon: FeatherIconName;
  title: string;
  body: string;
  /** Dòng phụ dưới mô tả — ví dụ "Sent to lan@example.com". */
  footnote?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Nút thoát góc trái. Bỏ trống khi màn không cho quay lui. */
  exit?: { icon: Extract<FeatherIconName, 'x' | 'arrow-left'>; label: string; onPress: () => void };
}

/**
 * Màn "một câu chuyện, một nút": đã gửi link đặt lại (5b), link hỏng (5d), thiếu
 * email ở màn xác minh. Cả ba đều là KÊNH 3 của luật lỗi — màn hết đường dùng
 * nên thay luôn thân màn, thay vì nhét một dải lỗi vào giữa form.
 *
 * Một component cho cả ba vì chúng chỉ khác icon, chữ và đích của nút; tách ra
 * là mở đường cho ba bố cục trôi khỏi nhau.
 */
export function InfoState({
  icon,
  title,
  body,
  footnote,
  actionLabel,
  onAction,
  exit,
}: InfoStateProps) {
  const theme = useTheme();
  const box = theme.spacing(16);

  return (
    <Screen padded={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(2),
          paddingBottom: theme.spacing(6),
        }}
      >
        {exit === undefined ? null : (
          <View style={{ alignSelf: 'flex-start' }}>
            <IconButton icon={exit.icon} accessibilityLabel={exit.label} onPress={exit.onPress} />
          </View>
        )}

        <View
          style={{
            width: box,
            height: box,
            // Bo góc gấp đôi bậc thường — cùng cách `FormMessage` làm khối lớn.
            borderRadius: theme.radius.base * 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.secondary,
            marginTop: theme.spacing(6),
          }}
        >
          <Feather name={icon} size={28} color={theme.colors['primary-emphasis']} />
        </View>

        <AppText variant="display" style={{ marginTop: theme.spacing(5.5) }}>
          {title}
        </AppText>
        <AppText tone="muted" style={{ marginTop: theme.spacing(1.5) }}>
          {body}
        </AppText>

        {footnote === undefined ? null : (
          <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(3.5) }}>
            {footnote}
          </AppText>
        )}

        <View style={{ marginTop: 'auto', paddingTop: theme.spacing(6) }}>
          <Button shape="pill" label={actionLabel} onPress={onAction} />
        </View>
      </View>
    </Screen>
  );
}

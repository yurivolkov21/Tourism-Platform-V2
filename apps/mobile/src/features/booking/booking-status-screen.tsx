import type { FeatherIconName } from '@tourism/mobile-ui';
import { Button, EmptyState, Icon, Screen, useTheme } from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

export interface BookingStatusAction {
  label: string;
  onPress: () => void;
}

export interface BookingStatusScreenProps {
  icon: FeatherIconName;
  heading: string;
  body: string;
  /** `null` = không có nút chính (B6 — đang xác nhận, không có đường đi nào ở đây). */
  primary?: BookingStatusAction | null;
  secondary?: BookingStatusAction | null;
  /** B4 — dải bước ở đầu màn (màn thanh toán là bước 4 "Pay"); vắng thì không vẽ. */
  progress?: ReactNode;
  /** B6 — đang chờ: vòng xoay thay icon tĩnh để khách thấy app còn làm việc. */
  busy?: boolean;
}

/**
 * Khuôn "thẻ trạng thái" dùng chung cho B5 (rời app sang trình duyệt), B6
 * (đang xác nhận, không nút) và B7 (chưa nhận được xác nhận) — cùng bố cục
 * mockup: ô vuông icon + tiêu đề + câu phụ + tối đa hai nút. Cùng khuôn
 * `AuthGateScreen` (icon vuông 64dp secondary + `EmptyState surface=false`).
 */
export function BookingStatusScreen({
  icon,
  heading,
  body,
  primary = null,
  secondary = null,
  progress = null,
  busy = false,
}: BookingStatusScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={['bottom']}>
      {progress === null ? null : <View style={{ paddingTop: theme.spacing(2) }}>{progress}</View>}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(2) }}>
        <EmptyState
          icon={
            <View
              style={{
                width: theme.spacing(16),
                height: theme.spacing(16),
                borderRadius: theme.radius.base * 2,
                backgroundColor: theme.colors.secondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {busy ? (
                <ActivityIndicator
                  testID="booking-status-spinner"
                  size="large"
                  color={theme.colors['primary-emphasis']}
                  accessibilityLabel={heading}
                />
              ) : (
                <Icon name={icon} size={28} color={theme.colors['primary-emphasis']} />
              )}
            </View>
          }
          title={heading}
          body={body}
          surface={false}
        >
          {primary === null && secondary === null ? null : (
            <View
              style={{ gap: theme.spacing(3), alignSelf: 'stretch', marginTop: theme.spacing(4) }}
            >
              {primary === null ? null : (
                <Button shape="pill" label={primary.label} onPress={primary.onPress} />
              )}
              {secondary === null ? null : (
                <Button
                  shape="pill"
                  variant="ghost"
                  label={secondary.label}
                  onPress={secondary.onPress}
                />
              )}
            </View>
          )}
        </EmptyState>
      </View>
    </Screen>
  );
}

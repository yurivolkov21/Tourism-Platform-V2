import Feather from '@expo/vector-icons/Feather';
import { AppImage, AppText, Button, Screen, useTheme, withAlpha } from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

export interface BookingSuccessScreenProps {
  heroImageUrl: string | null;
  heading: string;
  subtitle: string;
  bookingCodeLabel: string;
  bookingCode: string;
  tourTitle: string;
  travellersLabel: string;
  dateRangeLabel: string;
  totalAmount: string;
  viewBookingLabel: string;
  onViewBooking: () => void;
  browseToursLabel: string;
  onBrowseTours: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const HERO_HEIGHT = 300;
const ICON_SIZE = 64;

/** B8 — đặt chỗ xong. Terminal screen, không có đường lùi (không header native). */
export function BookingSuccessScreen({
  heroImageUrl,
  heading,
  subtitle,
  bookingCodeLabel,
  bookingCode,
  tourTitle,
  travellersLabel,
  dateRangeLabel,
  totalAmount,
  viewBookingLabel,
  onViewBooking,
  browseToursLabel,
  onBrowseTours,
  transformUrl,
}: BookingSuccessScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={['bottom']} padded={false} scrollable={false}>
      <View style={{ flex: 1 }}>
        <View style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.muted }}>
          {heroImageUrl === null ? null : (
            <>
              <AppImage source={heroImageUrl} width={780} alt="" transformUrl={transformUrl} fill />
              {/* Mockup .hero::before — ảnh mờ dần xuống nền, không phải blur thật */}
              <LinearGradient
                colors={[
                  withAlpha(theme.colors.scrim, 0.45),
                  withAlpha(theme.colors.background, 0),
                  withAlpha(theme.colors.background, 0.55),
                  theme.colors.background,
                ]}
                locations={[0, 0.3, 0.66, 1]}
                style={StyleSheet.absoluteFill}
              />
            </>
          )}
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            paddingHorizontal: theme.spacing(6),
            // Icon lấn lên mép dưới ảnh bìa (mockup: icon nổi giữa ảnh và nội
            // dung) — margin âm bằng nửa icon để phần còn lại lồi xuống dưới.
            marginTop: -(ICON_SIZE / 2),
          }}
        >
          <View
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check-circle" size={30} color={theme.colors['primary-foreground']} />
          </View>
          <AppText variant="display" style={{ marginTop: theme.spacing(4), textAlign: 'center' }}>
            {heading}
          </AppText>
          <AppText
            variant="subtitle"
            tone="muted"
            style={{ marginTop: theme.spacing(1.5), textAlign: 'center' }}
          >
            {subtitle}
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              alignSelf: 'stretch',
              marginTop: theme.spacing(4),
              padding: theme.spacing(3),
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.secondary,
            }}
          >
            <AppText variant="caption" style={{ color: theme.colors['secondary-foreground'] }}>
              {bookingCodeLabel}
            </AppText>
            <AppText variant="label" style={{ color: theme.colors['secondary-foreground'] }}>
              {bookingCode}
            </AppText>
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: theme.spacing(2) }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing(2.5),
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <AppText variant="subtitle" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                {tourTitle}
              </AppText>
              <AppText variant="label">{travellersLabel}</AppText>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing(2.5),
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <AppText variant="subtitle" tone="muted">
                {dateRangeLabel}
              </AppText>
              <AppText variant="label">{totalAmount}</AppText>
            </View>
          </View>
        </View>

        <View
          style={{
            gap: theme.spacing(2),
            paddingHorizontal: theme.spacing(6),
            paddingTop: theme.spacing(4),
            paddingBottom: theme.spacing(6),
          }}
        >
          <Button shape="pill" label={viewBookingLabel} onPress={onViewBooking} />
          <Button shape="pill" variant="ghost" label={browseToursLabel} onPress={onBrowseTours} />
        </View>
      </View>
    </Screen>
  );
}

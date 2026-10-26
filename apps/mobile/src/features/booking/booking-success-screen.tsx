import {
  AppImage,
  AppText,
  AuroraGradient,
  Button,
  CountUpText,
  FadeIn,
  Icon,
  PopIn,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { ConfettiBurst } from './confetti-burst';

export interface BookingSuccessScreenProps {
  heroImageUrl: string | null;
  heading: string;
  subtitle: string;
  bookingCodeLabel: string;
  bookingCode: string;
  tourTitle: string;
  travellersCaption: string;
  travellersLabel: string;
  totalCaption: string;
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
const NOTCH_SIZE = 22;

/** B8 — đặt chỗ xong. Terminal screen, không có đường lùi (không header native). */
export function BookingSuccessScreen({
  heroImageUrl,
  heading,
  subtitle,
  bookingCodeLabel,
  bookingCode,
  tourTitle,
  travellersCaption,
  travellersLabel,
  totalCaption,
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
        <View
          style={{ height: HERO_HEIGHT, backgroundColor: theme.colors.muted, overflow: 'hidden' }}
        >
          {heroImageUrl === null ? <AuroraGradient intensity={0.45} /> : null}
          {heroImageUrl === null ? null : (
            <>
              <AppImage source={heroImageUrl} width={780} alt="" transformUrl={transformUrl} fill />
              {/* Màu thương hiệu giao thoa chạy chậm phủ lên ảnh, dưới dải mờ về màu nền. */}
              <AuroraGradient intensity={0.3} />
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
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiBurst fallDistance={HERO_HEIGHT - 40} />
          </View>
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
          {/* Quầng sáng mockup (box-shadow màu primary): Android không có bóng màu nên giả bằng hai vòng mờ */}
          <View
            style={{
              position: 'absolute',
              top: -12,
              width: ICON_SIZE + 24,
              height: ICON_SIZE + 24,
              borderRadius: theme.radius.base * 4,
              backgroundColor: withAlpha(theme.colors.primary, 0.12),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -6,
              width: ICON_SIZE + 12,
              height: ICON_SIZE + 12,
              borderRadius: theme.radius.base * 3,
              backgroundColor: withAlpha(theme.colors.primary, 0.2),
            }}
          />
          <PopIn delay={150}>
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
              <Icon name="check-circle" size={30} color={theme.colors['primary-foreground']} />
            </View>
          </PopIn>
          <FadeIn delay={250} style={{ alignItems: 'center' }}>
            <AppText variant="brand" style={{ marginTop: theme.spacing(4), textAlign: 'center' }}>
              {heading}
            </AppText>
            <AppText
              variant="subtitle"
              tone="muted"
              style={{ marginTop: theme.spacing(1.5), textAlign: 'center' }}
            >
              {subtitle}
            </AppText>
          </FadeIn>

          <FadeIn delay={400} style={{ alignSelf: 'stretch' }}>
            {/* Mockup .ticket: nửa trên mã booking, đường xé có khuyết hai bên, nửa dưới tour + tổng tiền */}
            <View
              style={{
                alignSelf: 'stretch',
                marginTop: theme.spacing(4),
                borderRadius: theme.radius.base * 2,
                backgroundColor: theme.colors.card,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing(3.5),
                  paddingHorizontal: theme.spacing(4),
                  backgroundColor: theme.colors.secondary,
                }}
              >
                <View>
                  <AppText
                    variant="caption"
                    style={{ color: theme.colors['secondary-foreground'] }}
                  >
                    {bookingCodeLabel}
                  </AppText>
                  <AppText
                    variant="title"
                    style={{ color: theme.colors['secondary-foreground'], letterSpacing: 2 }}
                  >
                    {bookingCode}
                  </AppText>
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: theme.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={22} color={theme.colors['primary-emphasis']} />
                </View>
              </View>

              <View style={{ height: NOTCH_SIZE, justifyContent: 'center' }}>
                <View
                  style={{
                    marginHorizontal: theme.spacing(5),
                    borderTopWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: theme.colors.border,
                  }}
                />
                <View
                  style={[
                    styles.notch,
                    { left: -NOTCH_SIZE / 2, backgroundColor: theme.colors.background },
                  ]}
                />
                <View
                  style={[
                    styles.notch,
                    { right: -NOTCH_SIZE / 2, backgroundColor: theme.colors.background },
                  ]}
                />
              </View>

              <View
                style={{
                  padding: theme.spacing(4),
                  paddingTop: theme.spacing(1),
                  gap: theme.spacing(2.5),
                }}
              >
                <View>
                  <AppText variant="label">{tourTitle}</AppText>
                  <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(0.5) }}>
                    {dateRangeLabel}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing(6) }}>
                  <View>
                    <AppText variant="caption" tone="muted">
                      {travellersCaption}
                    </AppText>
                    <AppText variant="label">{travellersLabel}</AppText>
                  </View>
                  <View>
                    <AppText variant="caption" tone="muted">
                      {totalCaption}
                    </AppText>
                    <CountUpText variant="label" text={totalAmount} />
                  </View>
                </View>
              </View>
            </View>
          </FadeIn>
        </View>

        <View
          style={{
            gap: theme.spacing(2),
            paddingHorizontal: theme.spacing(6),
            paddingTop: theme.spacing(4),
            paddingBottom: theme.spacing(6),
          }}
        >
          <FadeIn delay={550} style={{ gap: theme.spacing(2) }}>
            <Button shape="pill" label={viewBookingLabel} onPress={onViewBooking} />
            <Button shape="pill" variant="ghost" label={browseToursLabel} onPress={onBrowseTours} />
          </FadeIn>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Khuyết nửa vòng ở mép vé: hình tròn màu nền, nửa ngoài bị overflow cắt.
  notch: {
    position: 'absolute',
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
  },
});

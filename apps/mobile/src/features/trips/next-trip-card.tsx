import { AppImage, AppText, Icon, PressableScale, useTheme, withAlpha } from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

export interface NextTripVM {
  code: string;
  imageUrl: string | null;
  title: string;
  /** "Departing in" hoặc "On tour now". */
  kicker: string;
  /** "12 days" hoặc "Day 2 of 4" — chữ `brand` lớn trên ảnh. */
  headline: string;
  /** "Nov 3 – 7 · 2 travellers". */
  subLabel: string;
  ctaLabel: string;
}

export interface NextTripCardProps {
  trip: NextTripVM;
  onPress: (code: string) => void;
  transformUrl?: (source: string, width: number) => string;
}

const IMAGE_HEIGHT = 120;

/**
 * Thẻ "Next trip" đầu tab Trips (B5, khung B10): ảnh cao 120 có dải mờ, kicker và số
 * `brand` trên ảnh; dưới ảnh là tên tour, ngày · số khách và "View trip" kèm mũi tên.
 */
export function NextTripCard({ trip, onPress, transformUrl }: NextTripCardProps) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}, ${trip.kicker} ${trip.headline}`}
      onPress={() => onPress(trip.code)}
      style={{
        marginHorizontal: theme.spacing(4),
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: theme.colors.card,
      }}
    >
      <View style={{ height: IMAGE_HEIGHT, backgroundColor: theme.colors.muted }}>
        {trip.imageUrl === null ? null : (
          <AppImage
            source={trip.imageUrl}
            width={400}
            alt={trip.title}
            transformUrl={transformUrl}
            fill
            reveal
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(theme.colors.scrim, 0), withAlpha(theme.colors.scrim, 0.75)]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ position: 'absolute', left: theme.spacing(4), bottom: theme.spacing(3) }}>
          <AppText variant="caption" tone="media" style={{ opacity: 0.85 }}>
            {trip.kicker}
          </AppText>
          <AppText variant="brand" tone="media">
            {trip.headline}
          </AppText>
        </View>
      </View>
      <View style={{ padding: theme.spacing(4), gap: theme.spacing(1) }}>
        <AppText variant="heading" numberOfLines={1}>
          {trip.title}
        </AppText>
        <AppText variant="label" tone="muted" style={{ fontWeight: theme.weight.normal }}>
          {trip.subLabel}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(1),
            marginTop: theme.spacing(2),
          }}
        >
          <AppText variant="label" tone="link">
            {trip.ctaLabel}
          </AppText>
          <Icon name="arrow-right" size={18} color={theme.colors['primary-emphasis']} />
        </View>
      </View>
    </PressableScale>
  );
}

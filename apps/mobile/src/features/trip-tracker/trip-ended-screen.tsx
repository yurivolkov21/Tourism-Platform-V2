import Feather from '@expo/vector-icons/Feather';
import { AppText, Button, Screen, useTheme } from '@tourism/mobile-ui';
import { ScrollView, View } from 'react-native';
import { RowLink } from './trip-tracker-parts';

export interface TripEndedStat {
  value: number;
  label: string;
}

export interface TripEndedScreenProps {
  welcomeBackLabel: string;
  summary: string;
  stats: readonly [TripEndedStat, TripEndedStat, TripEndedStat];
  /** `true` khi `booking.reviewedAt !== null` — ẨN khối "How was it?"+nút,
   *  hiện `reviewedLabel` tĩnh thay vào (handoff P6: "đã viết rồi thì đổi
   *  thành 'You reviewed this trip'"). */
  reviewed: boolean;
  howWasItTitle: string;
  howWasItBody: string;
  writeReviewLabel: string;
  onWriteReviewPress: () => void;
  reviewedLabel: string;
  bookingDetailsRow: { label: string; caption: string; onPress: () => void };
  whereToNextRow: { label: string; caption: string; onPress: () => void };
}

/** P6 — chuyến đã kết thúc (mockup mục 4). */
export function TripEndedScreen({
  welcomeBackLabel,
  summary,
  stats,
  reviewed,
  howWasItTitle,
  howWasItBody,
  writeReviewLabel,
  onWriteReviewPress,
  reviewedLabel,
  bookingDetailsRow,
  whereToNextRow,
}: TripEndedScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        {/* Khối chào mừng nằm trong thẻ `.count` của mockup: nền card, viền border. */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: theme.spacing(6),
            paddingHorizontal: theme.spacing(5),
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.base * 3,
          }}
        >
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
            <Feather name="flag" size={28} color={theme.colors['primary-emphasis']} />
          </View>
          <AppText variant="title" style={{ marginTop: theme.spacing(3), textAlign: 'center' }}>
            {welcomeBackLabel}
          </AppText>
          <AppText variant="subtitle" tone="muted" style={{ marginTop: 4, textAlign: 'center' }}>
            {summary}
          </AppText>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing(6), marginTop: theme.spacing(4) }}
          >
            {stats.map((stat) => (
              <View key={stat.label} style={{ alignItems: 'center' }}>
                <AppText variant="title">{stat.value}</AppText>
                <AppText variant="caption" tone="muted">
                  {stat.label}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        {reviewed ? (
          <AppText
            variant="subtitle"
            tone="muted"
            style={{ textAlign: 'center', marginTop: theme.spacing(2) }}
          >
            {reviewedLabel}
          </AppText>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing(2.5),
                marginTop: theme.spacing(4),
                padding: theme.spacing(3.5),
                borderRadius: theme.radius.base * 2,
                backgroundColor: theme.colors.secondary,
              }}
            >
              <Feather name="star" size={20} color={theme.colors['secondary-foreground']} />
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ color: theme.colors['secondary-foreground'] }}>
                  {howWasItTitle}
                </AppText>
                <AppText
                  variant="caption"
                  style={{
                    color: theme.colors['secondary-foreground'],
                    marginTop: 2,
                    opacity: 0.85,
                  }}
                >
                  {howWasItBody}
                </AppText>
              </View>
            </View>
            <View style={{ marginTop: theme.spacing(4) }}>
              <Button shape="pill" label={writeReviewLabel} onPress={onWriteReviewPress} />
            </View>
          </>
        )}

        <View style={{ marginTop: theme.spacing(4) }}>
          <RowLink
            icon="file-text"
            label={bookingDetailsRow.label}
            caption={bookingDetailsRow.caption}
            onPress={bookingDetailsRow.onPress}
          />
          <RowLink
            icon="compass"
            label={whereToNextRow.label}
            caption={whereToNextRow.caption}
            onPress={whereToNextRow.onPress}
            last
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

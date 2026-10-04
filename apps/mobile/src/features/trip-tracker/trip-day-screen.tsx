import Feather from '@expo/vector-icons/Feather';
import { AppText, Button, Screen, useTheme } from '@tourism/mobile-ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StopState } from './trip-tracker';
import { RowLink, SectionLabel, TripCountCard, TripMeter } from './trip-tracker-parts';

export interface TripDayLineVM {
  /** `undefined` cho dòng không khớp khuôn "HH:MM — việc" (in nguyên văn). */
  time?: string;
  text: string;
  /** Chỉ dòng có `time` mới có trạng thái tô đậm theo giờ hiện tại. */
  state?: StopState;
}

export interface TripDayScreenProps {
  onTourNowLabel: string;
  dateLabel: string;
  dayTitle: string;
  progressPercent: number;
  dayOfTotalLabel: string;
  endsOnLabel: string;
  todayLabel: string;
  lines: readonly TripDayLineVM[];
  /** Vắng ở ngày cuối (không có "ngày mai"). */
  nextDayRow?: { label: string; caption: string; onPress: () => void };
  tripNotesRow: { label: string; caption: string; onPress: () => void };
  bookingDetailsRow: { label: string; caption: string; onPress: () => void };
  contactLabel: string;
  onContactPress: () => void;
}

function DayLine({ line }: { line: TripDayLineVM }) {
  const theme = useTheme();
  const active = line.state === 'active';
  const done = line.state === 'done';

  return (
    <View
      style={{ flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(1) }}
    >
      <View style={{ width: theme.spacing(11) }}>
        {line.time === undefined ? null : (
          <AppText
            variant="caption"
            tone={active ? undefined : 'muted'}
            style={active ? { color: theme.colors['primary-emphasis'] } : undefined}
          >
            {line.time}
          </AppText>
        )}
      </View>
      <AppText
        variant={active ? 'label' : 'subtitle'}
        tone={done ? 'muted' : 'default'}
        style={[{ flex: 1 }, done ? { textDecorationLine: 'line-through' as const } : null]}
      >
        {line.text}
      </AppText>
    </View>
  );
}

/** P5 — đang trong chuyến, tiêu đề header ĐỘNG "Day {n} of {total}" (route tự
 *  đặt qua `Stack.Screen`, không khai ở đây). Mockup mục 4. */
export function TripDayScreen({
  onTourNowLabel,
  dateLabel,
  dayTitle,
  progressPercent,
  dayOfTotalLabel,
  endsOnLabel,
  todayLabel,
  lines,
  nextDayRow,
  tripNotesRow,
  bookingDetailsRow,
  contactLabel,
  onContactPress,
}: TripDayScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <TripCountCard>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <SectionLabel>{onTourNowLabel}</SectionLabel>
            <AppText variant="caption" tone="muted">
              {dateLabel}
            </AppText>
          </View>
          <AppText variant="title" style={{ marginTop: 4 }}>
            {dayTitle}
          </AppText>
          <TripMeter percent={progressPercent} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: theme.spacing(1.5),
            }}
          >
            <AppText variant="caption" tone="muted">
              {dayOfTotalLabel}
            </AppText>
            <AppText variant="caption" tone="muted">
              {endsOnLabel}
            </AppText>
          </View>
        </TripCountCard>

        <View style={{ marginTop: theme.spacing(5) }}>
          <SectionLabel>{todayLabel}</SectionLabel>
        </View>
        <View style={{ marginTop: theme.spacing(2) }}>
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: mảng tĩnh một lịch trình, không chèn/xoá giữa chừng.
            <DayLine key={index} line={line} />
          ))}
        </View>

        <View style={{ marginTop: theme.spacing(4) }}>
          {nextDayRow === undefined ? null : (
            <RowLink
              icon="calendar"
              label={nextDayRow.label}
              caption={nextDayRow.caption}
              onPress={nextDayRow.onPress}
            />
          )}
          <RowLink
            icon="briefcase"
            label={tripNotesRow.label}
            caption={tripNotesRow.caption}
            onPress={tripNotesRow.onPress}
          />
          <RowLink
            icon="file-text"
            label={bookingDetailsRow.label}
            caption={bookingDetailsRow.caption}
            onPress={bookingDetailsRow.onPress}
            last
          />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
          paddingBottom: Math.max(insets.bottom, theme.spacing(3)),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      >
        <Button
          shape="pill"
          variant="ghost"
          label={contactLabel}
          leading={
            <Feather name="message-square" size={18} color={theme.colors['primary-emphasis']} />
          }
          onPress={onContactPress}
        />
      </View>
    </Screen>
  );
}

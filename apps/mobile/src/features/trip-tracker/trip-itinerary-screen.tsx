import Feather from '@expo/vector-icons/Feather';
import { AppText, Screen, useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ItineraryLine } from '@/features/tour-detail/itinerary';

export interface TripItineraryDayVM {
  dayNumber: number;
  title: string;
  dateLabel: string;
  lines: readonly ItineraryLine[];
}

export interface TripItineraryScreenProps {
  summaryLabel: string;
  days: readonly TripItineraryDayVM[];
  /** Ngày mở sẵn lúc vào màn (P4 spec: "mở sẵn ngày sắp tới") — `null` thì
   *  không ngày nào mở. */
  initialExpandedDay: number | null;
}

/**
 * P4 — "Your itinerary", lịch trình CHUYẾN ĐÃ MUA (khác tab Itinerary của
 * trang tour — đây gắn ngày lịch thật). Cùng khuôn rail-dot với
 * `tour-detail-screen.tsx` (D2); không tách thành mảnh dùng chung vì màn đó
 * đã có test riêng ổn định, tách lúc này là rủi ro không cần.
 */
export function TripItineraryScreen({
  summaryLabel,
  days,
  initialExpandedDay,
}: TripItineraryScreenProps) {
  const theme = useTheme();
  const [expandedDay, setExpandedDay] = useState<number | null>(initialExpandedDay);

  return (
    <Screen edges={[]} padded={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <AppText variant="caption" tone="muted">
          {summaryLabel}
        </AppText>

        <View style={{ marginTop: theme.spacing(4), gap: 14 }}>
          {days.map((day, index) => {
            const isLast = index === days.length - 1;
            const open = day.dayNumber === expandedDay;

            return (
              <View key={day.dayNumber} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
                <View style={{ width: 24, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 99,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: open ? theme.colors.primary : theme.colors.secondary,
                    }}
                  >
                    <AppText
                      variant="caption"
                      style={{
                        color: open
                          ? theme.colors['primary-foreground']
                          : theme.colors['primary-emphasis'],
                        fontFamily: theme.fonts.semibold,
                      }}
                    >
                      {day.dayNumber}
                    </AppText>
                  </View>
                  {isLast ? null : (
                    <View
                      style={{
                        flex: 1,
                        width: 2,
                        backgroundColor: theme.colors.border,
                        marginTop: 4,
                      }}
                    />
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setExpandedDay(open ? null : day.dayNumber)}
                  style={{ flex: 1, paddingBottom: theme.spacing(1.5) }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{day.title}</AppText>
                      <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                        {day.dateLabel}
                      </AppText>
                    </View>
                    <Feather
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.colors['muted-foreground']}
                    />
                  </View>
                  {!open || day.lines.length === 0 ? null : (
                    <View style={{ marginTop: theme.spacing(2), gap: 6 }}>
                      {day.lines.map((line) =>
                        line.kind === 'timed' ? (
                          <View
                            key={`${line.time}-${line.text}`}
                            style={{ flexDirection: 'row', gap: theme.spacing(2) }}
                          >
                            <AppText
                              variant="caption"
                              style={{ width: 44, fontFamily: theme.fonts.semibold }}
                            >
                              {line.time}
                            </AppText>
                            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                              {line.text}
                            </AppText>
                          </View>
                        ) : (
                          <AppText key={line.text} variant="caption" tone="muted">
                            {line.text}
                          </AppText>
                        ),
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

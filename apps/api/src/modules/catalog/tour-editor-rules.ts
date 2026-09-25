import { departurePhase } from '@tourism/contract';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Hai luật THUẦN của khu làm việc tour (spec F17) — tách khỏi service để test
 * không cần DB.
 */

/**
 * Phiên bản kế tiếp của một tour: đồng hồ hiện tại, nhưng không bao giờ nhỏ hơn
 * hay bằng phiên bản cũ (plan F17, quyết định 3). Hai lần lưu rơi cùng một
 * mili-giây mà ra cùng phiên bản thì phép so-và-ghi mất tác dụng — người cầm
 * phiên bản cũ ghi đè được lên lần lưu thứ hai.
 */
export function nextTourVersion(version: string, now: Date): Date {
  return new Date(Math.max(now.getTime(), Date.parse(version) + 1));
}

export interface DepartureSeats {
  seatsTotal: number;
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}

/**
 * Sàn của số khách tối đa (spec §2b.2): số ghế lớn nhất của các chuyến có giai
 * đoạn khác `completed` và `cancelled`. Giai đoạn lấy từ `departurePhase`
 * (ADR-0046) — một chuyến đã về 30 ghế không được khoá oan một tour giờ chỉ chạy
 * đoàn 12 (spec §4.8).
 */
export function liveSeatsMax(departures: readonly DepartureSeats[], now: Date): number | null {
  let max: number | null = null;
  for (const departure of departures) {
    const phase = departurePhase({
      status: departure.status,
      startDate: calendarDate(departure.startDate),
      endDate: calendarDate(departure.endDate),
      now,
    });
    if (phase === 'completed' || phase === 'cancelled') continue;
    if (max === null || departure.seatsTotal > max) max = departure.seatsTotal;
  }
  return max;
}

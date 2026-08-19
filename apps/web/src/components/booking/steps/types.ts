import type { DepartureVM } from '@/lib/api/tours';
import type { BookingFormErrors, BookingFormState } from '@/lib/booking-form';

/**
 * Hợp đồng chung của bốn thân bước.
 *
 * **Không bước nào tự giữ state.** Toàn bộ `BookingFormState` sống ở
 * `BookingWizard` và truyền xuống qua props — đó chính là thứ làm nút Back giữ
 * được dữ liệu đã nhập: đổi bước chỉ đổi phần được render, không tháo state.
 * Nếu một bước tự `useState` cho ô của nó thì rời bước là mất, và lỗi kiểu đó
 * chỉ lộ ra khi có người bấm Back — muộn.
 */
export interface StepShared {
  state: BookingFormState;
  errors: BookingFormErrors;
  set: <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => void;
  /** Đợt đang chọn, giải sẵn ở wizard để bốn bước khỏi tự tra lại. */
  selected: DepartureVM | null;
  currency: string;
}

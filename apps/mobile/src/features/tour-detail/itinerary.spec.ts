import { parseItineraryDescription } from './itinerary';

describe('parseItineraryDescription', () => {
  it('mỗi dòng khớp mẫu "HH:MM — mô tả" tách thành giờ + chữ riêng', () => {
    const description =
      '09:00 — Arrival pickup at Đà Nẵng International Airport\n10:30 — Check in near My Khê Beach';
    expect(parseItineraryDescription(description)).toEqual([
      { kind: 'timed', time: '09:00', text: 'Arrival pickup at Đà Nẵng International Airport' },
      { kind: 'timed', time: '10:30', text: 'Check in near My Khê Beach' },
    ]);
  });

  it('dòng KHÔNG khớp mẫu in nguyên dòng (plain), không ép vào cột giờ', () => {
    expect(parseItineraryDescription('A full day in Hội An, no fixed schedule.')).toEqual([
      { kind: 'plain', text: 'A full day in Hội An, no fixed schedule.' },
    ]);
  });

  it('trộn cả hai kiểu trong cùng mô tả — quyết định theo TỪNG dòng', () => {
    const description = '09:00 — Pickup\nFree time in the afternoon\n18:30 — Dinner';
    expect(parseItineraryDescription(description)).toEqual([
      { kind: 'timed', time: '09:00', text: 'Pickup' },
      { kind: 'plain', text: 'Free time in the afternoon' },
      { kind: 'timed', time: '18:30', text: 'Dinner' },
    ]);
  });

  it('bỏ dòng trắng, null → mảng rỗng', () => {
    expect(parseItineraryDescription('09:00 — Pickup\n\n\n10:00 — Depart')).toEqual([
      { kind: 'timed', time: '09:00', text: 'Pickup' },
      { kind: 'timed', time: '10:00', text: 'Depart' },
    ]);
    expect(parseItineraryDescription(null)).toEqual([]);
  });

  it('nhận cả gạch ngang thường "-" lẫn em dash "—"', () => {
    expect(parseItineraryDescription('09:00 - Pickup')).toEqual([
      { kind: 'timed', time: '09:00', text: 'Pickup' },
    ]);
  });
});

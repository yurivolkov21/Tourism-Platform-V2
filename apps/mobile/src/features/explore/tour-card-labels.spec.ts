import { messages } from '@tourism/i18n';
import { formatDepartureDate } from '@/features/tour-detail/departures';
import { discountPercent, tourCardLabels } from './tour-card-labels';

const t = messages.mobile.tourDetail;

describe('tourCardLabels', () => {
  it('có đợt hạ giá (giá "from" dưới giá gốc): in giá "from", gạch giá gốc', () => {
    const labels = tourCardLabels({
      priceFrom: '80.00',
      basePrice: '100.00',
      currency: 'USD',
      nextDeparture: null,
    });

    expect(labels.priceLabel).toBe('$80');
    expect(labels.compareAtPriceLabel).toBe('$100');
    expect(labels.discountLabel).toBe('−20%');
  });

  it('không hạ giá: không gạch giá nào', () => {
    const labels = tourCardLabels({
      priceFrom: '100.00',
      basePrice: '100.00',
      currency: 'USD',
      nextDeparture: null,
    });

    expect(labels.priceLabel).toBe('$100');
    expect(labels.compareAtPriceLabel).toBeNull();
    expect(labels.discountLabel).toBeNull();
  });

  it('có đợt kế: dòng ngày đi và số chỗ, còn nhiều chỗ thì không "gần đầy"', () => {
    const labels = tourCardLabels({
      priceFrom: '100.00',
      basePrice: '100.00',
      currency: 'USD',
      nextDeparture: { startDate: '2099-11-03', seatsLeft: 8 },
    });

    expect(labels.departureLabel).toBe(t.nextDeparture(formatDepartureDate('2099-11-03')));
    expect(labels.seatsLabel).toBe(t.seatsLeft(8));
    expect(labels.almostFull).toBe(false);
  });

  it('đợt kế còn từ ba chỗ trở xuống: "gần đầy"', () => {
    const labels = tourCardLabels({
      priceFrom: '100.00',
      basePrice: '100.00',
      currency: 'USD',
      nextDeparture: { startDate: '2099-11-03', seatsLeft: 3 },
    });

    expect(labels.almostFull).toBe(true);
  });

  it('không còn đợt nào đặt được: "Dates on request", không có số chỗ', () => {
    const labels = tourCardLabels({
      priceFrom: '100.00',
      basePrice: '100.00',
      currency: 'USD',
      nextDeparture: null,
    });

    expect(labels.departureLabel).toBe(messages.mobile.explore.datesOnRequest);
    expect(labels.seatsLabel).toBeNull();
    expect(labels.almostFull).toBe(false);
  });
});

describe('discountPercent', () => {
  it('tính trên xu nguyên, làm tròn xuống — $35 → $28.35 là 19%, không phải 18%', () => {
    expect(discountPercent('35.00', '28.35')).toBe(19);
    expect(discountPercent('199.00', '169.00')).toBe(15);
  });
});

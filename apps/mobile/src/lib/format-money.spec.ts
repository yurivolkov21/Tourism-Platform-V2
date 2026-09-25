import { formatMoney } from './format-money';

describe('formatMoney', () => {
  it('làm tròn về đơn vị, không thập phân — khớp cách web hiện giá tour', () => {
    expect(formatMoney('39.00', 'USD')).toBe('$39');
    expect(formatMoney('419.50', 'USD')).toBe('$420');
  });
});

import { fromMinorUnits, isZeroDecimalCurrency, toAmountValue, toMinorUnits } from './money.js';

describe('isZeroDecimalCurrency', () => {
  it('recognises VND/JPY/KRW regardless of case', () => {
    expect(isZeroDecimalCurrency('VND')).toBe(true);
    expect(isZeroDecimalCurrency('jpy')).toBe(true);
    expect(isZeroDecimalCurrency('Krw')).toBe(true);
  });

  it('treats USD/EUR as two-decimal', () => {
    expect(isZeroDecimalCurrency('USD')).toBe(false);
    expect(isZeroDecimalCurrency('eur')).toBe(false);
  });
});

describe('toMinorUnits', () => {
  it('converts a 2dp USD amount to cents', () => {
    expect(toMinorUnits('117.00', 'USD')).toBe(11700);
    expect(toMinorUnits('0.99', 'USD')).toBe(99);
  });

  it('passes zero-decimal currencies through unscaled', () => {
    expect(toMinorUnits('500000', 'VND')).toBe(500000);
    expect(toMinorUnits('500000.00', 'VND')).toBe(500000);
    expect(toMinorUnits('1200', 'JPY')).toBe(1200);
  });

  it('rounds HALF_UP on sub-minor precision', () => {
    expect(toMinorUnits('116.995', 'USD')).toBe(11700); // .5 cents rounds up
    expect(toMinorUnits('116.994', 'USD')).toBe(11699);
    expect(toMinorUnits('500000.5', 'VND')).toBe(500001);
    expect(toMinorUnits('500000.4', 'VND')).toBe(500000);
  });

  it('is exact where floats are not (Decimal all the way)', () => {
    // 19.99 * 100 === 1998.9999999999998 in IEEE754 — Decimal must not care.
    expect(toMinorUnits('19.99', 'USD')).toBe(1999);
    expect(toMinorUnits('0.29', 'USD')).toBe(29);
  });

  it('rejects a non-numeric amount', () => {
    expect(() => toMinorUnits('not-money', 'USD')).toThrow();
  });
});

describe('fromMinorUnits', () => {
  it('formats cents back to the 2dp gateway-boundary string', () => {
    expect(fromMinorUnits(11700, 'USD')).toBe('117.00');
    expect(fromMinorUnits(99, 'USD')).toBe('0.99');
  });

  it('keeps zero-decimal currencies unscaled (still 2dp string)', () => {
    expect(fromMinorUnits(500000, 'VND')).toBe('500000.00');
    expect(fromMinorUnits(1200, 'jpy')).toBe('1200.00');
  });

  it('accepts the provider string form', () => {
    expect(fromMinorUnits('11700', 'USD')).toBe('117.00');
  });

  it('round-trips with toMinorUnits', () => {
    expect(fromMinorUnits(toMinorUnits('117.00', 'USD'), 'USD')).toBe('117.00');
    expect(fromMinorUnits(toMinorUnits('500000.00', 'VND'), 'VND')).toBe('500000.00');
  });
});

describe('toAmountValue', () => {
  it('formats 2dp for standard currencies (PayPal amount.value)', () => {
    expect(toAmountValue('117.00', 'USD')).toBe('117.00');
    expect(toAmountValue('117', 'USD')).toBe('117.00');
  });

  it('formats 0dp for zero-decimal currencies (PayPal rejects mismatched precision)', () => {
    expect(toAmountValue('500000.00', 'VND')).toBe('500000');
    expect(toAmountValue('1200', 'JPY')).toBe('1200');
  });

  it('rounds HALF_UP to the currency precision', () => {
    expect(toAmountValue('116.995', 'USD')).toBe('117.00');
    expect(toAmountValue('500000.5', 'VND')).toBe('500001');
  });
});

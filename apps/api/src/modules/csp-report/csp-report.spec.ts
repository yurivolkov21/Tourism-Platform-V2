import { appOf, CSP_DEDUPE_WINDOW_MS, CspReportDeduper, parseCspReports } from './csp-report.js';

// W4 C1 (ADR-0038 AMEND 2) — parse hai định dạng report CSP + dedupe log.

describe('parseCspReports', () => {
  it('application/csp-report (report-uri, khoá kebab-case) → một vi phạm', () => {
    const body = {
      'csp-report': {
        'document-uri': 'https://www.nexora-travel.agency/tours',
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js',
        'script-sample': 'alert(1)',
      },
    };
    expect(parseCspReports(body)).toEqual([
      {
        app: 'web',
        directive: 'script-src-elem',
        blockedUri: 'https://evil.example/x.js',
        documentUri: 'https://www.nexora-travel.agency/tours',
        sample: 'alert(1)',
      },
    ]);
  });

  it('application/reports+json (report-to, camelCase) → nhiều vi phạm, bỏ report không phải csp-violation', () => {
    const body = [
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://admin.nexora-travel.agency/reviews',
          effectiveDirective: 'connect-src',
          blockedURL: 'https://tracker.example/beacon',
        },
      },
      { type: 'deprecation', body: { id: 'x' } },
      'rác',
    ];
    expect(parseCspReports(body)).toEqual([
      {
        app: 'admin',
        directive: 'connect-src',
        blockedUri: 'https://tracker.example/beacon',
        documentUri: 'https://admin.nexora-travel.agency/reviews',
        sample: '',
      },
    ]);
  });

  it('body dị dạng / field sai kiểu → mảng rỗng hoặc chuỗi rỗng, KHÔNG throw; field dài bị cắt', () => {
    expect(parseCspReports(null)).toEqual([]);
    expect(parseCspReports('x')).toEqual([]);
    expect(parseCspReports({ khac: 1 })).toEqual([]);
    const long = parseCspReports({
      'csp-report': { 'violated-directive': 'a'.repeat(500), 'blocked-uri': 42 },
    })[0];
    expect(long?.directive).toHaveLength(200);
    expect(long?.blockedUri).toBe('');
    expect(long?.app).toBe('unknown');
  });
});

describe('appOf', () => {
  it('phân biệt web/admin/local theo hostname; URL rác → unknown', () => {
    expect(appOf('https://www.nexora-travel.agency/')).toBe('web');
    expect(appOf('https://admin.nexora-travel.agency/login')).toBe('admin');
    expect(appOf('http://localhost:3000/tours')).toBe('local');
    expect(appOf('not a url')).toBe('unknown');
  });
});

describe('CspReportDeduper', () => {
  const T0 = 1_757_000_000_000;
  const v = { directive: 'script-src', blockedUri: 'https://evil.example/x.js' };

  it('cùng (directive, blockedUri) chỉ log MỘT lần trong 10 phút', () => {
    const dedupe = new CspReportDeduper();
    expect(dedupe.shouldLog(v, T0)).toBe(true);
    expect(dedupe.shouldLog(v, T0 + 1000)).toBe(false);
    expect(dedupe.shouldLog(v, T0 + CSP_DEDUPE_WINDOW_MS - 1)).toBe(false);
    expect(dedupe.shouldLog(v, T0 + CSP_DEDUPE_WINDOW_MS)).toBe(true);
  });

  it('cặp khác nhau không đè cửa sổ của nhau', () => {
    const dedupe = new CspReportDeduper();
    expect(dedupe.shouldLog(v, T0)).toBe(true);
    expect(dedupe.shouldLog({ ...v, directive: 'img-src' }, T0)).toBe(true);
    expect(dedupe.shouldLog({ ...v, blockedUri: 'https://khac.example' }, T0)).toBe(true);
  });
});

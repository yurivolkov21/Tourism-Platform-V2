import {
  appOf,
  CSP_DEDUPE_WINDOW_MS,
  CspReportDeduper,
  isAllowedDocument,
  MAX_REPORTS_PER_REQUEST,
  parseCspReports,
  stripQuery,
} from './csp-report.js';

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

describe('parseCspReports — vòng vá review W4', () => {
  it('documentUri bỏ query/hash: token reset trên /reset-password?token= KHÔNG vào log', () => {
    const [v] = parseCspReports({
      'csp-report': {
        'document-uri': 'https://www.nexora-travel.agency/reset-password?token=SECRET#frag',
        'violated-directive': 'script-src',
        'blocked-uri': 'inline',
      },
    });
    expect(v?.documentUri).toBe('https://www.nexora-travel.agency/reset-password');
    expect(JSON.stringify(v)).not.toContain('SECRET');
  });

  it('reports+json chỉ xử lý tối đa MAX_REPORTS_PER_REQUEST entry', () => {
    const body = Array.from({ length: 500 }, (_, i) => ({
      type: 'csp-violation',
      body: {
        documentURL: 'https://www.nexora-travel.agency/',
        blockedURL: `https://e.example/${i}`,
      },
    }));
    expect(parseCspReports(body)).toHaveLength(MAX_REPORTS_PER_REQUEST);
  });

  it('stripQuery: URL rác → chuỗi rỗng', () => {
    expect(stripQuery('not a url')).toBe('');
  });
});

describe('isAllowedDocument', () => {
  const hosts = new Set(['www.nexora-travel.agency', 'admin.nexora-travel.agency']);
  it('chỉ nhận report có documentUri thuộc host hai app', () => {
    const ok = parseCspReports({
      'csp-report': { 'document-uri': 'https://www.nexora-travel.agency/tours' },
    })[0];
    const fake = parseCspReports({ 'csp-report': { 'document-uri': 'https://evil.example/x' } })[0];
    const none = parseCspReports({ 'csp-report': { 'violated-directive': 'img-src' } })[0];
    expect(ok && isAllowedDocument(ok, hosts)).toBe(true);
    expect(fake && isAllowedDocument(fake, hosts)).toBe(false);
    expect(none && isAllowedDocument(none, hosts)).toBe(false);
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
  const v = { app: 'web', directive: 'script-src', blockedUri: 'https://evil.example/x.js' };

  it('khoá dedupe gồm cả app — cùng cặp ở admin không bị web đè', () => {
    const dedupe = new CspReportDeduper();
    expect(dedupe.shouldLog(v, T0)).toBe(true);
    expect(dedupe.shouldLog({ ...v, app: 'admin' }, T0)).toBe(true);
  });

  it('có trần entry: chạm trần thì đuổi entry cũ, không phình vô hạn; đếm số bị nuốt', () => {
    const dedupe = new CspReportDeduper(CSP_DEDUPE_WINDOW_MS, 100);
    for (let i = 0; i < 1000; i++) dedupe.shouldLog({ ...v, blockedUri: `u${i}` }, T0);
    expect(dedupe.size).toBeLessThanOrEqual(100);
    dedupe.shouldLog(v, T0);
    dedupe.shouldLog(v, T0 + 1);
    dedupe.shouldLog(v, T0 + 2);
    expect(dedupe.drainSuppressed()).toBe(2);
    expect(dedupe.drainSuppressed()).toBe(0);
  });

  it('1000 lượt với 1000 khoá khác nhau không quét toàn Map (thời gian tuyến tính)', () => {
    const dedupe = new CspReportDeduper(CSP_DEDUPE_WINDOW_MS, 100_000);
    const start = performance.now();
    for (let i = 0; i < 20_000; i++) dedupe.shouldLog({ ...v, blockedUri: `u${i}` }, T0 + i);
    expect(performance.now() - start).toBeLessThan(500);
  });

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

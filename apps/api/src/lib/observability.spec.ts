import type { Breadcrumb, ErrorEvent, NodeOptions } from '@sentry/node';
import * as Sentry from '@sentry/node';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  onUnhandledRejectionIntegration: vi.fn((options: { mode: string }) => ({
    name: 'OnUnhandledRejection',
    options,
  })),
}));

const DSN = 'https://public@o1.ingest.sentry.io/1';

/**
 * ADR-0010 AMEND 1. Cờ "đã init" là state cấp module, nên mỗi test nạp lại module cho sạch.
 */
async function load() {
  vi.resetModules();
  return import('./observability.js');
}

/** Lấy options truyền cho `Sentry.init` ở lần gọi đầu. */
function initOptions() {
  const call = vi.mocked(Sentry.init).mock.calls[0];
  if (!call?.[0]) throw new Error('Sentry.init chưa được gọi');
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initObservability', () => {
  it('thiếu DSN: không init, captureException vẫn no-op như seam cũ', async () => {
    const { initObservability, captureException } = await load();
    expect(initObservability({ dsn: undefined, environment: 'production' })).toBe(false);
    captureException(new Error('boom'));
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('có DSN: init một lần, chỉ bắt lỗi (không tracing, không móc ESM, không PII mặc định)', async () => {
    const { initObservability } = await load();
    expect(initObservability({ dsn: DSN, environment: 'production' })).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = initOptions();
    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'production',
      sendDefaultPii: false,
      registerEsmLoaderHooks: false,
    });
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracesSampler).toBeUndefined();
    expect(options.includeLocalVariables).toBeUndefined();
  });

  it('sau init, captureException đẩy đúng lỗi lên Sentry', async () => {
    const { initObservability, captureException } = await load();
    initObservability({ dsn: DSN, environment: 'production' });
    const error = new TypeError('boom');
    captureException(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('promise bị reject không ai bắt vẫn làm tiến trình chết như Node (strict, không warn)', async () => {
    const { initObservability } = await load();
    initObservability({ dsn: DSN, environment: 'production' });
    const integrations = initOptions().integrations;
    if (typeof integrations !== 'function') throw new Error('integrations phải là hàm');
    const defaults = [
      { name: 'Http' },
      { name: 'OnUnhandledRejection', options: { mode: 'warn' } },
      { name: 'OnUncaughtException' },
    ] as unknown as Parameters<
      Extract<NodeOptions['integrations'], (...args: never[]) => unknown>
    >[0];
    const result = integrations(defaults) as unknown as { name: string; options?: unknown }[];
    expect(result.map((i) => i.name)).toEqual([
      'Http',
      'OnUnhandledRejection',
      'OnUncaughtException',
    ]);
    expect(result[1]?.options).toEqual({ mode: 'strict' });
  });
});

describe('scrubEvent', () => {
  it('request chỉ còn method và đường dẫn: bỏ query, header, cookie, body; bỏ user', async () => {
    const { scrubEvent } = await load();
    const event = {
      type: undefined,
      request: {
        method: 'POST',
        url: 'https://api.example.com/api/bookings/lookup?email=khach@example.com',
        query_string: 'email=khach@example.com',
        headers: { cookie: 'session=abc', authorization: 'Bearer x', 'user-agent': 'UA' },
        cookies: { session: 'abc' },
        data: { email: 'khach@example.com' },
        env: { REMOTE_ADDR: '1.2.3.4' },
      },
      user: { ip_address: '1.2.3.4', email: 'khach@example.com' },
    } as ErrorEvent;

    const scrubbed = scrubEvent(event);
    expect(scrubbed.request).toEqual({
      method: 'POST',
      url: 'https://api.example.com/api/bookings/lookup',
    });
    expect(scrubbed.user).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain('khach@example.com');
  });

  it('sự kiện không có request vẫn đi qua nguyên vẹn', async () => {
    const { scrubEvent } = await load();
    const event = { type: undefined, message: 'boom' } as ErrorEvent;
    expect(scrubEvent(event)).toEqual({ type: undefined, message: 'boom' });
  });
});

describe('dropConsoleBreadcrumb', () => {
  it('bỏ breadcrumb từ console (log có thể chở dữ liệu khách), giữ loại khác', async () => {
    const { dropConsoleBreadcrumb } = await load();
    const consoleCrumb: Breadcrumb = {
      category: 'console',
      message: 'gửi mail tới khach@example.com',
    };
    const httpCrumb: Breadcrumb = { category: 'http', data: { url: 'https://api.stripe.com' } };
    expect(dropConsoleBreadcrumb(consoleCrumb)).toBeNull();
    expect(dropConsoleBreadcrumb(httpCrumb)).toBe(httpCrumb);
  });
});

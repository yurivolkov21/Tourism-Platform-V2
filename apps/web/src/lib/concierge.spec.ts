import { APICallError, type UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { errorKind, toChatRequest, tourSlugFromPath } from './concierge';

const ID = '7f3c2a10-3b1e-4a5c-9d2f-0c8e4b6a1f00';

const user = (text: string): UIMessage => ({
  id: 'u1',
  role: 'user',
  parts: [{ type: 'text', text }],
});

function assistantWithEnquiry(state: 'approval-requested' | 'approval-responded'): UIMessage {
  const input = { name: 'An', email: 'an@example.com', message: 'Space for two?' };
  return {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Here is the card.' },
      state === 'approval-requested'
        ? {
            type: 'tool-submitEnquiry',
            toolCallId: 'c1',
            state,
            input,
            approval: { id: 'ap-1' },
          }
        : {
            type: 'tool-submitEnquiry',
            toolCallId: 'c1',
            state,
            input,
            approval: { id: 'ap-1', approved: false },
          },
    ],
  };
}

function apiError(statusCode: number, body: unknown): APICallError {
  const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new APICallError({
    message: responseBody,
    url: 'http://localhost:3001/api/chat',
    requestBodyValues: undefined,
    statusCode,
    responseBody,
  });
}

describe('toChatRequest', () => {
  it('tin cuối của khách → input chữ, kèm slug tour đang xem', () => {
    expect(toChatRequest([user('  Sa Pa in November?  ')], ID, 'sapa-trek')).toEqual({
      conversationId: ID,
      tourSlug: 'sapa-trek',
      input: { type: 'message', text: 'Sa Pa in November?' },
    });
  });

  it('không ở trang tour → không có khoá tourSlug', () => {
    expect(toChatRequest([user('Hi')], ID, null)).not.toHaveProperty('tourSlug');
  });

  it('nhiều phần chữ được nối lại', () => {
    const message: UIMessage = {
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'there' },
      ],
    };
    expect(toChatRequest([message], ID, null)?.input).toEqual({
      type: 'message',
      text: 'Hello\nthere',
    });
  });

  it('tin cuối là trả lời đã có quyết định duyệt → input approval', () => {
    const messages = [user('Send it'), assistantWithEnquiry('approval-responded')];
    expect(toChatRequest(messages, ID, null)?.input).toEqual({
      type: 'approval',
      approvalId: 'ap-1',
      approved: false,
    });
  });

  it('không có gì để gửi (trả lời còn chờ duyệt, hay rỗng) → null', () => {
    expect(toChatRequest([user('x'), assistantWithEnquiry('approval-requested')], ID, null)).toBe(
      null,
    );
    expect(toChatRequest([], ID, null)).toBeNull();
    expect(toChatRequest([user('   ')], ID, null)).toBeNull();
  });
});

describe('errorKind', () => {
  it.each([
    [409, { code: 'CHAT_BUSY' }, 'busy'],
    [409, { code: 'CHAT_TURN_LIMIT' }, 'turnLimit'],
    [503, { code: 'CHAT_UNAVAILABLE' }, 'unavailable'],
    [404, { code: 'CHAT_NOT_FOUND' }, 'expired'],
    [429, { code: 'TOO_MANY_REQUESTS' }, 'rateLimited'],
    [429, 'Too Many Requests', 'rateLimited'],
    [400, { code: 'INVALID_INPUT' }, 'generic'],
    [503, 'Service Unavailable', 'unavailable'],
    [500, { code: 'INTERNAL' }, 'generic'],
  ] as const)('%i %j → %s', (status, body, kind) => {
    expect(errorKind(apiError(status, body))).toBe(kind);
  });

  it('lỗi giữa stream hay lỗi mạng → generic', () => {
    expect(errorKind(new Error('Something went wrong.'))).toBe('generic');
    expect(errorKind(new TypeError('Failed to fetch'))).toBe('generic');
  });
});

describe('tourSlugFromPath', () => {
  it.each([
    ['/tours/ha-long-2d1n', 'ha-long-2d1n'],
    ['/tours/ha-long-2d1n/book', 'ha-long-2d1n'],
    ['/tours/ha-long-2d1n/enquire', 'ha-long-2d1n'],
  ])('%s → %s', (path, slug) => {
    expect(tourSlugFromPath(path)).toBe(slug);
  });

  it.each(['/', '/tours', '/tours/', '/blog/ha-long-2d1n', '/tours/Bad Slug', '/tours/%E0%A4%A'])(
    '%s → null',
    (path) => {
      expect(tourSlugFromPath(path)).toBeNull();
    },
  );
});

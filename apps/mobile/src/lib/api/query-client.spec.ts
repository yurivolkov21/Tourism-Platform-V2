import { ORPCError } from '@orpc/client';
import { queryClient, shouldRetryQuery } from './query-client';

describe('shouldRetryQuery', () => {
  // Tour đã gỡ, bài viết không tồn tại: gọi lại vẫn 404, chỉ bắt khách nhìn
  // vòng xoay thêm 1 + 2 + 4 giây trước khi thấy màn "không còn nữa".
  it('lỗi 4xx của server (404, 400, 403): không gọi lại', () => {
    expect(shouldRetryQuery(0, new ORPCError('NOT_FOUND', { status: 404, defined: true }))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ORPCError('BAD_REQUEST', { status: 400 }))).toBe(false);
    expect(shouldRetryQuery(0, new ORPCError('FORBIDDEN', { status: 403 }))).toBe(false);
  });

  it('401, 408, 429 vẫn gọi lại (phiên vừa nạp, hết giờ, hết lượt tạm thời)', () => {
    expect(shouldRetryQuery(0, new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe(true);
    expect(shouldRetryQuery(0, new ORPCError('TIMEOUT', { status: 408 }))).toBe(true);
    expect(shouldRetryQuery(0, new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBe(true);
  });

  // API trên Render ngủ dậy chậm: 502/503 và hết giờ chờ phải được thử lại.
  it('5xx và lỗi mạng: gọi lại như mặc định', () => {
    expect(shouldRetryQuery(0, new ORPCError('INTERNAL_SERVER_ERROR', { status: 500 }))).toBe(true);
    expect(shouldRetryQuery(1, new ORPCError('SERVICE_UNAVAILABLE', { status: 503 }))).toBe(true);
    expect(shouldRetryQuery(2, new TypeError('Network request failed'))).toBe(true);
  });

  it('giữ trần 3 lần thử lại của TanStack Query', () => {
    expect(shouldRetryQuery(2, new TypeError('Network request failed'))).toBe(true);
    expect(shouldRetryQuery(3, new TypeError('Network request failed'))).toBe(false);
  });

  it('là luật mặc định của mọi query trong app', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });
});

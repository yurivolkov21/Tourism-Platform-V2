import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import PostDetailRoute from '@/app/posts/[slug]';
import { renderWithTheme } from '@/test-utils';

jest.mock('@/lib/env', () => ({
  env: () => ({ apiUrl: 'http://api.test', webUrl: 'https://web.test' }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ slug: 'removed-story' }),
}));

const copy = messages.mobile.posts;
const clients: QueryClient[] = [];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

async function renderRoute(reply: Response) {
  globalThis.fetch = jest.fn(() => Promise.resolve(reply)) as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <PostDetailRoute />
    </QueryClientProvider>,
  );
}

describe('PostDetailRoute', () => {
  // Bài đã gỡ hoặc đổi slug (link cũ, bài liên quan của bản cache): báo bài
  // không còn, không mời "Try again" một lỗi 404 chắc chắn.
  it('POST_NOT_FOUND: màn "bài không còn" với nút quay lại, không có nút thử lại', async () => {
    await renderRoute(
      json(404, {
        defined: true,
        code: 'POST_NOT_FOUND',
        status: 404,
        message: 'Post not found',
      }),
    );

    expect(await screen.findByText(copy.notFound)).toBeTruthy();
    expect(screen.getByText(copy.goBack)).toBeTruthy();
    expect(screen.queryByText(copy.retry)).toBeNull();
  });

  it('lỗi server khác: vẫn là màn lỗi có nút thử lại', async () => {
    await renderRoute(
      json(500, {
        defined: false,
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: 'Internal server error',
      }),
    );

    expect(await screen.findByText(copy.errorDetail)).toBeTruthy();
    expect(screen.getByText(copy.retry)).toBeTruthy();
  });
});

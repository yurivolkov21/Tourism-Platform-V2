import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import EnquiryRoute from '@/app/enquiry';
import { renderWithTheme } from '@/test-utils';

jest.mock('@/lib/auth-client', () => ({
  getAuthClient: () => ({
    useSession: () => ({ data: { user: { id: 'u1', name: 'Lan N.', email: 'lan@example.com' } } }),
    getCookie: () => '',
  }),
}));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ tourSlug: 'test-tour', tripTitle: 'Test tour' }),
}));

const clients: QueryClient[] = [];
const copy = messages.mobile.enquiry;

beforeEach(() => {
  // Trang tour trả id để gắn vào enquiry; `enquiries.create` nhận đơn.
  globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = url.includes('/api/tours/') ? { id: 't1' } : { id: 'e1' };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as unknown as typeof fetch;
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

async function renderAndSend() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  await renderWithTheme(
    <QueryClientProvider client={client}>
      <EnquiryRoute />
    </QueryClientProvider>,
  );
  await fireEvent.changeText(
    screen.getByLabelText(copy.messageLabel),
    'Can we bring a stroller on this trip?',
  );
  await fireEvent.press(await screen.findByRole('button', { name: copy.submit }));
  await screen.findByText(copy.successTitle);
}

describe('EnquiryRoute — Back to tour sau khi gửi', () => {
  it('quay về trang tour có sẵn trong stack, không đẩy thêm một bản nữa đè lên màn đã gửi', async () => {
    await renderAndSend();

    await fireEvent.press(screen.getByRole('button', { name: copy.backToTour }));
    expect(router.dismissTo).toHaveBeenCalledWith('/tours/test-tour');
    expect(router.push).not.toHaveBeenCalled();
  });
});

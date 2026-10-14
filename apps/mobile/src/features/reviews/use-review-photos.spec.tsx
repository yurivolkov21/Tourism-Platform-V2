import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { messages } from '@tourism/i18n';
import * as ImagePicker from 'expo-image-picker';
import type { ReactNode } from 'react';
import { useReviewPhotos } from './use-review-photos';

// Không chạm SecureStore thật — cookie rỗng đủ cho link oRPC dựng header.
jest.mock('@/lib/auth-client', () => ({ getAuthClient: () => ({ getCookie: () => '' }) }));
jest.mock('@/lib/env', () => ({ env: () => ({ apiUrl: 'http://api.test' }) }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const clients: QueryClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

async function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useReviewPhotos('BK-TEST0001', messages.reviews.photos), { wrapper });
}

describe('useReviewPhotos', () => {
  // N7 (rà 07/10): bấm đúp nút chọn ảnh trước khi picker kịp mở là hai lời gọi picker chồng nhau.
  it('bấm đúp "Choose from library" trước khi picker kịp mở chỉ mở một picker', async () => {
    // Quyền về chậm: lượt bấm thứ hai tới đúng lúc lượt đầu còn chờ hệ điều hành.
    type Permission = Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>;
    let grant: (value: Permission) => void = () => {};
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReturnValue(
      new Promise<Permission>((resolve) => {
        grant = resolve;
      }),
    );
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null });
    const { result } = await setup();

    await act(async () => {
      const first = result.current.pickPhoto('library');
      const second = result.current.pickPhoto('library');
      grant({
        granted: true,
        status: 'granted',
        expires: 'never',
        canAskAgain: true,
      } as Permission);
      await Promise.all([first, second]);
    });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });
});

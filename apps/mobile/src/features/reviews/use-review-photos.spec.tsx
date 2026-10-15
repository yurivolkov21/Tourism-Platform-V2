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
  jest.clearAllMocks();
});

async function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useReviewPhotos('BK-TEST0001', messages.reviews.photos), { wrapper });
}

type Permission = Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>;
type PickerResult = Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>;

const DENIED = {
  granted: false,
  status: 'denied',
  expires: 'never',
  canAskAgain: false,
} as Permission;

describe('useReviewPhotos', () => {
  // N7 (rà 07/10): bấm đúp nút chọn ảnh trước khi picker kịp mở là hai lời gọi picker chồng nhau.
  it('bấm đúp "Choose from library" trước khi picker kịp mở chỉ mở một picker', async () => {
    // Picker về chậm: lượt bấm thứ hai tới đúng lúc lượt đầu còn chờ hệ điều hành.
    let close: (value: PickerResult) => void = () => {};
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockReturnValue(
      new Promise<PickerResult>((resolve) => {
        close = resolve;
      }),
    );
    const { result } = await setup();

    await act(async () => {
      const first = result.current.pickPhoto('library');
      const second = result.current.pickPhoto('library');
      close({ canceled: true, assets: null });
      await Promise.all([first, second]);
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  // F7 (review 06/10 ở màn Account, port sang ảnh review 15/10): picker của hệ điều hành chỉ trao
  // đúng ảnh khách chọn nên không cần quyền đọc thư viện. Khách đã bấm "Don't allow" vẫn chọn được.
  it('"Choose from library" mở thẳng picker, không xin quyền thư viện', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(DENIED);
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null });
    const { result } = await setup();

    await act(() => result.current.pickPhoto('library'));

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(result.current.sheetError).toBeNull();
  });

  it('camera bị từ chối thì báo lỗi, không mở camera, và câu lỗi chỉ đường sang thư viện', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue(DENIED);
    const { result } = await setup();

    await act(() => result.current.pickPhoto('camera'));

    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(result.current.sheetError).toBe(messages.reviews.photos.errPermission);
    expect(messages.reviews.photos.errPermission).toMatch(/library/);
    expect(messages.reviews.photos.errPermission).not.toMatch(/photo library access/);
  });
});

import type { MockSessionUser } from './types.js';

// Session mock cho navbar (static-first — thay bằng Better Auth client khi
// làm phase auth). null = chưa đăng nhập (navbar hiện nút "Log in").
// Muốn xem trạng thái ĐÃ đăng nhập (avatar + dropdown): gán MOCK_SESSION =
// SAMPLE_USER rồi save — hot reload sẽ đổi ngay.
export const SAMPLE_USER: MockSessionUser = {
  name: 'Minh Anh',
  email: 'minh.anh@example.com',
};

export const MOCK_SESSION: MockSessionUser | null = null;

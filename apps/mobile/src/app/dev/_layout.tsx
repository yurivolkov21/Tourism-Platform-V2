import { Stack } from 'expo-router';

/** Nhóm màn chỉ dành cho máy dev; không header, màn tự lo phần đầu trang. */
export default function DevLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

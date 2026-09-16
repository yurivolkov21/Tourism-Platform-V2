/**
 * Tách thành hàm để test thay được: `__DEV__` là hằng số do Metro nội tuyến ngay
 * lúc bundle, nên gán đè nó trong test là gán đè một chữ `true` đã nằm sẵn trong
 * mã — không ăn thua.
 */
export function isDevBuild(): boolean {
  return __DEV__;
}

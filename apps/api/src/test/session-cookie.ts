/**
 * Cặp `name=value` của cookie phiên better-auth trong `set-cookie` của một response `inject` —
 * thứ int spec gửi lại ở header `cookie` của request sau. Không có cookie phiên thì ném lỗi kèm
 * header thô, nên đăng nhập hỏng đỏ ngay ở bước lấy cookie chứ không trôi thành 401 khó hiểu.
 *
 * Helper cho int spec (open-items G2): 29 spec từng chép nguyên hàm này, nên better-auth đổi tên
 * cookie là 29 chỗ phải sửa. Như `open-transactions.ts`, thư mục này vẫn được build vào `dist` dù
 * không mã chạy thật nào import nó.
 */
export function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

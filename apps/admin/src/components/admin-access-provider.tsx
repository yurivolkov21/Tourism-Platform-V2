'use client';

import { type AdminProcedureKey, canAccess } from '@tourism/contract/admin-access';
import * as React from 'react';

/**
 * Role của phiên đang mở, cho component client hỏi "nút này có hiện không" (ADR-0052 §2).
 * CHỈ để gọn mắt — gác thật ở API (`@AdminImplement`).
 *
 * Vắng provider thì `useCanAccess` trả `true` (plan P4f, quyết định 3). Ở app thật provider
 * luôn có — layout `(admin)` bọc mọi trang; vắng chỉ xảy ra trong test. Mặc định ngược lại
 * (ẩn) sẽ lấy mất nút Refund của chính Owner nếu một ngày provider rơi khỏi cây, còn mặc
 * định này chỉ để Staff thấy một nút bấm vào ra 403.
 */
const RoleContext = React.createContext<string | null>(null);

export function AdminAccessProvider({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useCanAccess(key: AdminProcedureKey): boolean {
  const role = React.useContext(RoleContext);
  return role === null || canAccess(role, key);
}

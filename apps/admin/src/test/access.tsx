import type * as React from 'react';
import { AdminAccessProvider } from '@/components/admin-access-provider';

/**
 * Wrapper cho `render(ui, { wrapper: withRole('STAFF') })` (ADR-0052). Spec không bọc thì UI
 * hiện đủ nút như Owner (plan P4f, quyết định 3) — ca của Staff phải bọc tường minh.
 */
export function withRole(role: string) {
  return function RoleWrapper({ children }: { children: React.ReactNode }) {
    return <AdminAccessProvider role={role}>{children}</AdminAccessProvider>;
  };
}

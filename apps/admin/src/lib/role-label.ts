import { messages } from '@tourism/i18n';

/**
 * Nhãn của một role trên giao diện admin (ADR-0052 §1: enum giữ ADMIN, giao diện gọi là
 * Owner). File riêng CHỈ import i18n (plan P4f, quyết định 12): `nav-user` là chunk client
 * của mọi trang, lấy nhãn từ `lib/users-view.ts` sẽ kéo barrel contract theo.
 */
const ROLE_LABELS: Record<string, string> = messages.admin.users.roles;

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

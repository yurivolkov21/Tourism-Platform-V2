import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { INTERCEPTORS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ImplementInterceptor } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../generated/prisma/enums.js';
import { AdminActivityInterceptor } from '../modules/activity/admin-activity.interceptor.js';
import { AdminImplement, adminRolesFor } from './admin-implement.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * `@AdminImplement` = `@Implement` của oRPC + `@Roles` suy từ bảng quyền (ADR-0052 §3).
 * AuthGuard đọc metadata của handler TRƯỚC của class, nên dòng `@Roles` này là thứ quyết
 * định; `@Roles(ADMIN)` cấp class chỉ còn là lưới cho handler quên đổi decorator.
 */
class Probe {
  // Handler không bao giờ được gọi — `never` thoả kiểu trả về mà `@Implement` đòi.
  @AdminImplement(contract.admin.bookings.refund)
  refund(): never {
    throw new Error('probe');
  }

  @AdminImplement(contract.admin.bookings.list)
  list(): never {
    throw new Error('probe');
  }
}

describe('AdminImplement', () => {
  it('khoá owner → chỉ ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.refund)).toEqual([UserRole.ADMIN]);
  });

  it('khoá staff → ADMIN và STAFF', () => {
    expect(Reflect.getMetadata(ROLES_KEY, Probe.prototype.list)).toEqual([
      UserRole.ADMIN,
      UserRole.STAFF,
    ]);
  });

  it('vẫn gắn route của contract — Implement chạy thật, không bị thay', () => {
    expect(Reflect.getMetadata(PATH_METADATA, Probe.prototype.list)).toBe('/api/admin/bookings');
    expect(Reflect.getMetadata(METHOD_METADATA, Probe.prototype.list)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, Probe.prototype.refund)).toBe(
      '/api/admin/bookings/:code/refund',
    );
  });

  it('thủ tục `log` → interceptor nhật ký nằm TRONG ImplementInterceptor, mang đúng khoá (ADR-0061 §3)', () => {
    const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, Probe.prototype.refund);
    expect(interceptors).toHaveLength(2);
    // Nest chạy interceptor đầu mảng ở NGOÀI cùng: ImplementInterceptor phải đứng trước để
    // `next.handle()` của nó phát ra procedure ĐÃ nối middleware nhật ký.
    expect(interceptors[0]).toBe(ImplementInterceptor);
    expect(interceptors[1]).toBeInstanceOf(AdminActivityInterceptor);
    expect((interceptors[1] as AdminActivityInterceptor).key).toBe('bookings.refund');
  });

  it('thủ tục `skip` (chỉ đọc) → không gắn interceptor nhật ký', () => {
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, Probe.prototype.list)).toEqual([
      ImplementInterceptor,
    ]);
  });

  it('thủ tục ngoài contract.admin → ném ngay lúc khai, không lặng lẽ thành Owner-only', () => {
    expect(() => adminRolesFor(contract.catalog.tours.list)).toThrow(
      'AdminImplement chỉ nhận thủ tục thuộc contract.admin',
    );
  });
});

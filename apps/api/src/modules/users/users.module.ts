import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * Vùng Users của admin (P4f, ADR-0052) — chỉ đường admin. Khách tự quản tài khoản của mình
 * ở `AuthModule` (`account.*`), không qua đây.
 */
@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class UsersModule {}

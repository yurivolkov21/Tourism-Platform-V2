import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AccountAvatarController } from './account-avatar.controller.js';
import { AdminReconcileService } from './admin-reconcile.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  controllers: [AuthController, AccountController, AccountAvatarController],
  providers: [AccountService, AuthGuard, AdminReconcileService],
  exports: [AuthGuard],
})
export class AuthModule {}

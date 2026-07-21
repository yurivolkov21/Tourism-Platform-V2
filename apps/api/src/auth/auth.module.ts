import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AdminReconcileService } from './admin-reconcile.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  controllers: [AuthController, AccountController],
  providers: [AccountService, AuthGuard, AdminReconcileService],
  exports: [AuthGuard],
})
export class AuthModule {}

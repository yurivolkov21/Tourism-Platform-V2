import { Module } from '@nestjs/common';
import { CspReportController } from './csp-report.controller.js';

/** W4 C1 (ADR-0038 AMEND 2): tai nghe CSP của cả hai app — chỉ một controller. */
@Module({ controllers: [CspReportController] })
export class CspReportModule {}

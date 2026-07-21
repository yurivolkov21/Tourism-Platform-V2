import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { SiteMediaService } from './site-media.service.js';

// Brand-chrome media (spec P3a-C W6): khách chưa đăng nhập cũng cần thấy
// hero/cta-band trên web public. AuthGuard toàn cục nên thiếu @Public() là
// 401 chết cả trang chủ (ADR-0003).
@Public()
@Controller()
export class SiteMediaController {
  constructor(private readonly siteMedia: SiteMediaService) {}

  @Implement(contract.siteMedia.list)
  list() {
    return implement(contract.siteMedia.list).handler(() => this.siteMedia.listSiteMedia());
  }
}

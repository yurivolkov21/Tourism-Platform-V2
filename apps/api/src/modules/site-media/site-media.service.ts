import { Injectable } from '@nestjs/common';
import type { SiteMediaEntry } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';

@Injectable()
export class SiteMediaService {
  constructor(private readonly media: MediaService) {}

  /** Chỉ trả slot CÓ media (ADR-0005). Owner của asset là slot.id (ownerType SITE). */
  async listSiteMedia(): Promise<SiteMediaEntry[]> {
    const slots = await prisma.siteMediaSlot.findMany();
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.SITE,
      slots.map((s) => s.id),
    );
    return slots
      .map((s) => ({ key: s.key, media: mediaMap.get(s.id) ?? [] }))
      .filter((e) => e.media.length > 0);
  }
}

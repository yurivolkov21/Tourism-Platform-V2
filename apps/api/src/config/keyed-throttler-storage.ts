import type { ThrottlerStorage } from '@nestjs/throttler';

/** Bản ghi mà `ThrottlerGuard.handleRequest` đọc — thư viện không re-export interface này. */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Storage in-memory cho throttler, KEYED THEO TỪNG KEY (ADR-0037 AMEND 1).
 *
 * Vì sao không dùng `ThrottlerStorageService` mặc định của @nestjs/throttler
 * 6.5.0: nó giữ timer giảm-hit trong một Map keyed theo TÊN throttler
 * (`'default'`), và khi MỘT key hết thời gian block, `resetBlockdRequest` gọi
 * `clearExpirationTimes('default')` — xoá timer của MỌI key cùng tên. Từ đó
 * `totalHits` của mọi user/route khác đóng băng, khách ghi rải rác vẫn chạm
 * trần. ADR-0037 gom mọi route ghi vào đúng một throttler tên `default` và
 * bật block 60s thật, tức nhánh lỗi đó chắc chắn chạy (vòng vá review W2).
 *
 * Thuật toán: cửa sổ trượt theo dấu thời gian — mỗi key giữ mảng mốc hit
 * trong `ttl` gần nhất + mốc hết block. Không có timer, không có gì dùng
 * chung giữa các key. Vẫn per-process (numInstances 1, ADR-0024 AMEND 2).
 */
interface Bucket {
  hits: number[];
  blockedUntil: number;
}

export class KeyedThrottlerStorage implements ThrottlerStorage {
  private readonly buckets = new Map<string, Bucket>();

  /** Cho test reset giữa các ca (cùng tên `storage` với service mặc định). */
  get storage(): Map<string, Bucket> {
    return this.buckets;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { hits: [], blockedUntil: 0 };
    bucket.hits = bucket.hits.filter((at) => at > now - ttl);

    if (bucket.blockedUntil > now) {
      this.buckets.set(key, bucket);
      return {
        totalHits: bucket.hits.length,
        timeToExpire: secondsUntil(bucket.hits[0], ttl, now),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((bucket.blockedUntil - now) / 1000),
      };
    }

    bucket.hits.push(now);
    const isBlocked = bucket.hits.length > limit;
    if (isBlocked) bucket.blockedUntil = now + blockDuration;
    this.buckets.set(key, bucket);
    return {
      totalHits: bucket.hits.length,
      timeToExpire: secondsUntil(bucket.hits[0], ttl, now),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }
}

/** Giây còn lại tới khi hit CŨ NHẤT rời cửa sổ — cho header `X-RateLimit-Reset`. */
function secondsUntil(oldest: number | undefined, ttl: number, now: number): number {
  if (oldest === undefined) return Math.ceil(ttl / 1000);
  return Math.max(0, Math.ceil((oldest + ttl - now) / 1000));
}

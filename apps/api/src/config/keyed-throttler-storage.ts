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

/** Trần số bucket sống — chạm là quét dọn, vẫn quá thì đuổi cũ nhất (vòng vá review W4). */
export const MAX_BUCKETS = 50_000;
/** Mỗi N lần increment quét dọn bucket rỗng/hết block một lượt (khấu hao). */
const SWEEP_EVERY = 1_000;

export class KeyedThrottlerStorage implements ThrottlerStorage {
  private readonly buckets = new Map<string, Bucket>();
  private increments = 0;

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
    // Dọn khấu hao (vòng vá review W4): từ W4 mỗi IP ĐỌC là một key — không
    // xoá thì Map phình đơn điệu suốt vòng đời process (Render 512 MB, worker
    // inline chung tiến trình).
    if (++this.increments % SWEEP_EVERY === 0 || this.buckets.size >= MAX_BUCKETS) {
      this.sweep(now, ttl);
    }
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

  /** Xoá bucket không còn hit trong cửa sổ và hết block; vẫn quá trần → đuổi cũ nhất. */
  private sweep(now: number, ttl: number): void {
    for (const [key, bucket] of this.buckets) {
      const alive = bucket.hits.some((at) => at > now - ttl);
      if (!alive && bucket.blockedUntil <= now) this.buckets.delete(key);
    }
    if (this.buckets.size < MAX_BUCKETS) return;
    let n = Math.floor(MAX_BUCKETS / 10);
    for (const key of this.buckets.keys()) {
      this.buckets.delete(key);
      if (--n === 0) break;
    }
  }
}

/** Giây còn lại tới khi hit CŨ NHẤT rời cửa sổ — cho header `X-RateLimit-Reset`. */
function secondsUntil(oldest: number | undefined, ttl: number, now: number): number {
  if (oldest === undefined) return Math.ceil(ttl / 1000);
  return Math.max(0, Math.ceil((oldest + ttl - now) / 1000));
}

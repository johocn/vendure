import { RangeBucket } from '../telemetry.types';
/**
 * Converts an exact count to a range bucket for privacy.
 * This prevents exposing exact entity counts while still
 * providing useful aggregate data.
 */
export declare function toRangeBucket(count: number): RangeBucket;

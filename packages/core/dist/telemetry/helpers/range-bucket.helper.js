"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRangeBucket = toRangeBucket;
/**
 * Converts an exact count to a range bucket for privacy.
 * This prevents exposing exact entity counts while still
 * providing useful aggregate data.
 */
function toRangeBucket(count) {
    if (count === 0)
        return '0';
    if (count <= 100)
        return '1-100';
    if (count <= 1000)
        return '101-1k';
    if (count <= 10000)
        return '1k-10k';
    if (count <= 100000)
        return '10k-100k';
    return '100k+';
}
//# sourceMappingURL=range-bucket.helper.js.map
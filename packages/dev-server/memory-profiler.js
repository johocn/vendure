"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileMemory = profileMemory;
/* eslint-disable */
/**
 * Used to profile peak memory usage for perf optimization purposes
 *
 * Add it to the index.ts or index-worker.ts:
 * ```ts
 * import { profileMemory } from './memory-profiler';
 *
 * profileMemory();
 * ```
 */
function profileMemory() {
    let max = 0;
    setInterval(() => {
        const rss = process.memoryUsage().rss;
        if (max < rss) {
            max = rss;
            console.log(`Peak: ${inMb(max)}`);
        }
    }, 500);
}
function inMb(bytes) {
    return `${Math.round((bytes / 1024 / 1024) * 100) / 100}MB;`;
}
//# sourceMappingURL=memory-profiler.js.map
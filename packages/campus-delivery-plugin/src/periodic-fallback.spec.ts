import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodicFallback } from './periodic-fallback';

describe('PeriodicFallback（后台兜底统一语义）', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('bootDelayMs 前不跑，到点首跑；此后按 intervalMs 轮询', async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000, bootDelayMs: 30_000 });
        loop.start(task);

        await vi.advanceTimersByTimeAsync(29_000);
        expect(task).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(task).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(2);
        loop.stop();
    });

    it('未配置 bootDelayMs → 首轮在 intervalMs 之后（不额外早跑）', async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000 });
        loop.start(task);

        await vi.advanceTimersByTimeAsync(59_000);
        expect(task).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(task).toHaveBeenCalledTimes(1);
        loop.stop();
    });

    it('start 幂等：重复调用不叠加定时器', async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000, bootDelayMs: 30_000 });
        loop.start(task);
        loop.start(task);
        loop.start(task);

        await vi.advanceTimersByTimeAsync(30_000);
        expect(task).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(2);
        loop.stop();
    });

    it('单飞：上一轮未结束 → 本轮跳过，不并发堆叠', async () => {
        let release!: () => void;
        const task = vi.fn().mockImplementation(() => new Promise<void>(r => { release = r; }));
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000 });
        loop.start(task);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000); // 第一轮仍挂着
        expect(task).toHaveBeenCalledTimes(1);
        release();
        await vi.advanceTimersByTimeAsync(0); // 释放 running 标记
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(2);
        loop.stop();
    });

    it('异常隔离：本轮异常只记日志，下一轮继续', async () => {
        const task = vi.fn()
            .mockRejectedValueOnce(new Error('db down'))
            .mockResolvedValue(undefined);
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000 });
        loop.start(task);

        await vi.advanceTimersByTimeAsync(60_000); // 不抛出即通过
        expect(task).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(2);
        loop.stop();
    });

    it('stop 后不再触发，且可重新 start', async () => {
        const task = vi.fn().mockResolvedValue(undefined);
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000 });
        loop.start(task);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(1);

        loop.stop();
        await vi.advanceTimersByTimeAsync(30 * 60_000);
        expect(task).toHaveBeenCalledTimes(1);
        expect(loop.started).toBe(false);

        loop.start(task);
        expect(loop.started).toBe(true);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(task).toHaveBeenCalledTimes(2);
        loop.stop();
    });

    it('trigger 手动触发一轮，且与定时轮共享单飞保护', async () => {
        let release!: () => void;
        const task = vi.fn().mockImplementation(() => new Promise<void>(r => { release = r; }));
        const loop = new PeriodicFallback({ name: 't', intervalMs: 60_000 });
        loop.start(task);

        void loop.trigger();
        expect(task).toHaveBeenCalledTimes(1);
        await loop.trigger(); // 第一轮未结束 → 立即返回，不再并发执行
        expect(task).toHaveBeenCalledTimes(1);
        release();
        await vi.advanceTimersByTimeAsync(0); // 释放 running 标记
        void loop.trigger();
        expect(task).toHaveBeenCalledTimes(2);
        release();
        await vi.advanceTimersByTimeAsync(0);
        loop.stop();
    });
});

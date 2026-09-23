import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { StocktakeTask } from './stocktake-task.entity';
import { StocktakeWave } from './stocktake-wave.entity';
import { StocktakeLine } from './stocktake-line.entity';

const storage = getMetadataArgsStorage();

function columns(target: Function): string[] {
    return storage.columns
        .filter((c) => (c.target as unknown) === target)
        .map((c) => c.propertyName);
}
function uniques(target: Function): string[][] {
    return storage.uniques
        .filter((u) => (u.target as unknown) === target)
        .map((u) => (u.columns as string[]).slice().sort());
}
function indices(target: Function): string[][] {
    return storage.indices
        .filter((i) => (i.target as unknown) === target)
        .map((i) => (i.columns as string[]).slice().sort());
}
function has(list: string[][], target: string[]): boolean {
    const want = target.slice().sort().join('|');
    return list.some((c) => c.join('|') === want);
}

describe('盘库三表实体约束', () => {
    it('stocktake_task 关键列齐备且 (tenantChannelId, code) 唯一', () => {
        const cols = columns(StocktakeTask);
        for (const c of [
            'code', 'tenantChannelId', 'stockLocationId', 'activityCode', 'name',
            'scopeJson', 'binModeAtCreate', 'state', 'createdById', 'createdByName',
            'postedStockDocId', 'postedAt', 'note',
        ]) {
            expect(cols).toContain(c);
        }
        expect(has(uniques(StocktakeTask), ['tenantChannelId', 'code'])).toBe(true);
    });

    it('stocktake_wave 关键列齐备且按 taskId 建索引', () => {
        const cols = columns(StocktakeWave);
        for (const c of [
            'tenantChannelId', 'taskId', 'scopeType', 'zoneId', 'zoneCode', 'zoneName',
            'assigneeId', 'assigneeName', 'state', 'expectedCount', 'countedCount',
            'claimedAt', 'submittedAt',
        ]) {
            expect(cols).toContain(c);
        }
        expect(has(indices(StocktakeWave), ['taskId'])).toBe(true);
    });

    it('stocktake_line 关键列与三个索引齐备', () => {
        const cols = columns(StocktakeLine);
        for (const c of [
            'tenantChannelId', 'taskId', 'waveId', 'variantId', 'variantSku', 'variantName',
            'zoneId', 'binId', 'zoneCode', 'binCode', 'bookQty', 'countedQty',
            'isExtra', 'countedById', 'countedByName', 'countedAt', 'note',
        ]) {
            expect(cols).toContain(c);
        }
        const idx = indices(StocktakeLine);
        expect(has(idx, ['taskId', 'waveId'])).toBe(true);
        expect(has(idx, ['waveId', 'countedQty'])).toBe(true);
        expect(has(idx, ['taskId', 'variantId'])).toBe(true);
    });

    it('stocktake_line 唯一约束防同盘次同变体同库位重复行', () => {
        expect(has(uniques(StocktakeLine), ['taskId', 'waveId', 'variantId', 'binId'])).toBe(true);
    });
});
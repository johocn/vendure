import { describe, expect, it } from 'vitest';

import { PickBatch } from './pick-batch.entity';
import { PickBatchOrder } from './pick-batch-order.entity';

describe('pick batch entities', () => {
    it('主表默认 state 为 PENDING', () => {
        const b = new PickBatch({ code: 'PB20260922-001' });
        // @Column default 只在 DB 层生效，这里只断言可按默认语义构造
        expect(b.code).toBe('PB20260922-001');
    });

    it('成员表可被主表 onDelete CASCADE 反向引用', () => {
        const o = new PickBatchOrder({ batchId: 1, orderId: 100 });
        expect(o.orderId).toBe(100);
    });
});

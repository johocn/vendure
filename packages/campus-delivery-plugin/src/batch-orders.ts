/**
 * 工作台批量接单 / 批量出餐（§73）：纯函数入参清洗，供 service 与单测共用。
 * 只做「选单集合」的规范化（去空、去重、上限），逐单流转仍走既有单笔状态机，
 * 因此批量失败可从断点继续，不会出现「一半成功一半被整体回滚」。
 */

/** 单次批量上限：后台多选与后端闸门同口径，超出请分批（一次 50 单足够覆盖饭点高峰） */
export const BATCH_ORDER_MAX = 50;

/** 入参不合规（空集合 / 超上限）：由 service 转成 UserInputError 回给后台 */
export class BatchOrderInputError extends Error {}

/**
 * 清洗批量订单 ID：支持数组或单个值，去空白、去重（保持后台勾选顺序），
 * 空集合或超上限抛 BatchOrderInputError。
 */
export function normalizeBatchOrderIds(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];
    const ids = [...new Set(list.map(v => String(v ?? '').trim()).filter(v => v !== ''))];
    if (!ids.length) throw new BatchOrderInputError('请选择要操作的订单');
    if (ids.length > BATCH_ORDER_MAX) {
        throw new BatchOrderInputError(`单次最多批量操作 ${BATCH_ORDER_MAX} 单，请分批处理`);
    }
    return ids;
}

/** 逐单操作结果：成功计数 + 失败明细（失败单跳过、继续处理后续单） */
export interface BatchOrderResult {
    ok: number;
    failed: { orderId: string; message: string }[];
}

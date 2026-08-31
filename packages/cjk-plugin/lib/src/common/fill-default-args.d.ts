export interface OperationArgValue {
    name: string;
    value: string;
}
export interface OperationInput {
    code: string;
    arguments: OperationArgValue[];
}
export interface OperationArgsDefLike {
    code: string;
    args: Record<string, {
        defaultValue?: unknown;
    } | undefined>;
}
/**
 * 把 operation（checker/handler）按定义补全缺失参数的 defaultValue。
 * - 幂等：只补缺失项，已传值不覆盖。
 * - 定义中无 defaultValue 且未传的参数不补，保持原样。
 * - 查不到对应 code 的定义时原样返回。
 */
export declare function fillDefaultArgs<T extends OperationInput | null | undefined>(operation: T, defs: ReadonlyArray<OperationArgsDefLike>): OperationInput | null;

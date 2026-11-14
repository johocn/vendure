import { ValueTransformer } from 'typeorm';

/**
 * Postgres 驱动会把 bigint 列读成字符串（MySQL/SQLite 返回 number），
 * 导致同一份金额在实体/service/API 层类型不一致。统一在读取时转成 number。
 * 金额单位为分，远小于 2^53，不存在精度风险。
 */
export const bigintToNumber: ValueTransformer = {
    to: (value?: number | null) => value,
    from: (value?: string | number | null) => (value == null ? value : Number(value)),
};

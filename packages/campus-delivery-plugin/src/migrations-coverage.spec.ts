// 防回归（审计报告 F11 衍生）：生产 DB_SYNC=0，实体/自定义字段新增列若只靠开发环境同步、
// 没进迁移，灾备重建或新环境会直接报 column does not exist。这里做静态差集检查：
// 1) 所有 @Column 声明的实体列，必须出现在建表 SQL 或某条 ADD COLUMN 中；
// 2) Channel 自定义字段必须有对应物理列的 ADD COLUMN。
// 只做静态文本比对，不需要数据库。
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = __dirname;
const MIGRATIONS_DIR = join(SRC_DIR, 'migrations');
const MIGRATIONS_SQL_DIR = join(SRC_DIR, '..', 'migrations');

/** 实体基类列由 VendureEntity 提供，所有建表 SQL 都已包含，无需在此重复校验 */
const BASE_COLUMNS = new Set(['id', 'createdAt', 'updatedAt']);

function readAllSql(): string {
    const parts: string[] = [];
    for (const file of readdirSync(MIGRATIONS_DIR)) {
        if (file.endsWith('.ts')) parts.push(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
    if (existsSync(MIGRATIONS_SQL_DIR)) {
        for (const file of readdirSync(MIGRATIONS_SQL_DIR)) {
            if (file.endsWith('.sql')) parts.push(readFileSync(join(MIGRATIONS_SQL_DIR, file), 'utf8'));
        }
    }
    return parts.join('\n');
}

/** 建表语句中声明的列（类型用 parenless/含括号的 varchar(255) 均可识别） */
function createTableColumns(sql: string): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    const re = /CREATE TABLE (?:IF NOT EXISTS )?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\);/gi;
    for (const m of sql.matchAll(re)) {
        const set = map.get(m[1]) ?? new Set<string>();
        for (const fragment of m[2].split(/,\s*|\n/)) {
            const fm = /^\s*"?([A-Za-z_][\w$]*)"?\s+[A-Za-z]/.exec(fragment);
            if (!fm) continue;
            if (/^(UNIQUE|PRIMARY|CONSTRAINT|FOREIGN|CHECK|KEY)$/i.test(fm[1])) continue;
            set.add(fm[1]);
        }
        map.set(m[1], set);
    }
    return map;
}

/** 后续 ALTER 补的列 */
function alteredColumns(sql: string): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    const re = /ALTER TABLE\s+"?([a-z_][a-z0-9_]*)"?\s+ADD COLUMN IF NOT EXISTS\s+"?([A-Za-z_][\w$]*)"?/gi;
    for (const m of sql.matchAll(re)) {
        const set = map.get(m[1]) ?? new Set<string>();
        set.add(m[2]);
        map.set(m[1], set);
    }
    return map;
}

/** 扫描 @Column 装饰器（支持跨行 options），返回其后的属性名 */
function columnProperties(src: string): string[] {
    const out: string[] = [];
    const deco = /@Column\(/g;
    let m: RegExpExecArray | null;
    while ((m = deco.exec(src))) {
        let i = m.index + m[0].length;
        let depth = 1;
        while (i < src.length && depth > 0) {
            if (src[i] === '(') depth++;
            else if (src[i] === ')') depth--;
            i++;
        }
        // 跳过装饰器与属性之间的空白 / 行注释 / 块注释
        const rest = src.slice(i).replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '');
        const pm = /^([A-Za-z_$][\w$]*)\s*[!?]?\s*:/.exec(rest);
        if (pm) out.push(pm[1]);
    }
    return out;
}

function entityTableName(src: string): string {
    const m = /export class ([A-Za-z_$][\w$]*) extends/.exec(src);
    if (!m) throw new Error('entity class not found');
    return m[1]
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

function channelCustomColumns(): string[] {
    const src = readFileSync(join(SRC_DIR, 'custom-fields.ts'), 'utf8');
    const start = src.indexOf('Channel: [');
    expect(start).toBeGreaterThan(-1);
    const productStart = src.indexOf('Product: [', start);
    const block = src.slice(start, productStart);
    return [...block.matchAll(/name:\s*'([^']+)'/g)].map(
        m => `customFields${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()}`,
    );
}

describe('迁移列覆盖（防 F11 类缺列回归）', () => {
    const sql = readAllSql();
    const created = createTableColumns(sql);
    const altered = alteredColumns(sql);
    const covered = (table: string, column: string) =>
        (created.get(table)?.has(column) ?? false) || (altered.get(table)?.has(column) ?? false);

    it('实体 @Column 均有建表或 ADD COLUMN 覆盖', () => {
        const missing: string[] = [];
        for (const file of readdirSync(SRC_DIR)) {
            if (!file.endsWith('.entity.ts')) continue;
            const src = readFileSync(join(SRC_DIR, file), 'utf8');
            const table = entityTableName(src);
            for (const column of columnProperties(src)) {
                if (BASE_COLUMNS.has(column)) continue;
                if (!covered(table, column)) missing.push(`${table}.${column}`);
            }
        }
        expect(missing, `以下列在迁移中缺失：\n${missing.join('\n')}`).toEqual([]);
    });

    it('Channel 自定义字段均有物理列迁移', () => {
        const missing = channelCustomColumns().filter(col => !covered('channel', col));
        expect(missing, `以下 Channel 自定义字段列在迁移中缺失：\n${missing.join('\n')}`).toEqual([]);
    });
});

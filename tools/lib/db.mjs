/**
 * 数据库操作：psql 执行、幂等 seed、备份、加字段、SKU 档案匹配。
 */
import { writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sshExec, runSqlFileInContainer, checkPgDump } from './ssh.mjs';
import { config } from '../dbtool.config.mjs';

/** 执行任意 SQL（字符串），写入临时文件后走标准管道。返回 stdout。 */
export function runQuery(sql) {
    const tmp = join(process.cwd(), `.dbtool_tmp_${Date.now()}.sql`);
    writeFileSync(tmp, sql, 'utf8');
    try {
        const { stdout } = runSqlFileInContainer(tmp);
        return stdout;
    } finally {
        try { unlinkSync(tmp); } catch { /* ignore */ }
    }
}

/** 执行本地 SQL 文件（标准管道）。 */
export function runSqlFile(localFile) {
    const { stdout } = runSqlFileInContainer(localFile);
    return stdout;
}

/** 建 dbtool_seed_log 表（幂等）。 */
export function ensureSeedLog() {
    const sql = `CREATE TABLE IF NOT EXISTS dbtool_seed_log (
        script_name text PRIMARY KEY,
        run_at timestamptz DEFAULT now()
    );`;
    runQuery(sql);
}

function seedLogExists(name) {
    const out = runQuery(
        `SELECT CASE WHEN EXISTS(SELECT 1 FROM dbtool_seed_log WHERE script_name = '${name.replace(/'/g, "''")}') THEN 'TRUE' ELSE 'FALSE' END AS "exists";`,
    );
    // 解析出值单元格（忽略标题、分隔行、(N rows) 汇总行）
    const cells = out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^[-+ ]+$/.test(l) && !/^\(\d+ rows\)$/.test(l) && !/^exists$/.test(l));
    return cells.some((c) => c === 'TRUE');
}

function markSeedRun(name) {
    runQuery(`INSERT INTO dbtool_seed_log (script_name) VALUES ('${name.replace(/'/g, "''")}');`);
}

/** 批量执行目录下种子脚本（幂等）。 */
export function runSeedDir(dir) {
    if (!existsSync(dir)) throw new Error(`目录不存在: ${dir}`);
    ensureSeedLog();
    const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.sql')).sort();
    if (files.length === 0) throw new Error(`无 .sql 文件: ${dir}`);

    const results = [];
    for (const f of files) {
        const abs = join(dir, f);
        const name = basename(f);
        if (seedLogExists(name)) {
            results.push({ name, status: 'skipped' });
            console.log(`[seed] 跳过(已执行): ${name}`);
            continue;
        }
        console.log(`[seed] 执行: ${name} ...`);
        try {
            runSqlFileInContainer(abs);
            markSeedRun(name);
            results.push({ name, status: 'done' });
            console.log(`[seed] 完成: ${name}`);
        } catch (e) {
            results.push({ name, status: 'failed', error: e.message });
            console.error(`[seed] 失败: ${name}: ${e.message}`);
            throw new Error(`seed 中止于 ${name}，修复后重跑该脚本即可`);
        }
    }
    return results;
}

/** 列出核心表的结构与行数。 */
export function listTables() {
    const tables = [
        'payment_method', 'payment_profile', 'payment_profile_payment_methods_payment_method',
        'payment_profile_channels_channel', 'product', 'product_variant', 'channel',
        'product_variant_price', 'product_variant_translation',
    ];
    const sql = tables.map((t) => `SELECT '${t}' AS table_name, count(*) AS rows FROM ${t};\n`).join('');
    return runQuery(sql);
}

/** 备份指定表（结构+数据）到本地 tools/backups/。 */
export function backupTable(table, backupDir) {
    if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error(`非法表名: ${table}`);
    if (!checkPgDump()) throw new Error('容器内无 pg_dump，无法备份');
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const localFile = join(backupDir, `${table}_${stamp}.sql`);
    const stamp2 = Date.now();
    const containerOut = `/tmp/dbtool_bak_${stamp2}.sql`;
    const serverTmp = `/tmp/dbtool_bak_${stamp2}.sql`;
    try {
        sshExec(`docker exec ${config.container} sh -c 'pg_dump -U ${config.user} -d ${config.db} -t ${table} -f ${containerOut}'`);
        sshExec(`docker cp ${config.container}:${containerOut} ${serverTmp}`);
        execFileSync('scp', [`${config.sshAlias}:${serverTmp}`, localFile], { encoding: 'utf8' });
        return localFile;
    } finally {
        sshExec(`docker exec ${config.container} rm -f ${containerOut}`);
        sshExec(`rm -f ${serverTmp}`);
    }
}

/** 业务表加列（幂等）。返回执行的 SQL。 */
export function addColumn(table, col, type, { dryRun = false } = {}) {
    if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error(`非法表名: ${table}`);
    if (!/^[a-zA-Z0-9_]+$/.test(col)) throw new Error(`非法列名: ${col}`);
    const sql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col}" ${type};`;
    if (dryRun) {
        console.log(`[dry-run] ${sql}`);
        return sql;
    }
    const out = runQuery(sql);
    console.log(out || `已加列: ${table}.${col}`);
    return sql;
}

/** 按 SKU 前缀匹配支付档案并打标签。 */
export function assignPaymentProfile({ dryRun = false, csvFile = null } = {}) {
    const profilesRaw = runQuery(`SELECT code, id FROM payment_profile;`);
    const profiles = parseSimpleTable(profilesRaw);
    if (profiles.length === 0) throw new Error('payment_profile 表为空，请先创建支付档案');

    const rules = [
        { prefix: 'cake-', code: 'cake-cod-profile' },
        { prefix: 'vegetable-', code: 'veg-wechatpay-profile' },
    ];

    const csvMap = {};
    if (csvFile) {
        const content = readFileSync(csvFile, 'utf8').trim();
        for (const line of content.split('\n').slice(1)) {
            const [sku, pcode] = line.split(',');
            if (sku && pcode) csvMap[sku.trim()] = pcode.trim();
        }
    }

    const variantsRaw = runQuery(`SELECT id, sku FROM product_variant WHERE sku IS NOT NULL;`);
    const variants = parseSimpleTable(variantsRaw);
    if (variants.length === 0) {
        console.log('product_variant 表中无数据，无 SKU 可匹配');
        return { matched: 0, skipped: 0 };
    }

    let matched = 0;
    let skipped = 0;
    for (const v of variants) {
        const sku = v.sku;
        let profileCode = null;
        if (csvMap[sku]) profileCode = csvMap[sku];
        else {
            for (const r of rules) {
                if (sku.startsWith(r.prefix)) { profileCode = r.code; break; }
            }
        }
        if (!profileCode) { skipped++; continue; }
        const pid = profiles.find((p) => p.code === profileCode)?.id;
        if (!pid) {
            console.warn(`[warn] 档案 ${profileCode} 不存在，SKU ${sku} 跳过`);
            skipped++;
            continue;
        }
        matched++;
        if (dryRun) {
            console.log(`[dry-run] SKU ${sku} -> ${profileCode} (id=${pid})`);
        } else {
            runQuery(`UPDATE product_variant SET "customFieldsPaymentprofileid" = '${pid}' WHERE id = '${v.id}';`);
        }
    }
    console.log(`匹配 ${matched} 个 SKU，跳过 ${skipped} 个`);
    return { matched, skipped };
}

/** 简单解析 psql 输出（两列：第一行标题，后续行数据）。 */
function parseSimpleTable(raw) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    // 去掉 psql 的 --- 分隔行（含 + 交叉点）与 (N rows) 汇总行
    const rows = lines.filter((l) => !/^[-+\s]+$/.test(l) && !/^\(\d+ rows\)$/.test(l));
    if (rows.length < 2) return [];
    const header = rows[0].split('|').map((h) => h.trim());
    const result = [];
    for (const line of rows.slice(1)) {
        const cols = line.split('|').map((c) => c.trim());
        const obj = {};
        header.forEach((h, i) => { obj[h] = cols[i]; });
        result.push(obj);
    }
    return result;
}
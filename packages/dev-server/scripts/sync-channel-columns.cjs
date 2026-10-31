/**
 * 生产发布辅助脚本：补齐 Channel 自定义字段列（DB_SYNC=0 时必跑）。
 *
 * 背景：Vendure 在 bootstrap 阶段 ChannelService.initChannels 会把 Channel 的全部
 * custom field 列一起查出来。生产 synchronize: false，插件里新增 Channel 自定义字段
 * 而库里没有对应列时，进程会在启动期直接崩溃：
 *   QueryFailedError: column Channel.customFieldsXxx does not exist
 * p24~p29 之类的 OnApplicationBootstrap 迁移救不了这一步（启动顺序在它们之前），
 * 所以需要在 restart 之前先把列补齐。
 *
 * 用法（在仓库根目录执行）：
 *   node packages/dev-server/scripts/sync-channel-columns.cjs            # 只打印缺失列，不执行
 *   node packages/dev-server/scripts/sync-channel-columns.cjs --apply    # 补列
 *
 * 列名规则（与线上/本机现有 customFields* 列一致）：
 *   customFields + 字段名首字母大写 + 其余小写
 *   （waimaiAfterSalesReviewThreshold → customFieldsWaimaiaftersalesreviewthreshold）
 */
const fs = require('node:fs');
const path = require('node:path');

// 仓库根：优先按脚本位置推导；脚本被拷到别处临时执行时退回 CWD（需在仓库根执行）
const SCRIPT_ROOT = path.resolve(__dirname, '../../..');
const ROOT = fs.existsSync(path.join(SCRIPT_ROOT, 'packages/dev-server/.env')) ? SCRIPT_ROOT : process.cwd();
const APPLY = process.argv.includes('--apply');

/** Vendure custom field 类型 → Postgres 列类型（不在表内的一律跳过，不做猜测） */
const COLUMN_TYPES = {
    string: 'character varying',
    text: 'text',
    int: 'integer',
    float: 'double precision',
    boolean: 'boolean',
    datetime: 'timestamptz',
};

/** 字段名 → 数据库列名（Vendure 的 customFields 列命名） */
function columnNameOf(fieldName) {
    return `customFields${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1).toLowerCase()}`;
}

function loadEnv() {
    const envPath = path.join(ROOT, 'packages/dev-server/.env');
    if (!fs.existsSync(envPath)) return process.env;
    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
    }
    return { ...process.env, ...env };
}

/**
 * 收集各插件编译产物里的 Channel 自定义字段。
 * 约定：custom-fields 模块导出一个 CustomFields 对象（如 campusCustomFields），取其 Channel 数组。
 */
function collectChannelFields() {
    const candidates = [];
    const pkgDir = path.join(ROOT, 'packages');
    for (const pkg of fs.readdirSync(pkgDir)) {
        for (const sub of ['lib/src', 'lib', 'dist/src', 'dist']) {
            const file = path.join(pkgDir, pkg, sub, 'custom-fields.js');
            if (fs.existsSync(file)) candidates.push(file);
        }
    }

    const fields = [];
    for (const file of candidates) {
        let mod;
        try {
            mod = require(file);
        } catch (e) {
            console.warn(`[skip] ${path.relative(ROOT, file)} 无法加载：${e.message}`);
            continue;
        }
        for (const exp of Object.values(mod)) {
            const channel = exp && typeof exp === 'object' ? exp.Channel : null;
            if (!Array.isArray(channel)) continue;
            for (const f of channel) {
                if (!f || !f.name) continue;
                fields.push({ ...f, source: path.relative(ROOT, file) });
            }
        }
    }
    return fields;
}

(async () => {
    const env = loadEnv();
    const { Client } = require(path.join(ROOT, 'node_modules/pg'));

    const wanted = collectChannelFields();
    if (!wanted.length) {
        console.log('未找到任何 Channel 自定义字段定义，退出');
        return;
    }

    const client = new Client({
        host: env.DB_HOST,
        port: Number(env.DB_PORT),
        user: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
    });
    await client.connect();

    const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'channel'`,
    );
    const existing = new Set(rows.map(r => String(r.column_name)));

    const missing = [];
    const skipped = [];
    for (const f of wanted) {
        const column = columnNameOf(f.name);
        if (existing.has(column)) continue;
        const pgType = COLUMN_TYPES[f.type];
        if (!pgType) {
            skipped.push(`${f.name}（type=${f.type}）← ${f.source}`);
            continue;
        }
        missing.push({ column, pgType, field: f });
    }

    console.log(`Channel 自定义字段共 ${wanted.length} 个，库中已有 ${existing.size} 个 channel 列`);
    if (skipped.length) console.log(`跳过（未支持的类型，请手工补列）：\n  ${skipped.join('\n  ')}`);
    if (!missing.length) {
        console.log('缺失列：无，可直接 restart');
        await client.end();
        return;
    }

    for (const m of missing) console.log(`缺失列：${m.column} ${m.pgType}  （${m.field.source}）`);

    if (!APPLY) {
        console.log('\n以上为 dry-run。加 --apply 才会执行 ALTER TABLE。');
        await client.end();
        return;
    }

    for (const m of missing) {
        const sql = `ALTER TABLE channel ADD COLUMN IF NOT EXISTS "${m.column}" ${m.pgType}`;
        try {
            await client.query(sql);
            console.log(`已补列：${m.column}`);
        } catch (e) {
            console.error(`补列失败：${m.column} -> ${e.message}`);
            process.exitCode = 1;
        }
    }
    await client.end();
})();

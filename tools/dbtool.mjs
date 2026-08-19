#!/usr/bin/env node
/**
 * dbtool — Vendure 数据库运维本地 CLI
 *
 * 用法:
 *   node tools/dbtool.mjs run <sql文件>
 *   node tools/dbtool.mjs query "<SQL>"
 *   node tools/dbtool.mjs seed [目录]
 *   node tools/dbtool.mjs assign-profile [--dry-run] [--csv <文件>]
 *   node tools/dbtool.mjs list-tables
 *   node tools/dbtool.mjs backup <表>
 *   node tools/dbtool.mjs add-field <表> --col <列> --type <类型> [--dry-run]
 */
import { join } from 'node:path';
import { runQuery, runSqlFile, runSeedDir, listTables, backupTable, addColumn, assignPaymentProfile } from './lib/db.mjs';

const BACKUP_DIR = join(process.cwd(), 'tools', 'backups');

function printHelp() {
    console.log(`dbtool — Vendure 数据库运维本地 CLI

用法: node tools/dbtool.mjs <命令> [参数]

命令:
  run <sql文件>            执行任意 SQL 文件
  query "<SQL>"            执行查询并打印结果
  seed [目录]              批量执行种子脚本(幂等, 默认 tools/seeds)
  assign-profile [--dry-run] [--csv <文件>]   按 cake-/vegetable- 前缀给 SKU 打支付档案标签
  list-tables              列出核心表结构与行数
  backup <表>              备份指定表到 tools/backups/
  add-field <表> --col <列> --type <类型> [--dry-run]   业务表加列
  help                     显示本帮助`);
}

function parseFlags(args) {
    const flags = { dryRun: false, csvFile: null, col: null, type: null };
    const positional = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--dry-run') flags.dryRun = true;
        else if (a === '--csv') flags.csvFile = args[++i];
        else if (a === '--col') flags.col = args[++i];
        else if (a === '--type') flags.type = args[++i];
        else positional.push(a);
    }
    return { flags, positional };
}

async function main() {
    const [cmd, ...rest] = process.argv.slice(2);
    if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
        printHelp();
        return;
    }

    const { flags, positional } = parseFlags(rest);

    switch (cmd) {
        case 'run': {
            if (!positional[0]) throw new Error('用法: dbtool run <sql文件>');
            console.log(runSqlFile(positional[0]));
            break;
        }
        case 'query': {
            if (!positional[0]) throw new Error('用法: dbtool query "<SQL>"');
            console.log(runQuery(positional[0]));
            break;
        }
        case 'seed': {
            const dir = positional[0] || join(process.cwd(), 'tools', 'seeds');
            runSeedDir(dir);
            break;
        }
        case 'assign-profile': {
            assignPaymentProfile({ dryRun: flags.dryRun, csvFile: flags.csvFile });
            break;
        }
        case 'list-tables': {
            console.log(listTables());
            break;
        }
        case 'backup': {
            if (!positional[0]) throw new Error('用法: dbtool backup <表>');
            const f = backupTable(positional[0], BACKUP_DIR);
            console.log(`已备份到: ${f}`);
            break;
        }
        case 'add-field': {
            if (!positional[0] || !flags.col || !flags.type) {
                throw new Error('用法: dbtool add-field <表> --col <列> --type <类型> [--dry-run]');
            }
            addColumn(positional[0], flags.col, flags.type, { dryRun: flags.dryRun });
            break;
        }
        default:
            throw new Error(`未知命令: ${cmd}\n运行 'node tools/dbtool.mjs help' 查看帮助`);
    }
}

main().catch((e) => {
    console.error(`\n[错误] ${e.message}`);
    process.exit(1);
});
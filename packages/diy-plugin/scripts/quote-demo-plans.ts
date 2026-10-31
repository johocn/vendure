/**
 * 运维脚本（幂等）：对指定 DiyPlan 跑 runDiyCalc 服务端复算，落 BOM/quoted 并公开。
 * 用法（cwd 为仓库根目录）：
 *   pnpm exec ts-node --transpile-only -P packages/diy-plugin/tsconfig.json packages/diy-plugin/scripts/quote-demo-plans.ts 1 2 3
 *
 * 依赖环境变量（未设置时回落到 dev 默认值）：DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME，
 * 或使用 packages/dev-server/.env 中的同名配置（本脚本会优先加载该文件）。
 * 前置条件：DiyPlugin 已 boot 并 seed 出 `bracelet-classic` 模板与素材；脚本只做 find/save，不删数据。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
// 与 dev server 共用同一份 .env（packages/dev-server/.env，DB=postgres）
dotenv.config({ path: path.resolve(__dirname, '../../dev-server/.env') });
import { DataSource, PrimaryGeneratedColumn } from 'typeorm';
import { VendureEntity } from '@vendure/core';
import { DiyPlan } from '../src/entities/diy-plan.entity';
import { DiyTemplate } from '../src/entities/diy-template.entity';
import { DiyMaterial } from '../src/entities/diy-material.entity';
import { runDiyCalc, toPlanBom } from '../src/calc-bridge';

// 独立脚本不走 bootstrap，需手动补齐 VendureEntity 自增主键装饰器元数据
PrimaryGeneratedColumn('increment')(VendureEntity.prototype as any, 'id');

const ds = new DataSource({
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'vendure',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'vendure-dev',
    entities: [DiyPlan, DiyTemplate, DiyMaterial],
    synchronize: false,
});

async function main() {
    const ids = process.argv.slice(2).map(Number).filter(n => n > 0);
    if (ids.length === 0) {
        throw new Error('usage: ts-node quote-demo-plans.ts <planId...>');
    }
    await ds.initialize();
    const planRepo = ds.getRepository(DiyPlan);
    const template = await ds.getRepository(DiyTemplate).findOne({ where: { code: 'bracelet-classic' } });
    if (!template) {
        throw new Error('bracelet-classic template not found（先让 DiyPlugin boot seed 执行）');
    }
    const materials = await ds.getRepository(DiyMaterial).find({ where: { enabled: true } });
    for (const id of ids) {
        const plan = await planRepo.findOne({ where: { id } });
        if (!plan) {
            console.log(`[quote] plan ${id} not found`);
            continue;
        }
        const out = runDiyCalc(template, plan.spec, materials, 'zh_Hans');
        plan.bom = toPlanBom(out.bom);
        plan.status = 'quoted';
        plan.isPublic = true;
        plan.publishedAt = new Date();
        await planRepo.save(plan);
        console.log(
            `[quote] plan ${id}: quoted amount=${out.bom.totalAmount} count=${out.bom.totalCount} items=${out.bom.items
                .map(i => i.code + 'x' + i.qty)
                .join(',')} isPublic=true`,
        );
    }
    await ds.destroy();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

/**
 * P5 mock 素材灌库脚本（幂等，可重复执行）：
 * - 读 beads-mock.json（与 bead-diy mock 同源），按 availableDiameters 展开为多行 DiyMaterial（直径档位=多 SKU）
 * - attrs = { group: <mock id>, defaultDiameter, weightPerBead }（C 端按 group 聚合）
 * - 补种 'spacer' 平台分类（seed.ts 无此分类）
 * - 价格 元→分（×100）；app=null 平台库
 * 运行：pnpm exec ts-node --transpile-only -P packages/diy-plugin/tsconfig.json packages/diy-plugin/scripts/populate-beads.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
// 与 dev server 共用同一份 .env（packages/dev-server/.env，DB=postgres）
dotenv.config({ path: path.resolve(__dirname, '../../dev-server/.env') });
import { DataSource, PrimaryGeneratedColumn } from 'typeorm';
import { VendureEntity } from '@vendure/core';
import { DiyCategory } from '../src/entities/diy-category.entity';
import { DiyMaterial } from '../src/entities/diy-material.entity';
import beadsRaw from './beads-mock.json';

// Vendure 的实体 id 主键是在 bootstrap 阶段由 setEntityIdStrategy()（AutoIncrementIdStrategy）
// 动态注册到 VendureEntity 基类的；独立脚本不走 bootstrap，需在 initialize 前手动补齐，
// 否则报 MissingPrimaryColumnError。typeorm 元数据沿原型链继承到各子实体。
PrimaryGeneratedColumn('increment')(VendureEntity.prototype as any, 'id');

interface MockBead {
    id: string; code: string; name: string; category: string; shape: string;
    beadDiameter: number; beadLength: number; holeSize: number;
    availableDiameters: number[]; priceUnit: number; stock: number;
    weightPerBead?: number; renderSpec: Record<string, any>;
}

// 连接参数与 dev-config.ts getDbConfig() postgres 段保持一致
const ds = new DataSource({
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'vendure',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'vendure-dev',
    entities: [DiyCategory, DiyMaterial],
    synchronize: false,
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const variantCode = (code: string, d: number) =>
    code.replace(/^([A-Z]+)-([A-Z]+)-\d{2}-([A-Z]+)$/, `$1-$2-${pad2(d)}-$3`);

async function main() {
    await ds.initialize();
    const beads = beadsRaw as unknown as MockBead[];
    const catRepo = ds.getRepository(DiyCategory);
    const matRepo = ds.getRepository(DiyMaterial);

    // 1) 补种 spacer 分类（幂等）
    let spacerCat = await catRepo.findOne({ where: { app: null as any, code: 'spacer' } });
    if (!spacerCat) {
        spacerCat = await catRepo.save(new DiyCategory({
            app: null, code: 'spacer',
            name: { 'zh-CN': '隔片配饰', 'en-US': 'Spacers' },
            sortOrder: 7, enabled: true,
        }));
        console.log('[populate] created spacer category');
    }
    const cats = await catRepo.find();
    const catByCode = new Map(cats.map(c => [c.code!, c.id as number]));

    // 2) 展开 + upsert
    let created = 0, updated = 0;
    for (const [i, bead] of beads.entries()) {
        const categoryId = catByCode.get(bead.category);
        if (!categoryId) throw new Error(`Category not found for "${bead.category}"（先启动一次 dev server 让 seed 执行）`);
        for (const d of bead.availableDiameters) {
            const code = variantCode(bead.code, d);
            const isDisc = bead.shape !== 'round';
            const axialLength = isDisc
                ? Math.round(((bead.beadLength * d) / bead.beadDiameter) * 10) / 10
                : d;
            const existing = await matRepo.findOne({ where: { app: null as any, code } });
            const row = existing ?? new DiyMaterial({ app: null, code });
            Object.assign(row, {
                name: { 'zh-CN': bead.name },
                categoryId,
                shape: bead.shape,
                diameter: d,
                axialLength,
                holeSize: bead.holeSize,
                attrs: { group: bead.id, defaultDiameter: bead.beadDiameter, weightPerBead: bead.weightPerBead },
                render: bead.renderSpec,
                price: Math.round(bead.priceUnit * 100),
                priceUnit: 'piece',
                currency: 'CNY',
                stock: bead.stock < 0 ? 999999 : bead.stock,
                images: null,
                sourceMaterialId: null,
                enabled: true,
                sortOrder: i,
            });
            await matRepo.save(row);
            existing ? updated++ : created++;
        }
    }
    console.log(`[populate] done: ${created} created, ${updated} updated（预期 created≈68 行 = 18 珠 × 各直径档展开）`);
    await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });

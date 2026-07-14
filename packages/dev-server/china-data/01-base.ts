import { INestApplication } from '@nestjs/common';
import {
    Administrator,
    AssetService,
    ChannelService,
    CollectionService,
    CountryService,
    FacetService,
    GlobalSettingsService,
    LanguageCode,
    RoleService,
    TaxCategoryService,
    TaxRateService,
    TransactionalConnection,
    User,
    UserService,
    ZoneService,
} from '@vendure/core';
import fs from 'fs';
import path from 'path';

import { withPlainCtx } from './shared';
import { COLLECTIONS, COUNTRIES, FACETS, TAX_RATES, ZONES } from './sources';

const ASSETS_DIR = path.join(__dirname, '../../core/mock-data/assets');

export async function populateBase(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const userService = app.get(UserService);
    const roleService = app.get(RoleService);
    const zoneService = app.get(ZoneService);
    const countryService = app.get(CountryService);
    const taxCategoryService = app.get(TaxCategoryService);
    const taxRateService = app.get(TaxRateService);
    const facetService = app.get(FacetService);
    const assetService = app.get(AssetService);
    const collectionService = app.get(CollectionService);
    const conn = app.get(TransactionalConnection);

    const defaultChannel = await channelService.getDefaultChannel();

    // 01-base 是 bootstrap 阶段：superadmin 用户在此 stage 内创建，因此使用 withPlainCtx（无 user）
    // 后续 stage（02-06）使用 withCtx（带 superadmin）
    await withPlainCtx(app, defaultChannel, async ctx => {
        // 0. 更新 GlobalSettings 添加 zh_Hans 语言（Channel 创建时需要）
        const globalSettingsService = app.get(GlobalSettingsService);
        await globalSettingsService.updateSettings(ctx, {
            availableLanguages: [LanguageCode.en, LanguageCode.zh_Hans],
        });

        // 1. 创建 superadmin 用户（createAdminUser 不带角色，需手动关联 Administrator + Role）
        const superAdminRole = await roleService.getSuperAdminRole(ctx);
        const user = await userService.createAdminUser(ctx, 'superadmin@china.test', 'superadmin');
        const administrator = new Administrator({
            emailAddress: 'superadmin@china.test',
            firstName: 'Super',
            lastName: 'Admin',
        });
        administrator.user = user;
        await conn.getRepository(ctx, Administrator).save(administrator);
        user.roles = [superAdminRole];
        await conn.getRepository(ctx, User).save(user, { reload: false });

        // 2. Zone / Country（Country 通过 translations 设置名称，再通过 addMembersToZone 归入 Zone）
        const zoneMap = new Map<string, string>();
        for (const z of ZONES) {
            const zone = await zoneService.create(ctx, { name: z.name });
            zoneMap.set(z.name, zone.id as string);
        }
        for (const c of COUNTRIES) {
            const country = await countryService.create(ctx, {
                code: c.code,
                enabled: true,
                translations: [{ languageCode: ctx.languageCode, name: c.name }],
            });
            const zoneId = zoneMap.get(c.zone);
            if (zoneId) {
                await zoneService.addMembersToZone(ctx, {
                    zoneId,
                    memberIds: [country.id],
                });
            }
        }

        // 3. TaxCategory + TaxRate（CreateTaxRateInput 用 value 而非 amount）
        const asiaZone = (await zoneService.findAll(ctx)).items.find(z => z.name === 'Asia');
        if (!asiaZone) throw new Error('Asia zone not found');
        for (const t of TAX_RATES) {
            const taxCategory = await taxCategoryService.create(ctx, { name: t.name });
            await taxRateService.create(ctx, {
                name: t.name,
                value: t.percentage,
                categoryId: taxCategory.id,
                zoneId: asiaZone.id,
                enabled: true,
            });
        }

        // 4. Facet + FacetValue（CreateFacetInput 需 isPrivate + translations）
        for (const f of FACETS) {
            await facetService.create(ctx, {
                code: f.code,
                isPrivate: false,
                translations: [{ languageCode: ctx.languageCode, name: f.name }],
                values: f.values.map(v => ({
                    code: v.code,
                    translations: [{ languageCode: ctx.languageCode, name: v.name }],
                })),
            });
        }

        // 5. Collection + Asset
        const allFacets = await facetService.findAll(ctx);
        for (const c of COLLECTIONS) {
            // 用 createFromFileStream 从文件路径创建 Asset
            const filePath = path.join(ASSETS_DIR, c.assetFile);
            const stream = fs.createReadStream(filePath);
            const assetResult = await assetService.createFromFileStream(stream, filePath, ctx);
            if (!('id' in assetResult)) {
                throw new Error(`Asset creation failed for ${c.assetFile}: ${assetResult.message}`);
            }

            // 找到对应的 facetValueIds
            const facetValueIds: string[] = [];
            for (const facet of allFacets.items) {
                for (const fv of facet.values) {
                    if (c.facetValueNames.includes(fv.name)) {
                        facetValueIds.push(fv.id as string);
                    }
                }
            }

            await collectionService.create(ctx, {
                translations: [
                    {
                        languageCode: ctx.languageCode,
                        name: c.name,
                        description: c.name,
                        slug: c.name,
                    },
                ],
                assetIds: [assetResult.id as string],
                filters: [
                    {
                        code: 'facet-value-filter',
                        arguments: [
                            { name: 'facetValueIds', value: JSON.stringify(facetValueIds) },
                            { name: 'containsAny', value: 'false' },
                        ],
                    },
                ],
            });
        }
    });
}

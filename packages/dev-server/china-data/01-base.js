"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateBase = populateBase;
const core_1 = require("@vendure/core");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("./shared");
const sources_1 = require("./sources");
const ASSETS_DIR = path_1.default.join(__dirname, '../../core/mock-data/assets');
async function populateBase(app) {
    const channelService = app.get(core_1.ChannelService);
    const userService = app.get(core_1.UserService);
    const roleService = app.get(core_1.RoleService);
    const zoneService = app.get(core_1.ZoneService);
    const countryService = app.get(core_1.CountryService);
    const taxCategoryService = app.get(core_1.TaxCategoryService);
    const taxRateService = app.get(core_1.TaxRateService);
    const facetService = app.get(core_1.FacetService);
    const assetService = app.get(core_1.AssetService);
    const collectionService = app.get(core_1.CollectionService);
    const conn = app.get(core_1.TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    // 01-base 是 bootstrap 阶段：superadmin 用户在此 stage 内创建，因此使用 withPlainCtx（无 user）
    // 后续 stage（02-06）使用 withCtx（带 superadmin）
    await (0, shared_1.withPlainCtx)(app, defaultChannel, async (ctx) => {
        // 0. 更新 GlobalSettings 添加 zh_Hans 语言（Channel 创建时需要）
        const globalSettingsService = app.get(core_1.GlobalSettingsService);
        await globalSettingsService.updateSettings(ctx, {
            availableLanguages: [core_1.LanguageCode.en, core_1.LanguageCode.zh_Hans],
        });
        // 1. 创建 superadmin 用户（createAdminUser 不带角色，需手动关联 Administrator + Role）
        const superAdminRole = await roleService.getSuperAdminRole(ctx);
        const user = await userService.createAdminUser(ctx, 'superadmin@china.test', 'superadmin');
        const administrator = new core_1.Administrator({
            emailAddress: 'superadmin@china.test',
            firstName: 'Super',
            lastName: 'Admin',
        });
        administrator.user = user;
        await conn.getRepository(ctx, core_1.Administrator).save(administrator);
        user.roles = [superAdminRole];
        await conn.getRepository(ctx, core_1.User).save(user, { reload: false });
        // 2. Zone / Country（Country 通过 translations 设置名称，再通过 addMembersToZone 归入 Zone）
        const zoneMap = new Map();
        for (const z of sources_1.ZONES) {
            const zone = await zoneService.create(ctx, { name: z.name });
            zoneMap.set(z.name, zone.id);
        }
        for (const c of sources_1.COUNTRIES) {
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
        if (!asiaZone)
            throw new Error('Asia zone not found');
        for (const t of sources_1.TAX_RATES) {
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
        for (const f of sources_1.FACETS) {
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
        for (const c of sources_1.COLLECTIONS) {
            // 用 createFromFileStream 从文件路径创建 Asset
            const filePath = path_1.default.join(ASSETS_DIR, c.assetFile);
            const stream = fs_1.default.createReadStream(filePath);
            const assetResult = await assetService.createFromFileStream(stream, filePath, ctx);
            if (!('id' in assetResult)) {
                throw new Error(`Asset creation failed for ${c.assetFile}: ${assetResult.message}`);
            }
            // 找到对应的 facetValueIds
            const facetValueIds = [];
            for (const facet of allFacets.items) {
                for (const fv of facet.values) {
                    if (c.facetValueNames.includes(fv.name)) {
                        facetValueIds.push(fv.id);
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
                assetIds: [assetResult.id],
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
//# sourceMappingURL=01-base.js.map
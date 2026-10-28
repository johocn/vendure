"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupLocationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const pickup_location_entity_1 = require("./pickup-location.entity");
const pickup_location_permissions_1 = require("./pickup-location-permissions");
/**
 * 列表过滤/排序白名单。SQL 列名全部来自此常量，用户输入只作为参数绑定，
 * 因此即使 GraphQL 参数中出现未知字段也不会拼接进 SQL。
 */
const FILTER_FIELDS = {
    id: { column: 'pl.id', kind: 'id' },
    createdAt: { column: 'pl.createdAt', kind: 'date' },
    updatedAt: { column: 'pl.updatedAt', kind: 'date' },
    name: { column: 'pl.name', kind: 'string' },
    type: { column: 'pl.type', kind: 'string' },
    stockType: { column: 'pl.stockType', kind: 'string' },
    address: { column: 'pl.address', kind: 'string' },
    contactPerson: { column: 'pl.contactPerson', kind: 'string' },
    phoneNumber: { column: 'pl.phoneNumber', kind: 'string' },
    businessHours: { column: 'pl.businessHours', kind: 'string' },
    remark: { column: 'pl.remark', kind: 'string' },
    province: { column: 'pl.province', kind: 'string' },
    city: { column: 'pl.city', kind: 'string' },
    district: { column: 'pl.district', kind: 'string' },
    street: { column: 'pl.street', kind: 'string' },
    sortOrder: { column: 'pl.sortOrder', kind: 'number' },
    enabled: { column: 'pl.enabled', kind: 'boolean' },
    isPublic: { column: 'pl.isPublic', kind: 'boolean' },
    ownerChannelId: { column: 'pl.ownerChannelId', kind: 'id' },
    merchantStoreId: { column: 'pl.merchantStoreId', kind: 'id' },
};
/**
 * update 允许写入的业务字段白名单。id / channels / ownerChannelId / deletedAt /
 * createdAt / updatedAt 等归属与生命周期字段不接受客户端传入；isPublic 另行鉴权。
 */
const UPDATABLE_FIELDS = [
    'name',
    'type',
    'stockType',
    'address',
    'contactPerson',
    'phoneNumber',
    'businessHours',
    'coordinates',
    'partner',
    'photos',
    'remark',
    'sortOrder',
    'enabled',
    'province',
    'city',
    'district',
    'street',
];
let PickupLocationService = class PickupLocationService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * 平台渠道判定（默认商城/平台）：code === '__default_channel__'。
     * 语义镜像 order-box.service.ts 的 isMallContext。
     */
    isPlatformContext(ctx) {
        var _a, _b;
        const code = String((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '');
        return code === '__default_channel__';
    }
    /**
     * 自提点可见规则（平台/租户分层）：
     * - 平台（默认渠道）：可见所有渠道自提点（平台运营全量自提点，含各租户自建点）。
     * - 租户：仅可见全局公共点（isPublic=true）与本租户自建点（ownerChannelId=本渠道），
     *   且需该点 channels 关联当前渠道。
     */
    applyVisibility(qb, ctx) {
        if (this.isPlatformContext(ctx))
            return;
        qb.where('(pl.isPublic = :isPublic OR pl.ownerChannelId = :channelId)', { isPublic: true, channelId: ctx.channelId });
        qb.innerJoin('pl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
    }
    /**
     * 是否为可管理全部自提点的上下文：平台渠道、超管或持全局点权限者。
     * 其余（租户）只能读写本渠道自建点。
     */
    canManageAll(ctx) {
        return (this.isPlatformContext(ctx) ||
            ctx.userHasPermissions([core_1.Permission.SuperAdmin, pickup_location_permissions_1.SetGlobalPickupLocation.Permission]));
    }
    /** 当前上下文是否可读写指定自提点 */
    canAccess(ctx, location) {
        if (this.canManageAll(ctx)) {
            return true;
        }
        return location.isPublic === true || Number(location.ownerChannelId) === Number(ctx.channelId);
    }
    async findAll(ctx, options) {
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        this.applyVisibility(qb, ctx);
        this.applyFilters(qb, options === null || options === void 0 ? void 0 : options.filter, options === null || options === void 0 ? void 0 : options.filterOperator);
        this.applySorting(qb, options === null || options === void 0 ? void 0 : options.sort);
        const take = Number(options === null || options === void 0 ? void 0 : options.take);
        qb.skip(Math.max(0, Number(options === null || options === void 0 ? void 0 : options.skip) || 0)).take(Number.isFinite(take) && take > 0 ? take : 10);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    /** 商城端：当前渠道可见且启用的自提点（不分页，按 sortOrder/创建时间排序） */
    async findEnabled(ctx) {
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        this.applyVisibility(qb, ctx);
        qb.andWhere('pl.enabled = :enabled', { enabled: true });
        this.applySorting(qb);
        return qb.getMany();
    }
    /**
     * Vendure 生成的 filter 值是运算符对象（如 { eq: true }、{ contains: 'x' }），
     * 直接绑定到 SQL 参数会报错。这里按白名单列逐个翻译为 SQL 条件。
     * 支持 Vendure 生成的 `_and` / `_or` 嵌套与顶层 `filterOperator`（OR 时各顶层条件取并集）。
     */
    applyFilters(qb, filter, filterOperator) {
        if (!filter)
            return;
        const { sqls, params } = this.buildFilterGroup(filter, 'f');
        if (sqls.length === 0)
            return;
        const joiner = filterOperator === 'OR' ? ' OR ' : ' AND ';
        qb.andWhere(`(${sqls.join(joiner)})`, params);
    }
    /** 递归翻译 filter：同一层内每个字段的所有运算符先按 AND 组合，字段之间由 filterOperator 决定 */
    buildFilterGroup(filter, prefix) {
        const sqls = [];
        const params = {};
        for (const [key, value] of Object.entries(filter)) {
            if (value == null)
                continue;
            if (key === '_and' || key === '_or') {
                if (!Array.isArray(value))
                    continue;
                const groups = value
                    .filter((sub) => sub != null && typeof sub === 'object')
                    .map((sub, index) => this.buildFilterGroup(sub, `${prefix}_${key}${index}`));
                const merged = groups
                    .filter((group) => group.sqls.length > 0)
                    .map((group) => `(${group.sqls.join(' AND ')})`);
                if (merged.length > 0) {
                    sqls.push(`(${merged.join(key === '_or' ? ' OR ' : ' AND ')})`);
                    for (const group of groups)
                        Object.assign(params, group.params);
                }
                continue;
            }
            const spec = FILTER_FIELDS[key];
            if (!spec)
                continue;
            const built = this.buildFieldConditions(spec, value, `${prefix}_${key}`);
            if (built.sqls.length === 0)
                continue;
            sqls.push(built.sqls.length === 1 ? built.sqls[0] : `(${built.sqls.join(' AND ')})`);
            Object.assign(params, built.params);
        }
        return { sqls, params };
    }
    buildFieldConditions(spec, raw, prefix) {
        var _a, _b;
        const sqls = [];
        const params = {};
        const param = (suffix) => `${prefix}_${suffix}`;
        // 兼容直接传标量的旧写法
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            sqls.push(`${spec.column} = :${param('eq')}`);
            params[param('eq')] = raw;
            return { sqls, params };
        }
        const ops = raw;
        if (ops.eq !== undefined) {
            sqls.push(`${spec.column} = :${param('eq')}`);
            params[param('eq')] = ops.eq;
        }
        if (ops.notEq !== undefined) {
            sqls.push(`${spec.column} != :${param('neq')}`);
            params[param('neq')] = ops.notEq;
        }
        if (Array.isArray(ops.in) && ops.in.length) {
            sqls.push(`${spec.column} IN (:...${param('in')})`);
            params[param('in')] = ops.in;
        }
        if (Array.isArray(ops.notIn) && ops.notIn.length) {
            sqls.push(`${spec.column} NOT IN (:...${param('notIn')})`);
            params[param('notIn')] = ops.notIn;
        }
        if (spec.kind === 'string') {
            if (typeof ops.contains === 'string') {
                sqls.push(`${spec.column} LIKE :${param('contains')}`);
                params[param('contains')] = `%${ops.contains}%`;
            }
            if (typeof ops.notContains === 'string') {
                sqls.push(`${spec.column} NOT LIKE :${param('notContains')}`);
                params[param('notContains')] = `%${ops.notContains}%`;
            }
            if (typeof ops.like === 'string') {
                sqls.push(`${spec.column} LIKE :${param('like')}`);
                params[param('like')] = ops.like;
            }
            if (typeof ops.regex === 'string') {
                const driver = String((_b = (_a = this.connection.rawConnection.options) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : '');
                if (driver === 'postgres' || driver === 'postgresql') {
                    sqls.push(`${spec.column} ~ :${param('regex')}`);
                    params[param('regex')] = ops.regex;
                }
                else if (driver === 'mysql' || driver === 'mariadb') {
                    sqls.push(`${spec.column} REGEXP :${param('regex')}`);
                    params[param('regex')] = ops.regex;
                }
                // sqlite 无正则运算符：忽略该条件，避免生成非法 SQL
            }
        }
        if (ops.isNull !== undefined) {
            sqls.push(`${spec.column} IS ${ops.isNull ? '' : 'NOT '}NULL`);
        }
        const comparisons = [
            ['lt', '<'],
            ['lte', '<='],
            ['gt', '>'],
            ['gte', '>='],
        ];
        for (const [op, sqlOp] of comparisons) {
            if (ops[op] !== undefined) {
                sqls.push(`${spec.column} ${sqlOp} :${param(op)}`);
                params[param(op)] = ops[op];
            }
        }
        if (Array.isArray(ops.between) && ops.between.length === 2) {
            sqls.push(`${spec.column} BETWEEN :${param('from')} AND :${param('to')}`);
            params[param('from')] = ops.between[0];
            params[param('to')] = ops.between[1];
        }
        return { sqls, params };
    }
    /**
     * 排序：按请求中的字段顺序依次应用（多字段排序全部生效）。
     * 未指定排序时默认 sortOrder 升序 + 创建时间倒序；
     * 末尾始终补 id 作为最终 tiebreaker，避免排序字段重复导致分页结果抖动/重复。
     */
    applySorting(qb, sort) {
        const parts = [];
        if (sort) {
            for (const [key, dir] of Object.entries(sort)) {
                const spec = FILTER_FIELDS[key];
                if (!spec || (dir !== 'ASC' && dir !== 'DESC'))
                    continue;
                parts.push({ column: spec.column, direction: dir });
            }
        }
        if (parts.length === 0) {
            parts.push({ column: 'pl.sortOrder', direction: 'ASC' }, { column: 'pl.createdAt', direction: 'DESC' });
        }
        if (!parts.some((part) => part.column === 'pl.id')) {
            parts.push({ column: 'pl.id', direction: 'ASC' });
        }
        parts.forEach((part, index) => {
            if (index === 0) {
                qb.orderBy(part.column, part.direction);
            }
            else {
                qb.addOrderBy(part.column, part.direction);
            }
        });
    }
    async findOne(ctx, id) {
        const result = await this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).findOne({
            where: { id: id },
            relations: { channels: true },
        });
        if (!result || !this.canAccess(ctx, result)) {
            return undefined;
        }
        return result;
    }
    async findByType(ctx, type) {
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        this.applyVisibility(qb, ctx);
        qb.andWhere('pl.type = :type', { type });
        qb.andWhere('pl.enabled = :enabled', { enabled: true });
        this.applySorting(qb);
        return qb.getMany();
    }
    /**
     * 按城市动态聚合当前渠道可见的启用自提点（rangeMode='all' 用）。
     * 语义：可见规则(公共点+本租户自建点) + 类型匹配 + enabled=true + 同 city + channels 关联当前渠道。
     * city 可为空 → 聚合当前渠道全部可见且启用的同类型自提点。
     */
    async findByCityForChannel(ctx, city, type) {
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        this.applyVisibility(qb, ctx);
        qb.andWhere('pl.type = :type', { type });
        qb.andWhere('pl.enabled = :enabled', { enabled: true });
        if (city) {
            qb.andWhere('pl.city = :city', { city });
        }
        this.applySorting(qb);
        return qb.getMany();
    }
    async findByIds(ctx, ids) {
        if (ids.length === 0)
            return [];
        const qb = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).createQueryBuilder('pl');
        this.applyVisibility(qb, ctx);
        qb.andWhere('pl.id IN (:...ids)', { ids });
        qb.andWhere('pl.enabled = :enabled', { enabled: true });
        this.applySorting(qb);
        return qb.getMany();
    }
    async create(ctx, input) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const merchantStoreId = await this.normalizeMerchantStoreId(ctx, input.merchantStoreId);
        const location = new pickup_location_entity_1.PickupLocation(input);
        location.merchantStoreId = merchantStoreId;
        location.channels = [ctx.channel];
        location.ownerChannelId = ctx.channelId;
        // 归属权限判定：仅持有 SetGlobalPickupLocation 权限者可建全局点，否则强制租户级
        const wantGlobal = input.isPublic === true || input.isGlobal === true;
        location.isPublic = wantGlobal && ctx.userHasPermissions([pickup_location_permissions_1.SetGlobalPickupLocation.Permission]) ? true : false;
        if (location.isPublic) {
            // 全局点归属平台，不限定某租户
            location.ownerChannelId = null;
        }
        return repo.save(location);
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = await repo.findOne({ where: { id: input === null || input === void 0 ? void 0 : input.id } });
        if (!location) {
            throw new core_1.EntityNotFoundError('PickupLocation', input === null || input === void 0 ? void 0 : input.id);
        }
        const canManageAll = this.canManageAll(ctx);
        if (!canManageAll && (location.isPublic || Number(location.ownerChannelId) !== Number(ctx.channelId))) {
            throw new core_1.ForbiddenError();
        }
        // 仅白名单业务字段可写，归属/生命周期字段由服务端维护
        const patch = {};
        for (const key of UPDATABLE_FIELDS) {
            if (input[key] !== undefined) {
                patch[key] = input[key];
            }
        }
        if (input.merchantStoreId !== undefined) {
            patch.merchantStoreId = await this.normalizeMerchantStoreId(ctx, input.merchantStoreId, location.merchantStoreId);
        }
        // 全局可见性仅平台/超管可改；租户传入的 isPublic 直接忽略
        if (canManageAll && input.isPublic !== undefined) {
            location.isPublic = input.isPublic === true;
            if (location.isPublic) {
                location.ownerChannelId = null;
            }
            else if (location.ownerChannelId == null) {
                location.ownerChannelId = ctx.channelId;
            }
        }
        Object.assign(location, patch);
        return repo.save(location);
    }
    /** 软删：仅置 deletedAt，保留被订单/配送档案引用的历史数据 */
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const location = await repo.findOne({ where: { id: id } });
        if (!location) {
            return;
        }
        if (!this.canAccess(ctx, location)) {
            throw new core_1.ForbiddenError();
        }
        await repo.softDelete(id);
    }
    /**
     * 校验并归一化关联门店 ID：
     * - 空值 → null（解除关联）；
     * - 非数字 → 拒绝；
     * - merchant_store 表存在时校验门店真实存在且未软删（两插件无外键，需应用层兜底）；
     * - 租户上下文只能关联「本渠道已 ACTIVE 认领」的门店，平台/超管不受限。
     *   编辑时沿用原值不做归属校验，避免历史数据被阻断。
     */
    async normalizeMerchantStoreId(ctx, raw, allowExistingId) {
        if (raw == null || raw === '') {
            return null;
        }
        const id = Number(raw);
        if (!Number.isInteger(id) || id <= 0) {
            throw new core_1.UserInputError(`门店 ID 非法：${raw}`);
        }
        const qr = this.connection.rawConnection.createQueryRunner();
        const isPostgres = this.connection.rawConnection.options.type === 'postgres';
        try {
            if (!(await qr.hasTable('merchant_store'))) {
                return id;
            }
            const rows = await qr.query(`SELECT id, "deletedAt" FROM merchant_store WHERE id = ${isPostgres ? '$1' : '?'}`, [id]);
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new core_1.UserInputError(`关联门店不存在：${id}`);
            }
            if (rows[0].deletedAt != null) {
                throw new core_1.UserInputError(`关联门店已删除：${id}`);
            }
            if (!this.canManageAll(ctx) && Number(allowExistingId) !== id) {
                if (await qr.hasTable('merchant_store_channel')) {
                    const claims = await qr.query(`SELECT id FROM merchant_store_channel
                         WHERE "storeId" = ${isPostgres ? '$1' : '?'}
                           AND "channelId" = ${isPostgres ? '$2' : '?'}
                           AND status = 'ACTIVE' LIMIT 1`, [id, Number(ctx.channelId)]);
                    if (!Array.isArray(claims) || claims.length === 0) {
                        throw new core_1.UserInputError(`门店未认领到当前租户，无法关联：${id}`);
                    }
                }
            }
            return id;
        }
        finally {
            await qr.release();
        }
    }
    async promoteToPublic(ctx, id) {
        const loc = await this.findOne(ctx, id);
        if (!loc)
            throw new core_1.EntityNotFoundError('PickupLocation', id);
        loc.isPublic = true;
        loc.ownerChannelId = null;
        return this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation).save(loc);
    }
    async assignToChannel(ctx, ids, channelId) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const locations = await repo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: { channels: true },
        });
        const channel = await this.connection.getRepository(ctx, core_1.Channel).findOne({
            where: { id: channelId },
        });
        if (!channel)
            throw new core_1.EntityNotFoundError('Channel', channelId);
        for (const loc of locations) {
            if (!loc.channels.find(c => c.id === channelId)) {
                loc.channels.push(channel);
            }
        }
        await repo.save(locations);
    }
    async removeFromChannel(ctx, ids, channelId) {
        const repo = this.connection.getRepository(ctx, pickup_location_entity_1.PickupLocation);
        const locations = await repo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: { channels: true },
        });
        for (const loc of locations) {
            loc.channels = loc.channels.filter(c => c.id !== channelId);
        }
        await repo.save(locations);
    }
    async sortByDistance(locations, lat, lng) {
        return locations
            .map(loc => ({
            loc,
            distance: loc.coordinates
                ? this.haversineDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng)
                : Number.MAX_VALUE
        }))
            .sort((a, b) => a.distance - b.distance)
            .map(item => item.loc);
    }
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
exports.PickupLocationService = PickupLocationService;
exports.PickupLocationService = PickupLocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], PickupLocationService);
//# sourceMappingURL=pickup-location.service.js.map
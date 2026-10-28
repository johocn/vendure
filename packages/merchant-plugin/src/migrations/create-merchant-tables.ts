// 商户域幂等建表：merchant / merchant_store / merchant_store_channel / merchant_store_staff，
// 并为历史自提点（pickup_location）/ 校园履约配置（campus_fulfillment_config）做门店回填。
// 生产 PG 与本地 SQLite 都可能关闭 synchronize，故全部在启动时幂等补齐；任何失败只告警不阻塞启动。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

import { Merchant } from '../merchant.entity';
import { MerchantStore } from '../merchant-store.entity';
import { MerchantStoreChannel } from '../merchant-store-channel.entity';
import { MerchantStoreStaff } from '../merchant-store-staff.entity';

const LOG_CTX = '[CreateMerchantTablesMigration]';

function toBool(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    return value === 'true' || value === 1;
}

/** simple-json 历史列在 raw 查询中可能已经是对象或仍为字符串 */
function parseJson(value: unknown): any {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

@Injectable()
export class CreateMerchantTablesMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    /** PG 没有 datetime 类型，sqlite 没有 timestamp，按当前连接选择 */
    private get dateColumnType(): 'timestamp' | 'datetime' {
        return this.connection.options.type === 'postgres' ? 'timestamp' : 'datetime';
    }

    /** 原生 SQL 参数占位符：PG 用 $n，sqlite 用 ? */
    private ph(index: number): string {
        return this.connection.options.type === 'postgres' ? `$${index}` : '?';
    }

    /** Table 列的 default 是原样拼接的 SQL，字符串字面量必须自带引号，否则 PG 会当作列引用 */
    private lit(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    async onApplicationBootstrap() {
        const queryRunner = this.connection.createQueryRunner();
        try {
            // 每段独立 try/catch：单段失败不影响其它段与启动
            try {
                await this.ensureTables(queryRunner);
            } catch (e: any) {
                console.error(`${LOG_CTX} failed to create tables: ${e?.message ?? e}`);
            }
            try {
                await this.ensurePickupLocationColumn(queryRunner);
            } catch (e: any) {
                console.error(`${LOG_CTX} failed to add pickup_location.merchantStoreId: ${e?.message ?? e}`);
            }
            try {
                await this.backfillPickupStores(queryRunner);
            } catch (e: any) {
                console.error(`${LOG_CTX} failed to backfill pickup stores: ${e?.message ?? e}`);
            }
            try {
                await this.backfillCampusStores(queryRunner);
            } catch (e: any) {
                console.error(`${LOG_CTX} failed to backfill campus stores: ${e?.message ?? e}`);
            }
        } finally {
            await queryRunner.release();
        }
    }

    // ------------------------------------------------------------------
    // 建表
    // ------------------------------------------------------------------

    private async ensureTables(queryRunner: QueryRunner): Promise<void> {
        const merchantTable = new Table({
            name: 'merchant',
            columns: [
                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                { name: 'createdAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'updatedAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'code', type: 'varchar', isNullable: false },
                { name: 'name', type: 'text', isNullable: false },
                { name: 'shortName', type: 'varchar', isNullable: true },
                { name: 'logo', type: 'text', isNullable: true },
                { name: 'brand', type: 'varchar', isNullable: true },
                { name: 'intro', type: 'text', isNullable: true },
                { name: 'tags', type: 'text', isNullable: true },
                { name: 'legalName', type: 'varchar', isNullable: true },
                { name: 'licenseNo', type: 'varchar', isNullable: true },
                { name: 'licenseImage', type: 'text', isNullable: true },
                { name: 'licenseExpiry', type: this.dateColumnType, isNullable: true },
                { name: 'merchantType', type: 'varchar', isNullable: false, default: this.lit('ENTERPRISE') },
                { name: 'industry', type: 'varchar', isNullable: true },
                { name: 'category', type: 'varchar', isNullable: true },
                { name: 'contactName', type: 'varchar', isNullable: true },
                { name: 'contactPhone', type: 'varchar', isNullable: true },
                { name: 'servicePhone', type: 'varchar', isNullable: true },
                { name: 'complaintPhone', type: 'varchar', isNullable: true },
                { name: 'email', type: 'varchar', isNullable: true },
                { name: 'wechat', type: 'varchar', isNullable: true },
                { name: 'province', type: 'varchar', isNullable: true },
                { name: 'city', type: 'varchar', isNullable: true },
                { name: 'district', type: 'varchar', isNullable: true },
                { name: 'street', type: 'varchar', isNullable: true },
                { name: 'address', type: 'varchar', isNullable: true },
                { name: 'ownerChannelId', type: 'int', isNullable: true },
                { name: 'claimStatus', type: 'varchar', isNullable: false, default: this.lit('UNCLAIMED') },
                { name: 'contractNo', type: 'varchar', isNullable: true },
                { name: 'cooperationStart', type: this.dateColumnType, isNullable: true },
                { name: 'cooperationEnd', type: this.dateColumnType, isNullable: true },
                { name: 'commissionRate', type: 'int', isNullable: true },
                { name: 'source', type: 'varchar', isNullable: false, default: this.lit('MANUAL') },
                { name: 'settlementType', type: 'varchar', isNullable: true },
                { name: 'bankName', type: 'varchar', isNullable: true },
                { name: 'bankAccountName', type: 'varchar', isNullable: true },
                { name: 'bankAccountNo', type: 'varchar', isNullable: true },
                { name: 'taxNo', type: 'varchar', isNullable: true },
                { name: 'invoiceTitle', type: 'varchar', isNullable: true },
                { name: 'status', type: 'varchar', isNullable: false, default: this.lit('ACTIVE') },
                { name: 'statusReason', type: 'varchar', isNullable: true },
                { name: 'closedAt', type: this.dateColumnType, isNullable: true },
            ],
            indices: [
                new TableIndex({ name: 'IDX_merchant_code', columnNames: ['code'], isUnique: true }),
            ],
        });

        const storeTable = new Table({
            name: 'merchant_store',
            columns: [
                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                { name: 'createdAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'updatedAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'merchantId', type: 'int', isNullable: false },
                { name: 'code', type: 'varchar', isNullable: false },
                { name: 'name', type: 'text', isNullable: false },
                { name: 'storeType', type: 'varchar', isNullable: false, default: this.lit('DIRECT') },
                { name: 'sortOrder', type: 'int', isNullable: false, default: 0 },
                { name: 'weight', type: 'int', isNullable: false, default: 0 },
                { name: 'country', type: 'varchar', isNullable: false, default: this.lit('CN') },
                { name: 'province', type: 'varchar', isNullable: true },
                { name: 'city', type: 'varchar', isNullable: true },
                { name: 'cityCode', type: 'varchar', isNullable: true },
                { name: 'district', type: 'varchar', isNullable: true },
                { name: 'street', type: 'varchar', isNullable: true },
                { name: 'addressLine', type: 'varchar', isNullable: true },
                { name: 'detail', type: 'varchar', isNullable: true },
                { name: 'postalCode', type: 'varchar', isNullable: true },
                { name: 'lat', type: 'float', isNullable: true },
                { name: 'lng', type: 'float', isNullable: true },
                { name: 'coordinateSystem', type: 'varchar', isNullable: false, default: this.lit('GCJ02') },
                { name: 'geohash', type: 'varchar', isNullable: true },
                { name: 'mapPoiId', type: 'varchar', isNullable: true },
                { name: 'mapProvider', type: 'varchar', isNullable: true },
                { name: 'navigationAddress', type: 'varchar', isNullable: true },
                { name: 'phoneNumber', type: 'varchar', isNullable: true },
                { name: 'backupPhone', type: 'varchar', isNullable: true },
                { name: 'managerName', type: 'varchar', isNullable: true },
                { name: 'managerPhone', type: 'varchar', isNullable: true },
                { name: 'wechat', type: 'varchar', isNullable: true },
                { name: 'servicePhone', type: 'varchar', isNullable: true },
                { name: 'businessHours', type: 'text', isNullable: true },
                { name: 'businessHoursText', type: 'varchar', isNullable: true },
                { name: 'timezone', type: 'varchar', isNullable: false, default: this.lit('Asia/Shanghai') },
                { name: 'specialDates', type: 'text', isNullable: true },
                { name: 'holidayPlan', type: 'text', isNullable: true },
                { name: 'status', type: 'varchar', isNullable: false, default: this.lit('OPEN') },
                { name: 'statusNote', type: 'varchar', isNullable: true },
                { name: 'reopenAt', type: this.dateColumnType, isNullable: true },
                { name: 'acceptingOrders', type: 'boolean', isNullable: false, default: true },
                { name: 'coverImage', type: 'text', isNullable: true },
                { name: 'photos', type: 'text', isNullable: true },
                { name: 'videos', type: 'text', isNullable: true },
                { name: 'panoramaUrl', type: 'text', isNullable: true },
                { name: 'notice', type: 'text', isNullable: true },
                { name: 'tags', type: 'text', isNullable: true },
                { name: 'facilities', type: 'text', isNullable: true },
                { name: 'supportsRedemption', type: 'boolean', isNullable: false, default: true },
                { name: 'redemptionHours', type: 'varchar', isNullable: true },
                { name: 'dailyRedeemLimit', type: 'int', isNullable: true },
                { name: 'requiresReservation', type: 'boolean', isNullable: false, default: false },
                { name: 'reservationPhone', type: 'varchar', isNullable: true },
                { name: 'supportsDelivery', type: 'boolean', isNullable: false, default: false },
                { name: 'deliveryRadiusKm', type: 'int', isNullable: true },
                { name: 'deliveryFee', type: 'int', isNullable: true },
                { name: 'minOrderAmount', type: 'int', isNullable: true },
                { name: 'deliveryMinutes', type: 'int', isNullable: true },
                { name: 'externalIds', type: 'text', isNullable: true },
                { name: 'source', type: 'varchar', isNullable: false, default: this.lit('MANUAL') },
                { name: 'lastSyncAt', type: this.dateColumnType, isNullable: true },
                { name: 'isPublic', type: 'boolean', isNullable: false, default: true },
                { name: 'enabled', type: 'boolean', isNullable: false, default: true },
                { name: 'createdBy', type: 'varchar', isNullable: true },
                { name: 'updatedBy', type: 'varchar', isNullable: true },
                { name: 'deletedAt', type: this.dateColumnType, isNullable: true },
            ],
            indices: [
                new TableIndex({ name: 'IDX_merchant_store_code', columnNames: ['code'], isUnique: true }),
                new TableIndex({ name: 'IDX_merchant_store_merchantId', columnNames: ['merchantId'] }),
            ],
        });

        const storeChannelTable = new Table({
            name: 'merchant_store_channel',
            columns: [
                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                { name: 'createdAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'updatedAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'storeId', type: 'int', isNullable: false },
                { name: 'channelId', type: 'int', isNullable: false },
                { name: 'role', type: 'varchar', isNullable: false, default: this.lit('OWNER') },
                { name: 'status', type: 'varchar', isNullable: false, default: this.lit('PENDING') },
                { name: 'claimedByUserId', type: 'int', isNullable: true },
                { name: 'claimedAt', type: this.dateColumnType, isNullable: true },
                { name: 'verifiedAt', type: this.dateColumnType, isNullable: true },
                { name: 'contractNo', type: 'varchar', isNullable: true },
                { name: 'note', type: 'text', isNullable: true },
            ],
            indices: [
                new TableIndex({
                    name: 'IDX_merchant_store_channel_store_channel',
                    columnNames: ['storeId', 'channelId'],
                    isUnique: true,
                }),
            ],
        });

        const storeStaffTable = new Table({
            name: 'merchant_store_staff',
            columns: [
                { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                { name: 'createdAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'updatedAt', type: this.dateColumnType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
                { name: 'storeId', type: 'int', isNullable: false },
                { name: 'userId', type: 'int', isNullable: false },
                { name: 'name', type: 'varchar', isNullable: true },
                { name: 'phone', type: 'varchar', isNullable: true },
                { name: 'role', type: 'varchar', isNullable: false, default: this.lit('CLERK') },
                { name: 'status', type: 'varchar', isNullable: false, default: this.lit('ACTIVE') },
                { name: 'lastLoginAt', type: this.dateColumnType, isNullable: true },
            ],
            indices: [
                new TableIndex({ name: 'IDX_merchant_store_staff_storeId', columnNames: ['storeId'] }),
                new TableIndex({
                    name: 'IDX_merchant_store_staff_store_user',
                    columnNames: ['storeId', 'userId'],
                    isUnique: true,
                }),
            ],
        });

        for (const table of [merchantTable, storeTable, storeChannelTable, storeStaffTable]) {
            if (!(await queryRunner.hasTable(table.name))) {
                await queryRunner.createTable(table);
            }
            await this.ensureIndexes(queryRunner, table);
        }
    }

    /** 表已存在（或建表后）补齐缺失索引（按列集合去重，避免 synchronize 已建同名索引时重复创建） */
    private async ensureIndexes(queryRunner: QueryRunner, table: Table): Promise<void> {
        const existing = await queryRunner.getTable(table.name);
        const columnKey = (columns: Array<string | { name?: string }>) =>
            columns
                .map(column => String(typeof column === 'string' ? column : column?.name ?? '').toLowerCase())
                .join(',');
        for (const index of table.indices) {
            const exists = existing?.indices.some(
                item =>
                    item.name === index.name ||
                    (columnKey(item.columnNames) === columnKey(index.columnNames) &&
                        !!item.isUnique === !!index.isUnique),
            );
            if (!exists) {
                await queryRunner.createIndex(
                    table.name,
                    new TableIndex({
                        name: index.name,
                        columnNames: index.columnNames,
                        isUnique: index.isUnique,
                    }),
                );
            }
        }
    }

    // ------------------------------------------------------------------
    // pickup_location 兼容
    // ------------------------------------------------------------------

    private quote(name: string): string {
        return this.connection.driver.escape(name);
    }

    private async ensurePickupLocationColumn(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('pickup_location'))) {
            return;
        }
        if (await queryRunner.hasColumn('pickup_location', 'merchantStoreId')) {
            return;
        }
        await queryRunner.addColumn(
            'pickup_location',
            new TableColumn({ name: 'merchantStoreId', type: 'int', isNullable: true }),
        );
    }

    /** 历史自提点（type=store）→ Merchant + MerchantStore + pickup_location.merchantStoreId 回填 */
    private async backfillPickupStores(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('pickup_location'))) {
            return;
        }
        const rows: any[] = await queryRunner.query(
            `SELECT * FROM ${this.quote('pickup_location')} WHERE ${this.quote('type')} = ${this.ph(1)}`,
            ['store'],
        );
        if (!Array.isArray(rows) || rows.length === 0) {
            return;
        }

        const merchantRepo = queryRunner.manager.getRepository(Merchant);
        const storeRepo = queryRunner.manager.getRepository(MerchantStore);

        for (const row of rows) {
            const legacyId = Number(row.id);
            if (!Number.isFinite(legacyId)) {
                continue;
            }

            // 1) 确保商户（code PL-M-<id>，名称优先 partner 再回退门店名）
            const merchantCode = `PL-M-${legacyId}`;
            let merchant = await merchantRepo.findOne({ where: { code: merchantCode } });
            if (!merchant) {
                const newMerchant = new Merchant({
                    code: merchantCode,
                    name: String(row.partner || row.name || merchantCode),
                    ownerChannelId: row.ownerChannelId != null ? Number(row.ownerChannelId) : null,
                    source: 'MIGRATION',
                    claimStatus: row.ownerChannelId != null ? 'CLAIMED' : 'UNCLAIMED',
                });
                merchant = await merchantRepo.save(newMerchant);
            }

            // 2) 确保门店（code PL-<id>）
            const storeCode = `PL-${legacyId}`;
            let store = await storeRepo.findOne({ where: { code: storeCode } });
            if (!store) {
                const coordinates = parseJson(row.coordinates) ?? {};
                const photos = parseJson(row.photos);
                const newStore = new MerchantStore({
                    merchantId: Number(merchant.id),
                    code: storeCode,
                    name: String(row.name || merchantCode),
                    storeType: 'DIRECT',
                    sortOrder: Number(row.sortOrder ?? 0),
                    country: 'CN',
                    province: row.province ?? null,
                    city: row.city ?? null,
                    district: row.district ?? null,
                    street: row.street ?? null,
                    addressLine: row.address ?? null,
                    lat: coordinates?.lat != null ? Number(coordinates.lat) : null,
                    lng: coordinates?.lng != null ? Number(coordinates.lng) : null,
                    phoneNumber: row.phoneNumber ?? null,
                    businessHoursText: row.businessHours ?? null,
                    photos: Array.isArray(photos) ? photos.map(String) : null,
                    isPublic: toBool(row.isPublic),
                    enabled: toBool(row.enabled),
                    source: 'MIGRATION',
                });
                store = await storeRepo.save(newStore);
            }

            // 3) 回填关联系 id
            await queryRunner.query(
                `UPDATE ${this.quote('pickup_location')} SET ${this.quote('merchantStoreId')} = ${this.ph(1)} WHERE ${this.quote('id')} = ${this.ph(2)}`,
                [Number(store.id), legacyId],
            );
        }
    }

    /** 校园履约配置（有 storeAddress / storePhone）→ 每渠道一个门店并 upsert 认领关系 */
    private async backfillCampusStores(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('campus_fulfillment_config'))) {
            return;
        }
        const rows: any[] = await queryRunner.query(
            `SELECT * FROM ${this.quote('campus_fulfillment_config')}`,
        );
        const configs = (Array.isArray(rows) ? rows : []).filter(
            row =>
                (row.storeAddress != null && String(row.storeAddress).trim().length > 0) ||
                (row.storePhone != null && String(row.storePhone).trim().length > 0),
        );
        if (configs.length === 0) {
            return;
        }

        const merchantRepo = queryRunner.manager.getRepository(Merchant);
        const storeRepo = queryRunner.manager.getRepository(MerchantStore);
        const claimRepo = queryRunner.manager.getRepository(MerchantStoreChannel);

        for (const config of configs) {
            const channelId = Number(config.channelId);
            if (!Number.isInteger(channelId) || channelId <= 0) {
                continue;
            }

            let merchant = await merchantRepo.findOne({ where: { code: `CF-M-${channelId}` } });
            if (!merchant) {
                const newMerchant = new Merchant({
                    code: `CF-M-${channelId}`,
                    name: String(config.storeAddress || `渠道 ${channelId} 门店`),
                    ownerChannelId: channelId,
                    source: 'MIGRATION',
                    claimStatus: 'CLAIMED',
                });
                merchant = await merchantRepo.save(newMerchant);
            }

            const storeCode = `CF-${channelId}`;
            let store = await storeRepo.findOne({ where: { code: storeCode } });
            if (!store) {
                const newStore = new MerchantStore({
                    merchantId: Number(merchant.id),
                    code: storeCode,
                    name: String(config.storeAddress || `渠道 ${channelId} 门店`),
                    storeType: 'DIRECT',
                    addressLine: config.storeAddress ?? null,
                    phoneNumber: config.storePhone ?? null,
                    lat: config.storeLat != null ? Number(config.storeLat) : null,
                    lng: config.storeLng != null ? Number(config.storeLng) : null,
                    notice: config.storeNotice ?? null,
                    source: 'MIGRATION',
                    isPublic: true,
                    enabled: true,
                });
                store = await storeRepo.save(newStore);
            }

            const storeId = Number(store.id);
            let claim = await claimRepo.findOne({ where: { storeId, channelId } });
            const now = new Date();
            if (!claim) {
                claim = claimRepo.create({ storeId, channelId });
            }
            claim.role = 'OWNER';
            claim.status = 'ACTIVE';
            claim.claimedAt = claim.claimedAt ?? now;
            claim.verifiedAt = now;
            await claimRepo.save(claim);
        }
    }
}

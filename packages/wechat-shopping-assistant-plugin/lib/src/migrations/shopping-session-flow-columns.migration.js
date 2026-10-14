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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingSessionFlowColumnsMigration = void 0;
// 幂等补 wechat_shopping_session.state/draft 两列（聊天内补录状态机：手机号 → 收货地址）。
// 仿 cjk-plugin 迁移模式：OnApplicationBootstrap + hasColumn 检查，失败不阻塞启动。
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let ShoppingSessionFlowColumnsMigration = class ShoppingSessionFlowColumnsMigration {
    constructor(connection) {
        this.connection = connection;
    }
    async onApplicationBootstrap() {
        const runner = this.connection.createQueryRunner();
        try {
            const tableName = this.connection.getMetadata('WechatShoppingSession').tableName;
            if (!(await runner.hasColumn(tableName, 'state'))) {
                await runner.addColumn(tableName, new typeorm_2.TableColumn({ name: 'state', type: 'varchar', length: '32', isNullable: true }));
                // eslint-disable-next-line no-console
                console.log(`[ShoppingSessionFlowColumnsMigration] added ${tableName}.state`);
            }
            if (!(await runner.hasColumn(tableName, 'draft'))) {
                // simple-json 实体列在方言底层为 text/json；手动建列用 text，typeorm 读写自行 JSON 序列化
                await runner.addColumn(tableName, new typeorm_2.TableColumn({ name: 'draft', type: 'text', isNullable: true }));
                // eslint-disable-next-line no-console
                console.log(`[ShoppingSessionFlowColumnsMigration] added ${tableName}.draft`);
            }
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('[ShoppingSessionFlowColumnsMigration] failed to ensure columns:', e === null || e === void 0 ? void 0 : e.message);
        }
        finally {
            await runner.release();
        }
    }
};
exports.ShoppingSessionFlowColumnsMigration = ShoppingSessionFlowColumnsMigration;
exports.ShoppingSessionFlowColumnsMigration = ShoppingSessionFlowColumnsMigration = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __metadata("design:paramtypes", [typeorm_2.Connection])
], ShoppingSessionFlowColumnsMigration);
//# sourceMappingURL=shopping-session-flow-columns.migration.js.map
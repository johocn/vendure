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
exports.AddressBookService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 地址簿服务（微信对话 CRUD + 默认地址，方案 B 列表式逐轮问答的数据层）：
 * - 列表按 id 升序（最早录入在前），index 从 1 起（对话回复编号定位）；
 * - 新增/设默认复用 core customerService.createAddress/updateAddress 内置的
 *   enforceSingleDefaultAddress（默认地址顾客内唯一，设新自动清旧）；
 * - 删除复用 core deleteAddress 内置的 reassignDefaultsForDeletedAddress
 *   （删除默认地址后剩余最早地址自动顶替）。
 */
let AddressBookService = class AddressBookService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    /** 顾客地址簿（id 升序 = 录入顺序，index 从 1 起） */
    async list(ctx, customerId) {
        var _a;
        const customer = await this.connection.getRepository(ctx, core_1.Customer).findOne({
            where: { id: customerId },
            relations: { addresses: true },
        });
        const addresses = ((_a = customer === null || customer === void 0 ? void 0 : customer.addresses) !== null && _a !== void 0 ? _a : []).slice().sort((a, b) => (Number(a.id) < Number(b.id) ? -1 : 1));
        return addresses.map((a, i) => {
            var _a, _b, _c;
            return ({
                id: String(a.id),
                index: i + 1,
                fullName: (_a = a.fullName) !== null && _a !== void 0 ? _a : '',
                phoneNumber: (_b = a.phoneNumber) !== null && _b !== void 0 ? _b : '',
                streetLine1: (_c = a.streetLine1) !== null && _c !== void 0 ? _c : '',
                isDefault: !!a.defaultShippingAddress,
            });
        });
    }
    /** 按 id 取单项（对话回显/确认卡用） */
    async getItem(ctx, customerId, addressId) {
        var _a;
        const items = await this.list(ctx, customerId);
        return (_a = items.find(a => a.id === addressId)) !== null && _a !== void 0 ? _a : null;
    }
    /** 新增地址（setDefault=true 时 core 自动清旧默认）；返回新建地址 id，失败 null */
    async add(ctx, customerId, input) {
        try {
            const address = await this.customerService.createAddress(ctx, customerId, {
                streetLine1: input.streetLine1.slice(0, 250),
                phoneNumber: input.phoneNumber,
                countryCode: 'CN',
                defaultShippingAddress: input.setDefault,
            });
            return String(address.id);
        }
        catch (e) {
            core_1.Logger.warn(`Assistant address add failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            return null;
        }
    }
    /** 改收货地址文本 */
    async updateText(ctx, addressId, text) {
        try {
            await this.customerService.updateAddress(ctx, { id: addressId, streetLine1: text.slice(0, 250) });
            return true;
        }
        catch (e) {
            core_1.Logger.warn(`Assistant address updateText failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
    /** 改收货人/电话（姓名可省略：只传电话即只改电话） */
    async updatePerson(ctx, addressId, input) {
        try {
            await this.customerService.updateAddress(ctx, Object.assign(Object.assign({ id: addressId }, (input.fullName !== undefined ? { fullName: input.fullName } : {})), (input.phoneNumber ? { phoneNumber: input.phoneNumber } : {})));
            return true;
        }
        catch (e) {
            core_1.Logger.warn(`Assistant address updatePerson failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
    /**
     * 删除地址（core deleteAddress：删默认时剩余最早地址自动顶替）。
     * 调用方删除前先 getItem 记录 isDefault，删除后重新 list 判断新默认（供对话文案展示切换提示）。
     */
    async remove(ctx, addressId) {
        try {
            await this.customerService.deleteAddress(ctx, addressId);
            return true;
        }
        catch (e) {
            core_1.Logger.warn(`Assistant address remove failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
    /** 设为默认（core 自动清旧默认，顾客内唯一） */
    async setDefault(ctx, addressId) {
        try {
            await this.customerService.updateAddress(ctx, { id: addressId, defaultShippingAddress: true });
            return true;
        }
        catch (e) {
            core_1.Logger.warn(`Assistant address setDefault failed: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            return false;
        }
    }
};
exports.AddressBookService = AddressBookService;
exports.AddressBookService = AddressBookService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService])
], AddressBookService);
//# sourceMappingURL=address.service.js.map
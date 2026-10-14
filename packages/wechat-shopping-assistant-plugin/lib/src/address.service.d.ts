import { CustomerService, RequestContext, TransactionalConnection } from '@vendure/core';
import { AddressBookItem } from './types';
/**
 * 地址簿服务（微信对话 CRUD + 默认地址，方案 B 列表式逐轮问答的数据层）：
 * - 列表按 id 升序（最早录入在前），index 从 1 起（对话回复编号定位）；
 * - 新增/设默认复用 core customerService.createAddress/updateAddress 内置的
 *   enforceSingleDefaultAddress（默认地址顾客内唯一，设新自动清旧）；
 * - 删除复用 core deleteAddress 内置的 reassignDefaultsForDeletedAddress
 *   （删除默认地址后剩余最早地址自动顶替）。
 */
export declare class AddressBookService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    /** 顾客地址簿（id 升序 = 录入顺序，index 从 1 起） */
    list(ctx: RequestContext, customerId: string | number): Promise<AddressBookItem[]>;
    /** 按 id 取单项（对话回显/确认卡用） */
    getItem(ctx: RequestContext, customerId: string | number, addressId: string): Promise<AddressBookItem | null>;
    /** 新增地址（setDefault=true 时 core 自动清旧默认）；返回新建地址 id，失败 null */
    add(ctx: RequestContext, customerId: string | number, input: {
        streetLine1: string;
        phoneNumber: string;
        setDefault: boolean;
    }): Promise<string | null>;
    /** 改收货地址文本 */
    updateText(ctx: RequestContext, addressId: string, text: string): Promise<boolean>;
    /** 改收货人/电话（姓名可省略：只传电话即只改电话） */
    updatePerson(ctx: RequestContext, addressId: string, input: {
        fullName?: string;
        phoneNumber?: string;
    }): Promise<boolean>;
    /**
     * 删除地址（core deleteAddress：删默认时剩余最早地址自动顶替）。
     * 调用方删除前先 getItem 记录 isDefault，删除后重新 list 判断新默认（供对话文案展示切换提示）。
     */
    remove(ctx: RequestContext, addressId: string): Promise<boolean>;
    /** 设为默认（core 自动清旧默认，顾客内唯一） */
    setDefault(ctx: RequestContext, addressId: string): Promise<boolean>;
}

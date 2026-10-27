import { CustomerService, RequestContext } from '@vendure/core';
import { DataSource } from 'typeorm';
/**
 * 口味偏好云端同步（P3-1）。
 * C 端原本只存本机（utils/taste-profile.ts），换设备即丢失；
 * 此处把同一份 JSON 落到 Customer.customFields.tasteProfile（物理列 customFieldsTasteprofile），
 * 登录后 C 端拉取覆盖本地，设置页保存时上行。结构校验在 C 端 normalizeProfile 完成，
 * 服务端只保证「合法 JSON 对象 + 长度上限」。
 */
export declare class TasteProfileShopResolver {
    private customerService;
    private dataSource;
    constructor(customerService: CustomerService, dataSource: DataSource);
    /** 读取本人云端口味偏好：未登录返回空串（C 端游客继续用本机存储） */
    campusMyTasteProfile(ctx: RequestContext): Promise<string>;
    /** 保存本人云端口味偏好：传空串代表清除 */
    campusUpdateTasteProfile(ctx: RequestContext, input: string): Promise<string>;
    private requireCustomerId;
}

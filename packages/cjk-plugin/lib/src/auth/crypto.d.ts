import { RequestContext } from '@vendure/core';
import type { TenantAuthConfig } from './auth-config.types';
export declare function setAuthSecret(secret: string | undefined): void;
export declare function encrypt(plain: string): string;
export declare function decrypt(payload: string): string;
export declare function isEncrypted(value: string): boolean;
/** 加密 domain 形状 authConfig 中所有敏感字段（原地修改） */
export declare function encryptAuthConfig(config: any): any;
/** 解密 domain 形状 authConfig 中所有敏感字段 */
export declare function decryptAuthConfig(config: any): any;
/** 脱敏 authConfig（管理后台读取用，secret 返回 ***） */
export declare function maskAuthConfig(config: any): any;
/** 合并保存：新值中 *** 表示保留原值，最终结果为加密后的 domain 形状 */
export declare function mergeAuthConfig(original: any, incoming: any): any;
/**
 * 把 struct 原始值（{ enabledMethods, overridesJson, ssoProvidersJson }）解析+解密为 domain 配置。
 * 不依赖 ctx，纯函数，可用于任意来源的 struct 数据。
 */
export declare function parseAndDecryptStruct(rawStruct: any): TenantAuthConfig | null;
/** 把 struct 原始值解析+解密为 domain 配置；无配置返回 null。策略/resolver 读取的统一入口 */
export declare function readChannelAuthConfig(ctx: RequestContext): TenantAuthConfig | null;
/** 策略用：取某方式的已解密凭证覆盖，无则 null */
export declare function getAuthOverride(ctx: RequestContext, method: string): any | null;
/** 把 domain 配置加密+序列化为 struct 形状（供写入 customFields.authConfig） */
export declare function serializeAuthConfigToStruct(domain: TenantAuthConfig | null): any;

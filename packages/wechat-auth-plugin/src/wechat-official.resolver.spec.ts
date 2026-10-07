import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Permission } from '@vendure/core';

// 只需类引用做元数据反射，隔离真实微信服务依赖
vi.mock('./wechat-auth.service', () => ({ WechatAuthService: class {} }));

import { WechatOfficialResolver } from './wechat-official.resolver';

/** 与 Vendure core allow.decorator.ts 的 PERMISSIONS_METADATA_KEY 一致 */
const PERMISSIONS_METADATA_KEY = '__permissions__';

const OFFICIAL_METHODS = [
    'wechatCurrentMenu',
    'wechatMenuPublish',
    'wechatMenuDelete',
    'wechatFans',
    'wechatTemplates',
    'wechatTemplateSend',
] as const;

describe('WechatOfficialResolver 访问控制（P0 修复：显式要求 SuperAdmin）', () => {
    it.each(OFFICIAL_METHODS)('%s 声明了 @Allow(Permission.SuperAdmin)，匿名不可调用', method => {
        const handler = (WechatOfficialResolver.prototype as any)[method];
        const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler);
        expect(permissions).toEqual([Permission.SuperAdmin]);
    });
});

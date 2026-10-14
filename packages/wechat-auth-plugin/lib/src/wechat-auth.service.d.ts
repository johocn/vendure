import { WechatAuthPluginOptions } from './types';
export declare class WechatAuthService {
    private options;
    private accessTokenCache;
    private miniProgramTokenCacheMap;
    private miniProgramTokenPromiseMap;
    private ticketCache;
    private accessTokenPromise;
    private ticketPromise;
    private readonly REFRESH_BUFFER_SECONDS;
    constructor(options: WechatAuthPluginOptions);
    getAccessToken(): Promise<string>;
    getJsapiTicket(): Promise<string>;
    getMiniProgramAccessToken(appId: string, appSecret: string): Promise<string>;
    private fetchAccessTokenByCredentials;
    generateJsapiSignature(url: string): Promise<{
        appId: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
    }>;
    private fetchAccessToken;
    /** 按凭证取 access_token：未传或与插件主 appId 相同时走主缓存；否则按 appId 独立缓存 */
    private getAccessTokenFor;
    private fetchJsapiTicket;
    private generateNonceStr;
    /** 微信 cgi-bin 通用 GET 请求（自动带 access_token，errcode 非 0 抛错） */
    private wxGet;
    private wxPost;
    /** 拉取当前公众号自定义菜单（get_current_selfmenu_info） */
    getOfficialMenu(): Promise<any>;
    /** 发布自定义菜单（menu/create） */
    createOfficialMenu(menu: any): Promise<any>;
    /** 删除自定义菜单（menu/delete） */
    deleteOfficialMenu(): Promise<any>;
    /** 粉丝 openid 列表（user/get，支持 next_openid 分页） */
    getFans(nextOpenid?: string): Promise<any>;
    /** 获取所有私有模板（template/get_all_private_template） */
    getTemplates(): Promise<any>;
    /** 发送模板消息（message/template/send） */
    sendTemplate(input: {
        touser: string;
        template_id: string;
        data?: any;
        url?: string;
        miniprogram?: any;
    }): Promise<any>;
    /**
     * 发送客服文本消息。cred 传渠道覆盖凭证（appId/appSecret），
     * 未传或与主 appId 一致时走主 access_token。
     */
    sendCustomText(touser: string, content: string, cred?: {
        appId?: string;
        appSecret?: string;
    }): Promise<any>;
    /** 发送客服图文消息（news，最多 8 条；imageUrl 必须为公网可访问的绝对地址） */
    sendCustomNews(touser: string, articles: Array<{
        title: string;
        description?: string;
        url?: string;
        picurl?: string;
    }>, cred?: {
        appId?: string;
        appSecret?: string;
    }): Promise<any>;
}

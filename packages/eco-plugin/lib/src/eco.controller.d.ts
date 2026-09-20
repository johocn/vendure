import { EcoReporter } from './eco-reporter.service';
/**
 * nshop 前端浏览类行为上报端点：POST /eco/events
 * body: { "action": "view_product" | "view_price", "ssoId": "12", "targetId": "1024", "extra": {} }
 * 校验通过后内部完成签名并转发到游戏服务器（fire-and-forget），本端点立即返回 { ok: true }。
 */
export declare class EcoController {
    private reporter;
    constructor(reporter: EcoReporter);
    report(body: any): {
        ok: boolean;
    };
}

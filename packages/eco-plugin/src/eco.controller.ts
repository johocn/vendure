import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { EcoReporter } from './eco-reporter.service';

/** 前端可上报的生态行为（purchase/distribute 由内部钩子触发，不开放端点） */
const FORWARD_ACTIONS = ['view_product', 'view_price'] as const;

/**
 * nshop 前端浏览类行为上报端点：POST /eco/events
 * body: { "action": "view_product" | "view_price", "ssoId": "12", "targetId": "1024", "extra": {} }
 * 校验通过后内部完成签名并转发到游戏服务器（fire-and-forget），本端点立即返回 { ok: true }。
 */
@Controller('eco')
export class EcoController {
    constructor(private reporter: EcoReporter) {}

    @Post('events')
    report(@Body() body: any): { ok: boolean } {
        const action = body?.action;
        const ssoId = body?.ssoId;
        const targetId = body?.targetId;
        if (!FORWARD_ACTIONS.includes(action) || !ssoId || !targetId) {
            throw new BadRequestException(
                `action 必须是 ${FORWARD_ACTIONS.join('/')}，且 ssoId/targetId 必填`,
            );
        }
        this.reporter.report(String(ssoId), action, String(targetId), body?.extra);
        return { ok: true };
    }
}

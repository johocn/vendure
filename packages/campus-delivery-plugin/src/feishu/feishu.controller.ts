import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { FeishuEventService } from './feishu.event.service';

/**
 * 飞书开放平台回调（事件订阅）。
 * nginx 需把 /feishu/ 反代到 Vendure（proxy_pass 末尾不要加 /，否则路径被改写）。
 */
@Controller('feishu')
export class FeishuController {
    constructor(private events: FeishuEventService) {}

    @Post('event')
    async event(@Body() body: any, @Res() res: Response): Promise<void> {
        const result = await this.events.handle(body);
        res.status(result.status).json(result.body);
    }
}

import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('douyin-auth')
export class DouyinAuthController {
    @Get('callback')
    async callback(@Req() req: Request, @Res() res: Response) {
        const code = req.query.code as string;
        res.redirect(`/?douyin_code=${code}`);
    }
}

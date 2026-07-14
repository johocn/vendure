import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('alipay-auth')
export class AlipayAuthController {
    @Get('callback')
    async callback(@Req() req: Request, @Res() res: Response) {
        const authCode = req.query.auth_code as string;
        const redirectUrl = `/?alipay_auth_code=${authCode}`;
        res.redirect(redirectUrl);
    }
}

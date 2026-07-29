import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Customer, Logger, RequestContext, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';

@Injectable()
export class MessagePushService {
    constructor(private connection: TransactionalConnection) {}

    async sendPush(ctx: RequestContext, customerId: number, title: string, body: string): Promise<void> {
        const customerRepo = this.connection.getRepository(ctx, Customer);
        const customer = await customerRepo.findOne({ where: { id: customerId as any } });
        if (!customer) {
            throw new Error(`Customer ${customerId} not found`);
        }
        const pushCid = (customer as any).customFields?.pushCid;
        if (!pushCid) {
            Logger.warn(`Customer ${customerId} has no pushCid, skipping push`, loggerCtx);
            return;
        }
        const cf = (ctx.channel as any).customFields ?? {};
        const appKey = cf.uniPushAppKey;
        const masterSecret = cf.uniPushMasterSecret;
        if (!appKey || !masterSecret) {
            Logger.warn(`Channel ${ctx.channelId} has no uniPush credentials, skipping push`, loggerCtx);
            return;
        }
        try {
            const token = await this.getToken(appKey, masterSecret);
            await this.pushSingle(appKey, token, pushCid, title, body);
            Logger.info(`Push sent to customer ${customerId}`, loggerCtx);
        } catch (e: any) {
            Logger.error(`Push failed for customer ${customerId}: ${e.message}`, loggerCtx);
            throw e;
        }
    }

    private async getToken(appKey: string, masterSecret: string): Promise<string> {
        const timestamp = Date.now();
        const sign = Buffer.from(`${appKey}${timestamp}${masterSecret}`).toString('base64');
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timestamp: String(timestamp), sign }),
        });
        const data: any = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui auth failed: ${data.msg}`);
        }
        return data.data.token;
    }

    private async pushSingle(
        appKey: string,
        token: string,
        cid: string,
        title: string,
        body: string,
    ): Promise<void> {
        const requestId = randomUUID();
        const res = await fetch(`https://restapi.getui.com/v2/${appKey}/push/single/cid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token },
            body: JSON.stringify({
                request_id: requestId,
                audience: { cid: [cid] },
                push_message: { notification: { title, body, click_type: 'payload' } },
            }),
        });
        const data: any = await res.json();
        if (data.code !== 0) {
            throw new Error(`Getui push failed: ${data.msg}`);
        }
    }
}

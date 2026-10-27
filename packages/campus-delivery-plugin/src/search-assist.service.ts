// P2-2 语音/拍照搜索：按渠道配置选择识别 Provider，统一收敛为「关键词」。
//
// 返回结构固定，不抛识别异常（失败以 { ok:false, error } 表达），避免 C 端因服务商抖动整页报错；
// 只有「类型非法 / 店铺未开启 / 服务商未注册」这类调用方错误才抛 UserInputError。
import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import {
    normalizeKeywords,
    SEARCH_ASSIST_PROVIDERS,
    SearchAssistType,
} from './search-assist';

export interface CampusSearchAssistResultShape {
    ok: boolean;
    type: SearchAssistType;
    provider: string;
    text: string;
    keywords: string[];
    latencyMs: number;
    error: string | null;
}

@Injectable()
export class SearchAssistService {
    constructor(private connection: TransactionalConnection) {}

    async assist(
        ctx: RequestContext,
        type: string,
        payload?: string | null,
    ): Promise<CampusSearchAssistResultShape> {
        const t = String(type ?? '').trim() as SearchAssistType;
        if (t !== 'voice' && t !== 'image') {
            throw new UserInputError(`不支持的识别类型: ${type || '(空)'}（仅接受 voice/image）`);
        }
        const repo = this.connection.getRepository(ctx, CampusFulfillmentConfig);
        const cfg = await repo.findOne({ where: { channelId: ctx.channelId as any } });
        const providerName = (t === 'voice' ? cfg?.voiceSearchProvider : cfg?.imageSearchProvider) ?? 'mock';
        if (!providerName || providerName === 'none') {
            throw new UserInputError(t === 'voice' ? '店铺未开启语音搜索' : '店铺未开启拍照搜索');
        }
        const provider = SEARCH_ASSIST_PROVIDERS[providerName];
        if (!provider) {
            throw new UserInputError(`不支持的识别服务商: ${providerName}`);
        }
        const started = Date.now();
        try {
            const out = await provider.recognize({ type: t, payload: payload ?? null });
            const keywords = normalizeKeywords(out.keywords);
            const latencyMs = Date.now() - started;
            if (!keywords.length) {
                return { ok: false, type: t, provider: providerName, text: out.text ?? '', keywords: [], latencyMs, error: '未识别到可用关键词' };
            }
            return { ok: true, type: t, provider: providerName, text: out.text ?? '', keywords, latencyMs, error: null };
        } catch (e: any) {
            return { ok: false, type: t, provider: providerName, text: '', keywords: [], latencyMs: Date.now() - started, error: e?.message ?? '识别失败' };
        }
    }
}

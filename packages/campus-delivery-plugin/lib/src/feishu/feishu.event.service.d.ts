import { FeishuCommandService } from './feishu.command.service';
import { FeishuConfigService } from './feishu.config';
export interface FeishuEventResult {
    status: number;
    body: Record<string, unknown>;
}
/**
 * 飞书事件订阅入口：URL 验证（challenge）→ 可选解密 → token 校验 → event_id 去重 → 异步执行指令。
 * 先返回 200 再处理业务：飞书 3 秒超时会重试，重试叠加接单/退款很难看；真正的幂等由领域层保证。
 */
export declare class FeishuEventService {
    private cfg;
    private command;
    private seen;
    constructor(cfg: FeishuConfigService, command: FeishuCommandService);
    handle(raw: any): Promise<FeishuEventResult>;
    private decode;
    private isDuplicate;
}

import { ProductSurveyService } from './product-survey.service';
import { CandidatesResponse } from './types';
/**
 * 只读候选商品端点：GET /product-survey/candidates
 * 免登录；渠道由请求头 vendure-token 解析（缺省为默认渠道）。
 * 参数：
 *  - collection：Collection slug（选品调研必填）
 *  - onsale：值为 1 时返回该渠道全部上架在售商品；与 collection 同时传时以 collection 优先
 *  - take：默认 50，上限 100
 */
export declare class ProductSurveyController {
    private productSurveyService;
    constructor(productSurveyService: ProductSurveyService);
    getCandidates(
        vendureToken: string | undefined,
        collection?: string,
        onsale?: string,
        take?: string,
    ): Promise<CandidatesResponse>;
}

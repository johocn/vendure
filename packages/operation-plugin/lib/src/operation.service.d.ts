import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { OperationItem } from './operation-item.entity';
import { OperationSection } from './operation-section.entity';
interface SectionInput {
    code?: string;
    name?: string;
    type?: string;
    displayMode?: string | null;
    enabled?: boolean;
    position?: number;
}
interface ItemInput {
    type: string;
    sortOrder: number;
    title?: string | null;
    imageAssetId?: ID | null;
    linkUrl?: string | null;
    productId?: ID | null;
}
export declare class OperationService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 全量专区（含 items，按 position 降序）。 */
    listSections(ctx: RequestContext): Promise<OperationSection[]>;
    getByCode(ctx: RequestContext, code: string): Promise<OperationSection>;
    createSection(ctx: RequestContext, input: SectionInput): Promise<OperationSection>;
    updateSection(ctx: RequestContext, id: ID, input: Exclude<SectionInput, 'code'>): Promise<OperationSection>;
    deleteSection(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 整段替换条目：删除该专区旧条目后按输入全量重建（幂等，按 sortOrder 有序）。 */
    setOperationItems(ctx: RequestContext, sectionId: ID, items: ItemInput[]): Promise<OperationItem[]>;
    /** 校验专区存在（按 id + channel 过滤）。 */
    private requireSection;
    /** 仅已启用专区，按 position 降序；items 按 sortOrder 升序。 */
    listEnabled(ctx: RequestContext): Promise<OperationSection[]>;
    /** 按 code 取单个已启用专区；未启用返回 null。 */
    getEnabledByCode(ctx: RequestContext, code: string): Promise<OperationSection | null>;
    /** 批量解析条目目标（product / imageUrl），一次查询防 N+1；结果挂在条目实体上供 ResolveField 读取。 */
    resolveTargets(ctx: RequestContext, sections: OperationSection[]): Promise<void>;
    private sortItems;
}
export {};

import { RoomTemplate } from './room-template.entity';
import { RoomTemplateSeed } from './room-template-seeds';
/**
 * 决定哪些种子需要插入。
 * rule: 已存在(同名 code) → 跳过；被客户删除(control.deleted) → 跳过且不补回；否则 → 插入。
 * 纯函数，便于单测。
 */
export declare function resolveSeedActions(existingCodes: Set<string>, deletedCodes: Set<string>): RoomTemplateSeed[];
/** 由待插入种子生成完整模板实体输入。 */
export declare function seedsToInsertInputs(seeds: RoomTemplateSeed[]): Array<Omit<RoomTemplate, 'id' | 'createdAt' | 'updatedAt'>>;

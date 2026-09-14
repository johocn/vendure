import { RoomTemplate } from './room-template.entity';
import { ROOM_TEMPLATE_SEEDS, RoomTemplateSeed, buildSeedTemplate } from './room-template-seeds';

/**
 * 决定哪些种子需要插入。
 * rule: 已存在(同名 code) → 跳过；被客户删除(control.deleted) → 跳过且不补回；否则 → 插入。
 * 纯函数，便于单测。
 */
export function resolveSeedActions(existingCodes: Set<string>, deletedCodes: Set<string>): RoomTemplateSeed[] {
    return ROOM_TEMPLATE_SEEDS.filter((s) => !existingCodes.has(s.code) && !deletedCodes.has(s.code));
}

/** 由待插入种子生成完整模板实体输入。 */
export function seedsToInsertInputs(seeds: RoomTemplateSeed[]): Array<Omit<RoomTemplate, 'id' | 'createdAt' | 'updatedAt'>> {
    return seeds.map(buildSeedTemplate);
}

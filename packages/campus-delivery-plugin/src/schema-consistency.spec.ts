/**
 * campus-delivery schema 自洽性自检。
 *
 * 背景：#51d30f2cc 给 shop-api 文档加了查询字段 `campusProductDailyStock`，
 * 但类型 `CampusProductDailyStock` 只加在 admin 文档里，导致启动时
 * `ext[29] extendSchema ERROR: Unknown type "CampusProductDailyStock"` 崩溃（#c850166d4 修复）。
 *
 * 本用例把「文档内引用的命名类型」与「文档自身定义 + Vendure 基础 schema 定义」做比对，
 * 任何引用了未定义类型的 schema 文档都会在单测阶段失败，不必等到启动才发现。
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { DocumentNode, parse } from 'graphql';
import { describe, expect, it } from 'vitest';

import { CampusDeliveryPlugin } from './campus-delivery.plugin';

/** GraphQL 内置标量，无需定义 */
const BUILT_IN_SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

/** 真正「定义」类型的节点 kind（`extend type X` 只是引用，不算定义） */
const DEFINITION_KINDS = new Set([
    'ObjectTypeDefinition',
    'InputObjectTypeDefinition',
    'EnumTypeDefinition',
    'ScalarTypeDefinition',
    'UnionTypeDefinition',
    'InterfaceTypeDefinition',
]);

/**
 * Vendure 在运行时才生成的类型（不由 .graphql 文件或插件文档定义）。
 * 目前只需 Permission（generatePermissionEnum 生成）；如新增请在此登记并注明来源。
 */
const RUNTIME_GENERATED_TYPES = new Set(['Permission']);

function walkAst(node: any, visit: (node: any) => void): void {
    visit(node);
    for (const key of Object.keys(node)) {
        if (key === 'loc') {
            continue;
        }
        const value = node[key];
        if (Array.isArray(value)) {
            value.forEach(item => {
                if (item && typeof item === 'object' && typeof item.kind === 'string') {
                    walkAst(item, visit);
                }
            });
        } else if (value && typeof value === 'object' && typeof value.kind === 'string') {
            walkAst(value, visit);
        }
    }
}

/** 收集文档中定义的命名类型 + 引用的命名类型 */
function collectTypeNames(doc: DocumentNode): { defined: Set<string>; referenced: Set<string> } {
    const defined = new Set<string>();
    const referenced = new Set<string>();
    for (const def of doc.definitions) {
        const name = (def as any).name?.value;
        if (name && DEFINITION_KINDS.has(def.kind)) {
            defined.add(name);
        }
    }
    walkAst(doc, node => {
        if (node.kind === 'NamedType') {
            referenced.add(node.name.value);
        }
    });
    BUILT_IN_SCALARS.forEach(name => referenced.delete(name));
    return { defined, referenced };
}

/** 从 cwd 向上找到仓库根（兼容从包目录或仓库根运行） */
function findRepoRoot(start: string): string {
    let dir = resolve(start);
    for (;;) {
        if (existsSync(join(dir, 'packages/core/src/api/schema'))) {
            return dir;
        }
        const parent = resolve(dir, '..');
        if (parent === dir) {
            throw new Error(`未找到仓库根（从 ${start} 向上查找 packages/core/src/api/schema 失败）`);
        }
        dir = parent;
    }
}

function listGraphqlFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listGraphqlFiles(full));
        } else if (entry.name.endsWith('.graphql')) {
            files.push(full);
        }
    }
    return files;
}

/** Vendure 基础 schema 中定义的命名类型（common + 对应 api 目录） */
function collectBaseTypeNames(schemaRoot: string, apiDir: 'shop-api' | 'admin-api'): Set<string> {
    const defined = new Set<string>();
    const files = [...listGraphqlFiles(join(schemaRoot, 'common')), ...listGraphqlFiles(join(schemaRoot, apiDir))];
    for (const file of files) {
        const names = collectTypeNames(parse(readFileSync(file, 'utf8'), { noLocation: true }));
        names.defined.forEach(name => defined.add(name));
    }
    return defined;
}

/** 插件的 schema 文档（schema 支持 DocumentNode 或 (schema) => DocumentNode） */
function getPluginSchemaDoc(apiType: 'shop' | 'admin'): DocumentNode {
    const extension = Reflect.getMetadata(`${apiType}ApiExtensions`, CampusDeliveryPlugin);
    expect(extension, `CampusDeliveryPlugin 缺少 ${apiType}ApiExtensions`).toBeTruthy();
    const schema = extension.schema;
    return typeof schema === 'function' ? schema(undefined) : schema;
}

const repoRoot = findRepoRoot(process.cwd());
const schemaRoot = join(repoRoot, 'packages/core/src/api/schema');

/** 文档中引用了、但文档自身与基础 schema 都未定义的命名类型 */
function findUndefinedTypes(doc: DocumentNode, baseDefined: Set<string>): string[] {
    const { defined, referenced } = collectTypeNames(doc);
    return [...referenced].filter(
        name => !defined.has(name) && !baseDefined.has(name) && !RUNTIME_GENERATED_TYPES.has(name),
    );
}

describe('campus-delivery schema 自洽性', () => {
    it.each(['shop', 'admin'] as const)('%s-api 文档引用的类型均已定义', apiType => {
        const doc = getPluginSchemaDoc(apiType);
        const baseDefined = collectBaseTypeNames(schemaRoot, apiType === 'shop' ? 'shop-api' : 'admin-api');
        const missing = findUndefinedTypes(doc, baseDefined);

        expect(
            missing,
            `${apiType}-api schema 文档引用了未定义类型：${missing.join(', ')}。` +
                '若该类型应由其它插件提供，请在本用例的 RUNTIME_GENERATED_TYPES/白名单中登记',
        ).toEqual([]);
    });

    // 回归：#51d30f2cc 的 shop 文档只有字段、没有类型定义，检测逻辑必须能报出来
    it('回归：引用未定义类型时能被检出（#51d30f2cc）', () => {
        const buggyDoc = parse(
            'extend type Query { campusProductDailyStock: [CampusProductDailyStock!]! }',
            { noLocation: true },
        );
        const missing = findUndefinedTypes(buggyDoc, collectBaseTypeNames(schemaRoot, 'shop-api'));
        expect(missing).toContain('CampusProductDailyStock');
    });
});

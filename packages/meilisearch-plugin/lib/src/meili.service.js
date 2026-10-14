"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeiliService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("./constants");
let MeiliService = class MeiliService {
    constructor(opts) {
        this.opts = opts;
    }
    async req(method, path, body) {
        const res = await fetch(`${this.opts.host}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.opts.adminKey}`,
                'Content-Type': 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error(`Meili ${method} ${path} -> ${res.status}: ${await res.text()}`);
        return res.status === 204 ? null : res.json();
    }
    indexUid(locale) {
        return `${this.opts.indexPrefix}-${locale}`;
    }
    async ensureIndexes() {
        for (const locale of this.opts.locales) {
            const uid = this.indexUid(locale);
            await this.req('POST', '/indexes', { uid, primaryKey: 'id' }).catch(e => {
                if (!String(e).includes('index_already_exists'))
                    throw e; // 幂等
            });
            await this.req('PATCH', `/indexes/${uid}/settings`, {
                searchableAttributes: ['title', 'body', 'tags'],
                filterableAttributes: ['type', 'channelId', 'status', 'tags', 'collectionIds'],
                sortableAttributes: ['updatedAt', 'price'],
            });
        }
    }
    async upsertDocuments(locale, docs) {
        if (!docs.length)
            return;
        await this.req('POST', `/indexes/${this.indexUid(locale)}/documents?primaryKey=id`, docs);
    }
    /**
     * 商品搜索（shop 侧统一入口）：
     * filter 固定 type=product + status=published，可叠加 channelId；
     * 权重由 ensureIndexes 的 searchableAttributes 决定（title > tags > body）。
     */
    async search(locale, params) {
        var _a, _b, _c, _d, _e, _f;
        const filter = ["type = 'product'", "status = 'published'"];
        if (params.channelId)
            filter.push(`channelId = '${String(params.channelId).replace(/'/g, "''")}'`);
        const body = {
            q: params.q,
            limit: (_a = params.limit) !== null && _a !== void 0 ? _a : 10,
            offset: (_b = params.offset) !== null && _b !== void 0 ? _b : 0,
            filter,
        };
        const r = await this.req('POST', `/indexes/${this.indexUid(locale)}/search`, body);
        return {
            hits: ((_c = r.hits) !== null && _c !== void 0 ? _c : []),
            total: (_e = (_d = r.estimatedTotalHits) !== null && _d !== void 0 ? _d : r.totalHits) !== null && _e !== void 0 ? _e : 0,
            processingTimeMs: (_f = r.processingTimeMs) !== null && _f !== void 0 ? _f : 0,
        };
    }
    async deleteDocuments(locale, ids) {
        if (!ids.length)
            return;
        await this.req('POST', `/indexes/${this.indexUid(locale)}/documents/delete-batch`, ids);
    }
    async stats() {
        const s = await this.req('GET', '/stats');
        return this.opts.locales.map(locale => {
            var _a, _b, _c;
            const uid = this.indexUid(locale);
            return {
                index: uid,
                documents: (_c = (_b = (_a = s.indexes) === null || _a === void 0 ? void 0 : _a[uid]) === null || _b === void 0 ? void 0 : _b.numberOfDocuments) !== null && _c !== void 0 ? _c : 0,
                healthy: true,
            };
        });
    }
    async health() {
        try {
            const body = (await (await fetch(`${this.opts.host}/health`)).json());
            return body.status === 'available';
        }
        catch (_a) {
            return false;
        }
    }
    async triggerContentReindex() {
        if (!this.opts.reindexUrl || !this.opts.sharedSecret)
            return false;
        const res = await fetch(this.opts.reindexUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-zhao-secret': this.opts.sharedSecret },
            body: '{}',
        });
        if (!res.ok)
            throw new Error(`Strapi reindex -> ${res.status}: ${await res.text()}`);
        return true;
    }
};
exports.MeiliService = MeiliService;
exports.MeiliService = MeiliService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.MEILI_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], MeiliService);
//# sourceMappingURL=meili.service.js.map
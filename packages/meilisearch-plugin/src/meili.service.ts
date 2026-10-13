import { Inject, Injectable } from '@nestjs/common';
import { MEILI_PLUGIN_OPTIONS } from './constants';
import { KbDocument, MeiliIndexStatus, MeiliPluginOptions } from './types';

@Injectable()
export class MeiliService {
    constructor(@Inject(MEILI_PLUGIN_OPTIONS) private opts: MeiliPluginOptions) {}

    private async req(method: string, path: string, body?: unknown): Promise<any> {
        const res = await fetch(`${this.opts.host}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.opts.adminKey}`,
                'Content-Type': 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Meili ${method} ${path} -> ${res.status}: ${await res.text()}`);
        return res.status === 204 ? null : res.json();
    }

    indexUid(locale: string) {
        return `${this.opts.indexPrefix}-${locale}`;
    }

    async ensureIndexes(): Promise<void> {
        for (const locale of this.opts.locales) {
            const uid = this.indexUid(locale);
            await this.req('POST', '/indexes', { uid, primaryKey: 'id' }).catch(e => {
                if (!String(e).includes('index_already_exists')) throw e; // 幂等
            });
            await this.req('PATCH', `/indexes/${uid}/settings`, {
                searchableAttributes: ['title', 'body', 'tags'],
                filterableAttributes: ['type', 'channelId', 'status', 'tags', 'collectionIds'],
                sortableAttributes: ['updatedAt', 'price'],
            });
        }
    }

    async upsertDocuments(locale: string, docs: KbDocument[]): Promise<void> {
        if (!docs.length) return;
        await this.req('POST', `/indexes/${this.indexUid(locale)}/documents?primaryKey=id`, docs);
    }

    async deleteDocuments(locale: string, ids: string[]): Promise<void> {
        if (!ids.length) return;
        await this.req('POST', `/indexes/${this.indexUid(locale)}/documents/delete-batch`, ids);
    }

    async stats(): Promise<MeiliIndexStatus[]> {
        const s = await this.req('GET', '/stats');
        return this.opts.locales.map(locale => {
            const uid = this.indexUid(locale);
            return {
                index: uid,
                documents: s.indexes?.[uid]?.numberOfDocuments ?? 0,
                healthy: true,
            };
        });
    }

    async health(): Promise<boolean> {
        try {
            const body = (await (await fetch(`${this.opts.host}/health`)).json()) as { status?: string };
            return body.status === 'available';
        } catch {
            return false;
        }
    }

    async triggerContentReindex(): Promise<boolean> {
        if (!this.opts.reindexUrl || !this.opts.sharedSecret) return false;
        const res = await fetch(this.opts.reindexUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-zhao-secret': this.opts.sharedSecret },
            body: '{}',
        });
        if (!res.ok) throw new Error(`Strapi reindex -> ${res.status}: ${await res.text()}`);
        return true;
    }
}

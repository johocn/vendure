"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMethodHooks = void 0;
const core_1 = require("@vendure/core");
const javascript_stringify_1 = require("javascript-stringify");
const method_hooks_service_1 = require("../service/method-hooks.service");
exports.defaultMethodHooks = [
    (0, method_hooks_service_1.registerMethodHooks)(core_1.CacheService, {
        get: {
            pre: ({ args: [key], span }) => {
                span.setAttribute('cache.key', key);
            },
            post: ({ args: [key], result: hit, span }) => {
                span.setAttribute('cache.hit', !!hit);
                if (hit) {
                    span.addEvent('cache.hit', { key });
                }
                else {
                    span.addEvent('cache.miss', { key });
                }
            },
        },
        set: {
            pre: ({ args: [key], span }) => {
                span.setAttribute('cache.key', key);
            },
        },
        delete: {
            pre: ({ args: [key], span }) => {
                span.setAttribute('cache.key', key);
            },
        },
        invalidateTags: {
            pre: ({ args: [tags], span }) => {
                span.setAttribute('cache.tags', tags.join(', '));
            },
        },
    }),
    (0, method_hooks_service_1.registerMethodHooks)(core_1.EventBus, {
        publish: {
            pre: ({ args: [event], span }) => {
                span.setAttribute('event', event.constructor.name);
                span.setAttribute('event.timestamp', event.createdAt.toISOString());
            },
        },
    }),
    (0, method_hooks_service_1.registerMethodHooks)(core_1.JobQueueService, {
        createQueue: {
            pre: ({ args: [options], span }) => {
                span.setAttribute('job-queue.name', options.name);
            },
        },
    }),
    (0, method_hooks_service_1.registerMethodHooks)(core_1.JobQueue, {
        start: {
            pre: ({ instance, span }) => {
                span.setAttribute('job-queue.name', instance.name);
            },
        },
        add: {
            pre: ({ args: [data, options], span, instance }) => {
                var _a, _b;
                span.setAttribute('job.queueName', instance.name);
                span.setAttribute('job.data', (_a = (0, javascript_stringify_1.stringify)(data, null, 2, {
                    maxDepth: 3,
                })) !== null && _a !== void 0 ? _a : '');
                span.setAttribute('job.retries', (_b = options === null || options === void 0 ? void 0 : options.retries) !== null && _b !== void 0 ? _b : 0);
            },
            post({ result, span }) {
                span.setAttribute('job.buffered', result.id === 'buffered');
            },
        },
    }),
];
//# sourceMappingURL=default-method-hooks.js.map
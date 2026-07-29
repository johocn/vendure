"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csOrderCustomFields = void 0;
exports.csOrderCustomFields = {
    Order: [
        {
            name: 'csNotes',
            type: 'struct',
            list: true,
            public: false,
            fields: [
                { name: 'content', type: 'string' },
                { name: 'createdBy', type: 'string' },
                { name: 'createdAt', type: 'datetime' },
            ],
        },
    ],
};

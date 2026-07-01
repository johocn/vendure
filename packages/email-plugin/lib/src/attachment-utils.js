"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAttachments = serializeAttachments;
exports.deserializeAttachments = deserializeAttachments;
const core_1 = require("@vendure/core");
const stream_1 = require("stream");
const url_1 = require("url");
const constants_1 = require("./constants");
async function serializeAttachments(attachments) {
    const promises = attachments.map(async (a) => {
        const stringPath = (path) => (typeof path === 'string' ? path : (0, url_1.format)(path));
        const content = a.content instanceof stream_1.Stream ? await streamToBuffer(a.content) : a.content;
        return Object.assign(Object.assign({ filename: null, cid: null, encoding: null, contentType: null, contentTransferEncoding: null, contentDisposition: null, headers: null }, a), { path: a.path ? stringPath(a.path) : null, content: JSON.stringify(content) });
    });
    return Promise.all(promises);
}
function deserializeAttachments(serializedAttachments) {
    return serializedAttachments.map(a => {
        const content = parseContent(a.content);
        if (content instanceof Buffer && 50 * 1024 <= content.length) {
            core_1.Logger.warn(`Email has a large 'content' attachment (${Math.round(content.length / 1024)}k). Consider using the 'path' instead for improved performance.`, constants_1.loggerCtx);
        }
        return {
            filename: nullToUndefined(a.filename),
            cid: nullToUndefined(a.cid),
            encoding: nullToUndefined(a.encoding),
            contentType: nullToUndefined(a.contentType),
            contentTransferEncoding: nullToUndefined(a.contentTransferEncoding),
            contentDisposition: nullToUndefined(a.contentDisposition),
            headers: nullToUndefined(a.headers),
            path: nullToUndefined(a.path),
            content,
        };
    });
}
function parseContent(content) {
    try {
        const parsedContent = content && JSON.parse(content);
        if (typeof parsedContent === 'string') {
            return parsedContent;
        }
        else if (parsedContent.hasOwnProperty('data')) {
            return Buffer.from(parsedContent.data);
        }
    }
    catch (e) {
        // empty
    }
}
function streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => {
            chunks.push(Buffer.from(chunk));
        });
        stream.on('error', err => reject(err));
        stream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
    });
}
function nullToUndefined(input) {
    return input == null ? undefined : input;
}
//# sourceMappingURL=attachment-utils.js.map
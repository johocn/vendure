declare module 'pdfkit' {
    import { Stream } from 'stream';

    class PDFDocument extends Stream {
        constructor(options?: PDFDocumentOptions);
        fontSize(size: number): PDFDocument;
        text(text: string, options?: { align?: string; underline?: boolean }): PDFDocument;
        moveDown(lines?: number): PDFDocument;
        end(): void;
        on(event: 'data', listener: (chunk: Buffer) => void): this;
        on(event: 'end', listener: () => void): this;
        on(event: 'error', listener: (err: Error) => void): this;
    }

    interface PDFDocumentOptions {
        size?: string;
        margin?: number;
    }

    export = PDFDocument;
}

import { graphql } from '@/graphql/graphql';
import { Button, api } from '@vendure/dashboard';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const exportInvoicesCsv = graphql(`
    query ExportInvoicesCsv {
        exportInvoicesCsv
    }
`);

export function InvoiceExportButton() {
    const [busy, setBusy] = useState(false);

    const doExport = async () => {
        setBusy(true);
        try {
            const res = await api.query(exportInvoicesCsv);
            const csv = (res as any).exportInvoicesCsv as string;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Export succeeded');
        } catch (e: any) {
            toast.error(e?.message ?? 'Export failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button type="button" onClick={doExport} disabled={busy} variant="secondary">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export CSV
        </Button>
    );
}
import { LabeledData } from '@/vdb/components/labeled-data.js';
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, DashboardPageBlockDefinition } from '@vendure/dashboard';
import { useState } from 'react';

const generateInvoicePdfMutation = graphql(`
    mutation GenerateInvoicePdf($orderId: ID!) {
        generateInvoicePdf(orderId: $orderId) {
            url
            invoiceNumber
        }
    }
`);

export const invoicePdfBlock: DashboardPageBlockDefinition = {
    id: 'invoice-pdf-info',
    title: <Trans>Invoice</Trans>,
    location: {
        pageId: 'order-detail',
        column: 'side',
        position: { blockId: 'main-form', order: 'after' },
    },
    shouldRender: context => {
        const order = context.entity as any;
        return !!order?.customFields?.invoiceRequired;
    },
    component: ({ context }) => {
        const order = context.entity as any;
        const cf = order?.customFields;
        const [generating, setGenerating] = useState(false);

        if (!cf) return null;

        const handleGenerate = async () => {
            setGenerating(true);
            try {
                await generateInvoicePdfMutation({ orderId: String(order.id) });
                window.location.reload();
            } finally {
                setGenerating(false);
            }
        };

        return (
            <div className="space-y-2">
                <LabeledData label="Invoice Type">{cf.invoiceType || '-'}</LabeledData>
                <LabeledData label="Invoice Title">{cf.invoiceTitle || '-'}</LabeledData>
                <LabeledData label="Tax Number">{cf.invoiceTaxNumber || '-'}</LabeledData>
                <LabeledData label="Email">{cf.invoiceEmail || '-'}</LabeledData>
                {cf.invoiceType === 'special' && (
                    <>
                        <LabeledData label="Company Address">{cf.invoiceCompanyAddress || '-'}</LabeledData>
                        <LabeledData label="Company Phone">{cf.invoiceCompanyPhone || '-'}</LabeledData>
                        <LabeledData label="Bank Name">{cf.invoiceBankName || '-'}</LabeledData>
                        <LabeledData label="Bank Account">{cf.invoiceBankAccount || '-'}</LabeledData>
                    </>
                )}
                <div className="flex gap-2 pt-2">
                    {!cf.invoicePdfUrl && (
                        <Button size="sm" onClick={handleGenerate} disabled={generating}>
                            {generating ? 'Generating...' : 'Generate PDF'}
                        </Button>
                    )}
                    {cf.invoicePdfUrl && (
                        <a href={cf.invoicePdfUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">Download PDF</Button>
                        </a>
                    )}
                </div>
            </div>
        );
    },
};

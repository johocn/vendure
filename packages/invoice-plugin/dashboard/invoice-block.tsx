import { LabeledData } from '@/vdb/components/labeled-data.js';
import { Trans } from '@lingui/react/macro';
import { DashboardPageBlockDefinition } from '@vendure/dashboard';

export const invoiceBlock: DashboardPageBlockDefinition = {
    id: 'invoice-info',
    title: <Trans>Invoice Information</Trans>,
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
        if (!cf) return null;

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
            </div>
        );
    },
};

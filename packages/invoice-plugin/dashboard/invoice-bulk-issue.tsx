import { graphql } from '@/graphql/graphql';
import { useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { api, DataTableBulkActionItem, usePaginatedList } from '@vendure/dashboard';
import type { BulkActionComponent } from '@vendure/dashboard';
import { FileCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const bulkIssueInvoices = graphql(`
    mutation BulkIssueInvoices($ids: [ID!]!) {
        bulkIssueInvoices(ids: $ids) {
            id
            status
            invoiceNo
        }
    }
`);

export const BulkIssueInvoicesAction: BulkActionComponent<any> = ({ selection, table }) => {
    const { refetchPaginatedList } = usePaginatedList();
    const { t } = useLingui();
    const pendingInvoices = selection.filter(inv => inv.status === 'pending');
    const count = pendingInvoices.length;

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const results = await Promise.allSettled(
                pendingInvoices.map(inv => api.mutate(bulkIssueInvoices, { ids: [inv.id] })),
            );
            return {
                fulfilled: results.filter(r => r.status === 'fulfilled').length,
                rejected: results.filter(r => r.status === 'rejected').length,
            };
        },
        onSuccess: ({ fulfilled, rejected }) => {
            if (fulfilled > 0) {
                toast.success(t`Successfully issued ${fulfilled} invoices`);
            }
            if (rejected > 0) {
                toast.error(t`Failed to issue ${rejected} invoices`);
            }
            refetchPaginatedList();
            table.resetRowSelection();
        },
    });

    if (count === 0) {
        return null;
    }

    return (
        <DataTableBulkActionItem
            requiresPermission={['UpdateOrder']}
            onClick={() => mutate()}
            disabled={isPending}
            label={
                isPending ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t`Issuing...`}
                    </span>
                ) : (
                    t`Issue ${count} invoices`
                )
            }
            confirmationText={t`Are you sure you want to issue ${count} pending invoice(s)?`}
            icon={FileCheck}
        />
    );
};
import { graphql } from '@/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@vendure/dashboard';
import { useState } from 'react';

const getLogisticsTracking = graphql(`
    query GetLogisticsTracking($carrierCode: String!, $trackingNumber: String!) {
        logisticsTracking(carrierCode: $carrierCode, trackingNumber: $trackingNumber) {
            carrierCode
            trackingNumber
            traces {
                time
                status
                description
            }
        }
    }
`);

interface LogisticsTrackingDialogProps {
    carrierCode: string;
    trackingNumber: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LogisticsTrackingDialog({
    carrierCode,
    trackingNumber,
    open,
    onOpenChange,
}: LogisticsTrackingDialogProps) {
    const [traces, setTraces] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleQuery = async () => {
        setLoading(true);
        try {
            const result = await getLogisticsTracking({
                carrierCode,
                trackingNumber,
            });
            setTraces(result?.logisticsTracking?.traces ?? []);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        <Trans>Logistics Tracking</Trans> - {trackingNumber}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Button onClick={handleQuery} disabled={loading}>
                        {loading ? 'Loading...' : 'Query Tracking'}
                    </Button>
                    {traces.length > 0 && (
                        <div className="space-y-1">
                            {traces.map((trace, i) => (
                                <div key={i} className="flex gap-2 text-sm">
                                    <span className="text-muted-foreground whitespace-nowrap">{trace.time}</span>
                                    <span>{trace.description}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

import {
    ActionBarItem,
    api,
    Button,
    DashboardRouteDefinition,
    DetailPageButton,
    graphql,
    ListPage,
    PermissionGuard,
    toast,
} from '@vendure/dashboard';
import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PlusIcon, Trash2 } from 'lucide-react';

const getPickupLocations = graphql(`
    query GetPickupLocations($options: ListQueryOptions) {
        pickupLocations(options: $options) {
            items {
                id
                name
                type
                address
                phoneNumber
                businessHours
                partner
            }
            totalItems
        }
    }
`);

const deletePickupLocationDocument = graphql(`
    mutation DeletePickupLocation($id: ID!) {
        deletePickupLocation(id: $id)
    }
`);

export const pickupLocationList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'settings',
        id: 'pickup-locations',
        url: '/pickup-locations',
        title: 'Pickup Locations',
        requiresPermission: ['ReadSettings'],
    },
    path: '/pickup-locations',
    loader: () => ({
        breadcrumb: 'Pickup Locations',
    }),
    component: route => <PickupLocationListPage route={route} />,
};

function PickupLocationListPage({ route }: { route: any }) {
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.mutate(deletePickupLocationDocument, { id }),
        onSuccess: () => {
            toast.success('删除成功');
            queryClient.invalidateQueries();
        },
        onError: (error: any) => {
            toast.error('删除失败: ' + (error?.message || '未知错误'));
        },
    });

    const handleDelete = (id: string) => {
        if (window.confirm('确认删除此自提点?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <ListPage
            pageId="pickup-location-list"
            title={<Trans>Pickup Locations</Trans>}
            listQuery={getPickupLocations}
            route={route}
            defaultVisibility={{
                phoneNumber: false,
                businessHours: false,
                partner: false,
            }}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: 'Name',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
                actions: {
                    header: '操作',
                    cell: ({ row }) => (
                        <PermissionGuard requires={['PickupLocationDelete']}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(row.original.id)}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </PermissionGuard>
                    ),
                },
            }}
        >
            <ActionBarItem itemId="create-button" requiresPermission={['PickupLocationCreate']}>
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <Trans>新建自提点</Trans>
                </Button>
            </ActionBarItem>
        </ListPage>
    );
}

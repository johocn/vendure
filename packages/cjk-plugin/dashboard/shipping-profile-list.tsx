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

const getShippingProfiles = graphql(`
    query GetShippingProfiles($options: ListQueryOptions) {
        shippingProfiles(options: $options) {
            items {
                id
                name
                code
                description
                freeShippingThreshold
                isGlobal
            }
            totalItems
        }
    }
`);

const deleteShippingProfileDocument = graphql(`
    mutation DeleteShippingProfile($id: ID!) {
        deleteShippingProfile(id: $id)
    }
`);

export const shippingProfileList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'settings',
        id: 'shipping-profiles',
        url: '/shipping-profiles',
        title: '配送档案',
        requiresPermission: ['ReadSettings'],
    },
    path: '/shipping-profiles',
    loader: () => ({
        breadcrumb: '配送档案',
    }),
    component: route => <ShippingProfileListPage route={route} />,
};

function ShippingProfileListPage({ route }: { route: any }) {
    const queryClient = useQueryClient();
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.mutate(deleteShippingProfileDocument, { id }),
        onSuccess: () => {
            toast.success('删除成功');
            queryClient.invalidateQueries();
        },
        onError: (error: any) => {
            toast.error('删除失败: ' + (error?.message || '未知错误'));
        },
    });

    const handleDelete = (id: string) => {
        if (window.confirm('确认删除此配送档案？被引用的商品需要先重新分配')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <ListPage
            pageId="shipping-profile-list"
            title={<Trans>配送档案</Trans>}
            listQuery={getShippingProfiles}
            route={route}
            customizeColumns={{
                id: {
                    header: 'ID',
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.id} />,
                },
                name: {
                    header: <Trans>名称</Trans>,
                    cell: ({ row }) => <DetailPageButton id={row.original.id} label={row.original.name} />,
                },
                code: {
                    header: <Trans>编码</Trans>,
                },
                freeShippingThreshold: {
                    header: <Trans>免邮门槛</Trans>,
                    cell: ({ row }) => <span>{row.original.freeShippingThreshold ?? '-'}</span>,
                },
                isGlobal: {
                    header: <Trans>全局</Trans>,
                    cell: ({ row }) => <span>{row.original.isGlobal ? '是' : '否'}</span>,
                },
                actions: {
                    header: <Trans>操作</Trans>,
                    cell: ({ row }) => (
                        <PermissionGuard requires={['ShippingProfileDelete']}>
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
            <ActionBarItem itemId="create-button" requiresPermission={['ShippingProfileCreate']}>
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <Trans>新建配送档案</Trans>
                </Button>
            </ActionBarItem>
        </ListPage>
    );
}
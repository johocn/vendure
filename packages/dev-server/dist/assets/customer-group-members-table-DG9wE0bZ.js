import{ay as a,b7 as y,aR as h,aS as A,ax as o,gc as j,aA as L,gd as N,j as s,ew as P,P as $,aU as T,g5 as D,Q as F,L as G}from"./index-CfivDxyc.js";import{C as M}from"./customer-selector-BFPANTem.js";const n=G(`
    query CustomerGroupMemberList($id: ID!, $options: CustomerListOptions) {
        customerGroup(id: $id) {
            customers(options: $options) {
                items {
                    id
                    createdAt
                    updatedAt
                    firstName
                    lastName
                    emailAddress
                }
                totalItems
            }
        }
    }
`);function q({customerGroupId:r,canAddCustomers:u=!0}){const[d,l]=a.useState([]),[m,c]=a.useState(1),[g,p]=a.useState(10),[C,f]=a.useState([]),{_:i}=y(),S=h(),{mutate:x}=A({mutationFn:L.mutate(N),onSuccess:()=>{o.success(i({id:"y3tQ/s"})),S.invalidateQueries({queryKey:[j,n]})},onError:()=>{o.error(i({id:"ZlA28n"}))}});return s.jsxs("div",{children:[s.jsx(P,{listQuery:D(n),transformVariables:e=>({...e,id:r}),page:m,itemsPerPage:g,sorting:d,columnFilters:C,onPageChange:(e,t,b)=>{c(t),p(b)},onSortChange:(e,t)=>{l(t)},onFilterChange:(e,t)=>{f(t)},onSearchTermChange:e=>({lastName:{contains:e},emailAddress:{contains:e}}),additionalColumns:{name:{header:"Name",cell:({row:e})=>{const t=`${e.original.firstName} ${e.original.lastName}`;return s.jsx($,{render:s.jsx(T,{to:"/customers/$id",params:{id:e.original.id}}),variant:"ghost",children:t})}}},defaultColumnOrder:["name","emailAddress"],defaultVisibility:{id:!1,createdAt:!1,updatedAt:!1,firstName:!1,lastName:!1}}),u&&s.jsx(M,{onSelect:e=>{x({customerId:e.id,groupId:r})},label:s.jsx(F,{id:"IswRMs"})})]})}export{q as C};

import{r as a,F as b,o as y,p as j,t as o,fg as A,a as N,fh as F,j as s,dF as L,B as P,s as T,f9 as $,T as D,g as G}from"./index-BRWcz4T7.js";import{C as M}from"./customer-selector-DqZrTcDA.js";const n=G(`
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
`);function v({customerGroupId:r,canAddCustomers:u=!0}){const[d,l]=a.useState([]),[m,c]=a.useState(1),[g,p]=a.useState(10),[f,C]=a.useState([]),{_:i}=b(),S=y(),{mutate:h}=j({mutationFn:N.mutate(F),onSuccess:()=>{o.success(i({id:"y3tQ/s"})),S.invalidateQueries({queryKey:[A,n]})},onError:()=>{o.error(i({id:"ZlA28n"}))}});return s.jsxs("div",{children:[s.jsx(L,{listQuery:$(n),transformVariables:e=>({...e,id:r}),page:m,itemsPerPage:g,sorting:d,columnFilters:f,onPageChange:(e,t,x)=>{c(t),p(x)},onSortChange:(e,t)=>{l(t)},onFilterChange:(e,t)=>{C(t)},onSearchTermChange:e=>({lastName:{contains:e},emailAddress:{contains:e}}),additionalColumns:{name:{header:"Name",cell:({row:e})=>{const t=`${e.original.firstName} ${e.original.lastName}`;return s.jsx(P,{render:s.jsx(T,{to:"/customers/$id",params:{id:e.original.id}}),variant:"ghost",children:t})}}},defaultColumnOrder:["name","emailAddress"],defaultVisibility:{id:!1,createdAt:!1,updatedAt:!1,firstName:!1,lastName:!1}}),u&&s.jsx(M,{onSelect:e=>{h({customerId:e.id,groupId:r})},label:s.jsx(D,{id:"IswRMs"})})]})}export{v as C};

import{j as t,g4 as S,ay as i,cj as D,ew as y,g5 as C,P,aT as k,Q as L,aU as T,L as A}from"./index-CfivDxyc.js";import{D as $}from"./detail-page-button-DDJQPHS5.js";import{D as q}from"./delete-bulk-action-BPYZjKTu.js";const v=({selection:a,table:n})=>t.jsx(q,{mutationDocument:S,entityName:"facets",requiredPermissions:["DeleteCatalog","DeleteFacet"],selection:a,table:n}),r="facet-values-table",B=A(`
    query FacetValueList($options: FacetValueListOptions) {
        facetValues(options: $options) {
            items {
                id
                createdAt
                updatedAt
                name
                code
                customFields
            }
            totalItems
        }
    }
`);function N({facetId:a,registerRefresher:n}){const[m,g]=i.useState([]),[c,d]=i.useState(1),[o,f]=i.useState(10),{setTableSettings:u,settings:p}=D(),b=i.useRef(()=>{}),l=p.tableSettings?.[r],F={name:!0,code:!0},V=l?.columnVisibility??F,h=l?.columnOrder??[],x=l?.columnFilters;return t.jsxs(t.Fragment,{children:[t.jsx(y,{listQuery:C(B),page:c,itemsPerPage:o,sorting:m,columnFilters:x,defaultColumnOrder:h,defaultVisibility:V,onPageChange:(e,s,j)=>{f(j),d(s)},onSortChange:(e,s)=>{g(s)},onFilterChange:(e,s)=>{u(r,"columnFilters",s)},onColumnVisibilityChange:(e,s)=>{u(r,"columnVisibility",s)},registerRefresher:e=>{b.current=e,n?.(e)},transformVariables:e=>({options:{filter:{...e.options?.filter??{},facetId:{eq:a}},sort:e.options?.sort,take:o,skip:(c-1)*o}}),onSearchTermChange:e=>({name:{contains:e}}),customizeColumns:{name:{header:"Name",cell:({row:e})=>t.jsx($,{id:e.original.id,label:e.original.name,href:`/facets/${a}/values/${e.original.id}`})}},bulkActions:[{component:v}]}),t.jsx("div",{className:"mt-4",children:t.jsxs(P,{render:t.jsx(T,{to:`/facets/${a}/values/new`}),variant:"outline",children:[t.jsx(k,{}),t.jsx(L,{id:"GZg2Zw"})]})})]})}export{N as F};

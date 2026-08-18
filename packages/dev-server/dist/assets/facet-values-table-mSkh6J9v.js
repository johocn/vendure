import{j as t,fn as j,r as i,aE as D,et as C,fo as y,B as P,bv as k,T,aM as v,br as A}from"./index-DY5P-GzJ.js";import{D as B}from"./detail-page-button-CdwExdp_.js";import{D as L}from"./delete-bulk-action-DXnfvr0U.js";const $=({selection:a,table:n})=>t.jsx(L,{mutationDocument:j,entityName:"facets",requiredPermissions:["DeleteCatalog","DeleteFacet"],selection:a,table:n}),r="facet-values-table",q=A(`
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
`);function E({facetId:a,registerRefresher:n}){const[m,d]=i.useState([]),[u,g]=i.useState(1),[o,f]=i.useState(10),{setTableSettings:c,settings:b}=D(),p=i.useRef(()=>{}),l=b.tableSettings?.[r],F={name:!0,code:!0},V=l?.columnVisibility??F,h=l?.columnOrder??[],x=l?.columnFilters;return t.jsxs(t.Fragment,{children:[t.jsx(C,{listQuery:y(q),page:u,itemsPerPage:o,sorting:m,columnFilters:x,defaultColumnOrder:h,defaultVisibility:V,onPageChange:(e,s,S)=>{f(S),g(s)},onSortChange:(e,s)=>{d(s)},onFilterChange:(e,s)=>{c(r,"columnFilters",s)},onColumnVisibilityChange:(e,s)=>{c(r,"columnVisibility",s)},registerRefresher:e=>{p.current=e,n?.(e)},transformVariables:e=>({options:{filter:{...e.options?.filter??{},facetId:{eq:a}},sort:e.options?.sort,take:o,skip:(u-1)*o}}),onSearchTermChange:e=>({name:{contains:e}}),customizeColumns:{name:{header:"Name",cell:({row:e})=>t.jsx(B,{id:e.original.id,label:e.original.name,href:`/facets/${a}/values/${e.original.id}`})}},bulkActions:[{component:$}]}),t.jsx("div",{className:"mt-4",children:t.jsxs(P,{render:t.jsx(v,{to:`/facets/${a}/values/new`}),variant:"outline",children:[t.jsx(k,{}),t.jsx(T,{id:"GZg2Zw"})]})})]})}export{E as F};

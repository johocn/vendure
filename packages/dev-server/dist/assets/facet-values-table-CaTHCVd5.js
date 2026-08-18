import{j as t,f9 as j,r as i,bf as D,dG as C,fa as y,B as P,q as k,T,s as q,g as A}from"./index-q8xQ09Gk.js";import{D as B}from"./detail-page-button-752pzeur.js";import{D as L}from"./delete-bulk-action-DGBJunBf.js";const $=({selection:a,table:n})=>t.jsx(L,{mutationDocument:j,entityName:"facets",requiredPermissions:["DeleteCatalog","DeleteFacet"],selection:a,table:n}),r="facet-values-table",v=A(`
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
`);function N({facetId:a,registerRefresher:n}){const[m,d]=i.useState([]),[u,g]=i.useState(1),[o,f]=i.useState(10),{setTableSettings:c,settings:p}=D(),b=i.useRef(()=>{}),l=p.tableSettings?.[r],F={name:!0,code:!0},V=l?.columnVisibility??F,h=l?.columnOrder??[],x=l?.columnFilters;return t.jsxs(t.Fragment,{children:[t.jsx(C,{listQuery:y(v),page:u,itemsPerPage:o,sorting:m,columnFilters:x,defaultColumnOrder:h,defaultVisibility:V,onPageChange:(e,s,S)=>{f(S),g(s)},onSortChange:(e,s)=>{d(s)},onFilterChange:(e,s)=>{c(r,"columnFilters",s)},onColumnVisibilityChange:(e,s)=>{c(r,"columnVisibility",s)},registerRefresher:e=>{b.current=e,n?.(e)},transformVariables:e=>({options:{filter:{...e.options?.filter??{},facetId:{eq:a}},sort:e.options?.sort,take:o,skip:(u-1)*o}}),onSearchTermChange:e=>({name:{contains:e}}),customizeColumns:{name:{header:"Name",cell:({row:e})=>t.jsx(B,{id:e.original.id,label:e.original.name,href:`/facets/${a}/values/${e.original.id}`})}},bulkActions:[{component:$}]}),t.jsx("div",{className:"mt-4",children:t.jsxs(P,{render:t.jsx(q,{to:`/facets/${a}/values/new`}),variant:"outline",children:[t.jsx(k,{}),t.jsx(T,{id:"GZg2Zw"})]})})]})}export{N as F};

import{r as n,j as a,dG as p,B as C,s as h,fa as S,g as x}from"./index-B1sf7x_O.js";const P=x(`
    query CollectionContentsList($collectionId: ID!, $options: ProductVariantListOptions) {
        collection(id: $collectionId) {
            id
            productVariants(options: $options) {
                items {
                    id
                    createdAt
                    updatedAt
                    name
                    sku
                }
                totalItems
            }
        }
    }
`);function j({collectionId:s}){const[o,i]=n.useState([]),[r,l]=n.useState(1),[c,u]=n.useState(10),[d,g]=n.useState([]);return a.jsx(p,{listQuery:S(P),transformVariables:t=>({...t,collectionId:s}),customizeColumns:{name:{header:"Variant name",cell:({row:t})=>a.jsxs(C,{render:a.jsx(h,{to:`../../product-variants/${t.original.id}`}),variant:"ghost",children:[t.original.name," "]})}},page:r,itemsPerPage:c,sorting:o,columnFilters:d,onPageChange:(t,e,m)=>{l(e),u(m)},onSortChange:(t,e)=>{i(e)},onFilterChange:(t,e)=>{g(e)},onSearchTermChange:t=>({name:{contains:t}})})}export{j as C};

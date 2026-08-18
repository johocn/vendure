import{r as n,j as a,et as p,B as C,aM as h,fo as S,br as x}from"./index-DY5P-GzJ.js";const P=x(`
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
`);function j({collectionId:s}){const[o,i]=n.useState([]),[r,l]=n.useState(1),[c,u]=n.useState(10),[d,m]=n.useState([]);return a.jsx(p,{listQuery:S(P),transformVariables:t=>({...t,collectionId:s}),customizeColumns:{name:{header:"Variant name",cell:({row:t})=>a.jsxs(C,{render:a.jsx(h,{to:`../../product-variants/${t.original.id}`}),variant:"ghost",children:[t.original.name," "]})}},page:r,itemsPerPage:c,sorting:o,columnFilters:d,onPageChange:(t,e,g)=>{l(e),u(g)},onSortChange:(t,e)=>{i(e)},onFilterChange:(t,e)=>{m(e)},onSearchTermChange:t=>({name:{contains:t}})})}export{j as C};

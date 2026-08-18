import{r as o,dN as i,bk as l,j as s,aF as m,aG as p,bv as x,B as h,aI as f,d6 as j,d7 as N,d8 as b,d9 as A,da as V,db as g,f4 as y,br as C,fd as P,bm as k}from"./index-DY5P-GzJ.js";const I=C(`
        query ProductVariantList($options: ProductVariantListOptions) {
            productVariants(options: $options) {
                items {
                    id
                    name
                    sku
                    featuredAsset {
                        ...Asset
                    }
                    price
                    priceWithTax
                    product {
                        featuredAsset {
                            ...Asset
                        }
                    }
                }
                totalItems
            }
        }
    `,[P]);function q({onProductVariantSelect:r}){const[d,n]=o.useState(""),[c,a]=o.useState(!1),t=i(d,500),{data:u}=l({queryKey:["productVariants",t],staleTime:1e3*60*5,enabled:t.length>0,queryFn:()=>k.query(I,{options:{take:10,filter:{name:{contains:t},sku:{contains:t}},filterOperator:"OR"}})});return s.jsxs(m,{open:c,onOpenChange:a,children:[s.jsxs(p,{render:s.jsx(h,{variant:"outline",role:"combobox",className:"w-full"}),children:["Add item to order",s.jsx(x,{className:"opacity-50"})]}),s.jsx(f,{className:"p-0",children:s.jsxs(j,{shouldFilter:!1,children:[s.jsx(N,{placeholder:"Add item to order...",className:"h-9",onValueChange:e=>n(e)}),s.jsxs(b,{children:[s.jsx(A,{children:"No products found."}),s.jsx(V,{children:u?.productVariants.items.map(e=>s.jsxs(g,{value:e.id,onSelect:()=>{r({productVariantId:e.id,productVariantName:e.name,sku:e.sku,productAsset:e.featuredAsset??e.product.featuredAsset??null,price:e.price,priceWithTax:e.priceWithTax}),a(!1)},className:"flex items-center gap-2 p-2",children:[e.featuredAsset&&s.jsx(y,{asset:e.featuredAsset,preset:"tiny",className:"size-8 rounded-md object-cover"}),s.jsxs("div",{className:"flex flex-col",children:[s.jsx("span",{className:"text-sm font-medium",children:e.name}),s.jsx("span",{className:"text-xs text-muted-foreground",children:e.sku})]})]},e.id))})]})]})})]})}export{q as P};

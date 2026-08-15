import{ay as o,ec as i,az as l,j as s,ck as m,cl as p,aT as x,P as h,cn as f,e2 as j,e3 as A,e4 as N,e5 as V,ed as g,e6 as y,ee as C,L as P,ef as k,aA as b}from"./index-CfivDxyc.js";const S=P(`
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
    `,[k]);function q({onProductVariantSelect:r}){const[n,c]=o.useState(""),[d,a]=o.useState(!1),t=i(n,500),{data:u}=l({queryKey:["productVariants",t],staleTime:1e3*60*5,enabled:t.length>0,queryFn:()=>b.query(S,{options:{take:10,filter:{name:{contains:t},sku:{contains:t}},filterOperator:"OR"}})});return s.jsxs(m,{open:d,onOpenChange:a,children:[s.jsxs(p,{render:s.jsx(h,{variant:"outline",role:"combobox",className:"w-full"}),children:["Add item to order",s.jsx(x,{className:"opacity-50"})]}),s.jsx(f,{className:"p-0",children:s.jsxs(j,{shouldFilter:!1,children:[s.jsx(A,{placeholder:"Add item to order...",className:"h-9",onValueChange:e=>c(e)}),s.jsxs(N,{children:[s.jsx(V,{children:"No products found."}),s.jsx(g,{children:u?.productVariants.items.map(e=>s.jsxs(y,{value:e.id,onSelect:()=>{r({productVariantId:e.id,productVariantName:e.name,sku:e.sku,productAsset:e.featuredAsset??e.product.featuredAsset??null,price:e.price,priceWithTax:e.priceWithTax}),a(!1)},className:"flex items-center gap-2 p-2",children:[e.featuredAsset&&s.jsx(C,{asset:e.featuredAsset,preset:"tiny",className:"size-8 rounded-md object-cover"}),s.jsxs("div",{className:"flex flex-col",children:[s.jsx("span",{className:"text-sm font-medium",children:e.name}),s.jsx("span",{className:"text-xs text-muted-foreground",children:e.sku})]})]},e.id))})]})]})})]})}export{q as P};

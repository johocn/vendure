import{r as o,dN as x,bk as p,j as e,aF as h,aG as j,bv as f,T as n,B as N,aI as C,d6 as b,d7 as g,d8 as y,d9 as v,db as S,br as O,bm as T}from"./index-DY5P-GzJ.js";const q=O(`
    query GetCustomers($options: CustomerListOptions) {
        customers(options: $options) {
            items {
                id
                firstName
                lastName
                emailAddress
            }
            totalItems
        }
    }
`);function F(t){const[i,r]=o.useState(!1),[l,m]=o.useState(""),a=x(l,300),{data:d,isLoading:c}=p({queryKey:["customers",a],queryFn:()=>T.query(q,{options:{sort:{lastName:"ASC"},filter:a?{firstName:{contains:a},lastName:{contains:a},emailAddress:{contains:a}}:void 0,filterOperator:a?"OR":void 0}}),staleTime:1e3*60}),u=s=>{m(s)};return e.jsxs(h,{open:i,onOpenChange:r,children:[e.jsxs(j,{render:e.jsx(N,{variant:"outline",size:"sm",type:"button",disabled:t.readOnly,className:"gap-2"}),children:[e.jsx(f,{className:"h-4 w-4"}),t.label??e.jsx(n,{id:"C0uyNO"})]}),e.jsx(C,{className:"p-0 w-[350px]",align:"start",children:e.jsxs(b,{shouldFilter:!1,children:[e.jsx(g,{placeholder:"Search customers...",onValueChange:u,className:"h-10 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"}),e.jsxs(y,{children:[e.jsx(v,{children:c?e.jsx(n,{id:"Z3FXyt"}):e.jsx(n,{id:"BLXWJv"})}),d?.customers.items.map(s=>e.jsxs(S,{onSelect:()=>{t.onSelect(s),r(!1)},className:"flex flex-col items-start",children:[e.jsxs("div",{className:"font-medium",children:[s.firstName," ",s.lastName]}),e.jsx("div",{className:"text-sm text-muted-foreground",children:s.emailAddress})]},s.id))]})]})})]})}export{F as C};

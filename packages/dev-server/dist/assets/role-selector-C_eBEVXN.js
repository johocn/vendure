import{u as c,bk as l,j as p,ei as u,br as d,bm as m}from"./index-DY5P-GzJ.js";const y=d(`
    query Roles($options: RoleListOptions) {
        roles(options: $options) {
            items {
                id
                code
                description
            }
        }
    }
`);function q(o){const{value:t,onChange:i,multiple:n}=o,{_:s}=c(),{data:a}=l({queryKey:["roles"],queryFn:()=>m.query(y,{options:{take:100}}),select:e=>e.roles.items}),r=(a??[]).map(e=>({value:e.id,label:e.code,display:e.description?e.description:e.code}));return p.jsx(u,{value:t,onChange:i,multiple:n,items:r,placeholder:s({id:"h4pFju"}),searchPlaceholder:s({id:"jxxbqF"})})}export{q as R};

import{L as t,ej as i}from"./index-B5sUqbxQ.js";const e=t(`
    mutation DuplicateEntity($input: DuplicateEntityInput!) {
        duplicateEntity(input: $input) {
            ... on DuplicateEntitySuccess {
                newEntityId
            }
            ... on ErrorResult {
                errorCode
                message
            }
            ... on DuplicateEntityError {
                duplicationError
            }
        }
    }
`),r=t(`
        query GetEntityDuplicators {
            entityDuplicators {
                code
                description
                requiresPermission
                forEntities
                args {
                    ...ConfigArgDefinition
                }
            }
        }
    `,[i]);export{e as d,r as g};

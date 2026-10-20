# DynamoDB Toolbox

A quick & dirty tool to get data from DynamoDB

## Validation

Use Node.js 24 and Yarn 1.22.22. Run `yarn install --frozen-lockfile`,
`yarn typecheck`, `yarn eslint`, and `yarn test-ci --runInBand`. CI runs these
checks on pull requests and pushes to master. Tests mock DynamoDB and prompts,
write only to temporary directories, and block network access; they require no
AWS account or credentials. Existing coverage thresholds remain enforced.

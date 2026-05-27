import type { CodegenConfig } from '@graphql-codegen/cli';

// Generates typed-document-node operations against GitHub's published GraphQL
// schema, so collectors consume real types instead of hand-rolled interfaces.
// The output is committed and regenerated via `bun run build:graphql`.
const config: CodegenConfig = {
  schema: 'node_modules/@octokit/graphql-schema/schema.graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/github/graphql/generated.ts': {
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        scalars: {
          Base64String: 'string',
          BigInt: 'string',
          Date: 'string',
          DateTime: 'string',
          GitObjectID: 'string',
          GitRefname: 'string',
          GitSSHRemote: 'string',
          GitTimestamp: 'string',
          HTML: 'string',
          PreciseDateTime: 'string',
          URI: 'string',
          X509Certificate: 'string',
        },
        maybeValue: 'T | null',
        preResolveTypes: true,
        // The project sets `verbatimModuleSyntax`, so the generated module must
        // import its types with `import type`.
        useTypeImports: true,
      },
    },
  },
};

export default config;

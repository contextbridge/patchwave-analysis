# Release recipes
# All recipes run from the project root so scripts/ and .goreleaser.yaml resolve correctly.

set working-directory := '..'

# Build all release artifacts locally without publishing or notarizing.
# Requires `goreleaser` on PATH (brew install goreleaser/tap/goreleaser).
dry-run:
    goreleaser release --snapshot --clean --skip=publish,notarize

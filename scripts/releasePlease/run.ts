import { GitHub, Manifest, registerPlugin } from 'release-please';
import { IGNORE_DEPENDABOT_PLUGIN, IgnoreDependabot } from './IgnoreDependabot.ts';

registerPlugin(
  IGNORE_DEPENDABOT_PLUGIN,
  ({ github, targetBranch, repositoryConfig }) => new IgnoreDependabot(github, targetBranch, repositoryConfig),
);

const { GITHUB_REPOSITORY = '', GITHUB_TOKEN = '' } = Bun.env;
const [owner, repo] = GITHUB_REPOSITORY.split('/');
if (!owner || !repo || !GITHUB_TOKEN) {
  console.error('GITHUB_REPOSITORY (owner/repo) and GITHUB_TOKEN are required');
  process.exit(1);
}

const github = await GitHub.create({ owner, repo, token: GITHUB_TOKEN });
const loadManifest = () =>
  Manifest.fromManifest(
    github,
    github.repository.defaultBranch,
    'release-please-config.json',
    '.release-please-manifest.json',
    { plugins: [IGNORE_DEPENDABOT_PLUGIN] },
  );

// Mirrors googleapis/release-please-action: publish any merged release first,
// then reload so the release PR is built against the new state.
await (await loadManifest()).createReleases();
await (await loadManifest()).createPullRequests();

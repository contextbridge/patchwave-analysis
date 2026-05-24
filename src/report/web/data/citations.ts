export interface Citation {
  label: string;
  url: string;
}

// Sources cited inline throughout the report. The labels appear in tooltips; the URLs
// open in a new tab when a citation marker is clicked.
export const CITATIONS = {
  'mend-renovate-roi': {
    label: 'Mend Renovate Enterprise ROI calculator',
    url: 'https://www.mend.io/renovate-enterprise/',
  },
  'rombaut-2024': {
    label: 'Rombaut et al. 2024, "Studying the Practices of Deploying Machine Learning Projects on Docker"',
    url: 'https://arxiv.org/abs/2206.00699',
  },
  'atlassian-dx-2025': {
    label: 'Atlassian State of Developer Experience Report 2025',
    url: 'https://www.atlassian.com/blog/devops/developer-experience-report-2025',
  },
  'cortex-2024': {
    label: 'Cortex State of Developer Productivity Report 2024',
    url: 'https://www.cortex.io/post/state-of-developer-productivity-report-2024',
  },
  'pixee-merge-rates': {
    label: 'Pixee: Why Developers Ignore 85% of Security PRs',
    url: 'https://pixee.ai/blog/why-developers-ignore-85-of-security-prs',
  },
  'vulncheck-2026': {
    label: 'VulnCheck, May 2026 — AI-assisted vulnerability discovery',
    url: 'https://www.vulncheck.com/blog/ai-assisted-vulnerability-discovery',
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;

export interface Citation {
  label: string;
  url: string;
}

// Sources cited inline throughout the report. The labels appear in tooltips; the URLs
// open in a new tab when a citation marker is clicked.
export const CITATIONS = {
  'mohayeji-2025': {
    label:
      'Mohayeji et al. 2025, "Securing dependencies: A comprehensive study of Dependabot\'s impact on vulnerability mitigation," Empirical Software Engineering',
    url: 'https://link.springer.com/article/10.1007/s10664-025-10638-w',
  },
  'glasswing-2026': {
    label: 'Anthropic, "Project Glasswing: An initial update" (May 2026)',
    url: 'https://www.anthropic.com/research/glasswing-initial-update',
  },
  'anthropic-cvd-2026': {
    label: 'Anthropic, Coordinated Vulnerability Disclosure dashboard (May 2026)',
    url: 'https://red.anthropic.com/2026/cvd/',
  },
  'atlassian-dx-2025': {
    label: 'Atlassian State of Developer Experience Report 2025',
    url: 'https://www.atlassian.com/blog/devops/developer-experience-report-2025',
  },
  'vulncheck-2026': {
    label: 'VulnCheck, May 2026 — AI-assisted vulnerability discovery',
    url: 'https://www.vulncheck.com/blog/ai-assisted-vulnerability-discovery',
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;

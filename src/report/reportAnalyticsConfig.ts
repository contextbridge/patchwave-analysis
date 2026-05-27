// Embedded into the report HTML by the CLI and read back by the frontend. Types only,
// no runtime imports, so it is safe to pull into both the Node CLI and the browser bundle.
export interface ReportAnalyticsConfig {
  // Mirrors the CLI's telemetry opt-out at generation time. When true the frontend never
  // initializes PostHog. The viewer's own browser opt-out is checked separately at runtime.
  readonly telemetryDisabled: boolean;
  // Per-run id, sent as the pw_report_id property (not the identity) so report views join back to
  // the CLI run that produced them.
  readonly reportId: string;
  // Anon id of the generating machine (empty when telemetry was disabled). Used as the PostHog
  // distinct id so the report shares one person with its CLI run.
  readonly generatedByAnonId: string;
  readonly version: string;
}

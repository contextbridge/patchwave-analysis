// Embedded into the report HTML by the CLI and read back by the frontend. Types only,
// no runtime imports, so it is safe to pull into both the Node CLI and the browser bundle.
export interface ReportAnalyticsConfig {
  // Mirrors the CLI's telemetry opt-out at generation time. When true the frontend never
  // initializes PostHog. The viewer's own browser opt-out is checked separately at runtime.
  readonly telemetryDisabled: boolean;
  // Per-run id; the frontend uses it as the PostHog distinct id so every view of one report
  // groups together and joins back to the CLI run that produced it.
  readonly reportId: string;
  // Anonymous id of the machine that generated the report (empty when telemetry was disabled).
  readonly generatedByAnonId: string;
  readonly version: string;
}

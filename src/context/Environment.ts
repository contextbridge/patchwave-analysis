import { z } from 'zod';

const booleanEnv = z.stringbool({ truthy: ['1', 'true', 'yes'], falsy: ['', '0', 'false', 'no'] }).default(false);

const EnvironmentSchema = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DO_NOT_TRACK: booleanEnv,
  CONTEXTBRIDGE_TELEMETRY_DISABLED: booleanEnv,
  CI: booleanEnv,
  XDG_CONFIG_HOME: z.string().optional(),
  HOME: z.string().optional(),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function getEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(env);
}

import { z } from 'zod';

const EnvironmentSchema = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function getEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(env);
}

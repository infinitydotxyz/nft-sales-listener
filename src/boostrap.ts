import 'reflect-metadata';
import { Env, getEnv } from './utils';
import { logger } from './container';

async function bootstrap(): Promise<void> {
  const env = getEnv();

  switch (env) {
    case Env.Cli:
      return;
    case Env.Script:
      return;
    case Env.Production:
      return;
    default:
      throw new Error(`Env not bootstrapped ${env}`);
  }
}

void bootstrap();

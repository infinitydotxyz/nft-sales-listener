import { execute as runOpenseaSalesListener } from './controllers/sales-listener.controller';
import chalk from 'chalk';
import { logger } from '../src/container';

const execute = (): void => {
  logger.log(chalk.blue('---  Running Opensea Sales Scraper ----'));
  runOpenseaSalesListener();
};

export { execute };

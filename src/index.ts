import 'reflect-metadata';
import { execute as runOpenseaSalesListener } from './controllers/sales-listener.controller';
import chalk from 'chalk';
import { logger } from './container';
import { getInitialStatsForExistingCollections } from 'scripts/getInitialStatsForExistingCollections';

const main = (): void => {
  logger.log(chalk.blue('---  Running NFT Sales Listener ----'));
  runOpenseaSalesListener();
  void getInitialStatsForExistingCollections();
};

void main();
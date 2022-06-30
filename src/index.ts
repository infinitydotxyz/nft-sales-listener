import 'reflect-metadata';
import { execute as runSalesListener } from './controllers/sales-listener.controller';
import chalk from 'chalk';
import { logger } from './container';
import { getInitialStatsForExistingCollections } from 'scripts/getInitialStatsForExistingCollections';

const main = (): void => {
  logger.log(chalk.blue('---  Running NFT Sales Listener ----'));
  runSalesListener();
  void getInitialStatsForExistingCollections();
};

void main();
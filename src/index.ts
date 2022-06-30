import 'reflect-metadata';
import { execute as runSalesListener } from './controllers/sales-listener.controller';
import chalk from 'chalk';
import { logger } from './container';

const main = (): void => {
  logger.log(chalk.blue('---  Running NFT Sales Listener ----'));
  runSalesListener();
  // todo: remove this comment when collection indexing is done
  // for now nft-collection-service will be responsible for fetching iniital stats
  // void getInitialStatsForExistingCollections();
};

void main();
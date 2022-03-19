import 'reflect-metadata';
import { execute as runOpenseaSalesListener } from './controllers/sales-listener.controller';
import chalk from 'chalk';
import { firebase, logger } from './container';
import { StatsPeriod } from '@infinityxyz/lib/types/core';
import { getStatsCollName, StatsType } from '@infinityxyz/lib/utils';

const main = (): void => {
  logger.log(chalk.blue('---  Running NFT Sales Listener ----'));
  runOpenseaSalesListener();
};

async function deleteStats() {
  const streams = [];
  for (const type of Object.values(StatsType)) {
    for (const period of Object.values(StatsPeriod)) {
      const collName = getStatsCollName(period, type);
      const stream = firebase.db.collectionGroup(collName).stream();
      streams.push(stream);
    }
  }

  await Promise.all(streams.map((item) => deleteFromStream(item)));
}

async function deleteFromStream(stream: NodeJS.ReadableStream) {
  try {
    let batch = firebase.db.batch();
    let index = 0;
    for await (const snap of stream) {
      const snapshot = snap as any as FirebaseFirestore.QueryDocumentSnapshot;
      batch.delete(snapshot.ref);
      index += 1;

      if (index % 300 === 299) {
        logger.log(`committing batch. ${index}`);
        await batch.commit();
        batch = firebase.db.batch();
      }
    }

    await batch.commit();
    logger.log('Completed Stream');
  } catch (err) {
    logger.error('failed to delete all');
    logger.error(err);
  }
}

main();

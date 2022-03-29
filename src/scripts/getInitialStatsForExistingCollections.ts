import { firestoreConstants } from '@infinityxyz/lib/utils';
import { firebase, logger } from 'container';
import { addCollectionToQueue, taskQueue } from 'controllers/sales-collection-initializer.controller';

export async function getInitialStatsForExistingCollections() {
  try {
    const collectionsQuery = firebase.db.collection(firestoreConstants.COLLECTIONS_COLL);

    const stream = collectionsQuery.stream();

    const interval = setInterval(() => {
      const size = taskQueue.size + taskQueue.pending;
      logger.log(`Initializing stats for: ${size} collections`);

      if (size === 0) {
        clearInterval(interval);
      }
    }, 5000);

    let count = 0;
    for await (const docSnap of stream) {
      try {
        const docSnapshot = docSnap as any as FirebaseFirestore.QueryDocumentSnapshot;
        const allTimeStats = docSnapshot.ref.collection(firestoreConstants.COLLECTION_STATS_COLL).doc('all');
        const allTimeStatsSnap = await allTimeStats.get();
        const stats = allTimeStatsSnap.data();
        if (!stats) {
          count += 1;
          const [chainId, address] = docSnapshot.ref.id.split(':');
          void addCollectionToQueue(address, '1', chainId);
        }
      } catch (err) {
        logger.error(err);
      }
    }
    logger.log(`Found: ${count} collections without stats`);
  } catch (err) {
    logger.error('failed to get initial stats for existing collections', err);
  }
}

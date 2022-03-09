import { getDocIdHash, trimLowerCase } from '@infinityxyz/lib/utils';
import { SALES_COLL, COLLECTION_STATS_COLL, NFT_STATS_COLL } from '../constants';
import { firebase, logger } from 'container';
import { EventEmitter } from 'stream';
import { BASE_TIME, NftSale, Stats } from 'types';
import { getDocumentIdByTime } from 'utils';
import { getNewStats } from './stats.model';
import { addCollectionToQueue } from 'controllers/sales-collection-initializer.controller';

type Transaction = { sales: NftSale[]; totalPrice: number };

type SalesData = {
  transactions: { sales: NftSale[]; totalPrice: number }[];
};

function getIncomingStats(transaction: Transaction): Stats {
  const totalNumSales = transaction.sales.length > 1 ? transaction.sales.length : transaction.sales[0].quantity;
  const incomingStats: Stats = {
    floorPrice: transaction.sales[0].price as number,
    ceilPrice: transaction.sales[0].price as number,
    totalVolume: transaction.totalPrice,
    totalNumSales,
    avgPrice: transaction.sales[0].price as number,
    updateAt: transaction.sales[0].blockTimestamp
  };
  return incomingStats;
}

export function throttledWriter(): EventEmitter {
  const collections: Map<string, { data: SalesData; throttledWrite: Promise<void> }> = new Map();

  const emitter = new EventEmitter();

  async function updateCollectionSales(transactions: Transaction[]) {
    /**
     * we can have a max of 500 writes in one firestore tx
     *
     * <= 10 writes to update collection level stats
     * <= 5 * num sales writes to update token level stats
     * 1 write to save  each sale
     *
     * 500 - 10 = 490
     * 490 / 6 = 81.66
     */
    const MAX_SALES = 80;

    /**
     * group transactions into batches with a max of MAX_SALES per batch
     */
    const batches = transactions.reduce((batches: { size: number; transactions: Transaction[] }[], item) => {
      let batch = batches.pop();
      if (!batch) {
        batch = {
          size: 0,
          transactions: []
        };
      }

      if (batch.size + item.sales.length <= MAX_SALES) {
        batch.transactions.push(item);
        batch.size += item.sales.length;
        batches.unshift(batch);
      } else {
        batches.unshift(batch);
        const newBatch = {
          size: item.sales.length,
          transactions: [item]
        };
        batches.unshift(newBatch);
      }

      return batches;
    }, []);

    for (const batch of batches) {
      try {
        await updateCollectionSalesHelper(batch.transactions);
      } catch (err) {
        logger.error(err);
      }
    }
  }

  emitter.on('sales', ({ sales, totalPrice }: Transaction) => {
    if (Array.isArray(sales) && sales.length > 0) {
      const collectionAddress = sales[0].collectionAddress;
      if (!collections.get(collectionAddress)) {
        const throttledWrite = (collectionAddress: string): Promise<void> => {
          return new Promise<void>((resolve) => {
            setTimeout(async () => {
              try {
                logger.log(`Saving collection: ${collectionAddress}`);
                const collection = collections.get(collectionAddress);
                collections.delete(collectionAddress);
                if (collection?.data) {
                  await updateCollectionSales(collection.data.transactions);
                }
                resolve();
              } catch (err) {
                logger.error(err);
                resolve();
              }
            }, 60_000);
          });
        };
        collections.set(collectionAddress, {
          data: { transactions: [{ sales, totalPrice }] },
          throttledWrite: throttledWrite(collectionAddress)
        });
      } else {
        const collectionData = collections.get(collectionAddress);
        collectionData?.data.transactions.push({ sales, totalPrice });
      }
    }
  });

  return emitter;
}

async function updateCollectionSalesHelper(transactions: Transaction[]) {
  const chainId = transactions[0].sales[0].chainId;
  const collectionAddress = trimLowerCase(transactions[0].sales[0].collectionAddress);
  const collectionStatsRef = firebase.db.collection(COLLECTION_STATS_COLL).doc(`${chainId}:${collectionAddress}`);

  await firebase.db.runTransaction(async (tx) => {
    const validTransactions = await getUnsavedTransactions(transactions);

    /**
     * store current collection stats and transactions to be aggregated
     */
    const collectionDocs: {
      [docId: string]: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        currentStatsSnapshot: Promise<FirebaseFirestore.DocumentSnapshot>;
        transactionsToAggregate: { sales: NftSale[]; totalPrice: number }[];
      };
    } = {};

    /**
     * store current nft stats and nft sales to be aggregated
     */
    const nftDocs: {
      [docId: string]: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        currentStatsSnapshot: Promise<FirebaseFirestore.DocumentSnapshot>;
        salesToAggregate: NftSale[];
      };
    } = {};

    /**
     * helper to get current collection level stats docs and store transactions
     */
    const addTransactionToDocs = (
      ref: FirebaseFirestore.DocumentReference,
      txn: {
        sales: NftSale[];
        totalPrice: number;
      }
    ) => {
      const docId = ref.id;
      if (!collectionDocs[docId]) {
        collectionDocs[docId] = {
          ref,
          currentStatsSnapshot: tx.get(ref) as unknown as Promise<FirebaseFirestore.DocumentSnapshot>,
          transactionsToAggregate: []
        };
      }
      collectionDocs[docId].transactionsToAggregate.push(txn);
    };

    /**
     * helper to get current nft level stats docs and store nft sales
     */
    const addSaleToDocs = (ref: FirebaseFirestore.DocumentReference, sale: NftSale) => {
      const docId = ref.id;
      if (!nftDocs[docId]) {
        nftDocs[docId] = {
          ref,
          currentStatsSnapshot: tx.get(ref) as unknown as Promise<FirebaseFirestore.DocumentSnapshot>,
          salesToAggregate: []
        };
      }
      nftDocs[docId].salesToAggregate.push(sale);
    };

    /**
     * add transactions to total
     */
    const totalStatsRef = firebase.db
      .collection(COLLECTION_STATS_COLL)
      .doc(`${chainId}:${trimLowerCase(collectionAddress)}`);
    for (const transaction of validTransactions) {
      addTransactionToDocs(totalStatsRef, transaction);
    }

    /**
     * add transactions to each interval
     */
    for (const baseTime of Object.values(BASE_TIME)) {
      for (const transaction of validTransactions) {
        const time = transaction.sales[0].blockTimestamp;
        const collectionStatDocId = getDocumentIdByTime(time, baseTime as BASE_TIME);
        const collectionStatsDocRef = collectionStatsRef.collection(baseTime).doc(collectionStatDocId);
        addTransactionToDocs(collectionStatsDocRef, transaction);

        for (const sale of transaction.sales) {
          const nftDocId = getDocIdHash({
            chainId,
            collectionAddress: collectionAddress,
            tokenId: sale.tokenId
          });
          const nftStatsRef = firebase.db.collection(NFT_STATS_COLL).doc(nftDocId);
          addSaleToDocs(nftStatsRef, sale);
        }
      }
    }

    /**
     * wait for all stats promises to resolve
     */
    await Promise.all(
      [...Object.values(collectionDocs), ...Object.values(nftDocs)].map((item) => item.currentStatsSnapshot)
    );

    /**
     * save sales for all valid transactions
     */
    for (const transaction of validTransactions) {
      writeSales(transaction.sales, tx); // one write per sale
    }

    let addedToQueue = false;
    /**
     * aggregate collection level stats and save updates
     */
    for (const docToUpdate of Object.values(collectionDocs)) {
      const existingStats = (await docToUpdate.currentStatsSnapshot).data() as Stats; // this has already resolved
      const statsToMerge = docToUpdate.transactionsToAggregate.map((txn) => getIncomingStats(txn));
      if (existingStats) {
        statsToMerge.unshift(existingStats);
      } else if (!addedToQueue) {
        const tokenId = validTransactions[0].sales[0].tokenId;
        addCollectionToQueue(collectionAddress, tokenId).catch((err) => {
          logger.error(err);
        });
        addedToQueue = true;
      }

      let mergedStats: Stats | undefined = statsToMerge.shift();
      if (mergedStats) {
        for (const stat of statsToMerge) {
          mergedStats = getNewStats(mergedStats, stat);
        }

        /**
         * save collection stats
         * min of 5 per collection
         * max of 10 writes per collection (assuming all txns are within 1 hours of each other)
         */
        tx.set(docToUpdate.ref, mergedStats, { merge: true });
      }
    }

    /**
     * aggregate nft level stats and store results
     */
    for (const docToUpdate of Object.values(nftDocs)) {
      const existingStats = (await docToUpdate.currentStatsSnapshot).data() as Stats; // this has already resolved
      const totalPrice = docToUpdate.salesToAggregate.reduce((sum, sale) => (sale.price as number) + sum, 0);
      const statsToMerge = getIncomingStats({ sales: docToUpdate.salesToAggregate, totalPrice });
      const mergedStats = existingStats ? getNewStats(existingStats, statsToMerge) : statsToMerge;
      /**
       * min of 5 (all token ids are the same and in the same time interval)
       * max of 5 * num sales (different token id for every sale)
       */
      tx.set(docToUpdate.ref, mergedStats, { merge: true });
    }
  });
}

/**
 * filters transactions by those that don't yet exist in the db
 */
async function getUnsavedTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const promises: { promise: Promise<boolean>; transaction: Transaction }[] = [];
  for (const transaction of transactions) {
    const txHash = transaction.sales[0].txHash;
    promises.push({
      promise: transactionExists(txHash),
      transaction
    });
  }
  await Promise.all(promises.map((item) => item.promise));

  const unsavedTransactions = promises.filter(async (item) => await item.promise).map((item) => item.transaction);
  return unsavedTransactions;
}

async function transactionExists(txHash: string): Promise<boolean> {
  const query = firebase.db.collection(SALES_COLL).where('txHash', '==', txHash).limit(1);
  const data = await query.get();
  return !data.empty;
}

function writeSales(sales: NftSale[], tx: FirebaseFirestore.Transaction) {
  const salesCollectionRef = firebase.db.collection(SALES_COLL);
  for (const sale of sales) {
    const docRef = salesCollectionRef.doc();
    tx.create(docRef, sale);
  }
}

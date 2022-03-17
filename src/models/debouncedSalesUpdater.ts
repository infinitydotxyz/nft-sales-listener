import { trimLowerCase } from '@infinityxyz/lib/utils';
import { COLLECTION_INDEXING_SERVICE_URL, SALES_COLL } from '../constants';
import { firebase, logger } from 'container';
import { EventEmitter } from 'stream';
import { BASE_TIME, Stats } from 'types';
import { getDocumentRefByTime } from 'utils';
import { getNewStats } from './stats.model';
import { addCollectionToQueue } from 'controllers/sales-collection-initializer.controller';
import { Collection, CreationFlow, NftSale } from '@infinityxyz/lib/types/core';
import { writeSalesToFeed } from 'controllers/feed.controller';
import { enqueueCollection, ResponseType } from 'services/CollectionIndexingService';

/**
 * represents an ethereum transaction containing sales of one or more nfts
 */
export type Transaction = { sales: NftSale[]; totalPrice: number };

type SalesData = {
  transactions: { sales: NftSale[]; totalPrice: number }[];
};

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
const MAX_SALES_PER_BATCH = 80;

/**
 * time that collection sales will idle for until being written to the db
 */
const DEBOUNCE_INTERVAL = 60_000;

function getIncomingStats(data: Transaction | NftSale): Stats {
  if ('totalPrice' in data) {
    const totalNumSales = data.sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const incomingStats: Stats = {
      chainId: data.sales[0].chainId,
      collectionAddress: data.sales[0].collectionAddress,
      floorPrice: data.sales[0].price,
      ceilPrice: data.sales[0].price,
      totalVolume: data.sales[0].price * totalNumSales,
      totalNumSales,
      avgPrice: data.sales[0].price,
      updatedAt: data.sales[0].timestamp
    };
    return incomingStats;
  }

  const incomingStats: Stats = {
    chainId: data.chainId,
    collectionAddress: data.collectionAddress,
    tokenId: data.tokenId,
    floorPrice: data.price,
    ceilPrice: data.price,
    totalVolume: data.price,
    totalNumSales: 1,
    avgPrice: data.price,
    updatedAt: data.timestamp
  };
  return incomingStats;
}

export function debouncedSalesUpdater(): EventEmitter {
  const collections: Map<string, { data: SalesData; debouncedWrite: Promise<void> }> = new Map();

  const emitter = new EventEmitter();

  async function updateCollectionSales(transactions: Transaction[]) {
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

      if (batch.size + item.sales.length <= MAX_SALES_PER_BATCH) {
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

  /**
   * called each time a tx is received to perform some "safe" db writes
   * safe := (we don't have to worry about hitting 1 write/second limit)
   */
  async function performSafeDocumentWrites(
    tx: Transaction,
    collections: {
      [address: string]: Partial<Collection>;
    }
  ): Promise<void> {
    try {
      await writeSalesToFeed(tx, collections);
    } catch (err) {
      logger.error(err);
    }
  }

  async function getCollectionsFromSales(sales: NftSale[]): Promise<{
    [address: string]: Partial<Collection>;
  }> {
    try {
      const collectionAddresses = new Map(
        sales.map((sale) => [sale.collectionAddress, { address: sale.collectionAddress, chainId: sale.chainId }])
      );
      const collectionPromises: Promise<FirebaseFirestore.DocumentSnapshot>[] = [];
      for (const [, collection] of collectionAddresses) {
        const collectionPromise = firebase.getCollectionDocRef(collection.chainId, collection.address).get();
        collectionPromises.push(collectionPromise);
      }

      const collectionData = (await Promise.all(collectionPromises)).reduce(
        (acc: { [address: string]: Partial<Collection> }, snapShot) => {
          const collection = snapShot.data();
          if (collection?.address && typeof collection.address === 'string') {
            acc[collection.address] = collection as Partial<Collection>;
          }
          return acc;
        },
        {}
      );

      return collectionData;
    } catch (err) {
      logger.error(`Failed to get collection data`);
      logger.error(err);
      return {};
    }
  }

  emitter.on('sales', async (tx: Transaction) => {
    const { sales } = tx;
    if (Array.isArray(sales) && sales.length > 0) {
      const salesByCollection = sales.reduce((acc: { [address: string]: NftSale[] }, sale: NftSale) => {
        if (!acc[sale.collectionAddress]) {
          acc[sale.collectionAddress] = [];
        }
        acc[sale.collectionAddress].push(sale);
        return acc;
      }, {});

      const collectionData = await getCollectionsFromSales(sales);

      void performSafeDocumentWrites(tx, collectionData);

      for (const [collectionAddress, sales] of Object.entries(salesByCollection)) {
        const totalSalePriceInCollection = sales.reduce((sum, item) => item.price + sum, 0);
        if (!collections.get(collectionAddress)) {
          if (collectionData?.[collectionAddress]?.state?.create?.step !== CreationFlow.Complete) {
            void attemptToIndex({ address: collectionAddress, chainId: sales[0]?.chainId });
          }

          const debouncedWrite = (collectionAddress: string): Promise<void> => {
            return new Promise<void>((resolve) => {
              setTimeout(async () => {
                try {
                  const collection = collections.get(collectionAddress);
                  logger.log(`Saving collection: ${collectionAddress}`);

                  collections.delete(collectionAddress);
                  if (collection?.data) {
                    await updateCollectionSales(collection.data.transactions);
                  }
                  resolve();
                } catch (err) {
                  logger.error(err);
                  resolve();
                }
              }, DEBOUNCE_INTERVAL);
            });
          };
          collections.set(collectionAddress, {
            data: { transactions: [{ sales, totalPrice: totalSalePriceInCollection }] },
            debouncedWrite: debouncedWrite(collectionAddress)
          });
        } else {
          const collectionData = collections.get(collectionAddress);
          collectionData?.data.transactions.push({ sales, totalPrice: totalSalePriceInCollection });
        }
      }
    }
  });
  return emitter;
}

async function updateCollectionSalesHelper(transactions: Transaction[]) {
  const chainId = transactions[0].sales[0].chainId;
  const collectionAddress = trimLowerCase(transactions[0].sales[0].collectionAddress);

  let validTransactions: Transaction[] = [];
  await firebase.db.runTransaction(async (tx) => {
    validTransactions = await getUnsavedTransactions(transactions);

    const updates: {
      [refPath: string]: {
        ref: FirebaseFirestore.DocumentReference;
        currentSnapshot: Promise<FirebaseFirestore.DocumentSnapshot>;
        dataToAggregate: Transaction[] | NftSale[];
      };
    } = {};

    const addToUpdates = <T extends Transaction | NftSale>(ref: FirebaseFirestore.DocumentReference, data: T) => {
      const path = ref.path;
      if (!updates[ref.path]) {
        updates[path] = {
          ref,
          currentSnapshot: tx.get(ref) as unknown as Promise<FirebaseFirestore.DocumentSnapshot>,
          dataToAggregate: []
        };
      }
      (updates[ref.path]?.dataToAggregate as T[])?.push(data);
    };

    /**
     * add transactions to each interval
     */
    for (const baseTime of [...Object.values(BASE_TIME), 'total']) {
      for (const transaction of validTransactions) {
        const time = transaction.sales[0].timestamp;
        const collectionDocRef = getDocumentRefByTime(
          time,
          baseTime as BASE_TIME | 'total',
          collectionAddress,
          chainId
        );
        addToUpdates(collectionDocRef, transaction);

        for (const sale of transaction.sales) {
          const tokenDocRef = getDocumentRefByTime(
            time,
            baseTime as BASE_TIME | 'total',
            collectionAddress,
            chainId,
            sale.tokenId
          );
          addToUpdates(tokenDocRef, sale);
        }
      }
    }

    /**
     * wait for all stats promises to resolve
     */
    await Promise.all([...Object.values(updates)].map((item) => item.currentSnapshot));

    /**
     * save sales for all valid transactions
     */
    for (const transaction of validTransactions) {
      writeSales(transaction.sales, tx); // one write per sale
    }

    let addedToQueue = false;
    /**
     * aggregate stats and save to db
     */
    for (const docToUpdate of Object.values(updates)) {
      const existingStats = (await docToUpdate.currentSnapshot).data() as Stats | undefined; // this has already resolved
      const sample = docToUpdate.dataToAggregate[0];
      if ('totalPrice' in sample) {
        const statsToMerge = (docToUpdate.dataToAggregate as Transaction[]).map((txn) => getIncomingStats(txn));

        if (!existingStats && !addedToQueue) {
          const tokenId = validTransactions[0].sales[0].tokenId;
          addCollectionToQueue(collectionAddress, tokenId).catch((err) => {
            logger.error(err);
          });
          addedToQueue = true;
        }

        const mergedStats = statsToMerge.reduce((acc, item) => getNewStats(acc, item), existingStats);
        if (mergedStats) {
          /**
           * save collection stats
           * min of 5 per collection
           * max of 10 writes per collection (assuming all txns are within 1 hours of each other)
           */
          tx.set(docToUpdate.ref, mergedStats, { merge: true });
        }
      } else {
        const statsToMerge = (docToUpdate.dataToAggregate as NftSale[]).map((sale) => {
          return getIncomingStats(sale);
        });

        const mergedStats = statsToMerge.reduce((acc, item) => getNewStats(acc, item), existingStats);
        if (mergedStats) {
          /**
           * min of 5 (all token ids are the same and in the same time interval)
           * max of 5 * num sales (different token id for every sale)
           */
          tx.set(docToUpdate.ref, mergedStats, { merge: true });
        }
      }
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

  const unsavedTransactions = promises
    .filter(async (item) => {
      const transactionSavedInDb = await item.promise;
      return !transactionSavedInDb;
    })
    .map((item) => item.transaction);
  return unsavedTransactions;
}

async function transactionExists(txHash: string): Promise<boolean> {
  const query = firebase.db.collection(SALES_COLL).where('txHash', '==', trimLowerCase(txHash)).limit(1);
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

async function attemptToIndex(collection: { address: string; chainId: string }) {
  try {
    const res = await enqueueCollection(collection, COLLECTION_INDEXING_SERVICE_URL);
    if (res !== ResponseType.AlreadyQueued && res !== ResponseType.IndexingInitiated) {
      logger.error(`Failed to enqueue collection:${collection.chainId}:${collection.address}. Reason: ${res}`);
    }
  } catch (err) {
    logger.error(`Failed to enqueue collection. ${collection.chainId}:${collection.address}`);
    logger.error(err);
  }
}

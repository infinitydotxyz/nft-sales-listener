import { firestoreConstants, getStatsDocInfo, parseStatsDocId, trimLowerCase } from '@infinityxyz/lib/utils';
import { COLLECTION_INDEXING_SERVICE_URL } from '../constants';
import { firebase, logger } from 'container';
import { aggregateAllTimeStats, aggregateStats, getNewStats, getPrevStats } from './stats.model';
import { addCollectionToQueue } from 'controllers/sales-collection-initializer.controller';
import { AllTimeStats, Collection, NftSale, OrderDirection, Stats, StatsPeriod } from '@infinityxyz/lib/types/core';
import { writeSalesToFeed } from 'controllers/feed.controller';
import { enqueueCollection, ResponseType } from 'services/CollectionIndexingService';
import { TransactionType } from 'types/Transaction';
import { getDocRefByTime, getIncomingStats, isCollectionIndexed } from 'utils';
import Transaction from './Transaction';
import { PreAggregationStats } from 'types/PreAggregationStats';
import assert from 'assert';

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

export default class DebouncedSalesUpdater {
  /**
   * sales grouped by collection address that are waiting to be written to the db
   */
  private pendingCollections: Map<string, { data: SalesData; debouncedWrite: Promise<void> }> = new Map();

  async saveTransaction(tx: TransactionType) {
    try {
      const transaction = new Transaction(tx);
      if (!Array.isArray(transaction.tx.sales) || transaction.tx.sales.length === 0) {
        return;
      }
      const salesByCollection = transaction.salesByCollection;
      const collectionData = await transaction.getCollectionsFromSales();

      void this.performSafeDocumentWrites(tx, collectionData);

      for (const [collectionAddress, sales] of Object.entries(salesByCollection)) {
        this.debouncedSaveTransaction(collectionAddress, sales, collectionData);
      }
    } catch (err) {
      logger.error('failed to save transaction');
      logger.error(err);
      return;
    }
  }

  /**
   * saves a transaction to the db after a max of DEBOUNCE_INTERVAL ms
   */
  private debouncedSaveTransaction(
    collectionAddress: string,
    sales: NftSale[],
    collectionData: {
      [address: string]: Partial<Collection>;
    }
  ) {
    const totalSalePriceInCollection = sales.reduce((sum, item) => item.price + sum, 0);
    if (!this.pendingCollections.get(collectionAddress)) {
      if (!isCollectionIndexed(collectionData?.[collectionAddress])) {
        void this.attemptToIndex({ address: collectionAddress, chainId: sales[0]?.chainId });
      }

      const debouncedWrite = (collectionAddress: string): Promise<void> => {
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              const collection = this.pendingCollections.get(collectionAddress);
              this.pendingCollections.delete(collectionAddress);
              if (collection?.data) {
                await this.updateCollectionSales(collection.data.transactions);
              }
              resolve();
            } catch (err) {
              logger.error(err);
              resolve();
            }
          }, DEBOUNCE_INTERVAL);
        });
      };

      this.pendingCollections.set(collectionAddress, {
        data: { transactions: [{ sales, totalPrice: totalSalePriceInCollection }] },
        debouncedWrite: debouncedWrite(collectionAddress)
      });
      return;
    }

    const pendingCollection = this.pendingCollections.get(collectionAddress);
    pendingCollection?.data.transactions.push({ sales, totalPrice: totalSalePriceInCollection });
  }

  /**
   * groups sales sales for a collection into batches and
   * saves batches one at a time
   */
  private async updateCollectionSales(transactions: TransactionType[]) {
    const batches = this.createTransactionBatches(transactions);
    for (const batch of batches) {
      try {
        await this.updateBatch(batch.transactions);
      } catch (err) {
        logger.error(err);
      }
    }
  }

  /**
   * builds batches of MAX_SALES_PER_BATCH sales
   */
  private createTransactionBatches(transactions: TransactionType[]) {
    /**
     * group transactions into batches with a max of MAX_SALES per batch
     */
    const batches = transactions.reduce((batches: { size: number; transactions: TransactionType[] }[], item) => {
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
    return batches;
  }

  /**
   * runs the firestore transaction to write a batch of transaction
   * to the db
   */
  private async updateBatch(transactions: TransactionType[]) {
    const chainId = transactions[0].sales[0].chainId;
    const collectionAddress = trimLowerCase(transactions[0].sales[0].collectionAddress);

    let validTransactions: TransactionType[] = [];
    await firebase.db.runTransaction(async (tx) => {
      validTransactions = await this.getUnsavedTransactions(transactions, tx);

      const updates: {
        [refPath: string]: {
          ref: FirebaseFirestore.DocumentReference;
          currentSnapshot: Promise<FirebaseFirestore.DocumentSnapshot>;
          prevMostRecentSnapshot: Promise<FirebaseFirestore.QuerySnapshot>;
          onePeriodAgoDocId: string;
          twoPeriodsAgoDocId: string;
          dataToAggregate: TransactionType[] | NftSale[];
          period: StatsPeriod;
        };
      } = {};

      const getPrevDocId = (currentDocId: string, period: StatsPeriod) => {
        const ONE_MIN = 60 * 1000;
        const { timestamp: currentDocIdTimestamp, period : parsedPeriod } = parseStatsDocId(currentDocId);
        assert(period === parsedPeriod, 'invalid period');
        const onePeriodAgoTimestamp = currentDocIdTimestamp - ONE_MIN; 
        const { docId: onePeriodAgoDocId } = getStatsDocInfo(onePeriodAgoTimestamp, period);
        return onePeriodAgoDocId;
      };

      const addToUpdates = <T extends TransactionType | NftSale>(
        ref: FirebaseFirestore.DocumentReference,
        prevMostRecentQuery: FirebaseFirestore.Query,
        data: T,
        period: StatsPeriod
      ) => {
        const currentDocId = ref.id;
        const onePeriodAgoDocId = getPrevDocId(currentDocId, period);
        const twoPeriodsAgoDocId = getPrevDocId(onePeriodAgoDocId, period);

        updates[ref.path] = {
          ref,
          currentSnapshot: tx.get(ref) as unknown as Promise<FirebaseFirestore.DocumentSnapshot>,
          prevMostRecentSnapshot: prevMostRecentQuery.get(),
          onePeriodAgoDocId,
          twoPeriodsAgoDocId,
          dataToAggregate: [...((updates[ref.path]?.dataToAggregate as T[]) ?? []), data] as any,
          period
        };
      };


      /**
       * add transactions to each interval
       */
      for (const statsPeriod of [...Object.values(StatsPeriod)]) {
        const period = statsPeriod as StatsPeriod;
        for (const transaction of validTransactions) {
          const time = transaction.sales[0].timestamp;
          /**
           * collection level
           */
          const collectionDocRef = getDocRefByTime(time, period, collectionAddress, chainId);
          const {timestamp: docIdTimestamp } = parseStatsDocId(collectionDocRef.id );
          
          const prevMostRecentStatsQuery = collectionDocRef.parent
            .where('timestamp', '<', docIdTimestamp)
            .orderBy('timestamp', OrderDirection.Descending)
            .limit(1);
          addToUpdates(collectionDocRef, prevMostRecentStatsQuery, transaction, period);

          /**
           * nft level
           */
          for (const sale of transaction.sales) {
            const tokenDocRef = getDocRefByTime(time, period, collectionAddress, chainId, sale.tokenId);
            const {timestamp: docIdTimestamp } = parseStatsDocId(collectionDocRef.id );

            const prevMostRecentStatsQuery = tokenDocRef.parent
              .where('timestamp', '<', docIdTimestamp)
              .orderBy('timestamp', OrderDirection.Descending)
              .limit(1);
            addToUpdates(tokenDocRef, prevMostRecentStatsQuery, sale, period);
          }
        }
      }

      /**
       * wait for all stats promises to resolve
       */
      await Promise.all(Object.values(updates).flatMap((item) => [item.currentSnapshot, item.prevMostRecentSnapshot]));

      /**
       * save sales for all valid transactions
       */
      for (const transaction of validTransactions) {
        this.writeSales(transaction.sales, tx); // one write per sale
      }

      /**
       * aggregate stats and save to db
       */
      let addedToQueue = false;
      for (const docToUpdate of Object.values(updates)) {
        const existingStats = (await docToUpdate.currentSnapshot).data() as Stats | undefined; // promise has already resolved
        const prevMostRecentDoc =  (await docToUpdate.prevMostRecentSnapshot)?.docs?.[0];
        const prevMostRecentStats = prevMostRecentDoc?.data?.() as Stats | undefined;
        const prevStats: Stats | undefined = prevMostRecentStats ? getPrevStats(prevMostRecentStats, prevMostRecentDoc.id, docToUpdate.onePeriodAgoDocId, docToUpdate.twoPeriodsAgoDocId, docToUpdate.period) : undefined; 

        const sample = docToUpdate.dataToAggregate[0];

        /**
         * TransactionType update
         */
        if ('totalPrice' in sample) {
          const statsToMerge = (docToUpdate.dataToAggregate as TransactionType[]).map((txn) => getIncomingStats(txn));

          if (!existingStats && !addedToQueue) {
            const tokenId = validTransactions[0].sales[0].tokenId;
            addCollectionToQueue(collectionAddress, tokenId).catch((err) => {
              logger.error(err);
            });
            addedToQueue = true;
          }

          const mergedStats = statsToMerge.reduce(
            (acc, item) => getNewStats(acc, item),
            existingStats as PreAggregationStats
          );
          if (mergedStats) {
            let aggregatedStats: Stats | AllTimeStats;
            if (docToUpdate.period === StatsPeriod.All) {
              aggregatedStats = aggregateAllTimeStats(mergedStats, docToUpdate.ref.id, docToUpdate.period);
            } else {
              aggregatedStats = aggregateStats(prevStats, mergedStats, docToUpdate.ref.id, docToUpdate.period);
            }

            /**
             * save collection stats
             * min of 5 per collection
             * max of 10 writes per collection (assuming all txns are within 1 hour of each other)
             */
            tx.set(docToUpdate.ref, aggregatedStats, { merge: true });
          }
        } else {
          /**
           * NftSale update
           */
          const statsToMerge = (docToUpdate.dataToAggregate as NftSale[]).map((sale) => {
            return getIncomingStats(sale);
          });

          const mergedStats = statsToMerge.reduce(
            (acc, item) => getNewStats(acc, item),
            existingStats as PreAggregationStats
          );
          if (mergedStats) {
            let aggregatedStats: Stats | AllTimeStats;
            if (docToUpdate.period === StatsPeriod.All) {
              aggregatedStats = aggregateAllTimeStats(mergedStats, docToUpdate.ref.id, docToUpdate.period);
            } else {
              aggregatedStats = aggregateStats(prevStats, mergedStats, docToUpdate.ref.id, docToUpdate.period);
            }
            /**
             * min of 5 (all token ids are the same and in the same time interval)
             * max of 5 * num sales (different token id for every sale)
             */
            tx.set(docToUpdate.ref, aggregatedStats, { merge: true });
          }
        }
      }
    });
  }

  /**
   * called each time a tx is received to perform some "safe" db writes
   * safe := (we don't have to worry about hitting 1 write/second limit)
   */
  private async performSafeDocumentWrites(
    tx: TransactionType,
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

  /**
   * filters transactions by those that don't yet exist in the db
   */
  private async getUnsavedTransactions(transactions: TransactionType[], txn: FirebaseFirestore.Transaction): Promise<TransactionType[]> {
    const promises: { promise: Promise<boolean>; transaction: TransactionType }[] = [];
    for (const transaction of transactions) {
      const txHash = transaction.sales[0].txHash;
      promises.push({
        promise: this.transactionExists(txHash, txn),
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

  private async transactionExists(txHash: string, txn: FirebaseFirestore.Transaction): Promise<boolean> {
    const query = firebase.db
      .collection(firestoreConstants.SALES_COLL)
      .where('txHash', '==', trimLowerCase(txHash))
      .limit(1);
    const data = await txn.get(query);
    return !data.empty;
  }

  /**
   * save individual sales to the db
   */
  private writeSales(sales: NftSale[], tx: FirebaseFirestore.Transaction) {
    const salesCollectionRef = firebase.db.collection(firestoreConstants.SALES_COLL);
    for (const sale of sales) {
      const docRef = salesCollectionRef.doc();
      tx.create(docRef, sale);
    }
  }

  /**
   * enqueues a collection for indexing
   */
  private async attemptToIndex(collection: { address: string; chainId: string }) {
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
}
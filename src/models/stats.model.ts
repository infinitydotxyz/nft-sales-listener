import { firebase } from '../container';
import { addCollectionToQueue } from '../controllers/sales-collection-initializer.controller';
import { getDocumentIdByTime } from '../utils';
import { BASE_TIME, NftSale, Stats } from '../types';
import { COLLECTION_STATS_COLL, NFT_STATS_COLL } from '../constants';
import { CollectionStats } from '../services/OpenSea';
import { getDocIdHash, trimLowerCase } from '@infinityxyz/lib/utils';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';

const getNewStats = (prevStats: Stats, incomingStats: Stats): Stats => {
  const totalVolume = prevStats.totalVolume + incomingStats.totalVolume;
  const totalNumSales = prevStats.totalNumSales + incomingStats.totalNumSales;
  return {
    floorPrice: Math.min(prevStats.floorPrice, incomingStats.floorPrice),
    ceilPrice: Math.max(prevStats.ceilPrice, incomingStats.ceilPrice),
    totalVolume,
    totalNumSales,
    avgPrice: totalVolume / totalNumSales,
    updateAt: incomingStats.updateAt
  };
};

/**
 * @description save stats
 */
const saveStats = async (orders: NftSale[], totalPrice: number, chainId = '1'): Promise<void> => {
  const db = firebase.db;
  const collectionStatsRef = db
    .collection(COLLECTION_STATS_COLL)
    .doc(`${chainId}:(${trimLowerCase(orders[0].collectionAddress)}`);
  const nftDocId = getDocIdHash({
    chainId,
    collectionAddress: orders[0].collectionAddress,
    tokenId: orders[0].tokenId
  });
  const nftStatsRef = db.collection(NFT_STATS_COLL).doc(nftDocId);

  let isEmpty = false;

  await db.runTransaction(async (t) => {
    const totalNumSales = orders.length >= 2 ? orders.length : orders[0].quantity;
    const incomingStats: Stats = {
      floorPrice: orders[0].price as number,
      ceilPrice: orders[0].price as number,
      totalVolume: totalPrice,
      totalNumSales,
      avgPrice: orders[0].price as number,
      updateAt: orders[0].blockTimestamp
    };

    const docRefArray = [];
    const promiseArray = [];

    // --- collectionStats all time ---
    docRefArray.push(collectionStatsRef);
    promiseArray.push(t.get(collectionStatsRef));

    // --- collectionStats other time periods ---
    Object.values(BASE_TIME).forEach((baseTime) => {
      const docId = getDocumentIdByTime(orders[0].blockTimestamp, baseTime as BASE_TIME);
      const docRef = collectionStatsRef.collection(baseTime).doc(docId);
      promiseArray.push(t.get(docRef));
      docRefArray.push(docRef);
    });

    // --- nftStats all time ---
    docRefArray.push(nftStatsRef);
    promiseArray.push(t.get(nftStatsRef));

    // --- nftStats other time periods ---
    Object.values(BASE_TIME).forEach((baseTime) => {
      const docId = getDocumentIdByTime(orders[0].blockTimestamp, baseTime as BASE_TIME);
      const docRef = nftStatsRef.collection(baseTime).doc(docId);
      promiseArray.push(t.get(docRef));
      docRefArray.push(docRef);
    });

    const dataArray = await Promise.all(promiseArray);

    for (let i = 0; i < docRefArray.length; i++) {
      const prevStats = dataArray[i].data() as Stats | undefined;
      const docRef = docRefArray[i];
      if (prevStats) {
        t.update(docRef, getNewStats(prevStats, incomingStats));
      } else {
        isEmpty = true;
        t.set(docRef, incomingStats);
      }
    }
  });
  // todo: this gets called on all empty stats for individual nfts, not just the collection
  if (isEmpty) {
    await addCollectionToQueue(orders[0].collectionAddress, orders[0].tokenId);
  }
};

const saveInitialCollectionStats = (cs: CollectionStats, collectionAddress: string, chainId = '1') => {
  const firestore = firebase.db;
  const batchHandler = new FirestoreBatchHandler();

  const timestamp = Date.now();
  const statsRef = firestore.collection(COLLECTION_STATS_COLL).doc(`${chainId}:${trimLowerCase(collectionAddress)}`);
  const totalInfo: Stats = {
    floorPrice: cs.floor_price,
    ceilPrice: 0,
    totalVolume: cs.total_volume,
    totalNumSales: cs.total_sales,
    avgPrice: cs.average_price,
    updateAt: timestamp
  };
  batchHandler.add(statsRef, totalInfo, { merge: true });

  // --- Daily ---
  const dailyRef = statsRef.collection(BASE_TIME.DAILY).doc(getDocumentIdByTime(timestamp, BASE_TIME.DAILY));
  batchHandler.add(
    dailyRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.one_day_volume,
      totalNumSales: cs.one_day_sales,
      avgPrice: cs.one_day_average_price,
      updateAt: timestamp
    },
    { merge: true }
  );

  // --- Weekly ---
  const weekRef = statsRef.collection(BASE_TIME.WEEKLY).doc(getDocumentIdByTime(timestamp, BASE_TIME.WEEKLY));
  batchHandler.add(
    weekRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.seven_day_volume,
      totalNumSales: cs.seven_day_sales,
      avgPrice: cs.seven_day_average_price,
      updateAt: timestamp
    },
    { merge: true }
  );

  // --- Monthly ---
  const monthlyRef = statsRef.collection(BASE_TIME.MONTHLY).doc(getDocumentIdByTime(timestamp, BASE_TIME.MONTHLY));
  batchHandler.add(
    monthlyRef,
    {
      floorPrice: 0,
      ceilPrice: 0,
      totalVolume: cs.thirty_day_volume,
      totalNumSales: cs.thirty_day_sales,
      avgPrice: cs.thirty_day_average_price,
      updateAt: timestamp
    },
    { merge: true }
  );

  // commit
  batchHandler.flush();
};

const CollectionStatsModel = { saveStats, saveInitialCollectionStats };

export default CollectionStatsModel;

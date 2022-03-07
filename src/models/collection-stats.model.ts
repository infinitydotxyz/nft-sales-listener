import { firebase } from '../container';
import { addCollectionToQueue } from '../controllers/sales-collection-initializer.controller';
import { getDocumentIdByTime } from '../utils';
import { BASE_TIME, NftSalesRepository, CollectionStatsRepository, NftStatsRepository } from '../types';
import { DBN_COLLECTION_STATS } from '../constants';
import { CollectionStats } from '../services/OpenSea';

const getNewStats = (
  prevStats: CollectionStatsRepository,
  incomingStats: CollectionStatsRepository
): CollectionStatsRepository => {
  const totalVolume = prevStats.totalVolume + incomingStats.totalVolume;
  const totalNumSales = prevStats.totalNumSales + incomingStats.totalNumSales;
  return {
    floorPrice:
      prevStats.floorPrice === 0
        ? Math.min(incomingStats.floorPrice, prevStats.avgPrice)
        : Math.min(prevStats.floorPrice, prevStats.avgPrice, incomingStats.floorPrice),
    ceilPrice:
      prevStats.floorPrice === 0
        ? Math.max(incomingStats.ceilPrice, prevStats.avgPrice)
        : Math.max(prevStats.ceilPrice, prevStats.avgPrice, incomingStats.ceilPrice),
    totalVolume,
    totalNumSales,
    avgPrice: totalVolume / totalNumSales,
    updateAt: incomingStats.updateAt
  };
};

/**
 * @description save the orders into <sales> collection
 */
const handleOrders = async (orders: NftSalesRepository[], totalPrice: number, chainId = '1'): Promise<void> => {
  const db = firebase.db;
  const statsRef = db.collection(DBN_COLLECTION_STATS).doc(`${chainId}:${orders[0].collectionAddress}`);
  let isEmpty = false;

  await db.runTransaction(async (t) => {
    const incomingStats: NftStatsRepository = {
      floorPrice: orders[0].price,
      ceilPrice: orders[0].price,
      totalVolume: totalPrice,
      totalNumSales: orders.length,
      avgPrice: orders[0].price,
      updateAt: orders[0].blockTimestamp
    };

    const docRefArray = [];
    const promiseArray = [];

    docRefArray.push(statsRef);
    promiseArray.push(t.get(statsRef));
    Object.values(BASE_TIME).forEach((baseTime) => {
      const docId = getDocumentIdByTime(orders[0].blockTimestamp, baseTime as BASE_TIME);
      const docRef = statsRef.collection(baseTime).doc(docId);
      promiseArray.push(t.get(docRef));
      docRefArray.push(docRef);
    });

    const dataArray = await Promise.all(promiseArray);

    for (let i = 0; i < docRefArray.length; i++) {
      const prevStats = dataArray[i].data() as CollectionStatsRepository | undefined;
      const docRef = docRefArray[i];
      if (prevStats) {
        t.update(docRef, getNewStats(prevStats, incomingStats));
      } else {
        isEmpty = true;
        t.set(docRef, incomingStats);
      }
    }
  });
  if (isEmpty) {
    await addCollectionToQueue(orders[0].collectionAddress, orders[0].tokenId);
  }
};

const initStatsFromOS = async (
  cs: CollectionStats,
  collectionAddress: string,
  chainId = '1'
): Promise<FirebaseFirestore.WriteResult[]> => {
  const firestore = firebase.db;
  const batch = firestore.batch();

  const timestamp = Date.now();
  const statsRef = firestore.collection(DBN_COLLECTION_STATS).doc(`${chainId}:${collectionAddress}`);
  const totalInfo: CollectionStatsRepository = {
    floorPrice: cs.floor_price,
    ceilPrice: 0,
    totalVolume: cs.total_volume,
    totalNumSales: cs.total_sales,
    avgPrice: cs.average_price,
    updateAt: timestamp
  };
  batch.set(statsRef, totalInfo, { merge: true });

  // --- Daily ---
  const DailyRef = statsRef.collection(BASE_TIME.DAILY).doc(getDocumentIdByTime(timestamp, BASE_TIME.DAILY));
  batch.set(
    DailyRef,
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
  batch.set(
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
  batch.set(
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
  const res = await batch.commit();
  return res;
};

const CollectionStatsModel = { handleOrders, initStatsFromOS };

export default CollectionStatsModel;

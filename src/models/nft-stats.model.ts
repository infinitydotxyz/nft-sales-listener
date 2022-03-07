import { firebase } from '../container';
import { getDocumentIdByTime } from '../utils';
import { BASE_TIME, NftSalesRepository, NftStatsRepository } from '../types';
import { DBN_NFT_STATS } from '../constants';
import { getHashByNftAddress } from '../utils';

const getNewStats = (prevStats: NftStatsRepository, incomingStats: NftStatsRepository): NftStatsRepository => {
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
 * @description save the orders into <sales> collection
 */
const handleOrders = async (orders: NftSalesRepository[], totalPrice: number, chainId = '1'): Promise<void> => {
  const db = firebase.db;
  const nftDocId = getHashByNftAddress(chainId, orders[0].collectionAddress, orders[0].tokenId);
  const statsRef = db.collection(DBN_NFT_STATS).doc(nftDocId);

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
      const prevStats = dataArray[i].data() as NftStatsRepository | undefined;
      const docRef = docRefArray[i];
      if (prevStats) {
        t.update(docRef, getNewStats(prevStats, incomingStats));
      } else {
        t.set(docRef, incomingStats);
      }
    }
  });
};

const NftStatsModel = { handleOrders };

export default NftStatsModel;

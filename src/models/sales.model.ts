import { firebase, logger } from '../container';
import { NftSalesRepository } from '../types';
import { DBN_SALES } from '../constants';

/**
 * @description save the orders into <sales> collection
 */
const handleOrders = async (orders: NftSalesRepository[], chainId = '1'): Promise<FirebaseFirestore.WriteResult[]> => {
  try {
    const firestore = firebase.db;
    const batch = firestore.batch();
    const SalesCollectionRef = firestore.collection(DBN_SALES);
    orders.forEach((order) => {
      const docRef = SalesCollectionRef.doc();
      batch.create(docRef, order);
    });
    const res = await batch.commit();
    return res;
  } catch (err) {
    logger.error('SalesModel:[handleOrders]', err);
    throw err;
  }
};

const SalesModel = { handleOrders };

export default SalesModel;

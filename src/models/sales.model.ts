import { firebase, logger } from '../container';
import { NftSale } from '../types';
import { SALES_COLL } from '../constants';

/**
 * @description save the orders into <sales> collection
 */
const handleOrders = async (orders: NftSale[]): Promise<FirebaseFirestore.WriteResult[]> => {
  try {
    const firestore = firebase.db;
    const batch = firestore.batch();
    const SalesCollectionRef = firestore.collection(SALES_COLL);
    orders.forEach((order) => {
      const docRef = SalesCollectionRef.doc();
      batch.create(docRef, order);
    });
    return batch.commit();
  } catch (err) {
    logger.error('SalesModel:[handleOrders]', err);
    throw err;
  }
};

const SalesModel = { handleOrders };

export default SalesModel;

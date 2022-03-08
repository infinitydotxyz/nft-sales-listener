import { firebase, logger } from '../container';
import { NftSale } from '../types';
import { SALES_COLL } from '../constants';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';

/**
 * @description save the orders into <sales> collection
 */
const saveSales = (orders: NftSale[]): void => {
  try {
    const fsBatchHandler = new FirestoreBatchHandler();
    const SalesCollectionRef = firebase.db.collection(SALES_COLL);
    orders.forEach((order) => {
      const docRef = SalesCollectionRef.doc();
      fsBatchHandler.add(docRef, order, { merge: true });
    });
    fsBatchHandler.flush();
  } catch (err) {
    logger.error('SalesModel:[saveSales]', err);
    throw err;
  }
};

const SalesModel = { saveSales };

export default SalesModel;

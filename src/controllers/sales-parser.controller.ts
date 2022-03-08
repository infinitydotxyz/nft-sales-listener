import { logger } from '../container';
import { convertWeiToEther } from '../utils';
import { NftSale } from '../types';
import { NULL_ADDRESS } from '../constants';

import SalesModel from '../models/sales.model';
import StatsModel from '../models/stats.model';
import { trimLowerCase, ETHEREUM_WETH_ADDRESS } from '@infinityxyz/lib/utils';

export const parseSaleOrders = async (sales: NftSale[]): Promise<void> => {
  /**
   * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
   * */
  if (
    sales[0].paymentToken !== NULL_ADDRESS ||
    trimLowerCase(sales[0].paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)
  ) {
    return;
  }

  try {
    const totalPrice = convertWeiToEther(sales[0].price as BigInt);
    const orders: NftSale[] = sales.map((tx: NftSale) => {
      const order: NftSale = {
        chainId: tx.chainId,
        tokenType: tx.tokenType,
        txHash: trimLowerCase(tx.txHash),
        tokenId: tx.tokenId,
        collectionAddress: trimLowerCase(tx.collectionAddress),
        price: totalPrice / sales.length / tx.quantity,
        paymentToken: tx.paymentToken,
        quantity: tx.quantity,
        buyer: trimLowerCase(tx.buyer),
        seller: trimLowerCase(tx.seller),
        source: tx.source,
        blockNumber: tx.blockNumber,
        blockTimestamp: tx.blockTimestamp
      };
      return order;
    });

    SalesModel.saveSales(orders);
    StatsModel.saveStats(orders, totalPrice);
  } catch (err) {
    logger.error('Failed saving orders to firestore', err);
  }
};

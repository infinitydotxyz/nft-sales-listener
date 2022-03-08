import { logger } from '../container';
import { convertWeiToEther } from '../utils';
import { NftSale } from '../types';
import { NULL_ADDRESS } from '../constants';

import SalesModel from '../models/sales.model';
import StatsModel from '../models/stats.model';
import { trimLowerCase } from '@infinityxyz/lib/utils';

export const handleNftTransactions = async (transactions: NftSale[]): Promise<void> => {
  /**
   * Skip the transactions without ether as the payment. ex: usd, matic ...
   * */
  if (transactions[0].paymentToken !== NULL_ADDRESS) {
    return;
  }

  try {
    const totalPrice = convertWeiToEther(transactions[0].price as BigInt);
    const orders: NftSale[] = transactions.map((tx: NftSale) => {
      const order: NftSale = {
        chainId: tx.chainId,
        tokenType: tx.tokenType,
        txHash: trimLowerCase(tx.txHash),
        tokenId: tx.tokenId,
        collectionAddress: trimLowerCase(tx.collectionAddress),
        price: totalPrice / transactions.length / tx.quantity,
        paymentToken: tx.paymentToken,
        quantity: tx.quantity,
        buyer: trimLowerCase(tx.buyer),
        seller: trimLowerCase(tx.seller),
        source: tx.source,
        blockNumber: tx.blockNumber,
        blockTimestamp: tx.blockTimestamp,
      };
      return order;
    });

    const promiseArray = [SalesModel.handleOrders(orders), StatsModel.handleOrders(orders, totalPrice)];

    await Promise.allSettled(promiseArray);
  } catch (err) {
    logger.error('Sales-scraper:updateCollectionSalesInfo', err);
  }
};

import { logger } from '../container';
import { convertWeiToEther } from '../utils';
import { NftTransaction, NftSalesRepository, SCRAPER_SOURCE, TOKEN_TYPE } from '../types';
import { NULL_ADDR } from '../constants';

import SalesModel from '../models/sales.model';
import NftStatsModel from '../models/nft-stats.model';
import CollectionStatsModel from '../models/collection-stats.model';

export const handleNftTransactions = async (transactions: NftTransaction[], chainId = '1'): Promise<void> => {
  /**
   * Skip the transactions without ether as the payment. ex: usd, matic ...
   * */
  if (transactions[0].paymentToken !== NULL_ADDR) {
    return;
  }

  try {
    const totalPrice = convertWeiToEther(transactions[0].price);
    const orders: NftSalesRepository[] = transactions.map((tx: NftTransaction) => {
      const order: NftSalesRepository = {
        txHash: tx.txHash.trim().toLowerCase(),
        tokenId: tx.tokenIdStr,
        collectionAddress: tx.collectionAddr.trim().toLowerCase(),
        price: totalPrice / transactions.length,
        paymentTokenType: tx.paymentToken,
        quantity: tx.quantity,
        buyer: tx.buyerAddress.trim().toLowerCase(),
        seller: tx.sellerAddress.trim().toLowerCase(),
        source: tx.source,
        blockNumber: tx.blockNumber,
        blockTimestamp: tx.blockTimestamp
      };
      return order;
    });

    await SalesModel.handleOrders(orders);
    await NftStatsModel.handleOrders(orders, totalPrice);
    await CollectionStatsModel.handleOrders(orders, totalPrice);
  } catch (err) {
    logger.error('Sales-scraper:updateCollectionSalesInfo', err);
  }
};

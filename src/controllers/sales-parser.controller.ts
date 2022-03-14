import { logger } from '../container';
import { convertWeiToEther } from '../utils';
import { NftSale, PreParsedNftSale } from '../types';
import { NULL_ADDRESS } from '../constants';
import { trimLowerCase, ETHEREUM_WETH_ADDRESS } from '@infinityxyz/lib/utils';

export const parseSaleOrders = (sales: PreParsedNftSale[]): { sales: NftSale[]; totalPrice: number } => {
  /**
   * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
   * */
  if (
    sales[0].paymentToken !== NULL_ADDRESS &&
    trimLowerCase(sales[0].paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)
  ) {
    return { sales: [], totalPrice: 0 };
  }

  try {
    const totalPrice = convertWeiToEther(sales[0].price );
    const orders: NftSale[] = sales.map((tx: PreParsedNftSale) => {
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
        timestamp: tx.timestamp
      };
      return order;
    });

    return { sales: orders, totalPrice };
  } catch (err) {
    logger.error('Failed parsing orders', err);
    return { sales: [], totalPrice: 0 };
  }
};

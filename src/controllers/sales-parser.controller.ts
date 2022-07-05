import { logger } from '../container';
import { convertWeiToEther } from '../utils';
import { PreParsedInfinityNftSale, PreParsedNftSale } from '../types';
import { NULL_ADDRESS } from '../constants';
import { trimLowerCase, ETHEREUM_WETH_ADDRESS } from '@infinityxyz/lib/utils';
import { NftSale } from '@infinityxyz/lib/types/core/NftSale';

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
    const totalPrice = convertWeiToEther(sales[0].price);
    const orders: NftSale[] = sales.map((tx: PreParsedNftSale) => {
      const order: NftSale = {
        chainId: tx.chainId,
        tokenStandard: tx.tokenStandard,
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

export const parseInfinitySaleOrder = (sale: PreParsedInfinityNftSale): { sales: NftSale[]; totalPrice: number } => {
  /**
   * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
   * */
  if (sale.paymentToken !== NULL_ADDRESS && trimLowerCase(sale.paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)) {
    return { sales: [], totalPrice: 0 };
  }

  try {
    const totalPrice = convertWeiToEther(sale.price);
    const orders: NftSale[] = [];

    for (const orderItem of sale.orderItems) {
      const collectionAddress = orderItem.collection;
      for (const token of orderItem.tokens) {
        const order: NftSale = {
          chainId: sale.chainId,
          tokenStandard: sale.tokenStandard,
          txHash: trimLowerCase(sale.txHash),
          tokenId: token.tokenId,
          collectionAddress: trimLowerCase(collectionAddress),
          price: totalPrice / sale.quantity,
          paymentToken: sale.paymentToken,
          quantity: token.numTokens,
          buyer: trimLowerCase(sale.buyer),
          seller: trimLowerCase(sale.seller),
          source: sale.source,
          blockNumber: sale.blockNumber,
          timestamp: sale.timestamp
        };
        orders.push(order);
      }
    }

    return { sales: orders, totalPrice };
  } catch (err) {
    logger.error('Failed parsing infinity sale orders', err);
    return { sales: [], totalPrice: 0 };
  }
};

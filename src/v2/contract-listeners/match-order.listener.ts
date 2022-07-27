import { ChainId, ChainNFTs, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { PreParsedInfinityNftSale, PreParsedInfinityNftSaleInfoMatchOrder, PreParseInfinityMultipleNftSaleMatchOrder } from 'types';
import { TransactionReceiptProvider } from 'v2/models/transaction-receipt-provider';
import { BlockProvider } from '../models/block-provider';
import { ContractListenerBundle } from './contract-listener-bundle.abstract';

export type MatchOrderEvent = PreParsedInfinityNftSale & { buyOrderHash: string; sellOrderHash: string };
export type MatchOrderBundleEvent = { blockNumber: number; events: PreParseInfinityMultipleNftSaleMatchOrder };

export class MatchOrderListener extends ContractListenerBundle<MatchOrderBundleEvent, MatchOrderEvent> {
  public readonly eventName = 'MatchOrderFulfilled';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, txReceiptProvider: TransactionReceiptProvider) {
    super(contract, blockProvider, txReceiptProvider);
    this._eventFilter = contract.filters.MatchOrderFulfilled();
  }

  async decodeLogs(
    logs: ethers.Event[]
  ): Promise<MatchOrderBundleEvent | null> {
    const events = [];
    const blockNumber = logs.find((item) => !!item.blockNumber)?.blockNumber;
    if (!blockNumber) {
      return null;
    }
    for (const log of logs) {
      const res = await this.decodeSingleLog(log);
      if (res) {
        events.push(res);
      }
    }
    if (events.length === 0) {
      return null;
    }
    const firstItem = events[0];
    const initial: PreParseInfinityMultipleNftSaleMatchOrder = {
      chainId: firstItem.chainId,
      txHash: firstItem.txHash,
      blockNumber: firstItem.blockNumber,
      timestamp: firstItem.timestamp,
      source: firstItem.source,
      complication: firstItem.complication,
      sales: []
    };
    const multipleNftSales = events.reduce((acc, item) => {
      if (!item) {
        return acc;
      }
      const saleInfo: PreParsedInfinityNftSaleInfoMatchOrder = {
        paymentToken: item.paymentToken,
        price: item.price,
        buyer: item.buyer,
        seller: item.seller,
        quantity: item.quantity,
        tokenStandard: item.tokenStandard,
        orderItems: item.orderItems,
        buyOrderHash: item.buyOrderHash,
        sellOrderHash: item.sellOrderHash
      };
      acc.sales.push(saleInfo);
      return acc;
    }, initial);

    return { blockNumber, events: multipleNftSales };
  }

  async decodeSingleLog(log: ethers.providers.Log): Promise<MatchOrderEvent | null> {
    if(!log) {
      return null;
    }
    const event = this._contract.interface.parseLog(log);
    const eventData = event.args;
    if (eventData?.length !== 8) {
      return null;
    }
    // see commented reference below for payload structure
    const sellOrderHash = String(eventData[0]);
    const buyOrderHash = String(eventData[1]);
    const seller = trimLowerCase(String(eventData[2]));
    const buyer = trimLowerCase(String(eventData[3]));
    const complication = trimLowerCase(String(eventData[4]));
    const currency = trimLowerCase(String(eventData[5]));
    const amount = BigNumber.from(eventData[6]);
    const nfts = eventData[7];

    let quantity = 0;
    const orderItems: ChainNFTs[] = [];

    for (const orderItem of nfts) {
      const [_address, tokens] = orderItem;
      const tokenInfos = [];
      for (const token of tokens) {
        const [_tokenId, _numTokens] = token as [string, string];
        const tokenId = BigNumber.from(_tokenId).toString();
        const numTokens = BigNumber.from(_numTokens).toNumber();
        const tokenInfo = {
          tokenId,
          numTokens
        };
        tokenInfos.push(tokenInfo);
        quantity += numTokens;
      }

      const address = trimLowerCase(String(_address));
      const chainNFT: ChainNFTs = {
        collection: address,
        tokens: tokenInfos
      };
      orderItems.push(chainNFT);
    }

    const txHash = log.transactionHash;
    const block = await this._blockProvider.getBlock(log.blockNumber);
    const res: MatchOrderEvent = {
      chainId: ChainId.Mainnet,
      txHash,
      blockNumber: block.number,
      timestamp: block.timestamp * 1000,
      price: amount.toBigInt(),
      complication,
      paymentToken: currency,
      quantity,
      source: SaleSource.Infinity,
      tokenStandard: TokenStandard.ERC721,
      seller,
      buyer,
      orderItems,
      buyOrderHash,
      sellOrderHash
    };
    return res;
  }
}

import { ChainId, ChainNFTs, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import {
  PreParsedInfinityNftSale,
  PreParseInfinityMultipleNftSaleTakeOrder,
  PreParseInfinityNftSaleInfoTakeOrder
} from '../../types';
import { ProtocolFeeProvider } from '../protocol-fee-provider';
import { TransactionReceiptProvider } from '../transaction-receipt-provider';
import { BlockProvider } from '../block-provider';
import { ContractListenerBundle } from './contract-listener-bundle.abstract';

export type TakeOrderEvent = PreParsedInfinityNftSale & { orderHash: string };
export type TakeOrderBundleEvent = { blockNumber: number; events: PreParseInfinityMultipleNftSaleTakeOrder };

export class TakeOrderListener extends ContractListenerBundle<TakeOrderBundleEvent, TakeOrderEvent> {
  public readonly eventName = 'TakeOrderFulfilled';
  protected _eventFilter: ethers.EventFilter;

  constructor(
    contract: ethers.Contract,
    blockProvider: BlockProvider,
    chainId: ChainId,
    txReceiptProvider: TransactionReceiptProvider,
    protected _protocolFeeProvider: ProtocolFeeProvider
  ) {
    super(contract, blockProvider, chainId, txReceiptProvider);
    this._eventFilter = contract.filters.TakeOrderFulfilled();
  }

  async decodeLogs(logs: ethers.Event[]): Promise<TakeOrderBundleEvent | null> {
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
    const initial: PreParseInfinityMultipleNftSaleTakeOrder = {
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
      const saleInfo: PreParseInfinityNftSaleInfoTakeOrder = {
        paymentToken: item.paymentToken,
        price: item.price,
        buyer: item.buyer,
        seller: item.seller,
        quantity: item.quantity,
        tokenStandard: item.tokenStandard,
        orderItems: item.orderItems,
        orderHash: item.orderHash,
        protocolFeeWei: item.protocolFeeWei,
        protocolFeeBPS: item.protocolFeeBPS
      };
      acc.sales.push(saleInfo);
      return acc;
    }, initial);

    return { blockNumber, events: multipleNftSales };
  }

  async decodeSingleLog(log: ethers.providers.Log): Promise<TakeOrderEvent | null> {
    if (!log) {
      return null;
    }
    const event = this._contract.interface.parseLog(log);
    const eventData = event.args;
    if (eventData?.length !== 7) {
      return null;
    }
    const orderHash = String(eventData[0]);
    const seller = trimLowerCase(String(eventData[1]));
    const buyer = trimLowerCase(String(eventData[2]));
    const complication = trimLowerCase(String(eventData[3]));
    const currency = trimLowerCase(String(eventData[4]));
    const amount = BigNumber.from(eventData[5]);
    const nfts = eventData[6];

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
    const price = amount.toBigInt();
    const { feesPaidWei, protocolFeeBPS } = (
      await this._protocolFeeProvider.getProtocolFee(
        trimLowerCase(this._contract.address),
        this.chainId,
        log.blockNumber,
        log.transactionIndex
      )
    ).getFees(price);

    const txHash = log.transactionHash;
    const block = await this._blockProvider.getBlock(log.blockNumber);
    const res: TakeOrderEvent = {
      chainId: ChainId.Mainnet,
      txHash,
      blockNumber: block.number,
      timestamp: block.timestamp * 1000,
      price: price,
      complication,
      transactionIndex: log.transactionIndex,
      paymentToken: currency,
      quantity,
      source: SaleSource.Infinity,
      tokenStandard: TokenStandard.ERC721,
      seller,
      buyer,
      orderItems,
      orderHash,
      protocolFeeWei: feesPaidWei.toString(),
      protocolFeeBPS: protocolFeeBPS
    };
    return res;
  }
}

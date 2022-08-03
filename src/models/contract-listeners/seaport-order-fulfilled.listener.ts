import { ChainId, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { ETHEREUM_WETH_ADDRESS, NULL_ADDRESS, trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import {
  PreParsedMultipleNftSale,
  PreParsedNftSale,
  PreParsedNftSaleInfo,
  SeaportReceivedAmount,
  SeaportSoldNft
} from '../../types';
import { BlockProvider } from '../block-provider';
import { TransactionReceiptProvider } from '../transaction-receipt-provider';
import { ContractListenerBundle } from './contract-listener-bundle.abstract';

export type SeaportOrderFulfilledEvent = { blockNumber: number; events: PreParsedNftSale[] };
export type SeaportOrderFulfilledBundleEvent = { blockNumber: number; events: PreParsedMultipleNftSale };
export class SeaportOrderFulfilledListener extends ContractListenerBundle<
  SeaportOrderFulfilledBundleEvent,
  SeaportOrderFulfilledEvent
> {
  public readonly eventName = 'OrderFulfilled';
  protected _eventFilter: ethers.EventFilter;

  constructor(
    contract: ethers.Contract,
    blockProvider: BlockProvider,
    chainId: ChainId,
    txReceiptProvider: TransactionReceiptProvider
  ) {
    super(contract, blockProvider, chainId, txReceiptProvider);
    this._eventFilter = contract.filters.OrderFulfilled();
  }

  protected async decodeLogs(logs: ethers.providers.Log[]): Promise<SeaportOrderFulfilledBundleEvent | null> {
    const events = [];
    const blockNumber = logs.find((item) => !!item.blockNumber)?.blockNumber;
    if (!blockNumber) {
      return null;
    }
    for (const log of logs) {
      const res = await this.decodeSingleLog(log);
      if (res && res.events.length >= 0) {
        events.push(...res.events);
      }
    }
    if (events.length === 0) {
      return null;
    }
    const firstItem = events[0];
    const initial: PreParsedMultipleNftSale = {
      chainId: firstItem.chainId,
      txHash: firstItem.txHash,
      blockNumber: firstItem.blockNumber,
      timestamp: firstItem.timestamp,
      source: firstItem.source,
      paymentToken: firstItem.paymentToken,
      sales: []
    };
    const multipleNftSales = events.reduce((acc, item) => {
      if (!item) {
        return acc;
      }
      const saleInfo: PreParsedNftSaleInfo = {
        collectionAddress: item.collectionAddress,
        tokenId: item.tokenId,
        price: item.price,
        buyer: item.buyer,
        seller: item.seller,
        quantity: item.quantity,
        tokenStandard: item.tokenStandard
      };
      acc.sales.push(saleInfo);
      return acc;
    }, initial);

    return { blockNumber, events: multipleNftSales };
  }

  protected async decodeSingleLog(log: ethers.providers.Log): Promise<SeaportOrderFulfilledEvent | null> {
    if (!log) {
      return null;
    }
    const event = this._contract.interface.parseLog(log);
    const eventData = event.args;
    if (eventData?.length !== 6) {
      return null;
    }

    // see commented reference below for payload structure
    const offerer = eventData[1];
    const fulfiller = eventData[3];
    const spentItems = eventData[4];
    const receivedItems = eventData[5];

    const soldNfts: SeaportSoldNft[] = [];
    const amounts: SeaportReceivedAmount[] = [];

    for (const spentItem of spentItems) {
      const [_itemType, _token, _identifier, _amount] = spentItem;
      const itemType = _itemType;
      const token = _token;
      const identifier = BigNumber.from(_identifier).toString();
      const amount = BigNumber.from(_amount).toString();

      // only ERC721 items are supported
      if (itemType === 2 || itemType === 4) {
        soldNfts.push({
          tokenAddress: trimLowerCase(String(token)),
          tokenId: String(identifier),
          seller: trimLowerCase(String(offerer)),
          buyer: trimLowerCase(String(fulfiller))
        });
      } else if (itemType === 0 || itemType === 1) {
        // only ETH and WETH
        if (String(token).toLowerCase() === NULL_ADDRESS || String(token).toLowerCase() === ETHEREUM_WETH_ADDRESS) {
          amounts.push({
            tokenAddress: trimLowerCase(String(token)),
            amount: String(amount),
            seller: trimLowerCase(String(fulfiller)),
            buyer: trimLowerCase(String(offerer))
          });
        }
      }
    }

    for (const receivedItem of receivedItems) {
      const [_itemType, _token, _identifier, _amount] = receivedItem;
      const itemType = _itemType;
      const token = _token;
      const identifier = BigNumber.from(_identifier).toString();
      const amount = BigNumber.from(_amount).toString();

      // only ERC721 items are supported
      if (itemType === 2 || itemType === 4) {
        soldNfts.push({
          tokenAddress: trimLowerCase(String(token)),
          tokenId: String(identifier),
          seller: trimLowerCase(String(fulfiller)),
          buyer: trimLowerCase(String(offerer))
        });
      } else if (itemType === 0 || itemType === 1) {
        // only ETH and WETH
        if (String(token).toLowerCase() === NULL_ADDRESS || String(token).toLowerCase() === ETHEREUM_WETH_ADDRESS) {
          amounts.push({
            tokenAddress: trimLowerCase(String(token)),
            amount: String(amount),
            seller: trimLowerCase(String(offerer)),
            buyer: trimLowerCase(String(fulfiller))
          });
        }
      }
    }

    let totalAmount = BigNumber.from(0);
    for (const amount of amounts) {
      totalAmount = totalAmount.add(amount.amount);
    }

    const txHash = log.transactionHash;

    const block = await this._blockProvider.getBlock(log.blockNumber);
    const res: PreParsedNftSale = {
      chainId: ChainId.Mainnet,
      txHash,
      blockNumber: block.number,
      timestamp: block.timestamp * 1000,
      price: totalAmount.toBigInt(),
      paymentToken: NULL_ADDRESS,
      quantity: 1,
      source: SaleSource.Seaport,
      tokenStandard: TokenStandard.ERC721,
      seller: '',
      buyer: '',
      collectionAddress: '',
      tokenId: ''
    };

    const saleOrders: PreParsedNftSale[] = [];
    for (const nft of soldNfts) {
      const saleOrder: PreParsedNftSale = {
        ...res,
        seller: nft.seller,
        buyer: nft.buyer,
        collectionAddress: nft.tokenAddress,
        tokenId: nft.tokenId
      };
      saleOrders.push(saleOrder);
    }

    return {
      blockNumber: log.blockNumber,
      events: saleOrders
    };
  }
}

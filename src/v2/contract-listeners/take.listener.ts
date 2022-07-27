import { ChainId, ChainNFTs, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import { PreParsedInfinityNftSale } from 'types';
import { BlockProvider } from '../models/block-provider';
import { ContractListener } from './contract-listener.abstract';

export type TakeEvent = PreParsedInfinityNftSale & { orderHash: string };

export class TakeListener extends ContractListener<TakeEvent> {
  public readonly eventName = 'TakeOrderFulfilled';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider) {
    super(contract, blockProvider);
    this._eventFilter = contract.filters.TakeOrderFulfilled();
  }

  async decodeLog(args: ethers.Event[]): Promise<TakeEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
    const eventData = event.args;
    if (eventData?.length !== 7) {
      return null;
    }
    // see commented reference below for payload structure
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

    const txHash = event.transactionHash;
    const block = await this._blockProvider.getBlock(event.blockNumber);
    const res: TakeEvent = {
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
      orderHash
    };
    return res;
  }
}

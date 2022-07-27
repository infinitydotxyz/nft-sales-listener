import { ChainId, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { sleep } from '@infinityxyz/lib/utils';
import { MERKLE_VALIDATOR_ADDRESS, WYVERN_ATOMICIZER_ADDRESS } from 'constants/wyvern-constants';
import { ethers } from 'ethers';
import { PreParsedMultipleNftSale, PreParsedNftSale, PreParsedNftSaleInfo } from 'types';
import { BlockProvider } from 'v2/models/block-provider';
import { TransactionReceiptProvider } from 'v2/models/transaction-receipt-provider';
import { ContractListenerBundle } from './contract-listener-bundle.abstract';

export type OpenSeaOrdersMatchedEvent ={ blockNumber: number; events: PreParsedNftSale[] };
export type OpenSeaOrdersMatchedBundleEvent = { blockNumber: number; events: PreParsedMultipleNftSale };

type DecodedAtomicMatchInputs = {
  calldataBuy: string;
  addrs: string[];
  uints: BigInt[];
};

interface TokenInfo {
  collectionAddr: string;
  tokenIdStr: string;
  quantity: number;
  tokenType: string;
}

export class OpenSeaOrdersMatchedListener extends ContractListenerBundle<
  OpenSeaOrdersMatchedBundleEvent,
  OpenSeaOrdersMatchedEvent
> {
  public readonly eventName = 'OrdersMatched';
  protected _eventFilter: ethers.EventFilter;

  constructor(contract: ethers.Contract, blockProvider: BlockProvider, txReceiptProvider: TransactionReceiptProvider) {
    super(contract, blockProvider, txReceiptProvider);
    this._eventFilter = contract.filters.OrdersMatched();
  }

  protected async decodeLogs(
    logs: ethers.Event[]
  ): Promise<{ blockNumber: number; events: PreParsedMultipleNftSale } | null> {
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

  async decodeSingleLog(log: ethers.providers.Log): Promise<OpenSeaOrdersMatchedEvent | null> {
    if (!log) {
      return null;
    }
    const txHash: string = log?.transactionHash;
    if (!txHash) {
      return null;
    }

    let response;
    let maxAttempts = 10;
    while (maxAttempts > 0) {
      try {
        response = (await this._contract.provider.getTransaction(txHash)).data;
      } catch (err) {
        await sleep(2000);
        maxAttempts--;
        continue;
      }
      break;
    }
    const block = await this._blockProvider.getBlock(log.blockNumber);
    const decodedResponse: DecodedAtomicMatchInputs = this._contract.interface.decodeFunctionData(
      'atomicMatch_',
      response as ethers.utils.BytesLike
    ) as any;
    const saleOrders = this.handleAtomicMatch(decodedResponse, txHash, block);
    return {
      blockNumber: log.blockNumber,
      events: saleOrders
    };
  }

  private handleAtomicMatch(
    inputs: DecodedAtomicMatchInputs,
    txHash: string,
    block: ethers.providers.Block
  ): PreParsedNftSale[] {
    const addrs: string[] = inputs.addrs;
    const saleAddress: string = addrs[11];

    const uints: BigInt[] = inputs.uints;
    const price: BigInt = uints[4];
    const buyer = addrs[1]; // Buyer.maker
    const seller = addrs[8]; // Seller.maker
    const paymentTokenErc20Address = addrs[6];

    const res: PreParsedNftSale = {
      chainId: ChainId.Mainnet,
      txHash,
      blockNumber: block.number,
      timestamp: block.timestamp * 1000,
      price,
      paymentToken: paymentTokenErc20Address,
      buyer,
      seller,
      collectionAddress: '',
      tokenId: '',
      quantity: 0,
      source: SaleSource.OpenSea,
      tokenStandard: TokenStandard.ERC721
    };

    if (saleAddress.toLowerCase() !== WYVERN_ATOMICIZER_ADDRESS) {
      const token = this.handleSingleSale(inputs);
      res.collectionAddress = token.collectionAddr;
      res.tokenId = token.tokenIdStr;
      res.tokenStandard = token.tokenType === TokenStandard.ERC721 ? TokenStandard.ERC721 : TokenStandard.ERC1155;
      res.quantity = token.quantity;
      return [res];
    } else {
      const tokens = this.handleBundleSale(inputs);
      const response: PreParsedNftSale[] = tokens.map((token: TokenInfo) => {
        res.collectionAddress = token.collectionAddr;
        res.tokenId = token.tokenIdStr;
        res.tokenStandard = TokenStandard.ERC721;
        res.quantity = token.quantity;
        return res;
      });
      return response;
    }
  }

  /**
   *
   * @param inputs The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
   * @description This function is used to handle the case of a "normal" sale made from OpenSea.
   *              A "normal" sale is a sale that is not a bundle (only contains one asset).
   */

  private handleSingleSale(inputs: DecodedAtomicMatchInputs): TokenInfo {
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;

    const addrs = inputs.addrs;
    const nftAddrs: string = addrs[4];

    let collectionAddr;
    let tokenIdStr;
    let quantity = 1;
    let tokenType = TokenStandard.ERC721;
    const calldataBuy: string = inputs.calldataBuy;

    let offset = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 2;
    if (nftAddrs.toLowerCase() === MERKLE_VALIDATOR_ADDRESS) {
      collectionAddr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString();
      offset += UINT_256_LENGTH;
      tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
      offset += UINT_256_LENGTH;
      if (calldataBuy.length > 458) {
        quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
        tokenType = TokenStandard.ERC1155;
      }
    } else {
      // Token minted on Opensea
      collectionAddr = nftAddrs.toLowerCase();
      tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
      offset += UINT_256_LENGTH;
      if (calldataBuy.length > 202) {
        quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
        tokenType = TokenStandard.ERC1155;
      }
    }

    return {
      collectionAddr,
      tokenIdStr,
      quantity,
      tokenType
    };
  }

  /**
   *
   * @param inputs inputs AtomicMatch call that triggered the handleAtomicMatch_ call handler.
   * @description This function is used to handle the case of a "bundle" sale made from OpenSea.
   *              A "bundle" sale is a sale that contains several assets embedded in the same, atomic, transaction.
   */
  private handleBundleSale(inputs: DecodedAtomicMatchInputs): TokenInfo[] {
    const calldataBuy: string = inputs?.calldataBuy;
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;

    const indexStartNbToken = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 4;
    const indexStopNbToken = indexStartNbToken + UINT_256_LENGTH;

    const nbToken = ethers.BigNumber.from('0x' + calldataBuy.slice(indexStartNbToken, indexStopNbToken)).toNumber();
    const collectionAddrs: string[] = [];
    let offset = indexStopNbToken;
    for (let i = 0; i < nbToken; i++) {
      collectionAddrs.push(
        ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString()
      );

      // Move forward in the call data
      offset += UINT_256_LENGTH;
    }

    /**
     * After reading the contract addresses involved in the bundle sale
     * there are 2 chunks of params of length nbToken * UINT_256_LENGTH.
     *
     * Those chunks are each preceded by a "chunk metadata" of length UINT_256_LENGTH
     * Finally a last "chunk metadata" is set of length UINT_256_LENGTH. (3 META_CHUNKS)
     *
     *
     * After that we are reading the abi encoded data representing the transferFrom calls
     */
    const LEFT_CHUNKS = 2;
    const NB_META_CHUNKS = 3;
    offset += nbToken * UINT_256_LENGTH * LEFT_CHUNKS + NB_META_CHUNKS * UINT_256_LENGTH;

    const TRANSFER_FROM_DATA_LENGTH = METHOD_ID_LENGTH + UINT_256_LENGTH * 3;
    const tokenIdsList: string[] = [];
    for (let i = 0; i < nbToken; i++) {
      const transferFromData = calldataBuy.substring(offset, offset + TRANSFER_FROM_DATA_LENGTH);
      const tokenIdstr = ethers.BigNumber.from(
        '0x' + transferFromData.substring(METHOD_ID_LENGTH + UINT_256_LENGTH * 2)
      ).toString();
      tokenIdsList.push(tokenIdstr);

      // Move forward in the call data
      offset += TRANSFER_FROM_DATA_LENGTH;
    }

    return collectionAddrs.map((val, index) => ({
      collectionAddr: collectionAddrs[index],
      tokenIdStr: tokenIdsList[index],
      quantity: 1,
      tokenType: TokenStandard.ERC721
    }));
  }
}

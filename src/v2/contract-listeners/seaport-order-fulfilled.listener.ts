import { ChainId, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { ETHEREUM_WETH_ADDRESS, NULL_ADDRESS, trimLowerCase } from '@infinityxyz/lib/utils';
import { BigNumber, ethers, Event } from 'ethers';
import { PreParsedNftSale, SeaportReceivedAmount, SeaportSoldNft } from 'types';
import { ContractListener } from './contract-listener.abstract';

export type SeaportOrderFulfilledEvent = PreParsedNftSale[];

export class SeaportOrderFulfilledListener extends ContractListener<SeaportOrderFulfilledEvent> {
  protected async decodeLog(args: Event[]): Promise<SeaportOrderFulfilledEvent | null> {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return null;
    }
    const event: ethers.Event = args[args.length - 1];
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

    const txHash = event.transactionHash;

    const block = await this._blockProvider.getBlock(event.blockNumber);
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

    return saleOrders;
  }
}

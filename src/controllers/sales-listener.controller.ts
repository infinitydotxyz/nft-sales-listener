/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Block } from '@ethersproject/abstract-provider';
import { SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import { ETHEREUM_WETH_ADDRESS, sleep } from '@infinityxyz/lib/utils';
import { BigNumber, ethers } from 'ethers';
import DebouncedSalesUpdater from 'models/DebouncedSalesUpdater';
import SeaportABI from '../abi/seaport.json';
import WyvernExchangeABI from '../abi/wyvernExchange.json';
import {
  MERKLE_VALIDATOR_ADDRESS,
  NULL_ADDRESS,
  SEAPORT_ADDRESS,
  WYVERN_ATOMICIZER_ADDRESS,
  WYVERN_EXCHANGE_ADDRESS
} from '../constants';
import { logger } from '../container';
import Providers from '../models/Providers';
import { PreParsedNftSale } from '../types/index';
import { parseSaleOrders } from './sales-parser.controller';

const ETH_CHAIN_ID = '1';
const providers = new Providers();
const ethProvider = providers.getProviderByChainId(ETH_CHAIN_ID);

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

/**
 *
 * @param inputs inputs AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "bundle" sale made from OpenSea.
 *              A "bundle" sale is a sale that contains several assets embedded in the same, atomic, transaction.
 */
function handleBundleSale(inputs: DecodedAtomicMatchInputs): TokenInfo[] {
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

/**
 *
 * @param inputs The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "normal" sale made from OpenSea.
 *              A "normal" sale is a sale that is not a bundle (only contains one asset).
 */

function handleSingleSale(inputs: DecodedAtomicMatchInputs): TokenInfo {
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
 * The AtomicMatch call that triggered this call handler.
 * @description When a sale is made on OpenSea an AtomicMatch_ call is invoked.
 *              This handler will create the associated OpenSeaSale entity
 */
function handleAtomicMatch(
  inputs: DecodedAtomicMatchInputs,
  txHash: string,
  block: Block
): PreParsedNftSale[] | undefined {
  try {
    const addrs: string[] = inputs.addrs;
    const saleAddress: string = addrs[11];

    const uints: BigInt[] = inputs.uints;
    const price: BigInt = uints[4];
    const buyer = addrs[1]; // Buyer.maker
    const seller = addrs[8]; // Seller.maker
    const paymentTokenErc20Address = addrs[6];

    const res: PreParsedNftSale = {
      chainId: ETH_CHAIN_ID,
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
      const token = handleSingleSale(inputs);
      res.collectionAddress = token.collectionAddr;
      res.tokenId = token.tokenIdStr;
      res.tokenStandard = token.tokenType === TokenStandard.ERC721 ? TokenStandard.ERC721 : TokenStandard.ERC1155;
      res.quantity = token.quantity;
      return [res];
    } else {
      const tokens = handleBundleSale(inputs);
      const response: PreParsedNftSale[] = tokens.map((token: TokenInfo) => {
        res.collectionAddress = token.collectionAddr;
        res.tokenId = token.tokenIdStr;
        res.tokenStandard = TokenStandard.ERC721;
        res.quantity = token.quantity;
        return res;
      });
      return response;
    }
  } catch (err) {
    logger.error(`Failed to parse open sales transaction: ${txHash}`);
  }
}

const getTransactionByHash = async (txHash: string): Promise<ethers.utils.BytesLike> => {
  return (await ethProvider.getTransaction(txHash)).data;
};

async function handleSeaportEvent(salesUpdater: DebouncedSalesUpdater, args: ethers.Event[]): Promise<void> {
  if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
    return;
  }
  const event: ethers.Event = args[args.length - 1];
  const eventData = event.args;
  if (eventData?.length !== 6) {
    return;
  }
  // see commented reference below for payload structure
  const offerer = eventData[1];
  const fulfiller = eventData[3];
  const spentItems = eventData[4];
  const receivedItems = eventData[5];

  const soldNfts: any[] = [];
  const amounts: any[] = [];

  for (const spentItem of spentItems) {
    const itemType = spentItem[0];
    const token = spentItem[1];
    const identifier = BigNumber.from(spentItem[2]).toString();
    const amount = BigNumber.from(spentItem[3]).toString();

    // only ERC721 items are supported
    if (itemType === 2 || itemType === 4) {
      soldNfts.push({
        address: token,
        tokenId: identifier,
        seller: offerer,
        buyer: fulfiller
      });
    } else if (itemType === 0 || itemType === 1) {
      // only ETH and WETH
      if (String(token).toLowerCase() === NULL_ADDRESS || String(token).toLowerCase() === ETHEREUM_WETH_ADDRESS) {
        amounts.push({
          address: token,
          amount: amount,
          seller: fulfiller,
          buyer: offerer
        });
      }
    }
  }

  for (const receivedItem of receivedItems) {
    const itemType = receivedItem[0];
    const token = receivedItem[1];
    const identifier = BigNumber.from(receivedItem[2]).toString();
    const amount = BigNumber.from(receivedItem[3]).toString();

    // only ERC721 items are supported
    if (itemType === 2 || itemType === 4) {
      soldNfts.push({
        address: token,
        tokenId: identifier,
        seller: fulfiller,
        buyer: offerer
      });
    } else if (itemType === 0 || itemType === 1) {
      // only ETH and WETH
      if (String(token).toLowerCase() === NULL_ADDRESS || String(token).toLowerCase() === ETHEREUM_WETH_ADDRESS) {
        amounts.push({
          address: token,
          amount: amount,
          seller: offerer,
          buyer: fulfiller
        });
      }
    }
  }

  let totalAmount = BigNumber.from(0);
  for (const amount of amounts) {
    totalAmount = totalAmount.add(String(amount.amount));
  }

  const txHash = event.transactionHash;

  try {
    const block: Block = await event.getBlock();
    const res: PreParsedNftSale = {
      chainId: ETH_CHAIN_ID,
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
        collectionAddress: nft.address,
        tokenId: nft.identifier
      };
      saleOrders.push(saleOrder);
    }

    if (Array.isArray(saleOrders) && saleOrders?.length > 0) {
      logger.log(`Listener:[Seaport] fetched new order successfully: ${txHash}`);
      const { sales, totalPrice } = parseSaleOrders(saleOrders);
      logger.log(JSON.stringify(sales, null, 2));
      await salesUpdater.saveTransaction({ sales, totalPrice });
    }
  } catch (err) {
    logger.error(`Listener:[Seaport] failed to fetch new order: ${txHash}`);
  }
}

const execute = (): void => {
  const OpenseaContract = new ethers.Contract(WYVERN_EXCHANGE_ADDRESS, WyvernExchangeABI, ethProvider);
  const openseaIface = new ethers.utils.Interface(WyvernExchangeABI);

  const SeaportContract = new ethers.Contract(SEAPORT_ADDRESS, SeaportABI, ethProvider);

  const salesUpdater = new DebouncedSalesUpdater();

  SeaportContract.on('OrderFulfilled', async (...args: ethers.Event[]) => {
    await handleSeaportEvent(salesUpdater, args);
  });

  OpenseaContract.on('OrdersMatched', async (...args: ethers.Event[]) => {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return;
    }
    const event: ethers.Event = args[args.length - 1];
    const txHash: string = event?.transactionHash;
    if (!txHash) {
      return;
    }

    let response;
    let maxAttempts = 10;
    while (maxAttempts > 0) {
      try {
        response = await getTransactionByHash(txHash);
      } catch (err) {
        await sleep(2000);
        maxAttempts--;
        continue;
      }
      break;
    }
    try {
      const block: Block = await event.getBlock();
      const decodedResponse: DecodedAtomicMatchInputs = openseaIface.decodeFunctionData(
        'atomicMatch_',
        response as ethers.utils.BytesLike
      ) as any;
      const saleOrders = handleAtomicMatch(decodedResponse, txHash, block);
      if (Array.isArray(saleOrders) && saleOrders?.length > 0) {
        logger.log(`Listener:[Opensea] fetched new order successfully: ${txHash}`);
        const { sales, totalPrice } = parseSaleOrders(saleOrders);

        await salesUpdater.saveTransaction({ sales, totalPrice });
      }
    } catch (err) {
      logger.error(`Listener:[Opensea] failed to fetch new order: ${txHash}`);
    }
  });
};

export { execute };

// ======================================================== EVENTS FORMAT REFERENCE ========================================================

// ============================================================= SEAPORT ===================================================================

  /* 
    Event format: event.args array contains the following items:
    event OrderFulfilled(
      bytes32 orderHash,
      address indexed offerer,
      address indexed zone,
      address fulfiller,
      SpentItem[] offer,
      ReceivedItem[] consideration
    );

    struct SpentItem {
      ItemType itemType;
      address token;
      uint256 identifier;
      uint256 amount;
    }

    struct ReceivedItem {
      ItemType itemType;
      address token;
      uint256 identifier;
      uint256 amount;
      address payable recipient;
    }

    enum ItemType {
      // 0: ETH on mainnet, MATIC on polygon, etc.
      NATIVE,
      // 1: ERC20 items (ERC777 and ERC20 analogues could also technically work)
      ERC20,
      // 2: ERC721 items
      ERC721,
      // 3: ERC1155 items
      ERC1155,
      // 4: ERC721 items where a number of tokenIds are supported
      ERC721_WITH_CRITERIA,
      // 5: ERC1155 items where a number of ids are supported
      ERC1155_WITH_CRITERIA
    }

    Example output from console.log
    const eventData = event.args;
    if (eventData?.length !== 6) {
      return;
    }
    const offerer = eventData[1];
    const fulfiller = eventData[3];
    const spentItems = eventData[4];
    const receivedItems = eventData[5];
    logger.log(`Offerer: ${String(offerer)}`);
    logger.log(`Fulfiller: ${String(fulfiller)}`);
    logger.log(`Spent items: ${JSON.stringify(spentItems, null, 2)}`);
    logger.log(`Received items: ${JSON.stringify(receivedItems, null, 2)}`);

      Offerer: 0x040FC4f814321242c4E19114cFD7493BEbB3B121
      Fulfiller: 0xaC418208F535cf01aAC96A5A1877E1B5bacF861f
      Spent items: [
        [
          2,
          "0x64775Ea96CB4dD8Ef31E3d634af398c66543fbd7",
          {
            "type": "BigNumber",
            "hex": "0x0913"
          },
          {
            "type": "BigNumber",
            "hex": "0x01"
          }
        ]
      ]
      Received items: [
         [
          0,
          "0x0000000000000000000000000000000000000000",
          {
            "type": "BigNumber",
            "hex": "0x00"
          },
          {
            "type": "BigNumber",
            "hex": "0x01a2704935a54000"
          },
          "0x040FC4f814321242c4E19114cFD7493BEbB3B121"
        ],
        [
          0,
          "0x0000000000000000000000000000000000000000",
          {
            "type": "BigNumber",
            "hex": "0x00"
          },
          {
            "type": "BigNumber",
            "hex": "0x0b8bdb97852000"
          },
          "0x8De9C5A032463C561423387a9648c5C7BCC5BC90"
        ],
        [
          0,
          "0x0000000000000000000000000000000000000000",
          {
            "type": "BigNumber",
            "hex": "0x00"
          },
          {
            "type": "BigNumber",
            "hex": "0x1fde2adfa2a000"
          },
          "0x198702ca197C42e1A61Ff4d21A26BBf6b3B4Fa95"
        ]
      ]

    */

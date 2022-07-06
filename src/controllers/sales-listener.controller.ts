/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Block } from '@ethersproject/abstract-provider';
import { ChainNFTs, FirestoreOrder, OBOrderStatus, SaleSource, TokenStandard } from '@infinityxyz/lib/types/core';
import {
  ETHEREUM_INFINITY_EXCHANGE_ADDRESS,
  ETHEREUM_WETH_ADDRESS,
  firestoreConstants,
  sleep,
  trimLowerCase
} from '@infinityxyz/lib/utils';
import FirestoreBatchHandler from 'database/FirestoreBatchHandler';
import { BigNumber, ethers } from 'ethers';
import DebouncedSalesUpdater from 'models/DebouncedSalesUpdater';
import { Order } from 'models/order';
import { OrderItem } from 'models/order-item';
import InfinityABI from '../abi/infinityExchange.json';
import SeaportABI from '../abi/seaport.json';
import WyvernExchangeABI from '../abi/wyvernExchange.json';
import {
  MERKLE_VALIDATOR_ADDRESS,
  NULL_ADDRESS,
  SEAPORT_ADDRESS,
  WYVERN_ATOMICIZER_ADDRESS,
  WYVERN_EXCHANGE_ADDRESS
} from '../constants';
import { firebase, logger } from '../container';
import Providers from '../models/Providers';
import { PreParsedInfinityNftSale, PreParsedNftSale, SeaportReceivedAmount, SeaportSoldNft } from '../types/index';
import { parseInfinitySaleOrder, parseSaleOrders } from './sales-parser.controller';

const ETH_CHAIN_ID = '1';
// const GOERLI_CHAIN_ID = '5';
const providers = new Providers();
const ethProvider = providers.getProviderByChainId(ETH_CHAIN_ID);
// const goerliProvider = providers.getProviderByChainId(GOERLI_CHAIN_ID);

const SeaportContract = new ethers.Contract(SEAPORT_ADDRESS, SeaportABI, ethProvider);
const InfinityContract = new ethers.Contract(ETHEREUM_INFINITY_EXCHANGE_ADDRESS, InfinityABI, ethProvider);
// const InfinityContract = new ethers.Contract(GOERLI_INFINITY_EXCHANGE_ADDRESS, InfinityABI, goerliProvider);
const OpenseaContract = new ethers.Contract(WYVERN_EXCHANGE_ADDRESS, WyvernExchangeABI, ethProvider);
const openseaIface = new ethers.utils.Interface(WyvernExchangeABI);

const salesUpdater = new DebouncedSalesUpdater();

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

async function handleSeaportEvent(args: ethers.Event[]): Promise<void> {
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

  const soldNfts: SeaportSoldNft[] = [];
  const amounts: SeaportReceivedAmount[] = [];

  for (const spentItem of spentItems) {
    const itemType = spentItem[0];
    const token = spentItem[1];
    const identifier = BigNumber.from(spentItem[2]).toString();
    const amount = BigNumber.from(spentItem[3]).toString();

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
    const itemType = receivedItem[0];
    const token = receivedItem[1];
    const identifier = BigNumber.from(receivedItem[2]).toString();
    const amount = BigNumber.from(receivedItem[3]).toString();

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
        collectionAddress: nft.tokenAddress,
        tokenId: nft.tokenId
      };
      saleOrders.push(saleOrder);
    }

    if (Array.isArray(saleOrders) && saleOrders?.length > 0) {
      logger.log(`Listener:[Seaport] fetched new order successfully: ${txHash}`);
      const { sales, totalPrice } = parseSaleOrders(saleOrders);
      await salesUpdater.saveTransaction({ sales, totalPrice });
    }
  } catch (err) {
    logger.error(`Listener:[Seaport] failed to fetch new order: ${txHash}`);
  }
}

async function handleInfinityMatchEvent(args: ethers.Event[]): Promise<void> {
  if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
    return;
  }
  const event: ethers.Event = args[args.length - 1];
  const eventData = event.args;
  if (eventData?.length !== 8) {
    return;
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
    const tokens = orderItem[1];
    const tokenInfos = [];
    for (const token of tokens) {
      const tokenId = BigNumber.from(token[0]).toString();
      const numTokens = BigNumber.from(token[1]).toNumber();
      const tokenInfo = {
        tokenId,
        numTokens
      };
      tokenInfos.push(tokenInfo);
      quantity += numTokens;
    }

    const address = trimLowerCase(String(orderItem[0]));
    const chainNFT: ChainNFTs = {
      collection: address,
      tokens: tokenInfos
    };
    orderItems.push(chainNFT);
  }

  const txHash = event.transactionHash;

  try {
    const block: Block = await event.getBlock();
    const res: PreParsedInfinityNftSale = {
      chainId: ETH_CHAIN_ID,
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
      orderItems
    };

    logger.log(`Listener:[Infinity: MatchOrderFulfilled] fetched orders successfully for txn: ${txHash}`);

    // update order statuses
    await updateInfinityOrderStatus(res, sellOrderHash);
    await updateInfinityOrderStatus(res, buyOrderHash);

    // update sales stats, write to feed, write to sales collection
    const { sales, totalPrice } = parseInfinitySaleOrder(res);
    await salesUpdater.saveTransaction({ sales, totalPrice });
  } catch (err) {
    logger.error(`Listener:[Infinity: MatchOrderFulfilled] failed to update orders for txn: ${txHash}`, err);
  }
}

async function handleInfinityTakeEvent(args: ethers.Event[]): Promise<void> {
  if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
    return;
  }
  const event: ethers.Event = args[args.length - 1];
  const eventData = event.args;
  if (eventData?.length !== 7) {
    return;
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
    const tokens = orderItem[1];
    const tokenInfos = [];
    for (const token of tokens) {
      const tokenId = BigNumber.from(token[0]).toString();
      const numTokens = BigNumber.from(token[1]).toNumber();
      const tokenInfo = {
        tokenId,
        numTokens
      };
      tokenInfos.push(tokenInfo);
      quantity += numTokens;
    }

    const address = trimLowerCase(String(orderItem[0]));
    const chainNFT: ChainNFTs = {
      collection: address,
      tokens: tokenInfos
    };
    orderItems.push(chainNFT);
  }

  const txHash = event.transactionHash;

  try {
    const block: Block = await event.getBlock();
    const res: PreParsedInfinityNftSale = {
      chainId: ETH_CHAIN_ID,
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
      orderItems
    };

    logger.log(`Listener:[Infinity: TakeOrderFulfilled] fetched orders successfully for txn: ${txHash}`);

    // update order status
    await updateInfinityOrderStatus(res, orderHash);

    // update sales stats, write to feed, write to sales collection
    const { sales, totalPrice } = parseInfinitySaleOrder(res);
    await salesUpdater.saveTransaction({ sales, totalPrice });
  } catch (err) {
    logger.error(`Listener:[Infinity: TakeOrderFulfilled] failed to update orders for txn: ${txHash}`, err);
  }
}

async function handleCancelAllOrders(args: ethers.Event[]): Promise<void> {
  if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
    return;
  }
  const event: ethers.Event = args[args.length - 1];
  const eventData = event.args;
  if (eventData?.length !== 2) {
    return;
  }

  // see commented reference below for payload structure
  const user = trimLowerCase(String(eventData[0]));
  const minOrderNonce = parseInt(String(eventData[1]));

  try {
    logger.log(
      `Listener:[Infinity: CancelAllOrders] cancelling all orders with txn: ${event.transactionHash} for user ${user} with minOrderNonce ${minOrderNonce}`
    );
    // update min order nonce in user doc
    const userDocRef = firebase.db.collection(firestoreConstants.USERS_COLL).doc(user);
    await userDocRef.set({ minOrderNonce }, { merge: true });

    // update order statuses
    await updateInfinityOrderStatusesForCancelAll(user, minOrderNonce);
  } catch (err) {
    logger.error(
      `Listener:[Infinity: CancelAllOrders] failed to update orders for txn: ${event.transactionHash}`,
      err
    );
  }
}

async function handleCancelMultipleOrders(args: ethers.Event[]): Promise<void> {
  if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
    return;
  }
  const event: ethers.Event = args[args.length - 1];
  const eventData = event.args;
  if (eventData?.length !== 2) {
    return;
  }

  // see commented reference below for payload structure
  const user = trimLowerCase(String(eventData[0]));
  const nonces = eventData[1];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const parsedNonces = nonces.map((nonce: string) => parseInt(nonce));

  try {
    logger.log(
      `Listener:[Infinity: CancelMultipleOrders] cancelling multiple orders with txn: ${event.transactionHash} for user ${user} with nonces ${parsedNonces}`
    );
    // update order statuses
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await updateInfinityOrderStatusesForMultipleCancel(user, parsedNonces);
  } catch (err) {
    logger.error(
      `Listener:[Infinity: CancelMultipleOrders] failed to update orders for txn: ${event.transactionHash}`,
      err
    );
  }
}

async function updateInfinityOrderStatusesForCancelAll(user: string, minOrderNonce: number): Promise<void> {
  try {
    const orders = await firebase.db
      .collection(firestoreConstants.ORDERS_COLL)
      .where('makerAddress', '==', user)
      .where('nonce', '<', minOrderNonce)
      .get();

    logger.log(`Found: ${orders.size} orders to update for cancel all`);
    const batchHandler = new FirestoreBatchHandler();
    for (const order of orders.docs) {
      // update counters
      try {
        Order.updateCounters(order.data() as FirestoreOrder);
      } catch (err) {
        logger.error('Error updating order counters on cancel all orders', err);
      }

      // update order
      const orderRef = order.ref;
      batchHandler.add(orderRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });

      // update orderItems sub collection
      const orderItems = await orderRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL).get();
      logger.log(`Found: ${orderItems.size} order items to update for cancel all for this order`);
      for (const orderItem of orderItems.docs) {
        const orderItemRef = orderItem.ref;
        batchHandler.add(orderItemRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });
      }
    }
    // final flush
    await batchHandler.flush();
  } catch (err) {
    logger.error(`Listener:[Infinity: CancelAllOrders] failed to update order statuses for cancel all: ${err}`);
  }
}

async function updateInfinityOrderStatusesForMultipleCancel(user: string, parsedNonces: number[]): Promise<void> {
  try {
    const batchHandler = new FirestoreBatchHandler();
    for (const nonce of parsedNonces) {
      const orders = await firebase.db
        .collection(firestoreConstants.ORDERS_COLL)
        .where('makerAddress', '==', user)
        .where('nonce', '==', nonce)
        .get();

      for (const order of orders.docs) {
        // update counters
        try {
          Order.updateCounters(order.data() as FirestoreOrder);
        } catch (err) {
          logger.error('Error updating order counters on cancel multiple orders', err);
        }

        // update order
        const orderRef = order.ref;
        batchHandler.add(orderRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });

        // update orderItems sub collection
        const orderItems = await orderRef.collection(firestoreConstants.ORDER_ITEMS_SUB_COLL).get();
        logger.log(`Found: ${orderItems.size} order items to update for cancel multiple for this order`);
        for (const orderItem of orderItems.docs) {
          const orderItemRef = orderItem.ref;
          batchHandler.add(orderItemRef, { orderStatus: OBOrderStatus.Invalid }, { merge: true });
        }
      }
    }

    // final flush
    await batchHandler.flush();
  } catch (err) {
    logger.error(`Listener:[Infinity: CancelMultipleOrders] failed to update order statuses: ${err}`);
  }
}

async function updateInfinityOrderStatus(infinitySale: PreParsedInfinityNftSale, orderHash: string): Promise<void> {
  const orderItemQueries = Object.values(OrderItem.getImpactedOrderItemsQueries(infinitySale, orderHash));
  const orderItemRefs = await Promise.all(orderItemQueries.map((query) => query.get()));

  const orderPromises = orderItemRefs
    .flatMap((item) => item.docs)
    .map((item) => {
      const order = item.ref.parent.parent;
      return new Promise<Order>((resolve, reject) => {
        order
          ?.get()
          .then((snap) => {
            const orderData = snap.data() as FirestoreOrder;
            if (orderData) {
              resolve(new Order(orderData));
            } else {
              reject(new Error('Order not found'));
            }
          })
          .catch((err) => {
            logger.error(`Listener:[Infinity] failed to get order: ${order?.id}`, err);
            reject(err);
          });
      });
    });

  const orders = await Promise.all(orderPromises);

  logger.log(`Found: ${orders.length} orders to update`);

  for (const order of orders) {
    await order.handleSale(infinitySale);
  }
}

const execute = (): void => {
  InfinityContract.on('MatchOrderFulfilled', async (...args: ethers.Event[]) => {
    await handleInfinityMatchEvent(args);
  });

  InfinityContract.on('TakeOrderFulfilled', async (...args: ethers.Event[]) => {
    await handleInfinityTakeEvent(args);
  });

  InfinityContract.on('CancelAllOrders', async (...args: ethers.Event[]) => {
    await handleCancelAllOrders(args);
  });

  InfinityContract.on('CancelMultipleOrders', async (...args: ethers.Event[]) => {
    await handleCancelMultipleOrders(args);
  });

  SeaportContract.on('OrderFulfilled', async (...args: ethers.Event[]) => {
    await handleSeaportEvent(args);
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

// ======================================================== INFINITY ========================================================

/*

  event MatchOrderFulfilled(
    bytes32 sellOrderHash,
    bytes32 buyOrderHash,
    address indexed seller,
    address indexed buyer,
    address complication, // address of the complication that defines the execution
    address indexed currency, // token address of the transacting currency
    uint256 amount, // amount spent on the order
    OrderTypes.OrderItem[] nfts // items in order
  );

  event TakeOrderFulfilled(
    bytes32 orderHash,
    address indexed seller,
    address indexed buyer,
    address complication, // address of the complication that defines the execution
    address indexed currency, // token address of the transacting currency
    uint256 amount, // amount spent on the order
    OrderTypes.OrderItem[] nfts // items in order
  );

  struct TokenInfo {
    uint256 tokenId;
    uint256 numTokens;
  }

  struct OrderItem {
    address collection;
    TokenInfo[] tokens;
  }

  event CancelAllOrders(address indexed user, uint256 newMinNonce);
  event CancelMultipleOrders(address indexed user, uint256[] orderNonces);

*/

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

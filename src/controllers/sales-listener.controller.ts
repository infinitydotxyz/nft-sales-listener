import { ethers } from 'ethers';
import { Block } from '@ethersproject/abstract-provider';
import {
  WYVERN_EXCHANGE_ADDRESS,
  MERKLE_VALIDATOR_ADDRESS,
  WYVERN_ATOMICIZER_ADDRESS,
  NULL_ADDRESS
} from '../constants';
import WyvernExchangeABI from '../abi/wyvernExchange.json';
import Providers from '../models/Providers';
import { SALE_SOURCE, TOKEN_TYPE, NftSale } from '../types/index';
import { parseSaleOrders } from './sales-parser.controller';
import { logger, firebase } from '../container';
import ERC721ABI from '../abi/erc721Abi.json';
import ERC1155ABI from '../abi/erc1155Abi.json';
import { sleep } from '@infinityxyz/lib/utils';

const ETH_CHAIN_ID = '1';
const providers = new Providers();
const ethProvider = providers.getProviderByChainId(ETH_CHAIN_ID);

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
 *              A "bundle" sale is a sale that contains several assets embeded in the same, atomic, transaction.
 */
function handleBundleSale(inputs: any): TokenInfo[] {
  const calldataBuy: string = inputs.calldataBuy;
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
   * Finalluy a last "chunk metadata" is set of length UINT_256_LENGTH. (3 META_CHUNKS)
   *
   *
   * After that we are reading the abiencoded data representing the transferFrom calls
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
    tokenType: TOKEN_TYPE.ERC721
  }));
}

/**
 *
 * @param inputs The AtomicMatch call that triggered the handleAtomicMatch_ call handler.
 * @description This function is used to handle the case of a "normal" sale made from OpenSea.
 *              A "normal" sale is a sale that is not a bundle (only contains one asset).
 */

function handleSingleSale(inputs: any): TokenInfo {
  const TRAILING_OX = 2;
  const METHOD_ID_LENGTH = 8;
  const UINT_256_LENGTH = 64;

  const addrs = inputs.addrs;
  const nftAddrs: string = addrs[4];

  let collectionAddr;
  let tokenIdStr;
  let quantity = 1;
  let tokenType = TOKEN_TYPE.ERC721;
  const calldataBuy: string = inputs.calldataBuy;

  let offset = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 2;
  if (nftAddrs.toLowerCase() === MERKLE_VALIDATOR_ADDRESS) {
    collectionAddr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString();
    offset += UINT_256_LENGTH;
    tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
    offset += UINT_256_LENGTH;
    if (calldataBuy.length > 458) {
      quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
      tokenType = TOKEN_TYPE.ERC1155;
    }
  } else {
    // Token minted on Opensea
    collectionAddr = nftAddrs.toLowerCase();
    tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
    offset += UINT_256_LENGTH;
    if (calldataBuy.length > 202) {
      quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
      tokenType = TOKEN_TYPE.ERC1155;
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
 * @param call The AtomicMatch call that triggered this call handler.
 * @description When a sale is made on OpenSea an AtomicMatch_ call is invoked.
 *              This handler will create the associated OpenSeaSale entity
 */
function handleAtomicMatch_(inputs: any, txHash: string, block: Block): NftSale[] | undefined {
  try {
    const addrs = inputs.addrs;
    const saleAddress: string = addrs[11];

    const uints: BigInt[] = inputs.uints;
    const price: BigInt = uints[4];
    const buyer = addrs[1]; // Buyer.maker
    const seller = addrs[8]; // Seller.maker
    const paymentTokenErc20Address = addrs[6];

    const res: NftSale = {
      chainId: ETH_CHAIN_ID,
      txHash,
      blockNumber: block.number,
      blockTimestamp: block.timestamp * 1000,
      price,
      paymentToken: paymentTokenErc20Address,
      buyer,
      seller,
      collectionAddress: '',
      tokenId: '',
      quantity: 0,
      source: SALE_SOURCE.OPENSEA,
      tokenType: TOKEN_TYPE.ERC721
    };

    if (saleAddress.toLowerCase() !== WYVERN_ATOMICIZER_ADDRESS) {
      const token = handleSingleSale(inputs);
      res.collectionAddress = token.collectionAddr;
      res.tokenId = token.tokenIdStr;
      res.tokenType = token.tokenType === TOKEN_TYPE.ERC721 ? TOKEN_TYPE.ERC721 : TOKEN_TYPE.ERC1155;
      res.quantity = token.quantity;
      return [res];
    } else {
      const tokens = handleBundleSale(inputs);
      const response: NftSale[] = tokens.map((token: TokenInfo) => {
        res.collectionAddress = token.collectionAddr;
        res.tokenId = token.tokenIdStr;
        res.tokenType = TOKEN_TYPE.ERC721;
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

// todo: check firestore collections
const pruneERC721 = async (id: string, address: string) => {
  console.log('Pruning ERC721', id, address);
  const query = await firebase.db
    .collectionGroup('listings')
    .where('metadata.asset.id', '==', id)
    .where('metadata.asset.address', '==', address)
    .limit(100)
    .get();

  const contract = new ethers.Contract(address, ERC721ABI, ethProvider);
  try {
    for (let i = 0; i < query.docs.length; i++) {
      const doc = query.docs[i];
      const ref = doc.ref;
      const data = doc.data();
      const maker = data.maker;

      let owner = await contract.ownerOf(id);
      owner = owner.trim().toLowerCase();

      if (owner !== NULL_ADDRESS && owner !== maker) {
        console.log('stale', maker, owner, address, id);
        ref
          .delete()
          .then((res) => {
            console.log('pruned', doc.id, maker, owner, address, id);
          })
          .catch((err) => {
            console.error('Error deleting', doc.id, maker, err);
          });
      }
    }
  } catch (err) {
    console.error('Error pruning listing', err);
  }
};

// todo: check firestore collections
const pruneERC1155 = async (id: string, address: string, seller: string) => {
  console.log('Pruning ERC1155', id, address);
  const query = await firebase.db
    .collectionGroup('listings')
    .where('metadata.asset.id', '==', id)
    .where('metadata.asset.address', '==', address)
    .limit(100)
    .get();

  const contract = new ethers.Contract(address, ERC1155ABI, ethProvider);
  try {
    for (let i = 0; i < query.docs.length; i++) {
      const doc = query.docs[i];
      const ref = doc.ref;
      const data = doc.data();
      const maker = data.maker;

      const balance = await contract.balanceOf(seller, id);

      if (seller !== NULL_ADDRESS && seller === maker && balance === 0) {
        console.log('stale', maker, seller, address, id);
        ref
          .delete()
          .then((res) => {
            console.log('pruned', doc.id, maker, seller, address, id);
          })
          .catch((err) => {
            console.error('Error deleting', doc.id, maker, err);
          });
      }
    }
  } catch (err) {
    console.error('Error pruning listing', err);
  }
};

const execute = (): void => {
  /*
    --- Listen Opensea Sales event
  */
  const OpenseaContract = new ethers.Contract(WYVERN_EXCHANGE_ADDRESS, WyvernExchangeABI, ethProvider);
  const openseaIface = new ethers.utils.Interface(WyvernExchangeABI);

  OpenseaContract.on('OrdersMatched', async (...args) => {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const block: Block = await event.getBlock();
      const decodedResponse = openseaIface.decodeFunctionData('atomicMatch_', response as ethers.utils.BytesLike);
      const saleOrders = handleAtomicMatch_(decodedResponse, txHash, block);
      if (saleOrders) {
        logger.log(`Listener:[Opensea] fetched new order successfully: ${txHash}`);
        await parseSaleOrders(saleOrders);
      }
    } catch (err) {
      logger.error(`Listener:[Opensea] failed to fetch new order: ${txHash}`);
      logger.error(err);
    }
  });
};

export { execute };

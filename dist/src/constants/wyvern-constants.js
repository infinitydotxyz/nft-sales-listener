"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MERKLE_VALIDATOR_ADDRESS = exports.WYVERN_ATOMICIZER_ADDRESS = exports.WYVERN_EXCHANGE_ADDRESS = void 0;
/**
 * Main OpenSea smart contract address.
 *
 * This contract mostly provides the atomicMatch_ method used when a
 * sale is being made on OpenSea marketplace.
 */
exports.WYVERN_EXCHANGE_ADDRESS = '0x7f268357a8c2552623316e2562d90e642bb538e5';
/**
 * Librabry used by OpenSea for bundle sales.
 *
 * This lib, afaik, takes as parameters the different abi encoded
 * calls of "transferFrom" methods of all the NFT contracts involved
 * in the sale.
 */
exports.WYVERN_ATOMICIZER_ADDRESS = '0xc99f70bfd82fb7c8f8191fdfbfb735606b15e5c5';
/**
 * Librabry used by OpenSea for merkle validator.
 */
exports.MERKLE_VALIDATOR_ADDRESS = '0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7';
//# sourceMappingURL=wyvern-constants.js.map
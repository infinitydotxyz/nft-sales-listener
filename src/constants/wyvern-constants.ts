/**
 * Main OpenSea smart contract address.
 *
 * This contract mostly provides the atomicMatch_ method used when a
 * sale is being made on OpenSea marketplace.
 */
export const WYVERN_EXCHANGE_ADDRESS = '0x7f268357a8c2552623316e2562d90e642bb538e5';

export const SEAPORT_ADDRESS = '0x00000000006c3852cbef3e08e8df289169ede581';

/**
 * Librabry used by OpenSea for bundle sales.
 *
 * This lib, afaik, takes as parameters the different abi encoded
 * calls of "transferFrom" methods of all the NFT contracts involved
 * in the sale.
 */
export const WYVERN_ATOMICIZER_ADDRESS = '0xc99f70bfd82fb7c8f8191fdfbfb735606b15e5c5';

/**
 * Library used by OpenSea for merkle validator.
 */
export const MERKLE_VALIDATOR_ADDRESS = '0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7';

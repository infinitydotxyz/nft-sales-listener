import { Response } from 'got';
import { TokenStandard, TokenMetadata } from '@infinityxyz/types/core';
interface Web3Response<T> {
    total: number;
    page: number;
    page_size: number;
    result: T[];
    cursor: string;
}
interface Token {
    token_address: string;
    token_id: string;
    contract_type: TokenStandard;
    token_uri: string;
    metadata: string;
    synced_at: string;
    amount: string;
    name: string;
    symbol: string;
}
export default class Moralis {
    private readonly client;
    private readonly queue;
    constructor();
    /**
     * getTokens returns a single page of tokens (up to 500)
     */
    getTokens(address: string, chainId: string, cursor: string): Promise<Response<Web3Response<Token>>>;
    /**
     * getAllTokens gets all tokens for a contract
     */
    getAllTokens(address: string, chainId: string): Promise<Token[]>;
    /**
     * getTokenMetadata gets the token metadata for a specific tokenId
     */
    getTokenMetadata(address: string, chainId: string, tokenId: string): Promise<TokenMetadata>;
    /**
     * getChain returns the moralis chain parameter given the base 10 chain id
     */
    private getChain;
    private errorHandler;
    private paginate;
    private paginateHelper;
}
export {};

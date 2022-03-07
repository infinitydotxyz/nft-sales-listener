import { JsonRpcProvider } from '@ethersproject/providers';
export default class Providers {
    private readonly providers;
    constructor();
    getProviderByChainId(chainId: string): JsonRpcProvider;
}

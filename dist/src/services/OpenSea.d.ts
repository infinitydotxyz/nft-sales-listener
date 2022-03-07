import { CollectionMetadata, TokenStandard } from '@infinityxyz/types/core';
/**
 * we try not to use OpenSea more than we have to
 * prefer other methods of getting data if possible
 */
export default class OpenSeaClient {
    private readonly client;
    constructor();
    /**
     * getCollectionMetadata gets basic info about a collection: name, description, links, images
     *
     * it seems like rate limits are not an issue on this endpoint - at this time
     * (it handles ~500 requests at once using the default api key and none get rate limited)
     *
     * etherscan has a similar endpoint that seems decent if this begins to fail
     */
    getCollectionMetadata(address: string): Promise<CollectionMetadata>;
    /**
     * getCollectionStats using the opensea slug (not the same as the infinity slug)
     */
    getCollectionStats(slug: string): Promise<CollectionStatsResponse>;
    getCollections(offset?: number, limit?: number): Promise<Collection[]>;
    getCollection(slug: string): Promise<Collection>;
    getCollectionStatsByTokenInfo(collectionAddr: string, tokenId: string, chainId: string): Promise<CollectionStats>;
    private errorHandler;
}
export interface Collection {
    banner_image_url: string;
    chat_url?: string;
    created_date: string;
    default_to_fiat: boolean;
    description: string;
    dev_buyer_fee_basis_points: string;
    dev_seller_fee_basis_points: string;
    discord_url: string;
    display_data: DisplayData;
    external_url: string;
    featured: boolean;
    featured_image_url: string;
    hidden: boolean;
    safelist_request_status: string;
    image_url: string;
    is_subject_to_whitelist: boolean;
    large_image_url: string;
    medium_username?: string;
    name: string;
    only_proxied_transfers: boolean;
    opensea_buyer_fee_basis_points: string;
    opensea_seller_fee_basis_points: string;
    payout_address?: string;
    require_email: boolean;
    short_description?: string;
    slug: string;
    telegram_url?: string;
    twitter_username: string;
    instagram_username?: string;
    wiki_url: string;
    primary_asset_contracts?: Array<{
        address: string;
        asset_contract_type: string;
        created_date: string;
        name: string;
        nft_version: string;
        opensea_version: any;
        owner: number;
        schema_name: TokenStandard | string;
        symbol: string;
        total_supply: string;
        description: string;
        external_link: string;
        image_url: string;
        default_to_fiat: boolean;
        dev_buyer_fee_basis_points: number;
        dev_seller_fee_basis_points: number;
        only_proxied_transfers: boolean;
        opensea_buyer_fee_basis_points: number;
        opensea_seller_fee_basis_points: number;
        buyer_fee_basis_points: number;
        seller_fee_basis_points: number;
        payout_address: string;
    }>;
}
interface DisplayData {
    card_display_style: string;
}
interface CollectionStatsResponse {
    stats: CollectionStats;
}
export interface CollectionStats {
    one_day_volume: number;
    one_day_change: number;
    one_day_sales: number;
    one_day_average_price: number;
    seven_day_volume: number;
    seven_day_change: number;
    seven_day_sales: number;
    seven_day_average_price: number;
    thirty_day_volume: number;
    thirty_day_change: number;
    thirty_day_sales: number;
    thirty_day_average_price: number;
    total_volume: number;
    total_sales: number;
    total_supply: number;
    count: number;
    num_owners: number;
    average_price: number;
    num_reports: number;
    market_cap: number;
    floor_price: number;
}
export {};

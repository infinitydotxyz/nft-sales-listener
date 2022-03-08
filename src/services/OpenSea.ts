import { ethers } from 'ethers';
import { sleep } from '../utils';
import { OPENSEA_API_KEY } from '../constants';
import { CollectionMetadata, TokenStandard } from '@infinityxyz/lib/types/core';
import got, { Got, Response } from 'got/dist/source';
import { gotErrorHandler } from '../utils/got';

/**
 * formatName takes a name from opensea and adds spaces before capital letters
 * (e.g. BoredApeYachtClub => Bored Ape Yacht Club)
 */
function formatName(name: string): string {
  let formattedName = '';

  for (const char of name) {
    const isUpperCase = /^[A-Z]$/.test(char);
    const prevCharIsSpace = formattedName[formattedName.length - 1] === ' ';
    const isFirstChar = formattedName.length === 0;

    if (isUpperCase && !prevCharIsSpace && !isFirstChar) {
      formattedName = `${formattedName} ${char}`;
    } else {
      formattedName = `${formattedName}${char}`;
    }
  }
  return formattedName;
}

/**
 * we try not to use OpenSea more than we have to
 * prefer other methods of getting data if possible
 */
export default class OpenSea {
  private readonly client: Got;
  constructor() {
    this.client = got.extend({
      prefixUrl: 'https://api.opensea.io/api/v1/',
      headers: {
        'x-api-key': OPENSEA_API_KEY
      },
      /**
       * requires us to check status code
       */
      throwHttpErrors: false,
      cache: false,
      timeout: 20_000
    });
  }

  /**
   * getCollectionMetadata gets basic info about a collection: name, description, links, images
   *
   * it seems like rate limits are not an issue on this endpoint - at this time
   * (it handles ~500 requests at once using the default api key and none get rate limited)
   *
   * etherscan has a similar endpoint that seems decent if this begins to fail
   */
  async getCollectionMetadata(address: string): Promise<CollectionMetadata> {
    if (!ethers.utils.isAddress(address)) {
      throw new Error('Invalid address');
    }

    const response = await this.errorHandler(() => {
      return this.client.get(`asset_contract/${address}`, {
        responseType: 'json'
      });
    });
    const data = response.body as OpenSeaContractResponse;
    const collection = data.collection;

    /**
     * not sure why opensea formats names like (BoredApeYachtClub)
     */
    const name = formatName(data.name ?? '');

    const dataInInfinityFormat: CollectionMetadata = {
      name,
      description: data.description ?? '',
      symbol: data.symbol ?? '',
      profileImage: collection.image_url ?? '',
      bannerImage: collection.banner_image_url ?? '',
      displayType: collection.display_data?.card_display_style,
      links: {
        timestamp: new Date().getTime(),
        discord: collection.discord_url ?? '',
        external: collection.external_url ?? '',
        medium:
          typeof collection?.medium_username === 'string' ? `https://medium.com/${collection.medium_username}` : '',
        slug: collection?.slug ?? '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        telegram: collection?.telegram_url ?? '',
        twitter:
          typeof collection?.twitter_username === 'string' ? `https://twitter.com/${collection.twitter_username}` : '',
        instagram:
          typeof collection?.instagram_username === 'string'
            ? `https://instagram.com/${collection.instagram_username}`
            : '',
        wiki: collection?.wiki_url ?? ''
      }
    };
    return dataInInfinityFormat;
  }

  /**
   * getCollectionStats using the opensea slug (not the same as the infinity slug)
   */
  async getCollectionStats(slug: string): Promise<CollectionStatsResponse> {
    const res: Response<CollectionStatsResponse> = await this.errorHandler(() => {
      return this.client.get(`collection/${slug}/stats`, {
        responseType: 'json'
      });
    });

    const stats = res.body;

    return stats;
  }

  async getCollections(offset = 0, limit = 300): Promise<Collection[]> {
    const res: Response<CollectionsResponse> = await this.errorHandler(() => {
      return this.client.get(`collections`, {
        searchParams: {
          offset,
          limit
        },
        responseType: 'json'
      });
    });

    const collections = res?.body?.collections ?? [];

    return collections;
  }

  async getCollection(slug: string): Promise<Collection> {
    const res: Response<{ collection: Collection }> = await this.errorHandler(() => {
      return this.client.get(`collection/${slug}`, {
        responseType: 'json'
      });
    });

    const collection = res?.body?.collection ?? {};

    return collection;
  }

  async getCollectionStatsByTokenInfo(
    collectionAddr: string,
    tokenId: string,
    chainId: string
  ): Promise<CollectionStats> {
    const res: Response<{ collection: { stats: CollectionStats } }> = await this.errorHandler(() => {
      return this.client.get(`asset/${collectionAddr}/${tokenId}`, {
        responseType: 'json'
      });
    });

    const collectionStats = res?.body?.collection.stats ?? {};

    return collectionStats;
  }

  private async errorHandler<T>(request: () => Promise<Response<T>>, maxAttempts = 3): Promise<Response<T>> {
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;

      try {
        const res: Response<T> = await request();

        switch (res.statusCode) {
          case 200:
            return res;

          case 404:
            throw new Error('Not found');

          case 429:
            await sleep(5000);
            throw new Error('Rate limited');

          case 500:
            throw new Error('Internal server error');

          case 504:
            await sleep(5000);
            throw new Error('OpenSea down');

          default:
            await sleep(2000);
            throw new Error(`Unknown status code: ${res.statusCode}`);
        }
      } catch (err) {
        const handlerRes = gotErrorHandler(err);
        if ('retry' in handlerRes) {
          await sleep(handlerRes.delay);
        } else if (!handlerRes.fatal) {
          // unknown error
          if (attempt >= maxAttempts) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }
}

interface OpenSeaContractResponse {
  collection: Collection;
  address: string;
  asset_contract_type: string;
  created_date: string;
  name: string;
  nft_version: string;
  opensea_version?: unknown;
  owner: number;
  schema_name: string;
  symbol: string;
  total_supply?: unknown;
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
  payout_address?: unknown;
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
    total_supply: string; // not accurate
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

interface CollectionsResponse {
  collections: Collection[];
}

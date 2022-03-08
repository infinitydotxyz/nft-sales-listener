export * from './wyvern-constants';

export const DBN_COLLECTION_STATS = 'collection-stats';
export const DBN_ALL_TIME = 'all-time';
export const DBN_NFT_STATS = 'nft-stats';
export const DBN_HISTORY = 'history';
export const DBN_SALES = 'sales';

function getEnvironmentVariable(name: string, required = true): string {
  const variable = process.env[name] ?? '';
  if (required && !variable) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return variable;
}

export const OPENSEA_API_KEY = getEnvironmentVariable('OPENSEA_API_KEY');
export const MORALIS_API_KEY = getEnvironmentVariable('MORALIS_API_KEY');

export const FB_STORAGE_BUCKET = 'nftc-dev.appspot.com';
export const FIREBASE_SERVICE_ACCOUNT = 'firebase-dev.json';

export const JSON_RPC_MAINNET_KEYS = (() => {
  const apiKeys = [];
  let i = 0;
  while (true) {
    try {
      const apiKey = getEnvironmentVariable(`JSON_RPC_MAINNET${i}`);
      apiKeys.push(apiKey);
      i += 1;
    } catch (err) {
      break;
    }
  }

  return apiKeys;
})();

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 *
 * Logger Config
 *
 */
export const INFO_LOG = process.env.INFO_LOG !== 'false'; // explicity set to false to disable logs
export const ERROR_LOG = process.env.ERROR_LOG !== 'false'; // explicitly set to false to disable logs

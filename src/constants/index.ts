export * from './wyvern-constants';

export const MORALIS_API_KEY = getEnvironmentVariable('MORALIS_API_KEY');
export const MAX_UNCLE_ABLE_BLOCKS = 6;

export const FB_STORAGE_BUCKET = 'nftc-dev.appspot.com';
// export const FIREBASE_SERVICE_ACCOUNT = 'firebase-dev.json';
export const FIREBASE_SERVICE_ACCOUNT = 'nftc-test.json';
export const COLLECTION_INDEXING_SERVICE_URL =
  'https://nft-collection-service-dot-nftc-dev.ue.r.appspot.com/collection';
/**
 * -----------------------------
 */

export const JSON_RPC_MAINNET_KEYS = (() => {
  const apiKeys = getMultipleEnvVariables('JSON_RPC_MAINNET');
  return apiKeys;
})();

export const JSON_RPC_GOERLI_KEYS = (() => {
  const apiKeys = getMultipleEnvVariables('JSON_RPC_GOERLI');
  return apiKeys;
})();

export const OPENSEA_API_KEYS = (() => {
  const apiKeys = getMultipleEnvVariables('OPENSEA_API_KEY');
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

function getMultipleEnvVariables(prefix: string, minLength = 1): string[] {
  const variables = [];
  let i = 0;

  for (;;) {
    try {
      const apiKey = getEnvironmentVariable(`${prefix}${i}`);
      variables.push(apiKey);
      i += 1;
    } catch (err) {
      break;
    }
  }

  if (variables.length < minLength) {
    throw new Error(
      `Env Variable: ${prefix} failed to get min number of keys. Found: ${variables.length} Expected: at least ${minLength}`
    );
  }

  return variables;
}

function getEnvironmentVariable(name: string, required = true): string {
  const variable = process.env[name] ?? '';
  if (required && !variable) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return variable;
}

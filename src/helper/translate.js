import { translate } from '@vitalets/google-translate-api';
import { ProxyAgent } from 'undici';

const PROXY_LIST = [
  'http://vzhggkrs:3gq7l28848l3@31.59.20.176:6754',
  'http://vzhggkrs:3gq7l28848l3@45.38.107.97:6014',
  'http://vzhggkrs:3gq7l28848l3@198.105.121.200:6462',
];

const getRandomProxy = () => {
  if (!PROXY_LIST.length) return null;
  return PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
};

export const onTranslate = async (text, targetLang) => {
  try {
    const proxyUrl = getRandomProxy();
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

    const result = await translate(text, {
      to: targetLang,
      fetchOptions: dispatcher ? { dispatcher } : undefined,
    });

    return {
      translation: result.text,
      detectedSourceLanguage: result.raw?.src?.toLowerCase(),
    };
  } catch (error) {
    console.error('Error during translation:', error);
    return {
      translation: null,
      detectedSourceLanguage: null,
      error: error.message,
    };
  }
};
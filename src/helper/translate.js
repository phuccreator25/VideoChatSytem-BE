import { translate } from '@vitalets/google-translate-api';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Danh sách proxy của bạn (điền danh sách lấy từ Webshare hoặc nguồn khác vào đây)
// Định dạng: 'http://ip:port' hoặc 'http://username:password@ip:port'
const PROXY_LIST = [
  'http://vzhggkrs:3gq7l28848l3@31.59.20.176:6754',
  'http://vzhggkrs:3gq7l28848l3@45.38.107.97:6014',
  'http://vzhggkrs:3gq7l28848l3@198.105.121.200:6462',
];

// Hàm lấy ngẫu nhiên 1 proxy từ danh sách
const getRandomProxy = () => {
  if (!PROXY_LIST.length) return null;
  const randomIndex = Math.floor(Math.random() * PROXY_LIST.length);
  return PROXY_LIST[randomIndex];
};

export const onTranslate = async (text, targetLang) => {
  try {
    const proxyUrl = getRandomProxy();
    
    // Tạo cấu hình agent nếu có proxy trong danh sách
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const result = await translate(text, {
      to: targetLang,
      // Đối với các phiên bản dùng fetch ngầm:
      fetchOptions: agent ? { agent } : undefined,
      // Đối với các phiên bản dùng requestOptions (dự phòng tương thích):
      requestOptions: agent ? { agent } : undefined,
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
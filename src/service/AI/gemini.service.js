import axios from 'axios';
import env from '../../config/env.js';

/**
 * Tóm tắt cuộc gọi từ danh sách transcript hội thoại
 * @param {Array<{ speaker: string, text: string, timestamp: string }>} transcript 
 * @returns {Promise<{ summary: string, keyPoints: string[], actionItems: string[] }>}
 */
const generateCallSummary = async (transcript) => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env của Backend.");
    }

    const transcriptText = transcript
        .map((t) => `${t.speaker || 'Unknown'} (${t.timestamp || ''}): ${t.text || ''}`)
        .join("\n");

    const prompt = `Bạn là trợ lý AI phân tích cuộc gọi chuyên nghiệp. Hãy phân tích đoạn hội thoại cuộc gọi sau và trả về duy nhất 1 JSON object (không dùng markdown codeblock, không thêm bất kỳ lời dẫn nào) theo đúng cấu trúc:
                        {
                            "summary": "Tóm tắt ngắn gọn về nội dung cuộc gọi",
                            "keyPoints": ["Điểm chính 1", "Điểm chính 2"],
                            "actionItems": ["Nhiệm vụ cần thực hiện (nếu có)"]
                        }

                        Hội thoại cuộc gọi:
                        ${transcriptText}`;

    // Gọi Interactions API đúng theo Quickstart của Gemini
    const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
            model: 'gemini-3.5-flash',
            input: prompt
        },
        {
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        }
    );

    // Trích xuất text linh hoạt từ response của Interactions API
    const modelOutputStep = response.data?.steps?.find((s) => s.type === 'model_output');
    let rawText =
        modelOutputStep?.content?.[0]?.text ||
        modelOutputStep?.content?.[0]?.parts?.[0]?.text ||
        response.data?.output ||
        response.data?.text;

    if (typeof rawText === 'object') {
        rawText = JSON.stringify(rawText);
    }

    // Làm sạch Markdown codeblock nếu AI lỡ kèm vào
    if (rawText && typeof rawText === 'string') {
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    if (!rawText) {
        throw new Error("Không nhận được phản hồi hợp lệ từ Gemini API.");
    }

    let aiSummary;
    try {
        aiSummary = JSON.parse(rawText);
    } catch (e) {
        throw new Error("Dữ liệu trả về từ Gemini không đúng định dạng JSON.");
    }

    return aiSummary;
};

export const GEMINI_SERVICE = {
    generateCallSummary,
};

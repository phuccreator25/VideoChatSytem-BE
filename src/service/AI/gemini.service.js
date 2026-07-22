import axios from 'axios';
import env from '../../config/env.js';

const generateCallSummary = async (transcript) => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env của Backend.");
    }

    if (!Array.isArray(transcript) || transcript.length === 0) {
        return {
            summary: "Cuộc gọi không có nội dung hội thoại.",
            keyPoints: [],
            actionItems: []
        };
    }

    const transcriptText = transcript
        .map((t) => `[${t.timestamp || 'N/A'}] ${t.speaker || 'Unknown'}: ${t.text || ''}`)
        .join("\n");

    // 3. Prompt thiết kế cực kỳ nghiêm ngặt để ép Gemini trả về PURE JSON
    const prompt = `Bạn là hệ thống API tự động xử lý dữ liệu cuộc gọi.
                    Nhiệm vụ: Phân tích đoạn hội thoại dưới đây và trả về KẾT QUẢ DƯỚI DẠNG 1 JSON OBJECT DUY NHẤT.

                    BẮT BUỘC TUÂN THỦ CÁC QUY TẮC SAU:
                    1. KHÔNG sử dụng Markdown codeblock (KHÔNG dùng \`\`\`json hoặc \`\`\`).
                    2. KHÔNG thêm bất kỳ lời dẫn, giải thích hay câu chào hỏi nào.
                    3. Chỉ trả về duy nhất chuỗi JSON hợp lệ theo đúng cấu trúc mẫu dưới đây:

                    {
                    "summary": "Tóm tắt ngắn gọn nội dung chính cuộc gọi (2-3 câu)",
                    "keyPoints": ["Ý chính 1", "Ý chính 2"],
                    "actionItems": ["Nhiệm vụ cần thực hiện sau cuộc gọi (ghi rõ người làm nếu có)"]
                    }

                    Hội thoại cuộc gọi:
                    ${transcriptText}`;

    try {
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

        // Trích xuất text từ response linh hoạt
        const modelOutputStep = response.data?.steps?.find((s) => s.type === 'model_output');
        let rawText =
            modelOutputStep?.content?.[0]?.text ||
            modelOutputStep?.content?.[0]?.parts?.[0]?.text ||
            response.data?.output ||
            response.data?.text;

        if (typeof rawText === 'object') {
            rawText = JSON.stringify(rawText);
        }

        if (!rawText || typeof rawText !== 'string') {
            throw new Error("Không nhận được dữ liệu văn bản từ Gemini API.");
        }

        // Xử lý làm sạch triệt để phòng trường hợp AI vẫn sót codeblock
        const cleanedJsonText = rawText
            .replace(/^```json/gi, '')
            .replace(/^```/gi, '')
            .replace(/```$/g, '')
            .trim();

        const aiSummary = JSON.parse(cleanedJsonText);
        return aiSummary;

    } catch (error) {
        console.error("Lỗi khi tạo tóm tắt cuộc gọi:", error?.response?.data || error.message);
        
        if (error instanceof SyntaxError) {
            throw new Error("Dữ liệu phản hồi từ AI không thể chuyển đổi thành JSON hợp lệ.");
        }
        
        throw new Error(error?.response?.data?.error?.message || error.message || "Lỗi xử lý tóm tắt cuộc gọi.");
    }
};

export const GEMINI_SERVICE = {
    generateCallSummary,
};

import axios from 'axios';

export const onGetTurnCredentials = async () => {
    try {
        // Gọi API của Metered để lấy danh sách iceServers xịn, đã được xác thực sẵn
        const response = await axios.get("https://nguyentruongphuc.metered.live/api/v1/turn/credentials?apiKey=c899fd119eb94b17b7a94ea8525dd5be2946");

        return {
            success: true,
            iceServers: response.data
        };
    } catch (error) {
        console.error("Lỗi khi lấy thông tin TURN từ Metered:", error);
        // Fallback về STUN miễn phí để tránh crash app
        return {
            success: true,
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        };
    }
};

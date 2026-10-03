import { ADMIN_AUTH_SERVICE } from "../../service/admin/adminAuth.service.js"

const onLogin = async(req, res, next) => {
    try {
        const { email, password, deviceId } = req.body;

        const ipAddress =
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip;

        const userAgent = req.headers["user-agent"] || null;

        const metaData = {
            ipAddress,
            userAgent,
            deviceId: deviceId || null,
            email,
            password,
        };

        const result = await ADMIN_AUTH_SERVICE.onLogin(metaData)

        res.cookie("adminAccessToken", result.token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });

        res.cookie("adminRefreshToken", result.refreshToken, {
            httpOnly: true,
            // sameSite: "strict",
            secure: true,
            sameSite: "none",
        });

        return res.status(200).json({
            message: "Login successful",
            data: result.data
        });
        
    } catch (error) {
        next(error)
    }
}

export const ADMIN_AUTH_CONTROLLER = {
    onLogin
}
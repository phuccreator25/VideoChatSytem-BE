import aj from "../config/arject.js";
import { isSpoofedBot } from "@arcjet/inspect";

export const arjectProtection = async (req, res, next) => {
    try {
        const decision = await aj.protect(req)

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                return res.status(429).json({
                    message: "Rate limit exceeded. Please try again later.",
                });
            }

            if (decision.reason.isBot()) {
                return res.status(403).json({
                    message: "Bot access denied.",
                });
            }

            return res.status(403).json({
                message: "Access denied by security policy",
            });
        }

        //check for spoofed bots
        if (decision.results.some(isSpoofedBot)) {
            return res.status(403).json({
                error: "Spoofed bot detected",
                message: " Malicious bot activity detected."
            })
        }

        next()
    } catch (error) {
        console.log("Arject Protection Error: ", error);
        next(error)
    }
}
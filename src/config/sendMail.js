import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";
import env from "./env.js";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST || "smtp.gmail.com",
  port: Number(env.MAIL_PORT) || 587,
  secure: (Number(env.MAIL_PORT) || 587) === 465,
  auth: {
    user: env.MAIL_USERNAME || "nguyentruongphuc.25022004@gmail.com",
    pass: env.MAIL_PASSWORD || "yumiyreyghmmvzsp",
  },
});

export async function sendMail({ to, title, view, data = {} }) {
  const html = await ejs.renderFile(view, data);

  const info = await transporter.sendMail({
    from: `"VIDEO CHAT" <${Event.MAIL_FROM_ADDRESS || "nguyentruongphuc.25022004@gmail.com"}>`,
    to,
    subject: title,
    html,
  });

  return info;
}

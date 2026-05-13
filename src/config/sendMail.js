import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";
import env from "./env.js";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: Number(env.MAIL_PORT) || 587,
  secure: (Number(env.MAIL_PORT) || 587) === 465,
  auth: {
    user: env.MAIL_USERNAME,
    pass: env.MAIL_PASSWORD,
  },
});

export async function sendMail({ to, title, view, data = {} }) {
  const html = await ejs.renderFile(view, data);

  const info = await transporter.sendMail({
    from: `"VIDEO CHAT" <${env.MAIL_FROM_ADDRESS}>`,
    to,
    subject: title,
    html,
  });

  return info;
}

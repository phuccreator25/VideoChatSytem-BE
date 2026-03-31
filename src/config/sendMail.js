import nodemailer from "nodemailer";
import dotenv from "dotenv";
import ejs from "ejs";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.MAIL_PORT) || 587,
  secure: (Number(process.env.MAIL_PORT) || 587) === 465,
  auth: {
    user: process.env.MAIL_USERNAME || "nguyentruongphuc.25022004@gmail.com",
    pass: process.env.MAIL_PASSWORD || "yumiyreyghmmvzsp",
  },
});

export async function sendMail({ to, title, view, data = {} }) {
  const html = await ejs.renderFile(view, data);

  const info = await transporter.sendMail({
    from: `"VIDEO CHAT" <${process.env.MAIL_FROM_ADDRESS || "nguyentruongphuc.25022004@gmail.com"}>`,
    to,
    subject: title,
    html,
  });

  return info;
}

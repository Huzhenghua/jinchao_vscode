const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
  service: 'qq',
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

async function sendVerificationEmail(email, code) {
  if (!config.email.user || !config.email.pass) {
    throw new Error('未配置邮箱账号，请设置 JINCHAO_EMAIL_USER 和 JINCHAO_EMAIL_PASS');
  }

  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: '烬潮博客 - 验证码',
    html: `
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #333;">烬潮博客验证</h2>
        <p>您的验证码是：<strong style="color: #e74c3c; font-size: 24px;">${code}</strong></p>
        <p style="color: #666; font-size: 14px;">验证码5分钟内有效，请勿泄露给他人。</p>
      </div>
    `
  };
  
  const startedAt = Date.now();
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`验证码邮件已提交，耗时 ${Date.now() - startedAt}ms，收件人 ${email}`);
    return result;
  } catch (error) {
    console.error(`验证码邮件发送失败，耗时 ${Date.now() - startedAt}ms：`, error.message);
    throw error;
  }
}

module.exports = { sendVerificationEmail };

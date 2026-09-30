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

async function sendReportNotificationEmail(report) {
  if (!config.adminEmail) return null;
  if (!config.email.user || !config.email.pass) {
    throw new Error('未配置邮箱账号，请设置 JINCHAO_EMAIL_USER 和 JINCHAO_EMAIL_PASS');
  }

  const mailOptions = {
    from: config.email.user,
    to: config.adminEmail,
    subject: '烬潮博客 - 内容举报通知',
    html: `
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #333;">烬潮博客新举报</h2>
        <p><strong>举报者ID：</strong>${report.reporter_id}</p>
        <p><strong>内容类型：</strong>${report.content_type}，ID：${report.content_id}</p>
        <p><strong>举报原因：</strong>${report.reason}</p>
        <p style="color: #999; font-size: 14px;">请尽快前往后台审核。</p>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
}

// 密码修改验证链接邮件：resetUrl 为完整可点击地址
async function sendPasswordResetEmail(email, resetUrl, expiresMinutes = 30) {
  if (!config.email.user || !config.email.pass) {
    throw new Error('未配置邮箱账号，请设置 JINCHAO_EMAIL_USER 和 JINCHAO_EMAIL_PASS');
  }

  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: '烬潮博客 - 密码修改验证',
    html: `
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #333;">烬潮博客密码修改</h2>
        <p>我们收到了你的密码修改请求。请点击下面的按钮设置新密码：</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: #fb7299; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px;">设置新密码</a>
        </p>
        <p style="color: #666; font-size: 14px;">链接 ${expiresMinutes} 分钟内有效，且只能使用一次。</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">如果按钮无法点击，请复制此地址到浏览器打开：${resetUrl}</p>
        <p style="color: #999; font-size: 12px;">如果这不是你本人的操作，请忽略本邮件，你的密码不会被修改。</p>
      </div>
    `,
  };

  const startedAt = Date.now();
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`密码修改邮件已提交，耗时 ${Date.now() - startedAt}ms，收件人 ${email}`);
    return result;
  } catch (error) {
    console.error(`密码修改邮件发送失败，耗时 ${Date.now() - startedAt}ms：`, error.message);
    throw error;
  }
}

// 密码已更新通知邮件
async function sendPasswordChangedEmail(email) {
  if (!config.email.user || !config.email.pass) {
    throw new Error('未配置邮箱账号，请设置 JINCHAO_EMAIL_USER 和 JINCHAO_EMAIL_PASS');
  }

  const mailOptions = {
    from: config.email.user,
    to: email,
    subject: '烬潮博客 - 密码已更新',
    html: `
      <div style="padding: 20px; background: #f5f5f5;">
        <h2 style="color: #333;">密码修改成功</h2>
        <p>你的烬潮博客账号密码已于刚刚更新成功。</p>
        <p style="color: #666; font-size: 14px;">出于安全考虑，你之前的所有登录状态已失效，请使用新密码重新登录。</p>
        <p style="color: #999; font-size: 12px;">如果这不是你本人的操作，请立即通过"忘记密码"重新设置并联系我们。</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { 
  sendVerificationEmail, 
  sendReportNotificationEmail, 
  sendPasswordResetEmail, 
  sendPasswordChangedEmail 
};

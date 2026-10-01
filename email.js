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

function assertEmailConfig() {
  if (!config.email.user || !config.email.pass) {
    throw new Error('未配置邮箱账号，请设置 JINCHAO_EMAIL_USER 和 JINCHAO_EMAIL_PASS');
  }
}

// 发件人显示名：收件箱里显示「烬潮」而不是裸邮箱地址，提升识别度与打开率
function fromHeader() {
  return `"烬潮" <${config.email.user}>`;
}

// 统一外层模板：品牌色头部 + 内容卡片 + 页脚提示，各客户端渲染一致
function renderEmailShell(title, bodyHtml, footerHtml = '') {
  return `
    <div style="margin:0; padding:24px 12px; background:#f4f5f7; font-family:'PingFang SC','Microsoft YaHei',Helvetica,Arial,sans-serif;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ececec;">
        <div style="padding:16px 28px; background:#fb7299; color:#ffffff; font-size:18px; font-weight:bold; letter-spacing:2px;">烬潮</div>
        <div style="padding:28px;">
          <h2 style="margin:0 0 16px; color:#333333; font-size:20px;">${title}</h2>
          <div style="color:#555555; font-size:14px; line-height:1.7;">${bodyHtml}</div>
        </div>
        ${footerHtml ? `<div style="padding:14px 28px; background:#fafafa; border-top:1px solid #f0f0f0; color:#999999; font-size:12px; line-height:1.6;">${footerHtml}</div>` : ''}
      </div>
      <p style="max-width:520px; margin:12px auto 0; color:#bbbbbb; font-size:12px; text-align:center;">本邮件由烬潮系统自动发送，请勿直接回复</p>
    </div>
  `;
}

// 统一发送入口：附带耗时日志，便于排查 SMTP 慢查询
async function dispatch(mailOptions, logLabel) {
  const startedAt = Date.now();
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`${logLabel}已提交，耗时 ${Date.now() - startedAt}ms，收件人 ${mailOptions.to}`);
    return result;
  } catch (error) {
    console.error(`${logLabel}发送失败，耗时 ${Date.now() - startedAt}ms：`, error.message);
    throw error;
  }
}

async function sendVerificationEmail(email, code) {
  assertEmailConfig();

  const mailOptions = {
    from: fromHeader(),
    to: email,
    subject: '【烬潮】邮箱验证码，5 分钟内有效',
    text: `您的烬潮验证码是：${code}\n验证码 5 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。`,
    html: renderEmailShell(
      '邮箱验证',
      `<p>您的验证码是：</p>
       <p style="margin:20px 0;"><strong style="color:#fb7299; font-size:30px; letter-spacing:8px;">${code}</strong></p>
       <p style="color:#666666;">验证码 5 分钟内有效，请勿泄露给他人。</p>`,
      '如果这不是你本人的操作，请忽略本邮件。'
    )
  };

  return dispatch(mailOptions, '验证码邮件');
}

async function sendReportNotificationEmail(report) {
  if (!config.adminEmail) return null;
  assertEmailConfig();

  const mailOptions = {
    from: fromHeader(),
    to: config.adminEmail,
    subject: '【烬潮】内容举报通知',
    text: `收到新举报：\n举报者ID：${report.reporter_id}\n内容类型：${report.content_type}，ID：${report.content_id}\n举报原因：${report.reason}\n请尽快前往后台审核。`,
    html: renderEmailShell(
      '收到新举报',
      `<p><strong>举报者ID：</strong>${report.reporter_id}</p>
       <p><strong>内容类型：</strong>${report.content_type}，ID：${report.content_id}</p>
       <p><strong>举报原因：</strong>${report.reason}</p>
       <p style="color:#999999;">请尽快前往后台审核。</p>`
    )
  };
  return dispatch(mailOptions, '举报通知邮件');
}

// 密码修改验证链接邮件：resetUrl 为完整可点击地址
async function sendPasswordResetEmail(email, resetUrl, expiresMinutes = 30) {
  assertEmailConfig();

  const mailOptions = {
    from: fromHeader(),
    to: email,
    subject: `【烬潮】密码修改验证链接，${expiresMinutes} 分钟内有效`,
    text: `我们收到了你的密码修改请求。请打开以下链接设置新密码（${expiresMinutes} 分钟内有效，且只能使用一次）：\n${resetUrl}\n如果这不是你本人的操作，请忽略本邮件，你的密码不会被修改。`,
    html: renderEmailShell(
      '密码修改验证',
      `<p>我们收到了你的密码修改请求。请点击下面的按钮设置新密码：</p>
       <p style="margin:24px 0; text-align:center;">
         <a href="${resetUrl}" style="display:inline-block; padding:12px 32px; background:#fb7299; color:#ffffff; text-decoration:none; border-radius:8px; font-size:16px; font-weight:bold;">设置新密码</a>
       </p>
       <p style="color:#666666;">链接 ${expiresMinutes} 分钟内有效，且只能使用一次。</p>`,
      `如果按钮无法点击，请复制此地址到浏览器打开：<span style="word-break:break-all;">${resetUrl}</span><br>如果这不是你本人的操作，请忽略本邮件，你的密码不会被修改。`
    )
  };

  return dispatch(mailOptions, '密码修改邮件');
}

// 密码已更新通知邮件
async function sendPasswordChangedEmail(email) {
  assertEmailConfig();

  const mailOptions = {
    from: fromHeader(),
    to: email,
    subject: '【烬潮】你的密码已修改',
    text: '你的烬潮账号密码刚刚更新成功。出于安全考虑，你之前的所有登录状态已失效，请使用新密码重新登录。如果这不是你本人的操作，请立即通过"忘记密码"重新设置。',
    html: renderEmailShell(
      '密码修改成功',
      `<p>你的烬潮账号密码刚刚更新成功。</p>
       <p style="color:#666666;">出于安全考虑，你之前的所有登录状态已失效，请使用新密码重新登录。</p>`,
      '如果这不是你本人的操作，请立即通过"忘记密码"重新设置并联系我们。'
    )
  };

  return dispatch(mailOptions, '密码更新通知邮件');
}

module.exports = {
  sendVerificationEmail,
  sendReportNotificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};

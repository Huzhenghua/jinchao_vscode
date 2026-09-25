const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=');
        if (separator === -1) return [line, ''];
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        return [key, value];
      })
      .filter(([key]) => key)
  );
}

const localEnv = loadDotEnv();

const sessionSecret =
  process.env.JINCHAO_SESSION_SECRET ||
  localEnv.JINCHAO_SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex');

if (!process.env.JINCHAO_SESSION_SECRET && !localEnv.JINCHAO_SESSION_SECRET) {
  console.warn('[jinchao] 警告：JINCHAO_SESSION_SECRET 未设置，正在使用随机生成密钥（每次重启失效）。');
}

module.exports = {
  port: parseInt(process.env.JINCHAO_PORT || localEnv.JINCHAO_PORT || '3000', 10),
  sessionSecret,
  email: {
    user: process.env.JINCHAO_EMAIL_USER || localEnv.JINCHAO_EMAIL_USER || '',
    pass: process.env.JINCHAO_EMAIL_PASS || localEnv.JINCHAO_EMAIL_PASS || ''
  },
  adminEmail: process.env.JINCHAO_ADMIN_EMAIL || localEnv.JINCHAO_ADMIN_EMAIL || ''
};

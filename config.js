const fs = require('fs');
const path = require('path');

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

module.exports = {
  port: 3000,
  email: {
    user: process.env.JINCHAO_EMAIL_USER || localEnv.JINCHAO_EMAIL_USER || '',
    pass: process.env.JINCHAO_EMAIL_PASS || localEnv.JINCHAO_EMAIL_PASS || ''
  }
};

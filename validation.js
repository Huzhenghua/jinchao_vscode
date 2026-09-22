function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function validateRegistrationInput({ username, email, code, password }) {
  const trimmedUsername = String(username || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const trimmedCode = String(code || '').trim();

  if (!trimmedUsername) {
    return { valid: false, message: '用户名不能为空' };
  }

  if (!validateEmail(normalizedEmail)) {
    return { valid: false, message: '请输入有效的邮箱地址' };
  }

  if (!trimmedCode || trimmedCode.length < 4) {
    return { valid: false, message: '验证码格式不正确' };
  }

  if (!password || String(password).trim().length < 8) {
    return { valid: false, message: '密码至少为8位字符' };
  }

  return {
    valid: true,
    username: trimmedUsername,
    email: normalizedEmail,
    code: trimmedCode,
    password: String(password),
  };
}

function validatePostInput({ title, content }) {
  const trimmedTitle = String(title || '').trim();
  const trimmedContent = String(content || '').trim();

  if (!trimmedTitle) {
    return { valid: false, message: '标题不能为空' };
  }

  if (!trimmedContent) {
    return { valid: false, message: '文章内容不能为空' };
  }

  return {
    valid: true,
    title: trimmedTitle,
    content: trimmedContent,
  };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validateRegistrationInput,
  validatePostInput,
};

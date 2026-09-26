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

// 弹幕颜色白名单（B站常用弹幕色，含默认白）
const BARRAGE_COLORS = [
  '#ffffff',
  '#fe0302',
  '#ff7204',
  '#ffaa02',
  '#ffd302',
  '#ffff00',
  '#a0ee00',
  '#00cd00',
  '#019899',
  '#4266be',
  '#89d5ff',
  '#cc0273',
];

// 弹幕可选字号（px）
const BARRAGE_FONT_SIZES = [18, 25, 32];

// 弹幕滚动速度档位
const BARRAGE_SPEEDS = ['slow', 'normal', 'fast'];

// 弹幕时间点上限：24 小时
const BARRAGE_MAX_OFFSET_MS = 86400000;

const BARRAGE_MAX_CONTENT_LENGTH = 100;
const BARRAGE_DEFAULT_COLOR = '#ffffff';
const BARRAGE_DEFAULT_FONT_SIZE = 25;
const BARRAGE_DEFAULT_SPEED = 'normal';

// 仅返回白名单内的小写原值，杜绝 CSS 注入
function normalizeBarrageColor(color) {
  const lowered = String(color || '').trim().toLowerCase();
  return BARRAGE_COLORS.find(item => item === lowered) || null;
}

// 兼容数字与数字字符串，非法时返回 null
function normalizeBarrageFontSize(fontSize) {
  const value = Number(fontSize);
  if (!Number.isInteger(value)) return null;

  return BARRAGE_FONT_SIZES.includes(value) ? value : null;
}

function normalizeBarrageSpeed(speed) {
  const lowered = String(speed || '').trim().toLowerCase();
  return BARRAGE_SPEEDS.find(item => item === lowered) || null;
}

function validateBarrageCreate(input = {}) {
  const { content, offsetMs, color, fontSize, speed } = input;

  const trimmedContent = String(content || '').trim();
  if (!trimmedContent || trimmedContent.length > BARRAGE_MAX_CONTENT_LENGTH) {
    return { valid: false, message: '弹幕内容不能为空且不超过100字' };
  }

  let normalizedOffsetMs = 0;
  if (offsetMs !== undefined && offsetMs !== null && offsetMs !== '') {
    const parsedOffset = Number(offsetMs);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0 || parsedOffset > BARRAGE_MAX_OFFSET_MS) {
      return { valid: false, message: '弹幕时间点不合法' };
    }
    normalizedOffsetMs = parsedOffset;
  }

  let normalizedFontSize = BARRAGE_DEFAULT_FONT_SIZE;
  if (fontSize !== undefined && fontSize !== null && fontSize !== '') {
    normalizedFontSize = normalizeBarrageFontSize(fontSize) || BARRAGE_DEFAULT_FONT_SIZE;
  }

  return {
    valid: true,
    content: trimmedContent,
    offsetMs: normalizedOffsetMs,
    color: normalizeBarrageColor(color) || BARRAGE_DEFAULT_COLOR,
    fontSize: normalizedFontSize,
    speed: normalizeBarrageSpeed(speed) || BARRAGE_DEFAULT_SPEED,
  };
}

function validateBarrageUpdate(input = {}) {
  const { content, color, fontSize, speed } = input;
  const fields = {};

  if (content !== undefined) {
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent || trimmedContent.length > BARRAGE_MAX_CONTENT_LENGTH) {
      return { valid: false, message: '弹幕内容不能为空且不超过100字' };
    }
    fields.content = trimmedContent;
  }

  if (color !== undefined) {
    const normalizedColor = normalizeBarrageColor(color);
    if (!normalizedColor) {
      return { valid: false, message: '弹幕颜色不合法' };
    }
    fields.color = normalizedColor;
  }

  if (fontSize !== undefined) {
    const normalizedFontSize = normalizeBarrageFontSize(fontSize);
    if (!normalizedFontSize) {
      return { valid: false, message: '弹幕字号不合法' };
    }
    fields.fontSize = normalizedFontSize;
  }

  if (speed !== undefined) {
    const normalizedSpeed = normalizeBarrageSpeed(speed);
    if (!normalizedSpeed) {
      return { valid: false, message: '弹幕速度不合法' };
    }
    fields.speed = normalizedSpeed;
  }

  if (Object.keys(fields).length === 0) {
    return { valid: false, message: '没有需要更新的内容' };
  }

  return { valid: true, fields };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validateRegistrationInput,
  validatePostInput,
  BARRAGE_COLORS,
  BARRAGE_FONT_SIZES,
  BARRAGE_SPEEDS,
  BARRAGE_MAX_OFFSET_MS,
  validateBarrageCreate,
  validateBarrageUpdate,
};

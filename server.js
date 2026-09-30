const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const db = require('./database');
// 文件卡片纯逻辑（热度计算 / 排序）：与前端 app.js、单元测试共用同一份实现
const FileCardLogic = require('./public/js/file-card-logic.js');
const { sendVerificationEmail, sendReportNotificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require('./email');
const config = require('./config');
const {
  normalizeEmail,
  validateEmail,
  validateRegistrationInput,
  validatePostInput,
  validateBarrageCreate,
  validateBarrageUpdate,
  validateUploadFile,
} = require('./validation');

const app = express();
const videoDirectory = path.join(__dirname, 'public', 'uploads', 'videos');
const fileDirectory = path.join(__dirname, 'public', 'uploads', 'files');
// 预下载文件库（云盘式空间）：与上传文件库相互独立的存储目录
const preFileDirectory = path.join(__dirname, 'public', 'uploads', 'pre_files');
const avatarDirectory = path.join(__dirname, 'public', 'uploads', 'avatars');
const thumbnailDirectory = path.join(__dirname, 'public', 'uploads', 'thumbnails');
const hlsDirectory = path.join(videoDirectory, 'hls');
const execFileAsync = promisify(execFile);
fs.mkdirSync(videoDirectory, { recursive: true });
fs.mkdirSync(fileDirectory, { recursive: true });
fs.mkdirSync(preFileDirectory, { recursive: true });
fs.mkdirSync(avatarDirectory, { recursive: true });
fs.mkdirSync(hlsDirectory, { recursive: true });
fs.mkdirSync(thumbnailDirectory, { recursive: true });

function mediaUrl(filename) {
  return filename ? `/uploads/videos/${filename.split('/').map(encodeURIComponent).join('/')}` : null;
}

function avatarUrl(filename) {
  return filename ? `/uploads/avatars/${encodeURIComponent(filename)}` : null;
}

function listOptions(req, defaultLimit = 6, maxLimit = 100) {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  return {
    limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), maxLimit) : defaultLimit,
    sort: req.query.sort === 'hot' ? 'hot' : 'latest',
  };
}

// 分页偏移：非法值一律回落到 0
function offsetOption(req) {
  const requestedOffset = Number.parseInt(req.query.offset, 10);
  return Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
}

function getHlsPlaylist(video) {
  if (video.hls_playlist && fs.existsSync(path.join(videoDirectory, video.hls_playlist))) {
    return video.hls_playlist;
  }

  if (!video.mp4_filename) return video.hls_playlist || null;

  const outputBaseName = path.parse(path.basename(video.mp4_filename)).name;
  const fallbackPlaylist = `hls/${outputBaseName}/index.m3u8`;
  return fs.existsSync(path.join(videoDirectory, fallbackPlaylist)) ? fallbackPlaylist : video.hls_playlist || null;
}

async function transcodeVideo(inputPath, baseName) {
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const runFfmpeg = async (stage, args) => {
    try {
      return await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 4 });
    } catch (error) {
      error.transcodeStage = stage;
      throw error;
    }
  };
  const outputBaseName = `${baseName}-converted`;
  const mp4Filename = `${outputBaseName}.mp4`;
  const webmFilename = `${outputBaseName}.webm`;
  const posterFilename = `${outputBaseName}.jpg`;
  const hlsFolder = path.join(hlsDirectory, outputBaseName);
  const hlsPlaylist = path.join(hlsFolder, 'index.m3u8');
  fs.mkdirSync(hlsFolder, { recursive: true });

  try {
    await runFfmpeg('FFmpeg 检测', ['-version']);
    await runFfmpeg('MP4 转码', [
      '-y', '-i', inputPath, '-map', '0:v:0', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      '-f', 'mp4',
      path.join(videoDirectory, mp4Filename),
    ]);
    await runFfmpeg('HLS 切片', [
      '-y', '-i', path.join(videoDirectory, mp4Filename), '-c', 'copy',
      '-hls_time', '6', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(hlsFolder, 'segment%03d.ts'), '-f', 'hls', hlsPlaylist,
    ]);
    await runFfmpeg('WebM 转码', [
      '-y', '-i', path.join(videoDirectory, mp4Filename), '-c:v', 'libvpx-vp9',
      '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-f', 'webm',
      path.join(videoDirectory, webmFilename),
    ]);
    await runFfmpeg('封面生成', [
      '-y', '-ss', '00:00:01', '-i', path.join(videoDirectory, mp4Filename),
      '-frames:v', '1', '-q:v', '2', '-f', 'image2', path.join(videoDirectory, posterFilename),
    ]);
  } catch (error) {
    fs.rmSync(hlsFolder, { recursive: true, force: true });
    [mp4Filename, webmFilename, posterFilename].forEach(filename => {
      fs.rmSync(path.join(videoDirectory, filename), { force: true });
    });
    if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EISDIR') {
      throw new Error('服务器未安装 FFmpeg，请先安装 FFmpeg 后再上传视频');
    }
    const detail = error.stderr ? String(error.stderr).trim().split('\n').pop() : '';
    const stage = error.transcodeStage ? `${error.transcodeStage}失败` : '视频转码失败';
    throw new Error(detail ? `${stage}：${detail}` : `${stage}，请检查 FFmpeg 配置和视频文件格式`);
  }

  return { mp4Filename, webmFilename, posterFilename, hlsPlaylist: `hls/${outputBaseName}/index.m3u8` };
}

// 多文件上传：files 为文件本体，thumbnails 为前端生成的图片缩略图
const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, file.fieldname === 'thumbnails' ? thumbnailDirectory : fileDirectory);
    },
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 单个文件 200MB
    files: 40,                   // 最多 20 个文件 + 20 个缩略图
  },
  fileFilter: (req, file, callback) => {
    // 缩略图只允许图片
    if (file.fieldname === 'thumbnails') {
      return callback(null, String(file.mimetype).startsWith('image/'));
    }

    // 文件本体做格式校验：不合法则记录原因并跳过该文件（其余文件继续）
    const rejection = validateUploadFile(file.originalname);
    if (rejection) {
      req.rejectedFiles = req.rejectedFiles || [];
      req.rejectedFiles.push({ name: file.originalname, reason: rejection });
      return callback(null, false);
    }

    callback(null, true);
  },
});

// 包装 multer 中间件，把 multer 的错误转成统一 JSON
function fileUploadFields(req, res, next) {
  fileUpload.fields([{ name: 'files', maxCount: 20 }, { name: 'thumbnails', maxCount: 20 }])(req, res, error => {
    if (!error) return next();

    // 出错时清理本次已落盘的文件，避免留下垃圾
    if (req.files && typeof req.files === 'object') {
      Object.values(req.files).flat().forEach(item => {
        try { fs.rmSync(item.path, { force: true }); } catch (cleanupError) { /* 忽略清理失败 */ }
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.json({ success: false, message: '单个文件不能超过 200MB' });
    }
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.json({ success: false, message: '一次最多上传 20 个文件' });
    }
    return res.json({ success: false, message: `文件上传失败：${error.message}` });
  });
}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: videoDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    callback(null, file.fieldname === 'video' ? file.mimetype.startsWith('video/') : file.mimetype.startsWith('image/'));
  },
});

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});

// 预下载文件库（云盘式空间）专用上传：落到独立目录，不受上传文件库格式校验约束
const preFileUpload = multer({
  storage: multer.diskStorage({
    destination: preFileDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `pre-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function preFileUploadField(req, res, next) {
  preFileUpload.array('pre_files', 50)(req, res, error => {
    if (!error) return next();

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(item => {
        try { fs.rmSync(item.path, { force: true }); } catch (cleanupError) { /* 忽略清理失败 */ }
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.json({ success: false, message: '单个文件不能超过 200MB' });
    }
    return res.json({ success: false, message: `预下载文件上传失败：${error.message}` });
  });
}

// 预下载文件库容量上限：每个用户共享 200MB
const PRE_FILE_QUOTA_BYTES = 200 * 1024 * 1024;

function preFileUsage(userId) {
  const row = db.prepare('SELECT COALESCE(SUM(file_size), 0) AS used FROM pre_files WHERE user_id = ?').get(userId);
  return Number(row ? row.used : 0);
}

function preFileRowPayload(file) {
  return {
    id: file.id,
    original_name: file.original_name,
    mime_type: file.mime_type,
    file_size: file.file_size,
    created_at: file.created_at,
    downloadUrl: `/api/pre-files/${file.id}/download`,
  };
}

// 字节数 -> 人类可读大小（用于配额提示）
function formatHumanBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let index = -1;
  let result = value;
  do {
    result /= 1024;
    index += 1;
  } while (result >= 1024 && index < units.length - 1);
  return `${result >= 100 ? result.toFixed(0) : result.toFixed(1)} ${units[index]}`;
}

// 服务端 ZIP 打包共用的 CRC-32 查找表（惰性构建，避免与前端命名冲突故独立）
let crc32Table = null;

function getClientIp(req) {
  const address = req.socket.remoteAddress || req.connection.remoteAddress || '-';
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}

// 登录失败最大次数与锁定时长
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MINUTES = 15;

// 验证码类接口速率限制（注册 / 登录验证码 / 重置密码验证码）
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.json({ success: false, message: '请求过于频繁，请稍后再试' }),
});

// 登录 / 注册 / 重置密码密码类接口速率限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.json({ success: false, message: '请求过于频繁，请稍后再试' }),
});

// 弹幕写接口（发送 / 编辑 / 删除）速率限制
const barrageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.json({ success: false, message: '请求过于频繁，请稍后再试' }),
});

function utcNow() {
  return new Date().toISOString();
}

// 创建站内通知
function createNotification(userId, actorId, type, contentType, contentId, preview, link) {
  if (!userId || userId === actorId) return null;
  try {
    return db.prepare(`\n      INSERT INTO notifications (user_id, actor_id, type, content_type, content_id, preview, link)\n      VALUES (?, ?, ?, ?, ?, ?, ?)\n    `).run(userId, actorId || null, type, contentType || null, contentId || null, preview || null, link || null);
  } catch (error) {
    console.error('写入通知失败:', error.message);
    return null;
  }
}

// 解析评论中的 @用户名并为被提及用户创建通知
function notifyMentions(content, actorId, contentOwnerId, type, contentId, link) {
  const mentions = [...new Set([...String(content || '').matchAll(/@([^\s@]{1,40})/g)].map(m => m[1]))];
  for (const name of mentions) {
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
    if (!user) continue;
    const uid = user.id;
    if (uid === actorId || uid === contentOwnerId) continue;
    createNotification(uid, actorId, 'mention', type, contentId, `@${name}`, link);
  }
}

// 获取某用户对某个内容的收藏状态 (post/video/file)
function checkFavorited(userId, contentType, contentId) {
  if (!userId) return 0;
  const row = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND content_type = ? AND content_id = ?')
    .get(userId, contentType, contentId);
  return row ? 1 : 0;
}

// 统计某个内容被收藏的总次数 (post/video/file)
function countFavorites(contentType, contentId) {
  return db.prepare('SELECT COUNT(*) AS count FROM favorites WHERE content_type = ? AND content_id = ?')
    .get(contentType, contentId).count;
}

// 记录内容浏览历史
function recordView(userId, contentType, contentId) {
  if (!userId) return;
  const now = new Date().toISOString();
  db.prepare(`\n    INSERT INTO view_history (user_id, content_type, content_id, viewed_at)\n    VALUES (?, ?, ?, ?)\n    ON CONFLICT(user_id, content_type, content_id) DO UPDATE SET viewed_at = excluded.viewed_at\n  `).run(userId, contentType, contentId, now);
}

// 内容摘要查询语句（收藏 / 浏览历史共用）
const contentSummaryStatements = {
  post: db.prepare(`
    SELECT p.id, p.title, p.content AS summary, p.created_at, p.view_count, p.user_id, u.username, u.avatar_filename
    FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `),
  video: db.prepare(`
    SELECT v.id, v.title, v.title AS summary, v.created_at, v.view_count, v.user_id, v.poster_filename, u.username, u.avatar_filename
    FROM videos v JOIN users u ON u.id = v.user_id WHERE v.id = ?
  `),
  file: db.prepare(`
    SELECT f.id, f.title, f.original_name AS summary, f.created_at, f.download_count, f.user_id, u.username, u.avatar_filename
    FROM files f JOIN users u ON u.id = f.user_id WHERE f.id = ?
  `),
};

// 根据收藏或浏览历史记录补齐内容摘要信息
function fetchContentSummaries(entries, timeField) {
  return entries.map(entry => {
    const statement = contentSummaryStatements[entry.content_type];
    if (!statement) return null;
    const row = statement.get(entry.content_id);
    if (!row) return null;
    return {
      ...row,
      type: entry.content_type,
      [timeField]: entry[timeField],
      posterUrl: entry.content_type === 'video' ? mediaUrl(row.poster_filename) : null,
      avatarUrl: avatarUrl(row.avatar_filename),
    };
  }).filter(Boolean);
}

// 记录所有访问请求，便于观察局域网设备访问情况
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log(`[访问] ${timestamp} IP=${getClientIp(req)} ${req.method} ${req.originalUrl}`);
  next();
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// 验证码接口速率限制
app.use(['/api/send-code', '/api/send-login-code', '/api/send-reset-code', '/api/password-reset/request'], codeLimiter);
// 登录 / 注册 / 重置密码接口速率限制
app.use(['/api/login', '/api/login-code', '/api/register', '/api/reset-password', '/api/password-reset/confirm'], authLimiter);

// 记录活跃会话并踢出已撤销的会话
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    const now = utcNow();
    const existing = db.prepare('SELECT id, revoked FROM user_sessions WHERE id = ?').get(req.sessionID);
    if (existing && existing.revoked) {
      // 会话已被撤销，销毁登录状态
      req.session.destroy(() => {});
      req.session = null;
      return res.json({ success: false, message: '登录已失效，请重新登录' });
    }
    db.prepare(`\n      INSERT INTO user_sessions (id, user_id, ip, user_agent)\n      VALUES (?, ?, ?, ?)\n      ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at\n    `).run(req.sessionID, req.session.userId, getClientIp(req), req.headers['user-agent'] || '');
  }
  next();
});

// 生成6位验证码
function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

async function issueVerificationCode(email, purpose) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  db.prepare('DELETE FROM verification_codes WHERE email = ? AND purpose = ?').run(email, purpose);
  db.prepare('INSERT INTO verification_codes (email, code, expires_at, purpose) VALUES (?, ?, ?, ?)')
    .run(email, code, expiresAt.toISOString(), purpose);

  try {
    await sendVerificationEmail(email, code);
    return code;
  } catch (error) {
    db.prepare('DELETE FROM verification_codes WHERE email = ? AND code = ? AND purpose = ?')
      .run(email, code, purpose);
    throw error;
  }
}

// 邮件链接里的令牌：32 字节随机数的十六进制（只在 URL 里出现，不落库明文）
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// 邮件链接优先用配置项；未配置时回落当前请求的 Host（保证本地开发也能收到可点击的 URL）
function siteBaseUrl(req) {
  return config.baseUrl || `${req.protocol}://${req.get('host')}`;
}

// 在 req.session 中写入 userId，并记录到 user_sessions 表
function registerSession(req, remember) {
  if (!req.session.userId) return;
  if (remember) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 天
  } else {
    req.session.cookie.maxAge = null; // 浏览器会话Cookie
  }
  db.prepare(`\n    INSERT INTO user_sessions (id, user_id, ip, user_agent)\n    VALUES (?, ?, ?, ?)\n    ON CONFLICT(id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP\n  `).run(req.sessionID, req.session.userId, getClientIp(req), req.headers['user-agent'] || '');
}

// 缩略图 URL：存路径名，按已配置的前缀拼出访问地址
function getThumbnailUrl(filename) {
  return filename ? `/uploads/thumbnails/${encodeURIComponent(filename)}` : null;
}

// 根据文件名猜测 MIME 类型（用于 inline display）
function guessMimeType(filename) {
  const extension = path.extname(String(filename || '')).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
    '.aac': 'audio/aac', '.flac': 'audio/flac',
  };
  return map[extension] || 'application/octet-stream';
}

// 批次聚合用：判断文件属于图片 / 音频（其他一律归为"其他文件"）
function isImageMime(mimeType) {
  return String(mimeType || '').startsWith('image/');
}
function isAudioMime(mimeType) {
  return String(mimeType || '').startsWith('audio/');
}

// 邮箱脱敏显示：abc@qq.com -> a**@qq.com
function maskEmail(email) {
  const value = String(email || '');
  const atIndex = value.indexOf('@');
  if (atIndex <= 0) return value;
  const name = value.slice(0, atIndex);
  const domain = value.slice(atIndex);
  const head = name.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, name.length - 1))}${domain}`;
}

// 检查邮箱是否被锁定
function checkLoginLock(email) {
  const attempt = db.prepare('SELECT fail_count, locked_until FROM login_attempts WHERE email = ?').get(email);
  if (!attempt) return null;
  if (attempt.locked_until) {
    if (new Date(attempt.locked_until).getTime() > Date.now()) {
      const remaining = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000);
      return { locked: true, remaining };
    }
    // 锁定已过期，重置失败计数
    db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
  }
  return null;
}

// 记录登录失败，达到阈值则锁定
function recordLoginFail(email) {
  const now = utcNow();
  const existing = db.prepare('SELECT fail_count FROM login_attempts WHERE email = ?').get(email);
  if (existing) {
    const nextCount = existing.fail_count + 1;
    if (nextCount >= LOGIN_MAX_FAILS) {
      const lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60000).toISOString();
      db.prepare(`UPDATE login_attempts SET fail_count = ?, locked_until = ?, updated_at = ? WHERE email = ?`)
        .run(nextCount, lockedUntil, now, email);
    } else {
      db.prepare('UPDATE login_attempts SET fail_count = ?, updated_at = ? WHERE email = ?')
        .run(nextCount, now, email);
    }
  } else {
    db.prepare('INSERT INTO login_attempts (email, fail_count, updated_at) VALUES (?, ?, ?)')
      .run(email, 1, now);
  }
}

// 重置登录失败记录
function clearLoginFail(email) {
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
}

// 校验令牌是否可用：仅与库中哈希比对，不泄露账号信息
function findValidResetToken(token) {
  const tokenHash = hashResetToken(token);
  return db.prepare(`
    SELECT id, user_id FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(tokenHash, new Date().toISOString());
}

// 发送验证码
app.post('/api/send-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  try {
    await issueVerificationCode(email, 'register');
    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('发送邮件失败:', error);
    res.json({ success: false, message: '发送验证码失败，请稍后重试' });
  }
});

// 接口 1：申请发送验证链接
//   - 已登录（入口 A：dashboard「修改密码」）：直接从会话取出用户，不看请求体
//   - 未登录（入口 B：login.html「忘记密码」）：需要注册邮箱
app.post('/api/password-reset/request', async (req, res) => {
  let user = null;

  if (req.session.userId) {
    user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.json({ success: false, message: '登录已失效，请重新登录' });
    }
  } else {
    const email = normalizeEmail(String(req.body.email || ''));
    if (!validateEmail(email)) {
      return res.json({ success: false, message: '请输入有效的邮箱地址' });
    }
    user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.json({ success: false, message: '该邮箱尚未注册' });
    }
  }

  // 作废旧令牌（保证同一时间只有一个有效链接），再写入新的
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(user.id, hashResetToken(token), expiresAt);

  const resetUrl = `${siteBaseUrl(req)}/reset-password.html?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl, 30);
    res.json({
      success: true,
      message: `密码修改链接已发送至 ${maskEmail(user.email)}，30 分钟内有效`,
    });
  } catch (error) {
    // 发送失败则回收刚写入的令牌，避免留下永远收不到的无效令牌
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    console.error('发送密码修改邮件失败:', error.message);
    res.json({ success: false, message: '发送验证邮件失败，请稍后重试' });
  }
});

// 接口 2：校验令牌是否可用（供 reset-password.html 载入时调用；只返回脱敏邮箱）
app.get('/api/password-reset/verify', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.json({ success: false, message: '缺少验证令牌' });
  }

  const record = findValidResetToken(token);
  if (!record) {
    return res.json({ success: false, message: '链接无效或已过期，请重新申请' });
  }

  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(record.user_id);
  if (!user) {
    return res.json({ success: false, message: '账号不存在' });
  }

  // 只返回脱敏邮箱，不泄露登录名
  res.json({ success: true, email: maskEmail(user.email) });
});

// 接口 3：提交新密码；令牌为单次使用，成功后撤销全部会话并发送"已更新"通知邮件
app.post('/api/password-reset/confirm', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');

  if (!token) {
    return res.json({ success: false, message: '缺少验证令牌' });
  }
  if (!password || password.length < 8) {
    return res.json({ success: false, message: '密码至少为8位字符' });
  }

  const record = findValidResetToken(token);
  if (!record) {
    return res.json({ success: false, message: '链接无效或已过期，请重新申请' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(record.user_id);
  if (!user) {
    return res.json({ success: false, message: '账号不存在' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

  // 令牌单次使用：标记已用，同时清掉该用户其余令牌（防止重复发链接失效不彻底）
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(new Date().toISOString(), record.id);
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND id != ?').run(user.id, record.id);

  // 安全收尾：清除登录失败锁定，撤销全部设备会话（强制用新密码重新登录）
  clearLoginFail(user.email);
  db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ?').run(user.id);

  try {
    await sendPasswordChangedEmail(user.email);
  } catch (error) {
    console.error('发送密码更新通知邮件失败:', error.message);
  }

  res.json({ success: true, message: '密码修改成功，请使用新密码登录' });
});

// 发送邮箱登录验证码
app.post('/api/send-login-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: false, message: '该邮箱尚未注册' });
  }

  try {
    await issueVerificationCode(email, 'login');
    res.json({ success: true, message: '登录验证码已发送' });
  } catch (error) {
    console.error('发送登录邮件失败:', error);
    res.json({ success: false, message: '发送验证码失败，请稍后重试' });
  }
});

// 发送密码重置验证码
app.post('/api/send-reset-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: false, message: '该邮箱尚未注册' });
  }

  try {
    await issueVerificationCode(email, 'reset');
    res.json({ success: true, message: '重置验证码已发送' });
  } catch (error) {
    console.error('发送重置邮件失败:', error);
    res.json({ success: false, message: '发送验证码失败，请稍后重试' });
  }
});

// 重置密码
app.post('/api/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim().toUpperCase();
  const password = String(req.body.password || '');

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  if (!code || code.length < 4) {
    return res.json({ success: false, message: '验证码格式不正确' });
  }

  if (!password || password.trim().length < 8) {
    return res.json({ success: false, message: '密码至少为8位字符' });
  }

  const verification = db.prepare(`\n    SELECT id FROM verification_codes\n    WHERE email = ? AND code = ? AND purpose = 'reset' AND expires_at > ?\n    ORDER BY created_at DESC LIMIT 1\n  `).get(email, code, new Date().toISOString());
  if (!verification) {
    return res.json({ success: false, message: '验证码无效或已过期' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
  db.prepare('DELETE FROM verification_codes WHERE email = ? AND purpose = ?').run(email, 'reset');
  // 清除登录失败记录并撤销其他会话
  clearLoginFail(email);
  db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ?').run(user.id);

  res.json({ success: true, message: '密码重置成功' });
});

// 注册
app.post('/api/register', async (req, res) => {
  const registrationData = validateRegistrationInput({
    username: req.body.username,
    email: req.body.email,
    code: req.body.code,
    password: req.body.password,
  });

  if (!registrationData.valid) {
    return res.json({ success: false, message: registrationData.message });
  }

  const { username, email, code, password } = registrationData;

  const verification = db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND purpose = 'register' AND expires_at > ?")
    .get(email, code.toUpperCase(), new Date().toISOString());

  if (!verification) {
    return res.json({ success: false, message: '验证码无效或已过期' });
  }

  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.json({ success: false, message: '该邮箱已注册' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (email, password, username) VALUES (?, ?, ?)')
    .run(email, hashedPassword, username);

  db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);

  res.json({ success: true, message: '注册成功' });
});

// 登录
app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const remember = Boolean(req.body.remember);

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  // 检查是否被锁定
  const lock = checkLoginLock(email);
  if (lock && lock.locked) {
    return res.json({ success: false, message: `登录失败次数过多，账号已锁定 ${lock.remaining} 分钟` });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    recordLoginFail(email);
    return res.json({ success: false, message: '邮箱未注册或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    recordLoginFail(email);
    return res.json({ success: false, message: '邮箱未注册或密码错误' });
  }

  clearLoginFail(email);
  req.session.userId = user.id;
  registerSession(req, remember);
  res.json({ success: true, message: '登录成功', username: user.username });
});

// 使用邮箱验证码登录
app.post('/api/login-code', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim().toUpperCase();
  const remember = Boolean(req.body.remember);

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: false, message: '该邮箱尚未注册' });
  }

  const verification = db.prepare(`\n    SELECT id FROM verification_codes\n    WHERE email = ? AND code = ? AND purpose = 'login' AND expires_at > ?\n    ORDER BY created_at DESC LIMIT 1\n  `).get(email, code, new Date().toISOString());
  if (!verification) {
    return res.json({ success: false, message: '验证码无效或已过期' });
  }

  req.session.userId = user.id;
  registerSession(req, remember);
  db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
  res.json({ success: true, message: '登录成功', username: user.username });
});

// 获取文章列表
app.get('/api/posts', (req, res) => {
  const { limit, sort } = listOptions(req);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const userFilter = userId ? 'WHERE p.user_id = ?' : '';
  const bindVars = userId ? [userId, limit] : [limit];
  const orderBy = sort === 'hot'
    ? 'p.view_count DESC, comment_count DESC, p.created_at DESC'
    : 'p.created_at DESC';
  const posts = db.prepare(`\n    SELECT p.*, u.username, u.avatar_filename,\n      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,\n      ${req.session.userId ? `(SELECT COUNT(*) FROM favorites WHERE user_id = ? AND content_type = 'post' AND content_id = p.id) AS favorited` : '0 AS favorited'}\n    FROM posts p \n    JOIN users u ON p.user_id = u.id \n    ${userFilter}\n    ORDER BY ${orderBy}\n    LIMIT ?\n  `).all(...(req.session.userId ? [req.session.userId, ...bindVars] : bindVars));
  res.json(posts.map(post => ({ ...post, avatarUrl: avatarUrl(post.avatar_filename) })));
});

app.get('/api/posts/:id', (req, res) => {
  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  const post = db.prepare(`\n    SELECT p.id, p.user_id, p.title, p.content, p.view_count, p.created_at, u.username, u.avatar_filename\n    FROM posts p\n    JOIN users u ON u.id = p.user_id\n    WHERE p.id = ?\n  `).get(req.params.id);

  if (!post) return res.status(404).json({ success: false, message: '文章不存在' });
  if (req.session.userId) recordView(req.session.userId, 'post', post.id);
  res.json({ ...post, avatarUrl: avatarUrl(post.avatar_filename), favorited: checkFavorited(req.session.userId, 'post', post.id), favorite_count: countFavorites('post', post.id) });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`\n    SELECT c.id, c.user_id, c.content, c.created_at, c.reply_to, u.username, u.avatar_filename,\n      r.username AS reply_to_username,\n      (SELECT COUNT(*) FROM post_comment_likes WHERE comment_id = c.id) AS like_count,\n      CASE WHEN ? IS NOT NULL AND EXISTS (\n        SELECT 1 FROM post_comment_likes WHERE comment_id = c.id AND user_id = ?\n      ) THEN 1 ELSE 0 END AS liked\n    FROM post_comments c\n    JOIN users u ON u.id = c.user_id\n    LEFT JOIN users r ON r.id = c.reply_to\n    WHERE c.post_id = ?\n    ORDER BY c.created_at ASC\n  `).all(req.session.userId || null, req.session.userId || null, req.params.id);
  res.json(comments.map(comment => ({ ...comment, avatarUrl: avatarUrl(comment.avatar_filename), liked: Boolean(comment.liked) })));
});

app.post('/api/posts/:id/comments', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(req.params.id);
  const content = String(req.body.content || '').trim();
  let replyTo = Number(req.body.replyTo) || null;
  if (!post) return res.json({ success: false, message: '文章不存在' });
  if (!content) return res.json({ success: false, message: '评论内容不能为空' });
  if (content.length > 500) return res.json({ success: false, message: '评论不能超过500字' });

  if (replyTo) {
    const parent = db.prepare('SELECT id, user_id FROM post_comments WHERE id = ? AND post_id = ?').get(replyTo, post.id);
    if (!parent) replyTo = null;
    else replyTo = parent.id;
  }

  const info = db.prepare('INSERT INTO post_comments (post_id, user_id, content, reply_to) VALUES (?, ?, ?, ?)')
    .run(post.id, req.session.userId, content, replyTo);

  // 通知文章作者
  createNotification(post.user_id, req.session.userId, 'comment', 'post', post.id,
    content.slice(0, 100), `/detail.html?type=post&id=${post.id}`);
  // 通知@提及的用户
  notifyMentions(content, req.session.userId, post.user_id, 'post', post.id, `/detail.html?type=post&id=${post.id}`);

  res.json({ success: true, message: '评论成功' });
});

app.post('/api/posts/comments/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const comment = db.prepare('SELECT id, user_id FROM post_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.json({ success: false, message: '评论不存在' });

  const existing = db.prepare('SELECT 1 FROM post_comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(comment.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM post_comment_likes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO post_comment_likes (comment_id, user_id) VALUES (?, ?)').run(comment.id, req.session.userId);
    createNotification(comment.user_id, req.session.userId, 'comment_like', 'post', comment.id, null, null);
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM post_comment_likes WHERE comment_id = ?').get(comment.id).count;
  res.json({ success: true, liked: !existing, likeCount });
});

// 发布文章
app.post('/api/posts', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const validation = validatePostInput({
    title: req.body.title,
    content: req.body.content,
  });

  if (!validation.valid) {
    return res.json({ success: false, message: validation.message });
  }

  db.prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)')
    .run(req.session.userId, validation.title, validation.content);
  res.json({ success: true, message: '发布成功' });
});

// 获取当前用户发布的文章
app.get('/api/my-posts', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const posts = db.prepare(`
    SELECT p.id, p.title, p.content, p.created_at, u.username, u.avatar_filename
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.session.userId);

  res.json({ success: true, posts: posts.map(post => ({ ...post, avatarUrl: avatarUrl(post.avatar_filename) })) });
});

app.get('/api/my-submissions', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const userId = req.session.userId;
  const posts = db.prepare(`
    SELECT p.id, p.title, p.content AS summary, p.created_at, p.view_count, 'post' AS type
    FROM posts p WHERE p.user_id = ? ORDER BY p.created_at DESC
  `).all(userId);
  const videos = db.prepare(`
    SELECT v.id, v.title, v.title AS summary, v.created_at, v.view_count, 'video' AS type,
      v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist
    FROM videos v WHERE v.user_id = ? ORDER BY v.created_at DESC
  `).all(userId).map(video => ({
    ...video,
    mp4Url: mediaUrl(video.mp4_filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
  }));
  const files = db.prepare(`
    SELECT f.id, f.title, f.original_name AS summary, f.created_at, f.download_count, 'file' AS type
    FROM files f WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).all(userId);
  res.json({ success: true, posts, videos, files });
});

// 获取文件列表
app.get('/api/files', (req, res) => {
  const { limit, sort } = listOptions(req);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const orderBy = sort === 'hot' ? 'f.download_count DESC, f.created_at DESC' : 'f.created_at DESC';
  const userFilter = userId ? 'WHERE f.user_id = ?' : '';
  const bindVars = userId ? [userId, limit] : [limit];
  const files = db.prepare(`\n    SELECT f.id, f.user_id, f.title, f.filename, f.original_name, f.mime_type, f.file_size, f.password_hash, f.download_count, f.created_at, f.thumbnail,\n      u.username, u.avatar_filename,\n      ${req.session.userId ? `(SELECT COUNT(*) FROM favorites WHERE user_id = ? AND content_type = 'file' AND content_id = f.id) AS favorited` : '0 AS favorited'}\n    FROM files f\n    JOIN users u ON u.id = f.user_id\n    ${userFilter}\n    ORDER BY ${orderBy}\n    LIMIT ?\n  `).all(...(req.session.userId ? [req.session.userId, ...bindVars] : bindVars));

  res.json(files.map(file => ({
    passwordProtected: Boolean(file.password_hash),
    id: file.id,
    user_id: file.user_id,
    title: file.title,
    original_name: file.original_name,
    mime_type: file.mime_type,
    file_size: file.file_size,
    download_count: file.download_count,
    created_at: file.created_at,
    username: file.username,
    avatarUrl: avatarUrl(file.avatar_filename),
    thumbnailUrl: getThumbnailUrl(file.thumbnail),
    rawUrl: `/api/files/${file.id}/raw`,
    owner: req.session.userId === file.user_id,
    favorited: req.session.userId ? Boolean(file.favorited) : 0,
    downloadUrl: req.session.userId === file.user_id || !file.password_hash
      ? `/api/files/${file.id}/download`
      : null,
  })));
});

// ===== 首页热门文件：一次上传 = 一个批次（batch_id）= 一张卡片 =====

// 历史数据没有 batch_id，按"单文件即独立批次"兼容。
// 注意：别名不能叫 batch_id，否则会与 files.batch_id 同名列冲突（SQLite 优先取真实列，导致所有 NULL 行被并成一批）
const BATCH_KEY_SQL = "COALESCE(f.batch_id, 'legacy-' || f.id)";

// 批次热度指标：下载量 / 浏览量 / 收藏数按批次求和后算出热度
function loadBatchSummaries() {
  const rows = db.prepare(`
    SELECT ${BATCH_KEY_SQL} AS batch_key,
      COUNT(*) AS total,
      SUM(f.download_count) AS download_count,
      SUM(f.view_count) AS view_count,
      SUM(CASE WHEN f.password_hash IS NOT NULL THEN 1 ELSE 0 END) AS protected_count,
      MAX(f.created_at) AS created_at,
      MAX(f.user_id) AS user_id
    FROM files f
    GROUP BY ${BATCH_KEY_SQL}
  `).all();

  // 收藏表按 content_id 指向具体文件，这里归并到所属批次
  const favoriteRows = db.prepare(`
    SELECT ${BATCH_KEY_SQL} AS batch_key, COUNT(*) AS favorite_count
    FROM favorites fav
    JOIN files f ON f.id = fav.content_id
    WHERE fav.content_type = 'file'
    GROUP BY ${BATCH_KEY_SQL}
  `).all();
  const favoriteByBatch = new Map(favoriteRows.map(row => [row.batch_key, row.favorite_count]));

  return rows.map(row => {
    const favoriteCount = favoriteByBatch.get(row.batch_key) || 0;
    return {
      ...row,
      favorite_count: favoriteCount,
      heat: FileCardLogic.computeFileHeat({
        downloadCount: row.download_count,
        favoriteCount,
        viewCount: row.view_count,
      }),
    };
  });
}

// 批次内容：图片九宫格 / 音频播放器 / 其他文件列表
function loadBatchContents(batchIds) {
  const contents = new Map();
  if (!batchIds.length) return contents;

  const placeholders = batchIds.map(() => '?').join(',');
  const files = db.prepare(`
    SELECT f.id, f.user_id, f.title, f.original_name, f.mime_type, f.file_size,
      f.password_hash, f.download_count, f.created_at, f.thumbnail,
      ${BATCH_KEY_SQL} AS batch_key,
      u.username, u.avatar_filename
    FROM files f
    JOIN users u ON u.id = f.user_id
    WHERE ${BATCH_KEY_SQL} IN (${placeholders})
    ORDER BY batch_key, (f.batch_index IS NULL), f.batch_index, f.id
  `).all(...batchIds);

  files.forEach(file => {
    let content = contents.get(file.batch_key);
    if (!content) {
      content = {
        title: file.title,
        user_id: file.user_id,
        username: file.username,
        avatarUrl: avatarUrl(file.avatar_filename),
        images: [],
        audios: [],
        others: [],
      };
      contents.set(file.batch_key, content);
    }

    const protectedByPassword = Boolean(file.password_hash);
    const item = {
      id: file.id,
      title: file.title,
      original_name: file.original_name,
      mime_type: file.mime_type,
      file_size: file.file_size,
      download_count: file.download_count,
      thumbnailUrl: getThumbnailUrl(file.thumbnail),
      rawUrl: `/api/files/${file.id}/raw`,
      // 加密文件需要先验密码，这里不给直链
      downloadUrl: protectedByPassword ? null : `/api/files/${file.id}/download`,
      passwordProtected: protectedByPassword,
    };

    if (isImageMime(file.mime_type)) content.images.push(item);
    else if (isAudioMime(file.mime_type)) content.audios.push(item);
    else content.others.push(item);
  });

  return contents;
}

// 把批次热度行 + 批次内容组装成前端卡片所需的结构
function buildBatchPayload(row, content) {
  return {
    batchId: row.batch_key,
    user_id: row.user_id,
    username: (content && content.username) || '',
    avatarUrl: (content && content.avatarUrl) || null,
    created_at: row.created_at,
    title: (content && content.title) || '未命名文件',
    total: row.total,
    passwordProtected: row.protected_count > 0,
    download_count: row.download_count,
    view_count: row.view_count,
    favorite_count: row.favorite_count,
    heat: row.heat,
    images: (content && content.images) || [],
    audios: (content && content.audios) || [],
    others: (content && content.others) || [],
  };
}

// 热门文件列表：按热度降序（热度相同按上传时间降序），支持 offset/limit 分页供滚动加载
app.get('/api/file-batches', (req, res) => {
  const { limit } = listOptions(req, 8, 50);
  const offset = offsetOption(req);

  const summaries = loadBatchSummaries().sort(FileCardLogic.compareFileBatches);
  const page = summaries.slice(offset, offset + limit);
  const contents = loadBatchContents(page.map(row => row.batch_key));

  res.json({
    batches: page.map(row => buildBatchPayload(row, contents.get(row.batch_key))),
    total: summaries.length,
    offset,
    limit,
    hasMore: offset + page.length < summaries.length,
  });
});

// 单个批次详情：详情页按 batchId 精确拉取，避免全量拉取后再在前端筛选
app.get('/api/file-batches/:batchId', (req, res) => {
  const row = loadBatchSummaries().find(item => item.batch_key === req.params.batchId);
  if (!row) {
    return res.status(404).json({ success: false, message: '批次不存在或已被删除' });
  }

  const content = loadBatchContents([row.batch_key]).get(row.batch_key);
  res.json(buildBatchPayload(row, content));
});

app.get('/api/files/:id', (req, res) => {
  const file = db.prepare(`\n        SELECT f.id, f.user_id, f.title, f.original_name, f.mime_type, f.file_size, f.password_hash, f.download_count, f.created_at,\n          u.username, u.avatar_filename\n    FROM files f\n    JOIN users u ON u.id = f.user_id\n    WHERE f.id = ?\n  `).get(req.params.id);

  if (!file) return res.status(404).json({ success: false, message: '文件不存在' });
  if (req.session.userId) recordView(req.session.userId, 'file', file.id);
  res.json({
    id: file.id,
    user_id: file.user_id,
    title: file.title,
    original_name: file.original_name,
    mime_type: file.mime_type,
    file_size: file.file_size,
    download_count: file.download_count,
    created_at: file.created_at,
    username: file.username,
    avatarUrl: avatarUrl(file.avatar_filename),
    protected: Boolean(file.password_hash),
    owner: req.session.userId === file.user_id,
    favorited: checkFavorited(req.session.userId, 'file', file.id),
    favorite_count: countFavorites('file', file.id),
    downloadUrl: req.session.userId === file.user_id || !file.password_hash
      ? `/api/files/${file.id}/download`
      : null,
  });
});

app.post('/api/files/:id/verify', async (req, res) => {
  const file = db.prepare('SELECT id, user_id, password_hash FROM files WHERE id = ?').get(req.params.id);
  if (!file) {
    return res.json({ success: false, message: '文件不存在' });
  }

  if (!file.password_hash || file.user_id === req.session.userId) {
    return res.json({ success: true, message: '无需密码' });
  }

  const password = String(req.body.password || '');
  const valid = await bcrypt.compare(password, file.password_hash);
  return res.json({ success: valid, message: valid ? '密码正确' : '文件密码错误' });
});

app.get('/api/files/:id/download', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  const isOwner = req.session.userId && req.session.userId === file.user_id;
  const password = String(req.query.password || '');
  const passwordValid = !file.password_hash || isOwner || bcrypt.compareSync(password, file.password_hash);

  if (file.password_hash && !isOwner && !passwordValid) {
    return res.status(403).json({ success: false, message: '需要输入正确的文件密码' });
  }

  const filePath = path.join(fileDirectory, file.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在或已被删除' });
  }

  db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?').run(file.id);
  res.download(filePath, file.original_name || file.filename, {
    headers: { 'Content-Type': file.mime_type || 'application/octet-stream' },
  });
});

// 内联返回原文件（不触发下载），用于看原图与音频播放
app.get('/api/files/:id/raw', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  const isOwner = req.session.userId && req.session.userId === file.user_id;
  const password = String(req.query.password || '');
  const canView = !file.password_hash || isOwner || bcrypt.compareSync(password, file.password_hash);
  if (!canView) {
    return res.status(403).json({ success: false, message: '需要输入正确的文件密码' });
  }

  const filePath = path.join(fileDirectory, file.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在或已被删除' });
  }

  // 浏览量用于热门文件的热度计算；Range 请求来自音频预加载/拖动进度，不计入
  if (!req.headers.range) {
    db.prepare('UPDATE files SET view_count = view_count + 1 WHERE id = ?').run(file.id);
  }

  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
});

app.post('/api/files', fileUploadFields, async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const uploadedFiles = (req.files && req.files.files) || [];
  const uploadedThumbs = (req.files && req.files.thumbnails) || [];
  const rejectedFiles = req.rejectedFiles || [];

  if (uploadedFiles.length === 0 && rejectedFiles.length === 0) {
    return res.json({ success: false, message: '请选择要上传的文件' });
  }

  if (uploadedFiles.length === 0) {
    // 全部被格式校验拦下
    return res.json({
      success: false,
      message: `共 ${rejectedFiles.length} 个文件格式不被支持`,
      files: [],
      rejected: rejectedFiles,
    });
  }

  // 批次统一标题：留空则逐个使用"去掉扩展名的原文件名"
  const batchTitle = String(req.body.title || '').trim();
  const password = String(req.body.password || '').trim();
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  // 前端用 thumbnailIndexes 告诉后端"第几个文件带缩略图"，形如 "0,3,5"
  const thumbnailIndexes = String(req.body.thumbnailIndexes || '')
    .split(',')
    .map(item => Number.parseInt(item, 10))
    .filter(item => Number.isInteger(item) && item >= 0);

  // 一次上传共用一个批次 ID，首页据此聚合为一张卡片
  const batchId = crypto.randomBytes(12).toString('hex');

  const insert = db.prepare(`
    INSERT INTO files (user_id, title, filename, original_name, mime_type, file_size, password_hash, thumbnail, batch_id, batch_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertedFiles = [];
  const insertAll = db.transaction(() => {
    uploadedFiles.forEach((file, index) => {
      const thumbPosition = thumbnailIndexes.indexOf(index);
      const thumbnailFilename = thumbPosition === -1 ? null : (uploadedThumbs[thumbPosition] ? uploadedThumbs[thumbPosition].filename : null);
      const title = batchTitle || path.parse(file.originalname).name || '未命名文件';

      const result = insert.run(
        req.session.userId,
        title,
        file.filename,
        file.originalname,
        file.mimetype || 'application/octet-stream',
        file.size,
        passwordHash,
        thumbnailFilename,
        batchId,
        index,
      );

      insertedFiles.push({
        id: Number(result.lastInsertRowid),
        title,
        original_name: file.originalname,
        mime_type: file.mimetype || 'application/octet-stream',
        file_size: file.size,
        thumbnailUrl: getThumbnailUrl(thumbnailFilename),
        rawUrl: `/api/files/${result.lastInsertRowid}/raw`,
        passwordProtected: Boolean(passwordHash),
      });
    });
  });

  insertAll();

  const parts = [`成功上传 ${insertedFiles.length} 个文件`];
  if (password) parts.push('已开启密码保护');
  if (rejectedFiles.length) parts.push(`${rejectedFiles.length} 个文件因格式不支持被跳过`);

  res.json({
    success: true,
    message: parts.join('，'),
    batchId,
    files: insertedFiles,
    rejected: rejectedFiles,
  });
});

app.delete('/api/files/:id', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const file = db.prepare('SELECT filename FROM files WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!file) {
    return res.json({ success: false, message: '文件不存在或无权删除' });
  }

  db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  fs.unlinkSync(path.join(fileDirectory, file.filename));
  res.json({ success: true, message: '文件已删除' });
});

// ===== 预下载文件库（云盘式空间，200MB 配额）=====

// 上传到预下载库（独立目录，不做上传文件库的格式校验，仅校验配额）
app.post('/api/pre-files', preFileUploadField, (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const uploadedFiles = req.files || [];
  if (!uploadedFiles.length) {
    return res.json({ success: false, message: '请选择要存入预下载库的文件' });
  }

  const userId = req.session.userId;
  const used = preFileUsage(userId);
  const totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

  // 配额预检：超出则整体拒绝，并清理本次已落盘的文件
  if (used + totalSize > PRE_FILE_QUOTA_BYTES) {
    uploadedFiles.forEach(item => {
      try { fs.rmSync(item.path, { force: true }); } catch (cleanupError) { /* 忽略清理失败 */ }
    });
    const remaining = PRE_FILE_QUOTA_BYTES - used;
    return res.json({
      success: false,
      message: `超出预下载库容量上限（200MB），剩余可用 ${Math.max(remaining, 0) >= 0 ? formatHumanBytes(remaining) : '0 B'}`,
    });
  }

  const insert = db.prepare(`
    INSERT INTO pre_files (user_id, filename, original_name, mime_type, file_size)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertedFiles = [];
  const insertAll = db.transaction(() => {
    uploadedFiles.forEach(file => {
      const result = insert.run(userId, file.filename, file.originalname, file.mimetype || 'application/octet-stream', file.size);
      insertedFiles.push(preFileRowPayload({
        id: Number(result.lastInsertRowid),
        original_name: file.originalname,
        mime_type: file.mimetype || 'application/octet-stream',
        file_size: file.size,
        created_at: new Date().toISOString(),
      }));
    });
  });
  insertAll();

  res.json({
    success: true,
    message: `已存入预下载库 ${insertedFiles.length} 个文件`,
    files: insertedFiles,
    used: preFileUsage(userId),
    quota: PRE_FILE_QUOTA_BYTES,
  });
});

// 列出当前用户的预下载库 + 用量/配额
app.get('/api/pre-files', (req, res) => {
  if (!req.session.userId) {
    return res.json({ files: [], used: 0, quota: PRE_FILE_QUOTA_BYTES });
  }

  const rows = db.prepare('SELECT * FROM pre_files WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(req.session.userId);
  res.json({
    files: rows.map(preFileRowPayload),
    used: preFileUsage(req.session.userId),
    quota: PRE_FILE_QUOTA_BYTES,
  });
});

// 单个预下载文件：下载（触发浏览器下载）
app.get('/api/pre-files/:id/download', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const file = db.prepare('SELECT * FROM pre_files WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!file) {
    return res.status(404).json({ success: false, message: '文件不存在或无权访问' });
  }

  const filePath = path.join(preFileDirectory, file.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: '文件不存在或已被删除' });
  }

  res.download(filePath, file.original_name || file.filename, {
    headers: { 'Content-Type': file.mime_type || 'application/octet-stream' },
  });
});

// 批量下载：把指定 id 的预下载文件打包为 ZIP（store 方法，前端无需额外依赖）
app.get('/api/pre-files/zip', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const ids = String(req.query.ids || '').split(',').map(item => Number.parseInt(item.trim(), 10)).filter(Number.isInteger);
  if (!ids.length) {
    return res.json({ success: false, message: '请至少选择一个文件' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM pre_files WHERE user_id = ? AND id IN (${placeholders})`).all(req.session.userId, ...ids);
  if (!rows.length) {
    return res.status(404).json({ success: false, message: '文件不存在或无权访问' });
  }

  // 复用前端同款 ZIP 组装逻辑不可行（服务端无 DataView 打包工具则需手写），
  // 这里用最简 store 方式直接拼二进制，避免引入新依赖。
  const entries = [];
  const central = [];
  let offset = 0;
  const utf8 = text => Buffer.from(text, 'utf8');

  // CRC-32（与前端一致，逐字节计算）
  let crcTable = crc32Table;
  if (!crcTable) {
    crcTable = crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[i] = value >>> 0;
    }
  }
  const crcOf = buffer => {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) {
      crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const dosTime = date => {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const yearPart = (Math.max(1980, date.getFullYear()) - 1980) << 9;
    return ((yearPart | (date.getMonth() + 1) << 5 | date.getDate()) << 16) | time;
  };

  const chunks = [];

  rows.forEach(file => {
    const filePath = path.join(preFileDirectory, file.filename);
    if (!fs.existsSync(filePath)) return;
    const data = fs.readFileSync(filePath);
    const nameBytes = utf8(file.original_name || file.filename);
    const crc = crcOf(data);
    const dos = dosTime(new Date(file.created_at || Date.now()));
    const flagBits = 0x08;

    const header = Buffer.alloc(30 + nameBytes.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(flagBits, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(dos & 0xffff, 10);
    header.writeUInt16LE((dos >>> 16) & 0xffff, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    nameBytes.copy(header, 30);

    chunks.push(header, data);

    const centralRecord = Buffer.alloc(46 + nameBytes.length);
    centralRecord.writeUInt32LE(0x02014b50, 0);
    centralRecord.writeUInt16LE(20, 4);
    centralRecord.writeUInt16LE(20, 6);
    centralRecord.writeUInt16LE(0, 8);
    centralRecord.writeUInt16LE(flagBits, 10);
    centralRecord.writeUInt16LE(0, 12);
    centralRecord.writeUInt16LE(0, 14);
    centralRecord.writeUInt32LE(crc, 16);
    centralRecord.writeUInt32LE(data.length, 20);
    centralRecord.writeUInt32LE(data.length, 24);
    centralRecord.writeUInt16LE(nameBytes.length, 28);
    centralRecord.writeUInt16LE(0, 30);
    centralRecord.writeUInt16LE(0, 32);
    centralRecord.writeUInt16LE(0, 34);
    centralRecord.writeUInt16LE(0, 36);
    centralRecord.writeUInt32LE(0, 38);
    centralRecord.writeUInt32LE(offset, 42);
    nameBytes.copy(centralRecord, 46);

    central.push(centralRecord);
    offset += header.length + data.length;
  });

  const centralSize = central.reduce((sum, record) => sum + record.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const zipBuffer = Buffer.concat([...chunks, ...central, eocd]);
  const zipName = `pre-files-${Date.now()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);
  res.send(zipBuffer);
});

// 单个删除
app.delete('/api/pre-files/:id', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const file = db.prepare('SELECT filename FROM pre_files WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!file) {
    return res.status(404).json({ success: false, message: '文件不存在或无权删除' });
  }

  db.prepare('DELETE FROM pre_files WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  try { fs.unlinkSync(path.join(preFileDirectory, file.filename)); } catch (cleanupError) { /* 忽略清理失败 */ }
  res.json({ success: true, message: '文件已删除' });
});

// 批量删除
app.delete('/api/pre-files', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const ids = Array.isArray(req.body.ids)
    ? req.body.ids.map(item => Number.parseInt(item, 10)).filter(Number.isInteger)
    : [];
  if (!ids.length) {
    return res.json({ success: false, message: '请至少选择一个文件' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, filename FROM pre_files WHERE user_id = ? AND id IN (${placeholders})`).all(req.session.userId, ...ids);
  if (!rows.length) {
    return res.status(404).json({ success: false, message: '文件不存在或无权删除' });
  }

  const deleteAll = db.transaction(() => {
    rows.forEach(row => {
      db.prepare('DELETE FROM pre_files WHERE id = ? AND user_id = ?').run(row.id, req.session.userId);
      try { fs.unlinkSync(path.join(preFileDirectory, row.filename)); } catch (cleanupError) { /* 忽略清理失败 */ }
    });
  });
  deleteAll();

  res.json({ success: true, message: `已删除 ${rows.length} 个文件` });
});

// 我的上传文件库：按批次（一次上传 = 一张卡片）聚合当前登录用户自己的文件
app.get('/api/my-file-batches', (req, res) => {
  if (!req.session.userId) {
    return res.json({ batches: [] });
  }

  // 该用户所有文件按批次键聚合（无 batch_id 的历史文件视为独立批次）
  const summaries = db.prepare(`
    SELECT ${BATCH_KEY_SQL} AS batch_key,
      COUNT(*) AS total,
      SUM(f.file_size) AS total_size,
      MAX(f.created_at) AS created_at,
      MAX(f.title) AS title
    FROM files f
    WHERE f.user_id = ?
    GROUP BY ${BATCH_KEY_SQL}
    ORDER BY created_at DESC, batch_key DESC
  `).all(req.session.userId);

  if (!summaries.length) {
    return res.json({ batches: [] });
  }

  const batchKeys = summaries.map(row => row.batch_key);
  const placeholders = batchKeys.map(() => '?').join(',');
  const files = db.prepare(`
    SELECT f.id, f.title, f.original_name, f.mime_type, f.file_size, f.password_hash,
      f.created_at, f.thumbnail, ${BATCH_KEY_SQL} AS batch_key
    FROM files f
    WHERE f.user_id = ? AND ${BATCH_KEY_SQL} IN (${placeholders})
    ORDER BY f.created_at, f.id
  `).all(req.session.userId, ...batchKeys);

  const filesByBatch = new Map();
  files.forEach(file => {
    let list = filesByBatch.get(file.batch_key);
    if (!list) {
      list = [];
      filesByBatch.set(file.batch_key, list);
    }
    list.push({
      id: file.id,
      title: file.title,
      original_name: file.original_name,
      mime_type: file.mime_type,
      file_size: file.file_size,
      created_at: file.created_at,
      thumbnailUrl: getThumbnailUrl(file.thumbnail),
      downloadUrl: `/api/files/${file.id}/download`,
      passwordProtected: Boolean(file.password_hash),
    });
  });

  const batches = summaries.map(row => ({
    batchId: row.batch_key,
    title: row.title,
    total: row.total,
    totalSize: Number(row.total_size) || 0,
    createdAt: row.created_at,
    files: filesByBatch.get(row.batch_key) || [],
  }));

  res.json({ batches });
});

app.get('/api/search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.json([]);
  }

  const likeQuery = `%${query}%`;
  const { limit, sort } = listOptions(req);
  const requestedType = ['post', 'video', 'file'].includes(req.query.type) ? req.query.type : null;
  const postOrder = sort === 'hot' ? 'p.view_count DESC, p.created_at DESC' : 'p.created_at DESC';
  const videoOrder = sort === 'hot' ? 'v.view_count DESC, v.created_at DESC' : 'v.created_at DESC';
  const fileOrder = sort === 'hot' ? 'f.download_count DESC, f.created_at DESC' : 'f.created_at DESC';

  const posts = requestedType && requestedType !== 'post' ? [] : db.prepare(`
    SELECT 'post' AS type, p.id, p.title, p.content AS summary, p.created_at, p.user_id, p.view_count, NULL AS download_count, NULL AS filename, NULL AS poster_filename, NULL AS password_hash, u.username, u.avatar_filename
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.title LIKE ? OR p.content LIKE ?
    ORDER BY ${postOrder} LIMIT ?
  `).all(likeQuery, likeQuery, limit);

  const videos = requestedType && requestedType !== 'video' ? [] : db.prepare(`
    SELECT 'video' AS type, v.id, v.title, v.title AS summary, v.created_at, v.user_id, v.view_count, NULL AS download_count, v.filename, v.poster_filename, NULL AS password_hash, u.username, u.avatar_filename
    FROM videos v JOIN users u ON u.id = v.user_id
    WHERE v.title LIKE ?
    ORDER BY ${videoOrder} LIMIT ?
  `).all(likeQuery, limit);

  const files = requestedType && requestedType !== 'file' ? [] : db.prepare(`
    SELECT 'file' AS type, f.id, f.title, f.original_name AS summary, f.created_at, f.user_id, NULL AS view_count, f.download_count, f.filename, NULL AS poster_filename, f.password_hash, u.username, u.avatar_filename
    FROM files f JOIN users u ON u.id = f.user_id
    WHERE f.title LIKE ? OR f.original_name LIKE ?
    ORDER BY ${fileOrder} LIMIT ?
  `).all(likeQuery, likeQuery, limit);

  const results = [...posts, ...videos, ...files].map(item => ({
    ...item,
    avatarUrl: avatarUrl(item.avatar_filename),
    posterUrl: item.type === 'video' ? mediaUrl(item.poster_filename) : null,
    protected: Boolean(item.password_hash),
    password_hash: undefined,
  }));

  res.json(results);
});

app.get('/api/users/search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.json([]);

  const users = db.prepare(`
    SELECT id, username
    FROM users
    WHERE username LIKE ?
    ORDER BY username ASC
    LIMIT 8
  `).all(`%${query}%`);
  res.json(users);
});

// 公开的个人主页信息（他人视角）
app.get('/api/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ success: false, message: '用户不存在' });
  }

  const user = db.prepare(`
    SELECT u.id, u.username, u.bio, u.avatar_filename, u.created_at,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count,
      (SELECT COUNT(*) FROM videos WHERE user_id = u.id) AS video_count,
      (SELECT COUNT(*) FROM files WHERE user_id = u.id) AS file_count,
      (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) AS follower_count,
      (SELECT COUNT(*) FROM follows WHERE user_id = u.id) AS following_count,
      (SELECT COALESCE(SUM(vl_cnt.cnt),0) FROM (
        SELECT COUNT(*) AS cnt FROM video_likes vl JOIN videos v ON v.id = vl.video_id WHERE v.user_id = u.id
      ) AS vl_cnt) AS like_count
    FROM users u WHERE u.id = ?
  `).get(targetId);

  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

  const isFriend = req.session.userId
    ? Boolean(db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?')
      .get(Math.min(req.session.userId, targetId), Math.max(req.session.userId, targetId)))
    : false;
  const isFollowing = req.session.userId
    ? Boolean(db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND followed_id = ?').get(req.session.userId, targetId))
    : false;

  res.json({
    success: true,
    user: { ...user, avatarUrl: avatarUrl(user.avatar_filename) },
    isFriend,
    isFollowing,
    isSelf: req.session.userId === targetId,
  });
});

// 获取公开视频及点赞、评论数量
app.get('/api/videos', (req, res) => {
  const { limit, sort } = listOptions(req);
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const category = req.query.category ? Number(req.query.category) : null;
  const userFilter = userId ? 'AND v.user_id = ?' : '';
  const categoryFilter = category ? 'AND v.category_id = ?' : '';
  // 绑定顺序必须与 SQL 中的占位符顺序一致：收藏子查询、liked 判断、userFilter、categoryFilter、LIMIT
  const bindVars = [
    ...(req.session.userId ? [req.session.userId] : []),
    req.session.userId || null,
    req.session.userId || null,
    ...(userId ? [userId] : []),
    ...(category ? [category] : []),
    limit,
  ];
  const orderBy = sort === 'hot'
    ? 'v.view_count DESC, like_count DESC, comment_count DESC, v.created_at DESC'
    : 'v.created_at DESC';
  const videos = db.prepare(`
    SELECT v.id, v.user_id, v.title, v.filename, v.original_name, v.mime_type, v.source_url,
      v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist, v.view_count, v.created_at,
      v.category_id, vc.name AS category_name,
      u.username, u.avatar_filename,
       (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
       (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count,
       ${req.session.userId ? `(SELECT COUNT(*) FROM favorites WHERE user_id = ? AND content_type = 'video' AND content_id = v.id) AS favorited` : '0 AS favorited'},
       CASE WHEN ? IS NOT NULL AND EXISTS (
         SELECT 1 FROM video_likes WHERE video_id = v.id AND user_id = ?
       ) THEN 1 ELSE 0 END AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN video_categories vc ON vc.id = v.category_id
    WHERE 1=1 ${userFilter} ${categoryFilter}
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(...bindVars);

  res.json(videos.map(video => ({
    ...video,
    url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    mp4Url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
    liked: Boolean(video.liked),
    avatarUrl: avatarUrl(video.avatar_filename),
  })));
});

// 视频分区列表
app.get('/api/videos/categories', (req, res) => {
  const categories = db.prepare('SELECT id, name FROM video_categories ORDER BY id').all();
  res.json(categories);
});

// 首页推荐视频流（播放量加权 + 时间衰减）
app.get('/api/videos/recommend', (req, res) => {
  const { limit } = listOptions(req);
  const category = req.query.category ? Number(req.query.category) : null;
  const categoryFilter = category ? 'AND v.category_id = ?' : '';
  const bindVars = category ? [category, limit] : [limit];
  const videos = db.prepare(`
    SELECT v.id, v.user_id, v.title, v.filename, v.original_name, v.mime_type, v.source_url,
      v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist, v.view_count, v.created_at,
      v.category_id, vc.name AS category_name,
      u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count,
      (CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM video_likes WHERE video_id = v.id AND user_id = ?
      ) THEN 1 ELSE 0 END) AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN video_categories vc ON vc.id = v.category_id
    WHERE 1=1 ${categoryFilter}
    ORDER BY (v.view_count * 1.0 / (julianday('now') - julianday(v.created_at) + 1) + COALESCE((SELECT COUNT(*) FROM video_likes WHERE video_id = v.id),0)) DESC
    LIMIT ?
  `).all(req.session.userId || null, req.session.userId || null, ...bindVars);

  res.json(videos.map(video => ({
    ...video,
    url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    mp4Url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
    liked: Boolean(video.liked),
    avatarUrl: avatarUrl(video.avatar_filename),
  })));
});

app.get('/api/videos/:id', (req, res) => {
  db.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  const video = db.prepare(`
    SELECT v.id, v.user_id, v.title, v.filename, v.original_name, v.mime_type, v.source_url,
      v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist, v.view_count, v.created_at,
      v.category_id, vc.name AS category_name,
      u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM video_likes WHERE video_id = v.id AND user_id = ?
      ) THEN 1 ELSE 0 END AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN video_categories vc ON vc.id = v.category_id
    WHERE v.id = ?
  `).get(req.session.userId || null, req.session.userId || null, req.params.id);

  if (!video) return res.status(404).json({ success: false, message: '视频不存在' });
  if (req.session.userId) recordView(req.session.userId, 'video', video.id);
  res.json({
    ...video,
    url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    mp4Url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
    liked: Boolean(video.liked),
    favorited: checkFavorited(req.session.userId, 'video', video.id),
    favorite_count: countFavorites('video', video.id),
    avatarUrl: avatarUrl(video.avatar_filename),
  });
});

// 上传本地视频或发布外部视频链接
app.post('/api/videos', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  videoUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, async error => {
    if (error) {
      return res.json({ success: false, message: '只支持视频文件' });
    }

    const videoFile = req.files?.video?.[0];
    const coverFile = req.files?.cover?.[0];
    const title = String(req.body.title || '').trim();
    const sourceUrl = String(req.body.videoUrl || '').trim();
    const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null;
    let parsedUrl = null;
    try {
      if (sourceUrl) parsedUrl = new URL(sourceUrl);
    } catch (urlError) {
      if (videoFile) fs.unlinkSync(videoFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.json({ success: false, message: '视频链接格式不正确' });
    }

    if (parsedUrl && !['http:', 'https:'].includes(parsedUrl.protocol)) {
      if (videoFile) fs.unlinkSync(videoFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.json({ success: false, message: '视频链接必须使用 HTTP 或 HTTPS' });
    }

    if (videoFile && parsedUrl) {
      fs.unlinkSync(videoFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.json({ success: false, message: '请在本地文件和视频链接中选择一种发布方式' });
    }

    if (!title || (!videoFile && !parsedUrl)) {
      if (videoFile) fs.unlinkSync(videoFile.path);
      if (coverFile) fs.unlinkSync(coverFile.path);
      return res.json({ success: false, message: '请输入标题，并选择视频文件或填写视频链接' });
    }

    let media = {};
    if (videoFile) {
      try {
        media = await transcodeVideo(videoFile.path, path.parse(videoFile.filename).name);
        fs.rmSync(videoFile.path, { force: true });
        if (coverFile) {
          const coverFilename = `${path.parse(videoFile.filename).name}-cover${path.extname(coverFile.originalname).toLowerCase() || '.jpg'}`;
          fs.renameSync(coverFile.path, path.join(videoDirectory, coverFilename));
          fs.rmSync(path.join(videoDirectory, media.posterFilename), { force: true });
          media.posterFilename = coverFilename;
        }
      } catch (transcodeError) {
        fs.rmSync(videoFile.path, { force: true });
        if (coverFile) fs.rmSync(coverFile.path, { force: true });
        return res.json({ success: false, message: transcodeError.message });
      }
    } else if (coverFile) {
      fs.rmSync(coverFile.path, { force: true });
      return res.json({ success: false, message: '只有上传本地视频时才能设置封面' });
    }

    db.prepare(`
      INSERT INTO videos (user_id, title, filename, original_name, mime_type, source_url, mp4_filename, webm_filename, poster_filename, hls_playlist, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.session.userId,
      title,
      videoFile ? media.mp4Filename : '',
      videoFile ? videoFile.originalname : '',
      videoFile ? videoFile.mimetype : 'video/external',
      parsedUrl ? parsedUrl.toString() : null,
      media.mp4Filename || null,
      media.webmFilename || null,
      media.posterFilename || null,
      media.hlsPlaylist || null,
      categoryId,
    );
    res.json({ success: true, message: parsedUrl ? '视频链接发布成功' : '视频上传并转码成功' });
  });
});

// 发布者删除自己的视频
app.delete('/api/videos/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const video = db.prepare('SELECT filename, mp4_filename, webm_filename, poster_filename, hls_playlist FROM videos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!video) return res.json({ success: false, message: '视频不存在或无权删除' });

  db.prepare('DELETE FROM video_likes WHERE video_id = ?').run(req.params.id);
  db.prepare('DELETE FROM video_comment_likes WHERE comment_id IN (SELECT id FROM video_comments WHERE video_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM video_comments WHERE video_id = ?').run(req.params.id);
  db.prepare('DELETE FROM videos WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  [video.filename, video.mp4_filename, video.webm_filename, video.poster_filename]
    .filter(Boolean)
    .forEach(filename => fs.rmSync(path.join(videoDirectory, filename), { force: true }));
  if (video.hls_playlist) {
    fs.rmSync(path.join(videoDirectory, path.dirname(video.hls_playlist)), { recursive: true, force: true });
  }
  res.json({ success: true, message: '视频已下架' });
});

// ===== 关注系统 =====

// 查询是否已关注 + 粉丝数
app.get('/api/follows/status/:userId', (req, res) => {
  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ success: false, message: '用户不存在' });
  }
  const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId);
  if (!userExists) return res.status(404).json({ success: false, message: '用户不存在' });

  const followerCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followed_id = ?').get(targetId).c;
  const isFollowing = req.session.userId
    ? Boolean(db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND followed_id = ?').get(req.session.userId, targetId))
    : false;

  res.json({ success: true, isFollowing, follower_count: followerCount });
});

// 关注 / 取消关注（toggle）
app.post('/api/follows/:userId', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ success: false, message: '用户不存在' });
  }
  if (targetId === req.session.userId) {
    return res.json({ success: false, message: '不能关注自己' });
  }
  const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId);
  if (!userExists) return res.status(404).json({ success: false, message: '用户不存在' });

  const existing = db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND followed_id = ?').get(req.session.userId, targetId);
  let isFollowing;
  if (existing) {
    db.prepare('DELETE FROM follows WHERE user_id = ? AND followed_id = ?').run(req.session.userId, targetId);
    isFollowing = false;
  } else {
    db.prepare('INSERT INTO follows (user_id, followed_id) VALUES (?, ?)').run(req.session.userId, targetId);
    isFollowing = true;
    createNotification(targetId, req.session.userId, 'follow', null, null, null, `/space.html?user=${req.session.userId}`);
  }

  const followerCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followed_id = ?').get(targetId).c;
  res.json({ success: true, isFollowing, follower_count: followerCount, message: isFollowing ? '关注成功' : '已取消关注' });
});

// 关注动态（已关注用户最新视频流）
app.get('/api/follows', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const { limit } = listOptions(req);
  const videos = db.prepare(`
    SELECT v.id, v.user_id, v.title, v.filename, v.original_name, v.mime_type, v.source_url,
      v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist, v.view_count, v.created_at,
      v.category_id, vc.name AS category_name,
      u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count
    FROM videos v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN video_categories vc ON vc.id = v.category_id
    WHERE v.user_id IN (SELECT followed_id FROM follows WHERE user_id = ?)
    ORDER BY v.created_at DESC
    LIMIT ?
  `).all(req.session.userId, limit);

  res.json(videos.map(video => ({
    ...video,
    url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    mp4Url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
    avatarUrl: avatarUrl(video.avatar_filename),
  })));
});

// ===== 弹幕系统 =====

// 判断用户是否为管理员：users.role 为 admin，或邮箱等于配置的管理员邮箱
function isAdminUser(userId) {
  if (!userId) return false;

  const user = db.prepare('SELECT role, email FROM users WHERE id = ?').get(userId);
  if (!user) return false;

  if (user.role === 'admin') return true;
  return Boolean(config.adminEmail) && normalizeEmail(user.email) === normalizeEmail(config.adminEmail);
}

// 获取视频弹幕
app.get('/api/barrages/:videoId', (req, res) => {
  const videoId = Number(req.params.videoId);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return res.status(400).json({ success: false, message: '视频不存在' });
  }
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const barrages = db.prepare(`
    SELECT b.id, b.user_id, b.content, b.offset_ms, b.color, b.font_size, b.speed, b.created_at, b.updated_at, u.username, u.avatar_filename
    FROM barrages b
    JOIN users u ON u.id = b.user_id
    WHERE b.video_id = ?
    ORDER BY b.offset_ms ASC, b.created_at ASC
    LIMIT ?
  `).all(videoId, limit);

  const viewerId = req.session.userId || null;
  const viewerIsAdmin = isAdminUser(viewerId);

  res.json(barrages.map(b => ({
    ...b,
    avatarUrl: avatarUrl(b.avatar_filename),
    isOwn: viewerId === b.user_id,
    canEdit: viewerId === b.user_id || viewerIsAdmin,
  })));
});

// 发送弹幕
app.post('/api/barrages', barrageLimiter, (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const videoId = Number(req.body.videoId);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return res.status(400).json({ success: false, message: '视频不存在' });
  }

  const result = validateBarrageCreate({
    content: req.body.content,
    offsetMs: req.body.offsetMs,
    color: req.body.color,
    fontSize: req.body.fontSize,
    speed: req.body.speed,
  });
  if (!result.valid) return res.status(400).json({ success: false, message: result.message });

  const videoExists = db.prepare('SELECT 1 FROM videos WHERE id = ?').get(videoId);
  if (!videoExists) return res.status(404).json({ success: false, message: '视频不存在' });

  const info = db.prepare(`
    INSERT INTO barrages (video_id, user_id, content, offset_ms, color, font_size, speed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(videoId, req.session.userId, result.content, result.offsetMs, result.color, result.fontSize, result.speed);

  const barrage = db.prepare(`
    SELECT id, video_id, user_id, content, offset_ms, color, font_size, speed, created_at, updated_at
    FROM barrages WHERE id = ?
  `).get(info.lastInsertRowid);

  res.json({
    success: true,
    message: '弹幕发送成功',
    barrage: {
      ...barrage,
      isOwn: true,
      canEdit: true,
    },
  });
});

// 修改弹幕（仅发送者本人或管理员）
app.patch('/api/barrages/:id', barrageLimiter, (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const barrageId = Number(req.params.id);
  if (!Number.isInteger(barrageId) || barrageId <= 0) {
    return res.status(404).json({ success: false, message: '弹幕不存在' });
  }

  const barrage = db.prepare('SELECT id, user_id FROM barrages WHERE id = ?').get(barrageId);
  if (!barrage) return res.status(404).json({ success: false, message: '弹幕不存在' });

  const isOwn = req.session.userId === barrage.user_id;
  if (!isOwn && !isAdminUser(req.session.userId)) {
    return res.status(403).json({ success: false, message: '无权修改该弹幕' });
  }

  const result = validateBarrageUpdate({
    content: req.body.content,
    color: req.body.color,
    fontSize: req.body.fontSize,
    speed: req.body.speed,
  });
  if (!result.valid) return res.status(400).json({ success: false, message: result.message });

  // 动态拼 SQL：只更新请求中携带的字段
  const assignments = [];
  const params = [];
  if (result.fields.content !== undefined) {
    assignments.push('content = ?');
    params.push(result.fields.content);
  }
  if (result.fields.color !== undefined) {
    assignments.push('color = ?');
    params.push(result.fields.color);
  }
  if (result.fields.fontSize !== undefined) {
    assignments.push('font_size = ?');
    params.push(result.fields.fontSize);
  }
  if (result.fields.speed !== undefined) {
    assignments.push('speed = ?');
    params.push(result.fields.speed);
  }
  assignments.push('updated_at = ?');
  params.push(utcNow());
  params.push(barrageId);

  db.prepare(`UPDATE barrages SET ${assignments.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare(`
    SELECT b.id, b.user_id, b.content, b.offset_ms, b.color, b.font_size, b.speed, b.created_at, b.updated_at, u.username, u.avatar_filename
    FROM barrages b
    JOIN users u ON u.id = b.user_id
    WHERE b.id = ?
  `).get(barrageId);

  res.json({
    success: true,
    message: '弹幕已更新',
    barrage: {
      ...updated,
      avatarUrl: avatarUrl(updated.avatar_filename),
      isOwn: req.session.userId === updated.user_id,
      canEdit: true,
    },
  });
});

// 删除弹幕（仅发送者本人或管理员，硬删除）
app.delete('/api/barrages/:id', barrageLimiter, (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const barrageId = Number(req.params.id);
  if (!Number.isInteger(barrageId) || barrageId <= 0) {
    return res.status(404).json({ success: false, message: '弹幕不存在' });
  }

  const barrage = db.prepare('SELECT id, user_id FROM barrages WHERE id = ?').get(barrageId);
  if (!barrage) return res.status(404).json({ success: false, message: '弹幕不存在' });

  const isOwn = req.session.userId === barrage.user_id;
  if (!isOwn && !isAdminUser(req.session.userId)) {
    return res.status(403).json({ success: false, message: '无权删除该弹幕' });
  }

  db.prepare('DELETE FROM barrages WHERE id = ?').run(barrageId);

  res.json({ success: true, message: '弹幕已删除' });
});

// 登录用户点赞或取消点赞
app.post('/api/videos/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const video = db.prepare('SELECT id, user_id FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.json({ success: false, message: '视频不存在' });

  const existing = db.prepare('SELECT 1 FROM video_likes WHERE video_id = ? AND user_id = ?')
    .get(video.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM video_likes WHERE video_id = ? AND user_id = ?').run(video.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO video_likes (video_id, user_id) VALUES (?, ?)').run(video.id, req.session.userId);
    createNotification(video.user_id, req.session.userId, 'like', 'video', video.id, null, `/detail.html?type=video&id=${video.id}`);
  }

  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM video_likes WHERE video_id = ?').get(video.id).count;
  res.json({ success: true, liked: !existing, likeCount });
});

// 获取视频评论
app.get('/api/videos/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.id, c.user_id, c.content, c.created_at, c.reply_to, u.username, u.avatar_filename,
      r.username AS reply_to_username,
      (SELECT COUNT(*) FROM video_comment_likes WHERE comment_id = c.id) AS like_count,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM video_comment_likes WHERE comment_id = c.id AND user_id = ?
      ) THEN 1 ELSE 0 END AS liked
    FROM video_comments c JOIN users u ON u.id = c.user_id
    LEFT JOIN users r ON r.id = c.reply_to
    WHERE c.video_id = ? ORDER BY c.created_at ASC
  `).all(req.session.userId || null, req.session.userId || null, req.params.id);
  res.json(comments.map(comment => ({ ...comment, avatarUrl: avatarUrl(comment.avatar_filename), liked: Boolean(comment.liked) })));
});

app.post('/api/videos/comments/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const comment = db.prepare('SELECT id, user_id FROM video_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.json({ success: false, message: '评论不存在' });

  const existing = db.prepare('SELECT 1 FROM video_comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(comment.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM video_comment_likes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO video_comment_likes (comment_id, user_id) VALUES (?, ?)').run(comment.id, req.session.userId);
    createNotification(comment.user_id, req.session.userId, 'comment_like', 'video', comment.id, null, null);
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM video_comment_likes WHERE comment_id = ?').get(comment.id).count;
  res.json({ success: true, liked: !existing, likeCount });
});

// 登录用户发表视频评论
app.post('/api/videos/:id/comments', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const video = db.prepare('SELECT id, user_id FROM videos WHERE id = ?').get(req.params.id);
  const content = String(req.body.content || '').trim();
  let replyTo = Number(req.body.replyTo) || null;
  if (!video) return res.json({ success: false, message: '视频不存在' });
  if (!content) return res.json({ success: false, message: '评论内容不能为空' });
  if (content.length > 500) return res.json({ success: false, message: '评论不能超过500字' });

  if (replyTo) {
    const parent = db.prepare('SELECT id, user_id FROM video_comments WHERE id = ? AND video_id = ?').get(replyTo, video.id);
    if (!parent) replyTo = null;
    else replyTo = parent.id;
  }

  db.prepare('INSERT INTO video_comments (video_id, user_id, content, reply_to) VALUES (?, ?, ?, ?)')
    .run(video.id, req.session.userId, content, replyTo);

  // 通知视频作者
  createNotification(video.user_id, req.session.userId, 'comment', 'video', video.id,
    content.slice(0, 100), `/detail.html?type=video&id=${video.id}`);
  // 通知@提及的用户
  notifyMentions(content, req.session.userId, video.user_id, 'video', video.id, `/detail.html?type=video&id=${video.id}`);

  res.json({ success: true, message: '评论成功' });
});

// 修改当前用户自己的文章
app.put('/api/posts/:id', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const validation = validatePostInput({
    title: req.body.title,
    content: req.body.content,
  });

  if (!validation.valid) {
    return res.json({ success: false, message: validation.message });
  }

  const result = db.prepare(`
    UPDATE posts
    SET title = ?, content = ?
    WHERE id = ? AND user_id = ?
  `).run(validation.title, validation.content, req.params.id, req.session.userId);

  if (result.changes === 0) {
    return res.json({ success: false, message: '文章不存在或无权修改' });
  }

  res.json({ success: true, message: '文章已更新' });
});

// 删除当前用户自己的文章
app.delete('/api/posts/:id', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!post) {
    return res.json({ success: false, message: '文章不存在或无权删除' });
  }

  db.prepare('DELETE FROM post_comment_likes WHERE comment_id IN (SELECT id FROM post_comments WHERE post_id = ?)').run(req.params.id);
  db.prepare('DELETE FROM post_comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);

  res.json({ success: true, message: '文章已删除' });
});

// 获取用户信息
app.get('/api/user', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false });
  }

  const user = db.prepare('SELECT id, email, username, bio, avatar_filename, role, created_at FROM users WHERE id = ?').get(req.session.userId);
  res.json({ success: true, user: { ...user, avatarUrl: avatarUrl(user.avatar_filename) } });
});

// 获取当前用户的创作与互动概览统计
app.get('/api/user/stats', (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const userId = req.session.userId;
  const count = (sql, ...params) => db.prepare(sql).get(...params).total;

  const stats = {
    videos: count('SELECT COUNT(*) AS total FROM videos WHERE user_id = ?', userId),
    posts: count('SELECT COUNT(*) AS total FROM posts WHERE user_id = ?', userId),
    files: count('SELECT COUNT(*) AS total FROM files WHERE user_id = ?', userId),
    followers: count('SELECT COUNT(*) AS total FROM follows WHERE followed_id = ?', userId),
    following: count('SELECT COUNT(*) AS total FROM follows WHERE user_id = ?', userId),
    likes: count(
      'SELECT COUNT(*) AS total FROM video_likes JOIN videos ON videos.id = video_likes.video_id WHERE videos.user_id = ?',
      userId
    ),
    favorites: count('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?', userId),
    unreadNotifications: count('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0', userId)
  };

  res.json({ success: true, stats });
});

app.put('/api/user/profile', avatarUpload.single('avatar'), (req, res) => {
  if (!req.session.userId) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.json({ success: false, message: '请先登录' });
  }

  const username = String(req.body.username || '').trim();
  const bio = String(req.body.bio || '').trim();
  if (!username) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.json({ success: false, message: '用户名不能为空' });
  }
  if (username.length > 40 || bio.length > 300) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    return res.json({ success: false, message: '用户名或简介长度超出限制' });
  }

  const current = db.prepare('SELECT avatar_filename FROM users WHERE id = ?').get(req.session.userId);
  const avatarFilename = req.file ? req.file.filename : current.avatar_filename;
  db.prepare('UPDATE users SET username = ?, bio = ?, avatar_filename = ? WHERE id = ?')
    .run(username, bio, avatarFilename, req.session.userId);
    if (req.file && current.avatar_filename) {
    fs.rmSync(path.join(avatarDirectory, current.avatar_filename), { force: true });
  }
  const updatedAvatar = req.file ? req.file.filename : current.avatar_filename;
  res.json({ success: true, message: '个人资料已更新', avatarUrl: avatarUrl(updatedAvatar) });
});

app.put('/api/user/password', async (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!newPassword || newPassword.trim().length < 8) {
    return res.json({ success: false, message: '新密码至少为8位字符' });
  }
  if (newPassword === currentPassword) {
    return res.json({ success: false, message: '新密码不能与当前密码相同' });
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.json({ success: false, message: '当前密码错误' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.session.userId);
  // 修改密码后，撤销全部会话（需要重新登录）
  db.prepare('UPDATE user_sessions SET revoked = 1 WHERE user_id = ?').run(req.session.userId);

  res.json({ success: true, message: '密码已修改，请重新登录' });
});

app.delete('/api/user', async (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT password, avatar_filename FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.json({ success: false, message: '密码错误，无法注销账号' });
  }

  const userId = req.session.userId;
  const files = db.prepare('SELECT filename FROM files WHERE user_id = ?').all(userId);
  const videos = db.prepare('SELECT filename, mp4_filename, webm_filename, poster_filename, hls_playlist FROM videos WHERE user_id = ?').all(userId);
  const removeUserData = db.transaction(() => {
    db.prepare('DELETE FROM post_comment_likes WHERE user_id = ? OR comment_id IN (SELECT id FROM post_comments WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?))').run(userId, userId, userId);
    db.prepare('DELETE FROM post_comments WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)').run(userId, userId);
    db.prepare('DELETE FROM video_comment_likes WHERE user_id = ? OR comment_id IN (SELECT id FROM video_comments WHERE user_id = ? OR video_id IN (SELECT id FROM videos WHERE user_id = ?))').run(userId, userId, userId);
    db.prepare('DELETE FROM video_comments WHERE user_id = ? OR video_id IN (SELECT id FROM videos WHERE user_id = ?)').run(userId, userId);
    db.prepare('DELETE FROM video_likes WHERE user_id = ? OR video_id IN (SELECT id FROM videos WHERE user_id = ?)').run(userId, userId);
    db.prepare('DELETE FROM post_comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM posts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM files WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM videos WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM verification_codes WHERE email = (SELECT email FROM users WHERE id = ?)').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  removeUserData();
  files.forEach(file => fs.rmSync(path.join(fileDirectory, file.filename), { force: true }));
  videos.flatMap(video => [video.filename, video.mp4_filename, video.webm_filename, video.poster_filename]).filter(Boolean)
    .forEach(filename => fs.rmSync(path.join(videoDirectory, filename), { force: true }));
  videos.filter(video => video.hls_playlist).forEach(video => fs.rmSync(path.join(videoDirectory, path.dirname(video.hls_playlist)), { recursive: true, force: true }));
    if (user.avatar_filename) fs.rmSync(path.join(avatarDirectory, user.avatar_filename), { force: true });
  db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  req.session.destroy(() => {});
  res.json({ success: true, message: '账号已注销' });
});

app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const userId = req.session.userId;
  const friends = db.prepare(`
    SELECT u.id, u.username, u.avatar_filename, u.bio
    FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
    WHERE f.user_a = ? OR f.user_b = ? ORDER BY u.username
  `).all(userId, userId, userId).map(friend => ({ ...friend, avatarUrl: avatarUrl(friend.avatar_filename) }));
  const requests = db.prepare(`
    SELECT r.id, r.requester_id, r.recipient_id, r.status, r.created_at, u.username, u.avatar_filename
    FROM friend_requests r JOIN users u ON u.id = r.requester_id
    WHERE r.recipient_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC
  `).all(userId).map(request => ({ ...request, avatarUrl: avatarUrl(request.avatar_filename) }));
  res.json({ success: true, friends, requests });
});

app.get('/api/friends/status/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.id);
  const user = db.prepare('SELECT id, username, bio, avatar_filename FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  if (targetId === req.session.userId) return res.json({ success: true, status: 'self', user: { ...user, avatarUrl: avatarUrl(user.avatar_filename) } });
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  const friendship = db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b);
  const outgoing = db.prepare("SELECT id FROM friend_requests WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'").get(req.session.userId, targetId);
  const incoming = db.prepare("SELECT id FROM friend_requests WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'").get(targetId, req.session.userId);
  const status = friendship ? 'friend' : outgoing ? 'outgoing' : incoming ? 'incoming' : 'none';
  res.json({ success: true, status, requestId: incoming?.id || outgoing?.id || null, user: { ...user, avatarUrl: avatarUrl(user.avatar_filename) } });
});

app.post('/api/friends/requests', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.body.userId);
  if (!targetId || targetId === req.session.userId) return res.json({ success: false, message: '不能添加自己' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.json({ success: false, message: '用户不存在' });
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  if (db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) return res.json({ success: false, message: '已经是好友' });
  try {
    db.prepare("INSERT INTO friend_requests (requester_id, recipient_id) VALUES (?, ?)").run(req.session.userId, targetId);
  } catch (error) {
    return res.json({ success: false, message: '好友申请已存在' });
  }
      createNotification(targetId, req.session.userId, 'friend_request', null, null, null, '/friends.html');
    res.json({ success: true, message: '好友申请已发送' });
});

app.put('/api/friends/requests/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const request = db.prepare("SELECT * FROM friend_requests WHERE id = ? AND recipient_id = ? AND status = 'pending'").get(req.params.id, req.session.userId);
  if (!request) return res.json({ success: false, message: '申请不存在' });
  const action = req.body.action === 'accept' ? 'accept' : 'reject';
  if (action === 'accept') {
    const a = Math.min(request.requester_id, request.recipient_id);
    const b = Math.max(request.requester_id, request.recipient_id);
    db.transaction(() => {
      db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(request.id);
      db.prepare('INSERT OR IGNORE INTO friendships (user_a, user_b) VALUES (?, ?)').run(a, b);
    })();
    // 通知申请人（被接受）
    createNotification(request.requester_id, req.session.userId, 'friend_accept', null, null, null, '/friends.html');
  } else {
    db.prepare("UPDATE friend_requests SET status = 'rejected' WHERE id = ?").run(request.id);
  }
  res.json({ success: true, message: action === 'accept' ? '已添加好友' : '已拒绝申请' });
});

app.delete('/api/friends/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.id);
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(a, b);
  res.json({ success: true, message: '好友已删除' });
});

// 好友私信未读数（必须注册在 /api/messages/:id 之前，否则会被当成 id 参数匹配）
app.get('/api/messages/unread-count', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, count: 0 });
  const count = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL').get(req.session.userId).c;
  res.json({ success: true, count });
});

app.get('/api/messages/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.id);
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  if (!db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) return res.status(403).json({ success: false, message: '只有好友可以聊天' });
  // 标记此前往该好友的消息为已读
  db.prepare('UPDATE messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL')
    .run(utcNow(), targetId, req.session.userId);
  const messages = db.prepare(`SELECT m.id, m.sender_id, m.recipient_id, m.content, m.created_at, u.username, u.avatar_filename FROM messages m JOIN users u ON u.id = m.sender_id WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?) ORDER BY m.created_at ASC`).all(req.session.userId, targetId, targetId, req.session.userId);
  res.json({ success: true, messages: messages.map(message => ({ ...message, avatarUrl: avatarUrl(message.avatar_filename) })) });
});

app.post('/api/messages/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.id);
  const content = String(req.body.content || '').trim();
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  if (!db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) return res.json({ success: false, message: '只有好友可以聊天' });
  if (!content || content.length > 1000) return res.json({ success: false, message: '消息不能为空且不能超过1000字' });
  db.prepare('INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)').run(req.session.userId, targetId, content);
  createNotification(targetId, req.session.userId, 'message', null, null, content.slice(0, 100), `/chat.html?user=${req.session.userId}`);
  res.json({ success: true, message: '消息已发送' });
});

// 收藏 / 取消收藏内容（文章、视频、文件）
app.post('/api/favorites', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const contentType = String(req.body.contentType || '');
  const contentId = Number(req.body.contentId);
  if (!contentSummaryStatements[contentType] || !Number.isInteger(contentId) || contentId <= 0) {
    return res.json({ success: false, message: '收藏对象不正确' });
  }
  if (!contentSummaryStatements[contentType].get(contentId)) {
    return res.json({ success: false, message: '内容不存在' });
  }

  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND content_type = ? AND content_id = ?')
    .get(req.session.userId, contentType, contentId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO favorites (user_id, content_type, content_id) VALUES (?, ?, ?)')
      .run(req.session.userId, contentType, contentId);
  }
  const favorited = !existing;
  const favoriteCount = countFavorites(contentType, contentId);
  res.json({ success: true, favorited, favoriteCount, message: favorited ? '已加入收藏' : '已取消收藏' });
});

// 我的收藏列表
app.get('/api/favorites', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const contentType = ['post', 'video', 'file'].includes(req.query.type) ? req.query.type : null;
  const entries = db.prepare(`
    SELECT content_type, content_id, created_at FROM favorites
    WHERE user_id = ? ${contentType ? 'AND content_type = ?' : ''}
    ORDER BY created_at DESC
  `).all(...(contentType ? [req.session.userId, contentType] : [req.session.userId]));
  res.json({ success: true, items: fetchContentSummaries(entries, 'created_at') });
});

// 我的浏览历史
app.get('/api/history', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const contentType = ['post', 'video', 'file'].includes(req.query.type) ? req.query.type : null;
  const entries = db.prepare(`
    SELECT content_type, content_id, viewed_at FROM view_history
    WHERE user_id = ? ${contentType ? 'AND content_type = ?' : ''}
    ORDER BY viewed_at DESC LIMIT 60
  `).all(...(contentType ? [req.session.userId, contentType] : [req.session.userId]));
  res.json({ success: true, items: fetchContentSummaries(entries, 'viewed_at') });
});

// 清空浏览历史
app.delete('/api/history', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  db.prepare('DELETE FROM view_history WHERE user_id = ?').run(req.session.userId);
  res.json({ success: true, message: '浏览历史已清空' });
});

// 举报内容
app.post('/api/reports', async (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const contentType = String(req.body.contentType || '');
  const contentId = Number(req.body.contentId);
  const reason = String(req.body.reason || '').trim();

  if (!contentSummaryStatements[contentType] || !Number.isInteger(contentId) || contentId <= 0) {
    return res.json({ success: false, message: '举报对象不正确' });
  }
  if (reason.length < 2) return res.json({ success: false, message: '请填写举报原因' });
  if (reason.length > 300) return res.json({ success: false, message: '举报原因不能超过300字' });

  const duplicated = db.prepare("SELECT id FROM reports WHERE reporter_id = ? AND content_type = ? AND content_id = ? AND status = 'pending'")
    .get(req.session.userId, contentType, contentId);
  if (duplicated) return res.json({ success: false, message: '你已举报过该内容，请等待处理' });

  db.prepare('INSERT INTO reports (reporter_id, content_type, content_id, reason) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, contentType, contentId, reason);

  if (config.adminEmail) {
    try {
      await sendReportNotificationEmail({
        reporter_id: req.session.userId,
        content_type: contentType,
        content_id: contentId,
        reason,
      });
    } catch (error) {
      console.error('举报邮件通知发送失败:', error.message);
    }
  }
  res.json({ success: true, message: '举报已提交，我们会尽快处理' });
});

// 获取站内通知
app.get('/api/notifications', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const notifications = db.prepare(`
    SELECT n.id, n.type, n.content_type, n.content_id, n.preview, n.link, n.is_read, n.created_at,
      u.username AS actor_name, u.avatar_filename AS actor_avatar
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC LIMIT 50
  `).all(req.session.userId);
  res.json({
    success: true,
    unread: notifications.filter(item => !item.is_read).length,
    notifications: notifications.map(item => ({
      ...item,
      is_read: Boolean(item.is_read),
      actorAvatarUrl: avatarUrl(item.actor_avatar),
    })),
  });
});

// 未读通知数 / 未读私信数（导航红点轮询）
app.get('/api/notifications/unread-count', (req, res) => {
  if (!req.session.userId) return res.json({ success: true, unread: 0, messages: 0 });
  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.session.userId).c;
  const messages = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL').get(req.session.userId).c;
  res.json({ success: true, unread, messages });
});

// 标记通知已读（传 id 标记单条，否则全部标记）
app.post('/api/notifications/read', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const id = Number(req.body.id);
  if (Number.isInteger(id) && id > 0) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.session.userId);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.session.userId);
  }
  res.json({ success: true });
});

// 删除单条通知
app.delete('/api/notifications/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ success: true, message: '通知已删除' });
});

// 查看当前账号的活跃登录设备
app.get('/api/user/sessions', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const sessions = db.prepare(`
    SELECT id, ip, user_agent, created_at, last_seen_at
    FROM user_sessions
    WHERE user_id = ? AND revoked = 0
    ORDER BY last_seen_at DESC LIMIT 20
  `).all(req.session.userId);
  res.json({
    success: true,
    sessions: sessions.map(item => ({ ...item, current: item.id === req.sessionID })),
  });
});

// 退出除当前设备外的全部设备
app.post('/api/user/sessions/revoke-others', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const info = db.prepare('DELETE FROM user_sessions WHERE user_id = ? AND id != ?').run(req.session.userId, req.sessionID);
  res.json({ success: true, message: `已下线 ${info.changes} 台其他设备` });
});

// 踢出指定设备
app.delete('/api/user/sessions/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const sessionId = String(req.params.id);
  const target = db.prepare('SELECT id FROM user_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.session.userId);
  if (!target) return res.json({ success: false, message: '设备不存在' });
  db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId);
  if (sessionId === req.sessionID) {
    return req.session.destroy(() => res.json({ success: true, message: '当前设备已退出登录' }));
  }
  res.json({ success: true, message: '该设备已下线' });
});

// 退出登录
app.post('/api/logout', (req, res) => {
  if (req.session && req.session.userId && req.sessionID) {
    db.prepare('DELETE FROM user_sessions WHERE id = ?').run(req.sessionID);
  }
  req.session.destroy(() => {});
  res.json({ success: true });
});

// 启动服务器，允许同一局域网内的设备访问
app.listen(config.port, '0.0.0.0', () => {
  console.log(`烬潮博客运行在 http://localhost:${config.port}`);
  console.log(`局域网访问地址：http://<本机局域网IP>:${config.port}`);
});

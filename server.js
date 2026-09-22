const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');
const db = require('./database');
const { sendVerificationEmail } = require('./email');
const config = require('./config');
const {
  normalizeEmail,
  validateEmail,
  validateRegistrationInput,
  validatePostInput,
} = require('./validation');

const app = express();
const videoDirectory = path.join(__dirname, 'public', 'uploads', 'videos');
const fileDirectory = path.join(__dirname, 'public', 'uploads', 'files');
const avatarDirectory = path.join(__dirname, 'public', 'uploads', 'avatars');
const hlsDirectory = path.join(videoDirectory, 'hls');
const execFileAsync = promisify(execFile);
fs.mkdirSync(videoDirectory, { recursive: true });
fs.mkdirSync(fileDirectory, { recursive: true });
fs.mkdirSync(avatarDirectory, { recursive: true });
fs.mkdirSync(hlsDirectory, { recursive: true });

function mediaUrl(filename) {
  return filename ? `/uploads/videos/${filename.split('/').map(encodeURIComponent).join('/')}` : null;
}

function avatarUrl(filename) {
  return filename ? `/uploads/avatars/${encodeURIComponent(filename)}` : null;
}

function listOptions(req) {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  return {
    limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 6,
    sort: req.query.sort === 'hot' ? 'hot' : 'latest',
  };
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

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: fileDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

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

function getClientIp(req) {
  const address = req.socket.remoteAddress || req.connection.remoteAddress || '-';
  return address.startsWith('::ffff:') ? address.slice(7) : address;
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
  secret: 'jinchao-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

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

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: false, message: '邮箱未注册' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.json({ success: false, message: '密码错误' });
  }

  req.session.userId = user.id;
  res.json({ success: true, message: '登录成功', username: user.username });
});

// 使用邮箱验证码登录
app.post('/api/login-code', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim().toUpperCase();

  if (!validateEmail(email)) {
    return res.json({ success: false, message: '请输入有效的邮箱地址' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: false, message: '该邮箱尚未注册' });
  }

  const verification = db.prepare(`
    SELECT id FROM verification_codes
    WHERE email = ? AND code = ? AND purpose = 'login' AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code, new Date().toISOString());
  if (!verification) {
    return res.json({ success: false, message: '验证码无效或已过期' });
  }

  req.session.userId = user.id;
  db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
  res.json({ success: true, message: '登录成功', username: user.username });
});

// 获取文章列表
app.get('/api/posts', (req, res) => {
  const { limit, sort } = listOptions(req);
  const orderBy = sort === 'hot'
    ? 'p.view_count DESC, comment_count DESC, p.created_at DESC'
    : 'p.created_at DESC';
  const posts = db.prepare(`
    SELECT p.*, u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
    FROM posts p 
    JOIN users u ON p.user_id = u.id 
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(limit);
  res.json(posts.map(post => ({ ...post, avatarUrl: avatarUrl(post.avatar_filename) })));
});

app.get('/api/posts/:id', (req, res) => {
  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
  const post = db.prepare(`
    SELECT p.id, p.user_id, p.title, p.content, p.view_count, p.created_at, u.username, u.avatar_filename
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) return res.status(404).json({ success: false, message: '文章不存在' });
  res.json({ ...post, avatarUrl: avatarUrl(post.avatar_filename) });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.id, c.user_id, c.content, c.created_at, u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM post_comment_likes WHERE comment_id = c.id) AS like_count,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM post_comment_likes WHERE comment_id = c.id AND user_id = ?
      ) THEN 1 ELSE 0 END AS liked
    FROM post_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(req.session.userId || null, req.session.userId || null, req.params.id);
  res.json(comments.map(comment => ({ ...comment, avatarUrl: avatarUrl(comment.avatar_filename), liked: Boolean(comment.liked) })));
});

app.post('/api/posts/:id/comments', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  const content = String(req.body.content || '').trim();
  if (!post) return res.json({ success: false, message: '文章不存在' });
  if (!content) return res.json({ success: false, message: '评论内容不能为空' });
  if (content.length > 500) return res.json({ success: false, message: '评论不能超过500字' });

  db.prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(post.id, req.session.userId, content);
  res.json({ success: true, message: '评论成功' });
});

app.post('/api/posts/comments/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const comment = db.prepare('SELECT id FROM post_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.json({ success: false, message: '评论不存在' });

  const existing = db.prepare('SELECT 1 FROM post_comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(comment.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM post_comment_likes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO post_comment_likes (comment_id, user_id) VALUES (?, ?)').run(comment.id, req.session.userId);
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
  const orderBy = sort === 'hot' ? 'f.download_count DESC, f.created_at DESC' : 'f.created_at DESC';
  const files = db.prepare(`
        SELECT f.id, f.user_id, f.title, f.filename, f.original_name, f.mime_type, f.file_size, f.password_hash, f.download_count, f.created_at,
          u.username, u.avatar_filename
    FROM files f
    JOIN users u ON u.id = f.user_id
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(limit);

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
    owner: req.session.userId === file.user_id,
    downloadUrl: req.session.userId === file.user_id || !file.password_hash
      ? `/api/files/${file.id}/download`
      : null,
  })));
});

app.get('/api/files/:id', (req, res) => {
  const file = db.prepare(`
        SELECT f.id, f.user_id, f.title, f.original_name, f.mime_type, f.file_size, f.password_hash, f.download_count, f.created_at,
          u.username, u.avatar_filename
    FROM files f
    JOIN users u ON u.id = f.user_id
    WHERE f.id = ?
  `).get(req.params.id);

  if (!file) return res.status(404).json({ success: false, message: '文件不存在' });
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

app.post('/api/files', fileUpload.single('file'), async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: '请先登录' });
  }

  const title = String(req.body.title || '').trim();
  const password = String(req.body.password || '').trim();

  if (!req.file) {
    return res.json({ success: false, message: '请选择要上传的文件' });
  }

  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.json({ success: false, message: '请输入文件标题' });
  }

  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  db.prepare(`
    INSERT INTO files (user_id, title, filename, original_name, mime_type, file_size, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.userId,
    title,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype || 'application/octet-stream',
    req.file.size,
    passwordHash,
  );

  res.json({ success: true, message: password ? '文件已上传，已开启密码保护' : '文件已上传' });
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

// 获取公开视频及点赞、评论数量
app.get('/api/videos', (req, res) => {
  const { limit, sort } = listOptions(req);
  const orderBy = sort === 'hot'
    ? 'v.view_count DESC, like_count DESC, comment_count DESC, v.created_at DESC'
    : 'v.created_at DESC';
  const videos = db.prepare(`
        SELECT v.id, v.user_id, v.title, v.filename, v.original_name, v.mime_type, v.source_url,
          v.mp4_filename, v.webm_filename, v.poster_filename, v.hls_playlist, v.view_count, v.created_at,
          u.username, u.avatar_filename,
           (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
           (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count,
           CASE WHEN ? IS NOT NULL AND EXISTS (
             SELECT 1 FROM video_likes WHERE video_id = v.id AND user_id = ?
           ) THEN 1 ELSE 0 END AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(req.session.userId || null, req.session.userId || null, limit);

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
      u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) AS comment_count,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM video_likes WHERE video_id = v.id AND user_id = ?
      ) THEN 1 ELSE 0 END AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    WHERE v.id = ?
  `).get(req.session.userId || null, req.session.userId || null, req.params.id);

  if (!video) return res.status(404).json({ success: false, message: '视频不存在' });
  res.json({
    ...video,
    url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    mp4Url: video.source_url || mediaUrl(video.mp4_filename || video.filename),
    webmUrl: mediaUrl(video.webm_filename),
    posterUrl: mediaUrl(video.poster_filename),
    hlsUrl: mediaUrl(getHlsPlaylist(video)),
    liked: Boolean(video.liked),
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
      INSERT INTO videos (user_id, title, filename, original_name, mime_type, source_url, mp4_filename, webm_filename, poster_filename, hls_playlist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// 登录用户点赞或取消点赞
app.post('/api/videos/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.json({ success: false, message: '视频不存在' });

  const existing = db.prepare('SELECT 1 FROM video_likes WHERE video_id = ? AND user_id = ?')
    .get(video.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM video_likes WHERE video_id = ? AND user_id = ?').run(video.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO video_likes (video_id, user_id) VALUES (?, ?)').run(video.id, req.session.userId);
  }

  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM video_likes WHERE video_id = ?').get(video.id).count;
  res.json({ success: true, liked: !existing, likeCount });
});

// 获取视频评论
app.get('/api/videos/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.id, c.user_id, c.content, c.created_at, u.username, u.avatar_filename,
      (SELECT COUNT(*) FROM video_comment_likes WHERE comment_id = c.id) AS like_count,
      CASE WHEN ? IS NOT NULL AND EXISTS (
        SELECT 1 FROM video_comment_likes WHERE comment_id = c.id AND user_id = ?
      ) THEN 1 ELSE 0 END AS liked
    FROM video_comments c JOIN users u ON u.id = c.user_id
    WHERE c.video_id = ? ORDER BY c.created_at ASC
  `).all(req.session.userId || null, req.session.userId || null, req.params.id);
  res.json(comments.map(comment => ({ ...comment, avatarUrl: avatarUrl(comment.avatar_filename), liked: Boolean(comment.liked) })));
});

app.post('/api/videos/comments/:id/like', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const comment = db.prepare('SELECT id FROM video_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.json({ success: false, message: '评论不存在' });

  const existing = db.prepare('SELECT 1 FROM video_comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(comment.id, req.session.userId);
  if (existing) {
    db.prepare('DELETE FROM video_comment_likes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.session.userId);
  } else {
    db.prepare('INSERT INTO video_comment_likes (comment_id, user_id) VALUES (?, ?)').run(comment.id, req.session.userId);
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS count FROM video_comment_likes WHERE comment_id = ?').get(comment.id).count;
  res.json({ success: true, liked: !existing, likeCount });
});

// 登录用户发表评论
app.post('/api/videos/:id/comments', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });

  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id);
  const content = String(req.body.content || '').trim();
  if (!video) return res.json({ success: false, message: '视频不存在' });
  if (!content) return res.json({ success: false, message: '评论内容不能为空' });
  if (content.length > 500) return res.json({ success: false, message: '评论不能超过500字' });

  db.prepare('INSERT INTO video_comments (video_id, user_id, content) VALUES (?, ?, ?)')
    .run(video.id, req.session.userId, content);
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
  
  const user = db.prepare('SELECT id, email, username, bio, avatar_filename, created_at FROM users WHERE id = ?').get(req.session.userId);
  res.json({ success: true, user: { ...user, avatarUrl: avatarUrl(user.avatar_filename) } });
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
  res.json({ success: true, message: '个人资料已更新' });
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

app.get('/api/messages/:id', (req, res) => {
  if (!req.session.userId) return res.json({ success: false, message: '请先登录' });
  const targetId = Number(req.params.id);
  const a = Math.min(req.session.userId, targetId);
  const b = Math.max(req.session.userId, targetId);
  if (!db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) return res.status(403).json({ success: false, message: '只有好友可以聊天' });
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
  res.json({ success: true, message: '消息已发送' });
});

// 退出登录
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 启动服务器，允许同一局域网内的设备访问
app.listen(config.port, '0.0.0.0', () => {
  console.log(`烬潮博客运行在 http://localhost:${config.port}`);
  console.log(`局域网访问地址：http://<本机局域网IP>:${config.port}`);
});

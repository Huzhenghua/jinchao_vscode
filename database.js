const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'jinchao.db'));

// 创建用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar_filename TEXT,
    bio TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
if (!userColumns.includes('avatar_filename')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_filename TEXT');
}
if (!userColumns.includes('bio')) {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
}

// 创建文章表
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 创建验证码表
db.exec(`
  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'register',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const verificationColumns = db.prepare('PRAGMA table_info(verification_codes)').all().map(column => column.name);
if (!verificationColumns.includes('purpose')) {
  db.exec("ALTER TABLE verification_codes ADD COLUMN purpose TEXT NOT NULL DEFAULT 'register'");
}

// 创建文件表
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const fileColumns = db.prepare('PRAGMA table_info(files)').all().map(column => column.name);
if (!fileColumns.includes('password_hash')) {
  db.exec('ALTER TABLE files ADD COLUMN password_hash TEXT');
}
if (!fileColumns.includes('file_size')) {
  db.exec('ALTER TABLE files ADD COLUMN file_size INTEGER DEFAULT 0');
}
if (!fileColumns.includes('download_count')) {
  db.exec('ALTER TABLE files ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0');
}

// 创建视频及互动表
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS video_likes (
    video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (video_id, user_id),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS video_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS video_comment_likes (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES video_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS post_comment_likes (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (requester_id, recipient_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_a INTEGER NOT NULL,
    user_b INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_a, user_b),
    FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE
  );

     CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    email TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, content_type, content_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS view_history (
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, content_type, content_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_id INTEGER,
    type TEXT NOT NULL,
    content_type TEXT,
    content_id INTEGER,
    preview TEXT,
    link TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const videoColumns = db.prepare('PRAGMA table_info(videos)').all().map(column => column.name);
if (!videoColumns.includes('source_url')) {
  db.exec('ALTER TABLE videos ADD COLUMN source_url TEXT');
}
if (!videoColumns.includes('mp4_filename')) {
  db.exec('ALTER TABLE videos ADD COLUMN mp4_filename TEXT');
}
if (!videoColumns.includes('webm_filename')) {
  db.exec('ALTER TABLE videos ADD COLUMN webm_filename TEXT');
}
if (!videoColumns.includes('poster_filename')) {
  db.exec('ALTER TABLE videos ADD COLUMN poster_filename TEXT');
}
if (!videoColumns.includes('hls_playlist')) {
  db.exec('ALTER TABLE videos ADD COLUMN hls_playlist TEXT');
}
if (!videoColumns.includes('view_count')) {
  db.exec('ALTER TABLE videos ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0');
}
if (!videoColumns.includes('category_id')) {
  db.exec('ALTER TABLE videos ADD COLUMN category_id INTEGER');
}

// 创建视频分区表
db.exec(`
  CREATE TABLE IF NOT EXISTS video_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 预置分区数据
const existingCategories = db.prepare('SELECT COUNT(*) AS count FROM video_categories').get().count;
if (existingCategories === 0) {
  const insertCategory = db.prepare('INSERT INTO video_categories (name) VALUES (?)');
  ['科技', '游戏', '生活', '音乐', '学习', '娱乐', '其他'].forEach(name => insertCategory.run(name));
}

// 创建关注关系表
db.exec(`
  CREATE TABLE IF NOT EXISTS follows (
    user_id INTEGER NOT NULL,
    followed_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, followed_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// 创建弹幕表
db.exec(`
  CREATE TABLE IF NOT EXISTS barrages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    offset_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

const postColumns = db.prepare('PRAGMA table_info(posts)').all().map(column => column.name);
if (!postColumns.includes('view_count')) {
  db.exec('ALTER TABLE posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0');
}

const usersColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
if (!usersColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

const commentColumns = db.prepare('PRAGMA table_info(post_comments)').all().map(column => column.name);
if (!commentColumns.includes('reply_to')) {
  db.exec('ALTER TABLE post_comments ADD COLUMN reply_to INTEGER');
}
const vcommentColumns = db.prepare('PRAGMA table_info(video_comments)').all().map(column => column.name);
if (!vcommentColumns.includes('reply_to')) {
  db.exec('ALTER TABLE video_comments ADD COLUMN reply_to INTEGER');
}

const messageColumns = db.prepare('PRAGMA table_info(messages)').all().map(column => column.name);
if (!messageColumns.includes('read_at')) {
  db.exec('ALTER TABLE messages ADD COLUMN read_at DATETIME');
}

const barrageColumns = db.prepare('PRAGMA table_info(barrages)').all().map(column => column.name);
if (!barrageColumns.includes('color')) {
  db.exec("ALTER TABLE barrages ADD COLUMN color TEXT NOT NULL DEFAULT '#ffffff'");
}
if (!barrageColumns.includes('font_size')) {
  db.exec('ALTER TABLE barrages ADD COLUMN font_size INTEGER NOT NULL DEFAULT 25');
}
if (!barrageColumns.includes('speed')) {
  db.exec("ALTER TABLE barrages ADD COLUMN speed TEXT NOT NULL DEFAULT 'normal'");
}
if (!barrageColumns.includes('updated_at')) {
  db.exec('ALTER TABLE barrages ADD COLUMN updated_at DATETIME');
}

module.exports = db;

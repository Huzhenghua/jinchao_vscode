// API基础URL
const API_BASE = '';

// 内联 SVG 图标集（24x24 线条风格，stroke 跟随 currentColor）
const UI_ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.072-2.143 2.5-3.736 4.5-5 .5 2.5 1.5 3.5 2.5 5a7.5 7.5 0 1 1-11 0c.383-.476 1-1.5 1-2.5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  close: '<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  fullscreenExit: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
};

function uiIcon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI_ICONS[name] || ''}</svg>`;
}

// 主题初始化：localStorage 优先，否则跟随系统深色偏好
(function initTheme() {
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.body.classList.add('dark');
})();

// 切换深/浅主题并同步所有导航主题按钮
function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  document.querySelectorAll('.nav-theme-toggle').forEach(button => {
    button.innerHTML = uiIcon(dark ? 'sun' : 'moon');
    button.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    button.setAttribute('title', dark ? '切换到浅色模式' : '切换到深色模式');
  });
}

// 主题按钮（图标按当前主题渲染：深色态显示太阳，浅色态显示月亮）
function themeToggleMarkup() {
  const dark = document.body.classList.contains('dark');
  return `<button class="nav-theme-toggle" type="button" onclick="toggleTheme()" aria-label="切换深色/浅色模式" title="切换深色/浅色模式">${uiIcon(dark ? 'sun' : 'moon')}</button>`;
}

// 导航滚动加深（全局只绑定一次）
(function initNavbarScrollState() {
  const sync = () => {
    const nav = document.querySelector('.navbar');
    if (nav) nav.classList.toggle('navbar-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', sync, { passive: true });
  sync();
})();

function avatarMarkup(avatarUrl, username) {
  return avatarUrl
    ? `<img class="avatar" src="${escapeAttribute(avatarUrl)}" alt="${escapeAttribute(username)}的头像">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(String(username || '?').slice(0, 1))}</span>`;
}

function userAvatarMarkup(userId, avatarUrl, username) {
  const avatar = avatarMarkup(avatarUrl, username);
  return userId ? `<a class="avatar-link" href="/profile.html?user=${encodeURIComponent(userId)}" title="查看用户主页">${avatar}</a>` : avatar;
}

function getHomeLimit() {
  if (window.innerWidth < 560) return 3;
  if (window.innerWidth < 960) return 4;
  return 6;
}

// 数字格式化：1.2万
function formatCount(value) {
  const count = Number(value) || 0;
  return count >= 10000 ? `${(count / 10000).toFixed(1)}万` : String(count);
}

// 秒数格式化为 mm:ss
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minute = Math.floor(total / 60);
  const second = total % 60;
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

// 首页折叠区开关
function toggleCollapse(header) {
  if (!header) return;
  header.classList.toggle('collapsed');
  const body = header.nextElementSibling;
  if (body) body.classList.toggle('collapsed');
}

// 关注按钮（space 页与视频详情页共用）
function followButtonMarkup(isFollowing, userId) {
  return `<button class="follow-button${isFollowing ? ' following' : ''}" type="button" data-follow-user="${userId}" onclick="toggleFollow(${userId}, this)">${isFollowing ? '已关注' : '+ 关注'}</button>`;
}

// 显示消息（淡入，3 秒后淡出）
function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.className = 'message ' + (isError ? 'error' : 'success');
  element.style.display = 'block';

  // 先在无 is-visible 的状态渲染一帧，再加类以触发过渡
  requestAnimationFrame(() => element.classList.add('is-visible'));

  clearTimeout(element._hideTimer);
  clearTimeout(element._displayTimer);
  element._hideTimer = setTimeout(() => {
    element.classList.remove('is-visible');
    // 过渡结束后再彻底隐藏，避免元素占位残留
    element._displayTimer = setTimeout(() => {
      if (!element.classList.contains('is-visible')) element.style.display = 'none';
    }, 300);
  }, 3000);
}

// ===== Toast 通知 =====

// 惰性创建 Toast 容器（挂到 body，支持多条堆叠）
function ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

// 轻量 Toast：type ∈ info / success / error，4 秒自动移除，点击可提前关闭
function showToast(message, type = 'info') {
  const container = ensureToastContainer();
  const safeType = ['info', 'success', 'error'].includes(type) ? type : 'info';
  const toast = document.createElement('div');
  toast.className = `toast toast-${safeType}`;
  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  dot.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;
  toast.append(dot, text);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed || !toast.parentNode) return;
    dismissed = true;
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  };
  toast.addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, 4000);
}

// ===== 空状态组件 =====

// 内联线条风 SVG 插图（stroke=currentColor，56-64px）
const EMPTY_STATE_ICONS = {
  box: '<svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 22 32 10l22 12v22L32 56 10 44Z"/><path d="M10 22l22 12 22-12"/><path d="M32 34v22"/></svg>',
  search: '<svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="28" cy="28" r="17"/><path d="m40.5 40.5 13 13"/><path d="M21 28a7 7 0 0 1 7-7" opacity=".45"/></svg>',
};

// 生成空状态 HTML：图标 + 标题 + 描述 + 可选跳转按钮
function emptyStateMarkup(iconSvg, title, description, actionUrl, actionText) {
  const icon = iconSvg || EMPTY_STATE_ICONS.box;
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3 class="empty-state-title">${escapeHtml(title || '暂无内容')}</h3>
      ${description ? `<p class="empty-state-desc">${escapeHtml(description)}</p>` : ''}
      ${actionUrl && actionText ? `<a class="btn btn-primary empty-state-action" href="${actionUrl}">${escapeHtml(actionText)}</a>` : ''}
    </div>
  `;
}

// ===== 骨架屏占位（用于 JS 动态写入的列表） =====

function skeletonRows(count = 4) {
  return '<div class="skeleton-row"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-meta"></div><div class="skeleton skeleton-line"></div></div>'.repeat(count);
}

function skeletonCards(count = 6) {
  return '<div class="skeleton-card"><div class="skeleton skeleton-cover"></div><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-up"></div></div>'.repeat(count);
}

// 发送验证码
function startCodeCountdown(button) {
  if (!button) return;

  const defaultText = button.textContent;
  let remaining = 60;
  button.disabled = true;
  button.textContent = `${remaining}秒后重新发送`;

  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = defaultText;
      return;
    }
    button.textContent = `${remaining}秒后重新发送`;
  }, 1000);
}

async function requestVerificationCode({ endpoint, messageId, buttonId }) {
  const email = document.getElementById('email').value.trim().toLowerCase();
  if (!email) {
    showMessage(messageId, '请输入邮箱', true);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    showMessage(messageId, data.message, !data.success);
    if (data.success) startCodeCountdown(document.getElementById(buttonId));
  } catch (error) {
    showMessage(messageId, '发送失败，请重试', true);
  }
}

function sendVerificationCode() {
  return requestVerificationCode({
    endpoint: '/api/send-code',
    messageId: 'register-message',
    buttonId: 'send-register-code',
  });
}

// 处理注册
async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const code = document.getElementById('code').value.trim().toUpperCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    showMessage('register-message', '两次密码不一致', true);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, code, password })
    });
    
    const data = await response.json();
    showMessage('register-message', data.message, !data.success);
    
    if (data.success) {
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    }
  } catch (error) {
    showMessage('register-message', '注册失败，请重试', true);
  }
}

// 处理登录
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const code = document.getElementById('login-code').value.trim().toUpperCase();
  const isEmailMode = document.getElementById('email-login-field').hidden === false;
  // 勾选“记住我”时会话保留 30 天，否则关闭浏览器即失效
  const rememberField = document.getElementById('remember-me');
  const remember = Boolean(rememberField && rememberField.checked);

  try {
    const response = await fetch(`${API_BASE}${isEmailMode ? '/api/login-code' : '/api/login'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(isEmailMode ? { email, code, remember } : { email, password, remember })
    });
    
    const data = await response.json();
    showMessage('login-message', data.message, !data.success);
    
    if (data.success) {
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    showMessage('login-message', '登录失败，请重试', true);
  }
}

function sendLoginCode() {
  return requestVerificationCode({
    endpoint: '/api/send-login-code',
    messageId: 'login-message',
    buttonId: 'send-login-code',
  });
}

// 发送重置密码验证码
function sendResetCode() {
  return requestVerificationCode({
    endpoint: '/api/send-reset-code',
    messageId: 'reset-message',
    buttonId: 'send-reset-code',
  });
}

// 处理重置密码
async function handleResetPassword(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const code = document.getElementById('code').value.trim().toUpperCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    showMessage('reset-message', '两次密码不一致', true);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await response.json();
    showMessage('reset-message', data.message, !data.success);
    if (data.success) {
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    }
  } catch (error) {
    showMessage('reset-message', '重置失败，请重试', true);
  }
}

function setupLoginModes() {
  const buttons = document.querySelectorAll('[data-login-mode]');
  const passwordField = document.getElementById('password-login-field');
  const emailField = document.getElementById('email-login-field');
  if (!buttons.length || !passwordField || !emailField) return;

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const emailMode = button.dataset.loginMode === 'email';
      buttons.forEach(item => item.classList.toggle('is-active', item === button));
      passwordField.hidden = emailMode;
      emailField.hidden = !emailMode;
      document.getElementById('password').required = !emailMode;
      document.getElementById('login-code').required = emailMode;
    });
  });
}

// 检查登录状态
async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/api/user`);
    const data = await response.json();
    
    if (data.success) {
      const usernameEl = document.getElementById('username');
      if (usernameEl) usernameEl.textContent = data.user.username;
      const bio = document.getElementById('user-bio');
      if (bio) bio.textContent = data.user.bio || '管理个人资料和内容';
      document.body.dataset.userId = String(data.user.id);
    } else {
      window.location.href = '/login.html';
    }
  } catch (error) {
    window.location.href = '/login.html';
  }
}

// 根据登录状态更新导航（全站统一 #nav-actions 渲染路径）
async function updateNavigation() {
  const actions = document.getElementById('nav-actions');
  if (!actions) return;

  let data = { success: false };
  try {
    const response = await fetch(`${API_BASE}/api/user`);
    data = await response.json();
  } catch (error) {
    return; // 导航失败时保留页面，不影响主页浏览
  }

  actions.innerHTML = (data.success
    ? `<a class="nav-link" href="/dashboard.html">投稿</a>`
      + `<a class="nav-link" href="/following.html">动态</a>`
      + themeToggleMarkup()
      + `<a class="nav-icon-link" href="/notifications.html" title="通知" aria-label="通知">${uiIcon('bell')}<span class="nav-badge" id="nav-notification-badge" hidden></span></a>`
      + `<a class="nav-icon-link" href="/friends.html" title="私信与好友" aria-label="私信与好友">${uiIcon('mail')}<span class="nav-badge" id="nav-message-badge" hidden></span></a>`
      + `<a class="nav-avatar" href="/space.html?user=${data.user.id}" title="${escapeAttribute(data.user.username)}的主页">${avatarMarkup(data.user.avatarUrl, data.user.username)}</a>`
    : `${themeToggleMarkup()}<a class="btn btn-nav" href="/register.html">注册</a><a class="btn btn-nav btn-nav-active" href="/login.html">登录</a>`)
    + mobileMenuMarkup(data);

  if (data.success) startNavBadgePolling();
}

// 移动端汉堡菜单（≤560px 显示，桌面隐藏；面板内不放角标，避免与桌面图标角标 ID 重复）
function mobileMenuMarkup(data) {
  const items = data.success
    ? `<a href="/following.html">动态</a>`
      + `<a href="/notifications.html">通知</a>`
      + `<a href="/friends.html">私信</a>`
      + `<a href="/dashboard.html">投稿</a>`
      + `<a href="/space.html?user=${data.user.id}">我的主页</a>`
    : `<a class="btn btn-nav" href="/login.html">登录</a><a class="btn btn-nav btn-nav-active" href="/register.html">注册</a>`;
  return `<button class="nav-hamburger" type="button" onclick="toggleMobileMenu()" aria-label="打开菜单" aria-expanded="false" aria-controls="nav-mobile-menu">${uiIcon('menu', 20)}</button>`
    + `<div class="nav-mobile-menu" id="nav-mobile-menu">${items}</div>`;
}

// 展开/收起移动端菜单（同步 aria-expanded）
function toggleMobileMenu(force) {
  const menu = document.getElementById('nav-mobile-menu');
  const hamburger = document.querySelector('.nav-hamburger');
  if (!menu || !hamburger) return;
  const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
}

// 点击菜单项 / 菜单外区域 / Esc 后收起（全局委托一次）
(function initMobileMenuDismiss() {
  document.addEventListener('click', event => {
    const menu = document.getElementById('nav-mobile-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (event.target.closest('.nav-mobile-menu a, .nav-mobile-menu button')) {
      toggleMobileMenu(false);
      return;
    }
    if (!event.target.closest('.navbar')) toggleMobileMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') toggleMobileMenu(false);
  });
})();

// 导航角标：未读通知 + 未读私信
let navBadgeTimer = null;

function applyNavBadge(element, count) {
  if (!element) return;
  const value = Number(count) || 0;
  element.textContent = value > 99 ? '99+' : String(value);
  element.hidden = value === 0;
}

async function refreshNavBadges() {
  const notificationBadge = document.getElementById('nav-notification-badge');
  const messageBadge = document.getElementById('nav-message-badge');
  if (!notificationBadge && !messageBadge) return;

  try {
    const response = await fetch(`${API_BASE}/api/notifications/unread-count`);
    const data = await response.json();
    if (!data.success) return;
    applyNavBadge(notificationBadge, data.unread);
    applyNavBadge(messageBadge, data.messages);
  } catch (error) {
    // 轮询失败不影响页面使用
  }
}

function startNavBadgePolling() {
  refreshNavBadges();
  if (navBadgeTimer) return;
  navBadgeTimer = setInterval(refreshNavBadges, 30000);
}

// 退出登录
async function logout() {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST'
    });
    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
}

async function deleteAccount() {
  const password = window.prompt('请输入登录密码确认注销账号：');
  if (password === null) return;
  if (!window.confirm('注销后文章、视频、文件、评论和头像都会删除，确定继续吗？')) return;
  const response = await fetch(`${API_BASE}/api/user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  window.location.href = '/';
}

async function loadFriendsPage() {
  const requestsList = document.getElementById('friend-requests');
  const friendsList = document.getElementById('friends-list');
  const target = new URLSearchParams(window.location.search).get('user');
  if (target) await loadFriendTarget(target);
  if (!requestsList || !friendsList) return;
  const response = await fetch(`${API_BASE}/api/friends`);
  const data = await response.json();
  if (!data.success) return;
  requestsList.innerHTML = data.requests.length ? data.requests.map(request => `<article class="friend-card"><div class="author-line">${userAvatarMarkup(request.requester_id, request.avatarUrl, request.username)}<strong>${escapeHtml(request.username)}</strong></div><div class="friend-actions"><button class="btn btn-primary" type="button" onclick="respondFriendRequest(${request.id}, 'accept')">接受</button><button class="btn btn-secondary" type="button" onclick="respondFriendRequest(${request.id}, 'reject')">拒绝</button></div></article>`).join('') : '<p class="empty-comments">暂无好友申请</p>';
  friendsList.innerHTML = data.friends.length ? data.friends.map(friend => `<article class="friend-card"><div class="author-line">${userAvatarMarkup(friend.id, friend.avatarUrl, friend.username)}<div><strong>${escapeHtml(friend.username)}</strong><small>${escapeHtml(friend.bio || '')}</small></div></div><div class="friend-actions"><a class="btn btn-secondary" href="/chat.html?user=${friend.id}" target="_blank" rel="noopener">发消息</a><button class="btn btn-danger" type="button" onclick="removeFriend(${friend.id})">删除好友</button></div></article>`).join('') : '<p class="empty-comments">暂无好友</p>';
}

async function loadFriendTarget(userId) {
  const target = document.getElementById('friend-target');
  if (!target) return;
  const response = await fetch(`${API_BASE}/api/friends/status/${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!data.success) { target.innerHTML = '<p class="loading">用户不存在</p>'; return; }
  let action = '';
  if (data.status === 'none') action = `<button class="btn btn-primary" type="button" onclick="sendFriendRequest(${data.user.id})">添加好友</button>`;
  if (data.status === 'outgoing') action = '<span class="status-note">好友申请已发送</span>';
  if (data.status === 'incoming') action = `<button class="btn btn-primary" type="button" onclick="respondFriendRequest(${data.requestId}, 'accept')">接受好友申请</button>`;
  if (data.status === 'friend') action = `<a class="btn btn-secondary" href="/chat.html?user=${data.user.id}" target="_blank" rel="noopener">发送信息</a>`;
  target.innerHTML = `<article class="friend-target-card"><div class="author-line">${userAvatarMarkup(data.user.id, data.user.avatarUrl, data.user.username)}<div><h2>${escapeHtml(data.user.username)}</h2><p>${escapeHtml(data.user.bio || '这个用户还没有填写简介')}</p></div></div>${action}</article>`;
}

async function sendFriendRequest(userId) {
  const response = await fetch(`${API_BASE}/api/friends/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  const data = await response.json();
  showToast(data.message, data.success ? 'info' : 'error');
  if (data.success) await loadFriendsPage();
}

async function respondFriendRequest(requestId, action) {
  const response = await fetch(`${API_BASE}/api/friends/requests/${requestId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
  const data = await response.json();
  showToast(data.message, data.success ? 'info' : 'error');
  await loadFriendsPage();
}

async function removeFriend(userId) {
  if (!window.confirm('确定删除好友吗？')) return;
  await fetch(`${API_BASE}/api/friends/${userId}`, { method: 'DELETE' });
  await loadFriendsPage();
}

async function setupChatPage() {
  const userId = new URLSearchParams(window.location.search).get('user');
  const form = document.getElementById('chat-form');
  const messages = document.getElementById('chat-messages');
  if (!userId || !form || !messages) return;
  const load = async () => {
    const response = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(userId)}`);
    const data = await response.json();
    if (!data.success) { messages.innerHTML = `<p class="loading">${escapeHtml(data.message)}</p>`; return; }
    messages.innerHTML = data.messages.length ? data.messages.map(message => `<div class="message-bubble"><div class="author-line">${userAvatarMarkup(message.sender_id, message.avatarUrl, message.username)}<strong>${escapeHtml(message.username)}</strong></div><p>${escapeHtml(message.content)}</p><small>${new Date(message.created_at).toLocaleString('zh-CN')}</small></div>`).join('') : '<p class="empty-comments">暂无消息</p>';
    messages.scrollTop = messages.scrollHeight;
  };
  form.addEventListener('submit', async event => { event.preventDefault(); const response = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(userId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: form.elements.content.value }) }); const data = await response.json(); if (!data.success) showToast(data.message, 'error'); else { form.reset(); await load(); } });
  await load();
}

// 加载文章列表
async function loadPosts(targetId = 'posts-list', limit = 100, sort = 'latest', userId = null) {
  try {
    const response = await fetch(`${API_BASE}/api/posts?limit=${limit}&sort=${sort}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`);
    const posts = await response.json();
    
    const postsList = document.getElementById(targetId);
    if (!postsList) return;
    
    if (posts.length === 0) {
      postsList.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.box, '暂无文章', '抢先发布第一篇，和大家分享你的见解');
      return;
    }
    
    postsList.innerHTML = posts.map(post => `
      <article class="post-card detail-card" data-detail-url="/detail.html?type=post&id=${post.id}" tabindex="0" role="link">
        <h3>${escapeHtml(post.title)}</h3>
        <div class="meta">
          <span class="author-line">${userAvatarMarkup(post.user_id, post.avatarUrl, post.username)}<span>作者：${escapeHtml(post.username)}</span></span>
          <span>发布时间：${new Date(post.created_at).toLocaleString('zh-CN')}</span>
          <span>浏览 ${post.view_count || 0}</span>
          <span>评论 ${post.comment_count || 0}</span>
        </div>
        <div class="content">${escapeHtml(post.content).substring(0, 200)}${post.content.length > 200 ? '...' : ''}</div>
      </article>
    `).join('');
  } catch (error) {
    document.getElementById('posts-list').innerHTML = '<p class="loading">加载失败</p>';
  }
}

// 处理发布文章
async function handlePost(e) {
  e.preventDefault();

  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('content').value.trim();

  try {
    const response = await fetch(`${API_BASE}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });

    const data = await response.json();
    showMessage('post-message', data.message, !data.success);

    if (data.success) {
      document.getElementById('title').value = '';
      document.getElementById('content').value = '';
      await loadPosts();
    }
  } catch (error) {
    showMessage('post-message', '发布失败，请重试', true);
  }
}

// 加载当前用户的文章
async function loadMyPosts() {
  const postsList = document.getElementById('my-posts-list');
  if (!postsList) return;

  try {
    const response = await fetch(`${API_BASE}/api/my-posts`);
    const data = await response.json();

    if (!data.success) {
      postsList.innerHTML = '<p class="loading">请先登录</p>';
      return;
    }

    if (data.posts.length === 0) {
      postsList.innerHTML = '<p class="loading">你还没有发布文章</p>';
      return;
    }

    postsList.innerHTML = data.posts.map(post => `
      <article class="post-card detail-card" data-post-id="${post.id}" data-detail-url="/detail.html?type=post&id=${post.id}" tabindex="0" role="link">
        <div class="post-edit-view">
          <h3>${escapeHtml(post.title)}</h3>
          <div class="meta"><span class="author-line">${avatarMarkup(post.avatarUrl, post.username || '')}<span>发布时间：${new Date(post.created_at).toLocaleString('zh-CN')}</span></span></div>
          <div class="content">${escapeHtml(post.content)}</div>
          <div class="post-actions">
            <button class="btn btn-secondary" type="button" onclick="startEditPost(${post.id})">编辑</button>
            <button class="btn btn-danger" type="button" onclick="deletePost(${post.id})">删除</button>
          </div>
        </div>
        <form class="post-edit-form" hidden onsubmit="savePost(event, ${post.id})">
          <div class="form-group">
            <label>标题</label>
            <input name="title" value="${escapeAttribute(post.title)}" required>
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea name="content" rows="6" required>${escapeHtml(post.content)}</textarea>
          </div>
          <button class="btn btn-primary" type="submit">保存</button>
          <button class="btn btn-secondary" type="button" onclick="cancelEditPost(${post.id})">取消</button>
        </form>
      </article>
    `).join('');
  } catch (error) {
    postsList.innerHTML = '<p class="loading">加载失败</p>';
  }
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function startEditPost(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (!card) return;
  card.querySelector('.post-edit-view').hidden = true;
  card.querySelector('.post-edit-form').hidden = false;
}

function cancelEditPost(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (!card) return;
  card.querySelector('.post-edit-view').hidden = false;
  card.querySelector('.post-edit-form').hidden = true;
}

async function savePost(event, postId) {
  event.preventDefault();
  const form = event.target;
  const response = await fetch(`${API_BASE}/api/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: form.elements.title.value,
      content: form.elements.content.value,
    }),
  });
  const data = await response.json();
  showMessage('post-message', data.message, !data.success);
  if (data.success) await loadMyPosts();
}

async function deletePost(postId) {
  if (!window.confirm('确定删除这篇文章吗？')) return;

  const response = await fetch(`${API_BASE}/api/posts/${postId}`, { method: 'DELETE' });
  const data = await response.json();
  showMessage('post-message', data.message, !data.success);
  if (data.success) await loadMyPosts();
}

// B站式视频卡片：16:9 封面 + 时长角标 + UP主 + 播放量
function renderVideoCard(video, { showDelete = false } = {}) {
  const cover = video.posterUrl
    ? `<img class="video-cover-image" src="${escapeAttribute(video.posterUrl)}" alt="${escapeAttribute(video.title)}封面" loading="lazy">`
    : '<div class="video-cover-placeholder" aria-hidden="true">▶</div>';
  return `
    <article class="video-card" data-video-id="${video.id}" data-detail-url="/detail.html?type=video&id=${video.id}" tabindex="0" role="link">
      <div class="video-cover">
        ${cover}
        ${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
        <span class="video-cover-icon">播放</span>
        ${showDelete ? `<button class="btn btn-danger video-delete-button" type="button" onclick="deleteVideo(${video.id})">下架</button>` : ''}
      </div>
      <div class="video-info">
        <h3>${escapeHtml(video.title)}</h3>
        <div class="video-meta">
          <span class="video-author">
            ${avatarMarkup(video.avatarUrl, video.username)}
            <a class="video-author-name" href="/space.html?user=${video.user_id}" title="${escapeAttribute(video.username)}的主页">${escapeHtml(video.username)}</a>
          </span>
          <span class="video-views">${uiIcon('play', 12)} ${formatCount(video.view_count)}</span>
        </div>
      </div>
    </article>
  `;
}

// 加载公开视频（B站卡片网格）
async function loadVideos(targetId = 'videos-list', limit = 100, sort = 'latest', userId = null, categoryId = null) {
  const videosList = document.getElementById(targetId);
  if (!videosList) return;

  try {
    const [videosResponse, userResponse] = await Promise.all([
      fetch(`${API_BASE}/api/videos?limit=${limit}&sort=${sort}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}${categoryId ? `&category=${encodeURIComponent(categoryId)}` : ''}`),
      fetch(`${API_BASE}/api/user`),
    ]);
    const videos = await videosResponse.json();
    const userData = await userResponse.json();

    if (!Array.isArray(videos) || videos.length === 0) {
      videosList.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.box, '暂无视频', '这里还是一片空白，等你来投稿');
      return;
    }

    const currentUserId = userData.success ? userData.user.id : null;
    videosList.innerHTML = videos.map(video => renderVideoCard(video, {
      showDelete: currentUserId && currentUserId === video.user_id,
    })).join('');
  } catch (error) {
    videosList.innerHTML = '<p class="loading">视频加载失败</p>';
  }
}

// 首页推荐视频流（支持分区过滤）
async function loadRecommendVideos(categoryId = '') {
  const videosList = document.getElementById('videos-list');
  if (!videosList) return;

  try {
    const response = await fetch(`${API_BASE}/api/videos/recommend?limit=24${categoryId ? `&category=${encodeURIComponent(categoryId)}` : ''}`);
    const videos = await response.json();
    videosList.innerHTML = Array.isArray(videos) && videos.length
      ? videos.map(video => renderVideoCard(video)).join('')
      : emptyStateMarkup(EMPTY_STATE_ICONS.box, '该分区还没有视频', '快来抢首播吧');
  } catch (error) {
    videosList.innerHTML = '<p class="loading">视频加载失败</p>';
  }
}

// 首页分区 Tab：加载分区数据并绑定切换
async function loadCategoriesAndTabs() {
  const tabs = document.getElementById('category-tabs');
  if (!tabs) return;

  try {
    const categories = await (await fetch(`${API_BASE}/api/videos/categories`)).json();
    tabs.innerHTML = '<button class="category-tab active" data-category="">全部</button>'
      + categories.map(category => `<button class="category-tab" data-category="${category.id}">${escapeHtml(category.name)}</button>`).join('');
    tabs.addEventListener('click', event => {
      const button = event.target.closest('.category-tab');
      if (!button) return;
      tabs.querySelectorAll('.category-tab').forEach(tab => tab.classList.toggle('active', tab === button));
      loadRecommendVideos(button.dataset.category);
    });
  } catch (error) {
    // 分区加载失败时保留"全部"Tab
  }
}

// 上传表单的分区下拉选项
async function populateCategorySelect(select) {
  if (!select) return;
  try {
    const categories = await (await fetch(`${API_BASE}/api/videos/categories`)).json();
    select.innerHTML = '<option value="">选择分区（可选）</option>'
      + categories.map(category => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  } catch (error) {
    select.innerHTML = '<option value="">分区暂不可用</option>';
  }
}

// 视频详情页下方"相关推荐"列表
async function loadRecommendList(videoId) {
  const list = document.getElementById('recommend-list');
  if (!list) return;

  try {
    const videos = await (await fetch(`${API_BASE}/api/videos/recommend?limit=8`)).json();
    const items = (Array.isArray(videos) ? videos : []).filter(video => video.id !== Number(videoId)).slice(0, 6);
    list.innerHTML = items.length ? items.map(video => `
      <a class="recommend-item" href="/detail.html?type=video&id=${video.id}">
        <span class="recommend-cover">${video.posterUrl ? `<img src="${escapeAttribute(video.posterUrl)}" alt="${escapeAttribute(video.title)}封面" loading="lazy">` : '<div class="video-cover-placeholder" aria-hidden="true">▶</div>'}${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}</span>
        <span class="recommend-info">
          <h4>${escapeHtml(video.title)}</h4>
          <p>${escapeHtml(video.username)} · ▶ ${formatCount(video.view_count)}${video.category_name ? ` · ${escapeHtml(video.category_name)}` : ''}</p>
        </span>
      </a>
    `).join('') : '<p class="loading">暂无更多推荐</p>';
  } catch (error) {
    list.innerHTML = '<p class="loading">推荐加载失败</p>';
  }
}

async function loadFiles(targetId = 'files-list', limit = 100, sort = 'latest', userId = null) {
  const filesList = document.getElementById(targetId);
  if (!filesList) return;

  try {
    const [filesResponse, userResponse] = await Promise.all([
      fetch(`${API_BASE}/api/files?limit=${limit}&sort=${sort}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`),
      fetch(`${API_BASE}/api/user`),
    ]);
    const files = await filesResponse.json();
    const userData = await userResponse.json();

    if (files.length === 0) {
      filesList.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.box, '暂无文件', '上传文件，和大家共享资源');
      return;
    }

    const currentUserId = userData.success ? userData.user.id : 0;
    filesList.innerHTML = files.map(file => `
      <article class="file-item detail-card" data-file-id="${file.id}" data-detail-url="/detail.html?type=file&id=${file.id}" tabindex="0" role="link">
        <h3>${escapeHtml(file.title)}</h3>
        <div class="meta">
          <span class="author-line">${userAvatarMarkup(file.user_id, file.avatarUrl, file.username)}<span>作者：${escapeHtml(file.username)}</span></span>
          <span>上传于：${new Date(file.created_at).toLocaleString('zh-CN')}</span>
          <span>下载 ${file.download_count || 0}</span>
        </div>
        <p>${escapeHtml(file.original_name)}${file.passwordProtected ? ' · 需要密码' : ''}</p>
        <div class="file-actions">
          ${file.downloadUrl ? `<a class="btn btn-secondary" href="${file.downloadUrl}" target="_blank" rel="noopener noreferrer">下载</a>` : ''}
          ${!file.downloadUrl ? `<button class="btn btn-primary" type="button" onclick="downloadProtectedFile(${file.id})">输入密码下载</button>` : ''}
          ${file.user_id === currentUserId ? `<button class="btn btn-danger" type="button" onclick="deleteFile(${file.id})">删除</button>` : ''}
        </div>
      </article>
    `).join('');
  } catch (error) {
    filesList.innerHTML = '<p class="loading">文件加载失败</p>';
  }
}

async function loadMySubmissions() {
  const response = await fetch(`${API_BASE}/api/my-submissions`);
  const data = await response.json();
  if (!data.success) return;
  document.getElementById('my-post-count').textContent = `${data.posts.length} 条`;
  document.getElementById('my-video-count').textContent = `${data.videos.length} 条`;
  document.getElementById('my-file-count').textContent = `${data.files.length} 条`;
  const postList = document.getElementById('my-submission-posts');
  const videoList = document.getElementById('my-submission-videos');
  const fileList = document.getElementById('my-submission-files');
  postList.innerHTML = data.posts.length ? data.posts.map(post => `
    <article class="post-card detail-card" data-detail-url="/detail.html?type=post&id=${post.id}" tabindex="0" role="link"><h3>${escapeHtml(post.title)}</h3><div class="meta">浏览 ${post.view_count || 0} · ${new Date(post.created_at).toLocaleString('zh-CN')}</div><p>${escapeHtml(post.summary || '')}</p></article>
  `).join('') : '<p class="loading">暂无文章</p>';
  videoList.innerHTML = data.videos.length ? data.videos.map(video => `
    <article class="video-card detail-card" data-detail-url="/detail.html?type=video&id=${video.id}" tabindex="0" role="link"><h3>${escapeHtml(video.title)}</h3><div class="video-cover">${video.posterUrl ? `<img class="video-cover-image" src="${escapeAttribute(video.posterUrl)}" alt="${escapeAttribute(video.title)}封面">` : ''}<span class="video-cover-icon">播放</span></div><div class="meta">浏览 ${video.view_count || 0} · ${new Date(video.created_at).toLocaleString('zh-CN')}</div></article>
  `).join('') : '<p class="loading">暂无视频</p>';
  fileList.innerHTML = data.files.length ? data.files.map(file => `
    <article class="file-item detail-card" data-detail-url="/detail.html?type=file&id=${file.id}" tabindex="0" role="link"><h3>${escapeHtml(file.title)}</h3><div class="meta">下载 ${file.download_count || 0} · ${new Date(file.created_at).toLocaleString('zh-CN')}</div><p>${escapeHtml(file.summary || '')}</p></article>
  `).join('') : '<p class="loading">暂无文件</p>';
}

function setupBrowsePage() {
  const list = document.getElementById('browse-list');
  const sortSelect = document.getElementById('browse-sort');
  if (!list || !sortSelect) return;
  const type = new URLSearchParams(window.location.search).get('type') || 'post';
  const titles = { post: '全部文章', video: '全部视频', file: '全部文件' };
  document.getElementById('browse-title').textContent = titles[type] || titles.post;
  const load = async () => {
    if (type === 'post') await loadPosts('browse-list', 100, sortSelect.value);
    else if (type === 'video') await loadVideos('browse-list', 100, sortSelect.value);
    else await loadFiles('browse-list', 100, sortSelect.value);
  };
  sortSelect.addEventListener('change', load);
  load();
}

async function downloadProtectedFile(fileId) {
  const password = window.prompt('请输入该文件密码：');
  if (password === null) return;

  const verifyResponse = await fetch(`${API_BASE}/api/files/${fileId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const verifyData = await verifyResponse.json();
  if (!verifyData.success) {
    showToast(verifyData.message, 'error');
    return;
  }

  const url = `${API_BASE}/api/files/${fileId}/download?password=${encodeURIComponent(password)}`;
  window.open(url, '_blank');
}

async function deleteFile(fileId) {
  if (!window.confirm('确定删除这个文件吗？')) return;

  const response = await fetch(`${API_BASE}/api/files/${fileId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  await loadFiles();
}

function setupGlobalSearch() {
  const form = document.getElementById('nav-search-form');
  const input = document.getElementById('nav-search-input');
  if (!form || !input) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      input.focus();
      return;
    }
    window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
  });
}

function setupDetailCards() {
  document.addEventListener('click', event => {
    const card = event.target.closest('[data-detail-url]');
    if (!card || event.target.closest('a, button, input, select, textarea')) return;
    window.location.href = card.dataset.detailUrl;
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-detail-url]');
    if (!card || event.target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();
    window.location.href = card.dataset.detailUrl;
  });
}

async function loadSearchResults() {
  const results = document.getElementById('search-results');
  const input = document.getElementById('nav-search-input');
  if (!results || !input) return;

  const params = new URLSearchParams(window.location.search);
  const query = params.get('q')?.trim() || '';
  const requestedType = ['post', 'video', 'file'].includes(params.get('type')) ? params.get('type') : null;
  const isFullView = params.get('view') === 'all';
  const sortSelect = document.getElementById('search-sort');
  if (sortSelect) {
    sortSelect.value = params.get('sort') === 'latest' ? 'latest' : 'hot';
    sortSelect.addEventListener('change', () => {
      const next = new URLSearchParams(window.location.search);
      next.set('sort', sortSelect.value);
      window.location.href = `/search.html?${next.toString()}`;
    });
  }
  input.value = query;
  if (!query) {
    results.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.search, '请输入关键词开始搜索', '支持搜索文章、视频和文件');
    return;
  }

  try {
    const limit = isFullView ? 100 : 4;
    const typeParam = requestedType ? `&type=${requestedType}` : '';
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}&sort=${sortSelect ? sortSelect.value : 'hot'}${typeParam}`);
    if (!response.ok) throw new Error('search request failed');
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      results.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.search, '没有找到相关内容', '换个关键词试试，或检查输入是否有误', '/', '回到首页');
      return;
    }
    const groups = [
      { type: 'post', title: '博客文章', empty: '没有找到相关文章' },
      { type: 'video', title: '视频', empty: '没有找到相关视频' },
      { type: 'file', title: '文件', empty: '没有找到相关文件' },
    ].filter(group => !requestedType || group.type === requestedType);

    results.innerHTML = groups.map(group => {
      const groupItems = items.filter(item => item.type === group.type);
      return `
        <section class="search-category">
          <div class="search-category-heading">
            <h2>${group.title}</h2>
            <span>${groupItems.length} 条结果</span>
          </div>
          <div class="search-category-list">
            ${groupItems.length ? groupItems.map(renderSearchResult).join('') : `<p class="search-empty">${group.empty}</p>`}
          </div>
          ${!isFullView ? `<a class="more-link" href="/search.html?q=${encodeURIComponent(query)}&type=${group.type}&view=all&sort=${sortSelect ? sortSelect.value : 'hot'}" target="_blank" rel="noopener">更多${group.title}</a>` : ''}
        </section>
      `;
    }).join('');
  } catch (error) {
    results.innerHTML = '<p class="loading">搜索失败，请稍后重试</p>';
  }
}

function renderSearchResult(item) {
  const summary = item.summary ? escapeHtml(String(item.summary).slice(0, 160)) : '无简介';
  const metric = item.type === 'file'
    ? `下载 ${item.download_count || 0}`
    : `浏览 ${item.view_count || 0}`;
  const action = item.type === 'file'
    ? (item.protected
      ? `<button class="btn btn-primary" type="button" onclick="downloadProtectedFile(${item.id})">密码下载</button>`
      : `<a class="btn btn-secondary" href="/api/files/${item.id}/download">下载文件</a>`)
    : `<a class="btn btn-secondary" href="/detail.html?type=${item.type}&id=${item.id}">查看详情</a>`;

  return `
    <article class="search-result-item detail-card" data-detail-url="/detail.html?type=${item.type}&id=${item.id}" tabindex="0" role="link">
      <h3>${escapeHtml(item.title || item.original_name || '未命名')}</h3>
      <p class="author-line">${userAvatarMarkup(item.user_id, item.avatarUrl, item.username)}<span>${escapeHtml(item.username || '未知用户')}</span></p>
      ${item.type === 'video' ? `<div class="search-video-cover">${item.posterUrl ? `<img src="${escapeAttribute(item.posterUrl)}" alt="${escapeAttribute(item.title)}封面">` : '<span>暂无封面</span>'}<span class="video-cover-icon">播放</span></div>` : ''}
      <p>${summary}</p>
      <p class="search-metric">${metric}</p>
      ${item.protected ? '<p class="search-protected">需要密码访问</p>' : ''}
      ${action}
    </article>
  `;
}

async function loadDetailPage() {
  const detail = document.getElementById('detail-content');
  if (!detail) return;

  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  const id = params.get('id');
  const endpoints = { post: 'posts', video: 'videos', file: 'files' };
  if (!endpoints[type] || !id) {
    detail.innerHTML = '<p class="loading">详情地址不正确</p>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/${endpoints[type]}/${encodeURIComponent(id)}`);
    const item = await response.json();
    if (!response.ok) throw new Error(item.message || 'load failed');
    document.title = `${item.title} - 烬潮`;

    if (type === 'post') {
      detail.innerHTML = `
        <article class="detail-panel">
          <span class="detail-type">博客文章</span>
          <h1>${escapeHtml(item.title)}</h1>
          <div class="meta"><span class="author-line">${userAvatarMarkup(item.user_id, item.avatarUrl, item.username)}<span>作者：${escapeHtml(item.username)}</span></span><span>发布于：${new Date(item.created_at).toLocaleString('zh-CN')}</span><span>浏览 ${item.view_count || 0}</span></div>
          <div class="detail-content-text">${escapeHtml(item.content)}</div>
          <div class="detail-actions">
            ${favoriteButtonMarkup('post', item.id, item.favorited, item.favorite_count)}
            <button class="btn btn-secondary" type="button" onclick="reportContent('post', ${item.id})">举报</button>
          </div>
          <section class="detail-comments">
            <h2>文章评论</h2>
            <div class="comments" id="post-comments-${item.id}"><p class="loading">加载评论中...</p></div>
            <form class="comment-form" onsubmit="submitPostComment(event, ${item.id})">
              <input name="content" data-mention-input list="mention-users" maxlength="500" placeholder="写下评论，使用 @用户名 提及他人" required>
              <button class="btn btn-secondary" type="submit">评论</button>
            </form>
            <datalist id="mention-users"></datalist>
          </section>
        </article>
      `;
      setupMentionInputs();
      await loadPostComments(item.id);
      return;
    }

    if (type === 'video') {
      detail.innerHTML = renderVideoDetail(item);
      initializeVideoPlayers();
      const videoEl = detail.querySelector('.video-player');
      setupVideoBarrages(item.id, videoEl);
      setupBarrageControls(detail);
      setBarrageEditHandler(barrageId => openBarrageEditor(barrageId));
      setupUpCard(item.user_id);
      loadRecommendList(item.id);
      await loadVideoComments(item.id);
      return;
    }

    detail.innerHTML = `
      <article class="detail-panel">
        <span class="detail-type">文件</span>
        <h1>${escapeHtml(item.title)}</h1>
          <div class="meta"><span class="author-line">${userAvatarMarkup(item.user_id, item.avatarUrl, item.username)}<span>作者：${escapeHtml(item.username)}</span></span><span>上传于：${new Date(item.created_at).toLocaleString('zh-CN')}</span><span>下载 ${item.download_count || 0}</span></div>
        <div class="file-detail-info">
          <p>文件名：${escapeHtml(item.original_name)}</p>
          <p>类型：${escapeHtml(item.mime_type || '未知')}</p>
          <p>大小：${formatFileSize(item.file_size)}</p>
          ${item.protected ? '<p class="search-protected">该文件需要密码才能下载</p>' : ''}
        </div>
        <div class="detail-actions">
          ${item.protected && !item.owner ? `<button class="btn btn-primary" type="button" onclick="downloadProtectedFile(${item.id})">输入密码下载</button>` : `<a class="btn btn-primary" href="${item.downloadUrl || `/api/files/${item.id}/download`}">下载文件</a>`}
          ${favoriteButtonMarkup('file', item.id, item.favorited, item.favorite_count)}
          <button class="btn btn-secondary" type="button" onclick="reportContent('file', ${item.id})">举报</button>
        </div>
      </article>
    `;
  } catch (error) {
    detail.innerHTML = '<p class="loading">内容不存在或加载失败</p>';
  }
}

// B站式视频详情：左侧播放器+弹幕，右侧标题/UP主/操作，下方推荐与评论
function renderVideoDetail(video) {
  return `
    <div class="video-detail-panel" data-video-id="${video.id}">
      <article class="detail-page">
        <div class="detail-main">
          <div class="video-frame">
            <span class="video-quality">${video.hlsUrl ? 'HLS 高清' : 'MP4'}</span>
            <video class="video-player" controls playsinline webkit-playsinline x-webkit-airplay="deny" disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" preload="metadata" poster="${escapeAttribute(video.posterUrl || '')}" data-hls="${escapeAttribute(video.hlsUrl || '')}" data-mp4="${escapeAttribute(video.mp4Url || '')}" data-webm="${escapeAttribute(video.webmUrl || '')}">
              ${video.mp4Url ? `<source src="${escapeAttribute(video.mp4Url)}" type="video/mp4">` : ''}
              ${video.webmUrl ? `<source src="${escapeAttribute(video.webmUrl)}" type="video/webm">` : ''}
            </video>
            <button class="video-fullscreen-btn" type="button" data-video-fullscreen aria-label="全屏播放" title="全屏播放">${uiIcon('fullscreen', 18)}</button>
            <div class="barrage-layer" id="barrage-layer" aria-hidden="true"></div>
          </div>
          <form class="barrage-input-row" onsubmit="handleBarrageSend(event, ${video.id})">
            <input class="barrage-input" name="content" maxlength="100" placeholder="发个弹幕见证当下～" required>
            <button class="btn btn-secondary" type="button" onclick="toggleBarrageLayer(this)">关闭弹幕</button>
            <button class="btn btn-primary" type="submit">发送</button>
          </form>
          ${barrageToolbarMarkup(video.id)}
          <div class="video-detail-actions">
            <button class="btn like-button ${video.liked ? 'is-liked' : ''}" type="button" aria-pressed="${video.liked ? 'true' : 'false'}" onclick="toggleVideoLike(${video.id})">${LIKE_ICON}<span class="like-label">${video.liked ? '已点赞' : '点赞'}</span><span class="like-count">${formatCount(video.like_count)}</span></button>
            ${favoriteButtonMarkup('video', video.id, video.favorited, video.favorite_count)}
            <button class="btn btn-secondary" type="button" onclick="reportContent('video', ${video.id})">举报</button>
            <label class="video-quality video-speed-inline">播放速度
              <select data-video-speed aria-label="播放速度"><option value="0.5">0.5x</option><option value="1" selected>正常</option><option value="1.5">1.5x</option><option value="2">2x</option></select>
            </label>
          </div>
          <div class="video-detail-stats">
            <span>▶ ${formatCount(video.view_count)} 播放</span>
            <span>评论 <span class="comment-count">${video.comment_count}</span></span>
            <span>发布于 ${new Date(video.created_at).toLocaleString('zh-CN')}</span>
          </div>
          <section class="detail-comments">
            <div class="section-header"><h2>视频评论</h2></div>
            <div class="comments" id="comments-${video.id}"><p class="loading">加载评论中...</p></div>
            <form class="comment-form" onsubmit="submitVideoComment(event, ${video.id})"><input name="content" data-mention-input list="mention-users" maxlength="500" placeholder="写下评论，使用 @用户名 提及他人" required><button class="btn btn-secondary" type="submit">评论</button></form><datalist id="mention-users"></datalist>
          </section>
        </div>
        <aside class="detail-side">
          <div class="video-info-panel">
            <h1>${escapeHtml(video.title)}</h1>
            <div class="detail-meta">
              ${video.category_name ? `<span class="category-badge">${escapeHtml(video.category_name)}</span>` : ''}
              <span>▶ ${formatCount(video.view_count)} 播放</span>
              <span>💬 ${formatCount(video.comment_count)}</span>
            </div>
            <div class="up-card">
              ${avatarMarkup(video.avatarUrl, video.username)}
              <div class="up-info">
                <a class="up-name" href="/space.html?user=${video.user_id}">${escapeHtml(video.username)}</a>
                <span class="up-fans" id="up-fans">粉丝 --</span>
              </div>
              <div class="up-actions" id="up-actions"></div>
            </div>
          </div>
        </aside>
      </article>
      <section class="recommend-section">
        <div class="section-header"><h2>相关推荐</h2></div>
        <div class="recommend-list" id="recommend-list">${skeletonRows(4)}</div>
      </section>
    </div>
  `;
}

// ===== 弹幕系统 =====

// 与后端一致的白名单：旧服务进程暂不返回样式字段，前端必须自行兜底并过滤，杜绝样式注入
const BARRAGE_COLORS = ['#ffffff', '#fe0302', '#ff7204', '#ffaa02', '#ffd302', '#ffff00', '#a0ee00', '#00cd00', '#019899', '#4266be', '#89d5ff', '#cc0273'];
const BARRAGE_FONT_SIZES = [18, 25, 32];
const BARRAGE_SPEEDS = ['slow', 'normal', 'fast'];
// 速度档位 → 基础时长（秒）
const BARRAGE_BASE_DURATION = { slow: 10, normal: 7, fast: 4.5 };
// 纵向轨道几何自适应：按图层实测高度与最大字号动态计算像素步长与轨道数
const BARRAGE_MAX_FONT_SIZE = Math.max.apply(null, BARRAGE_FONT_SIZES); // 最大可选字号（32）
const BARRAGE_LANE_GAP_FACTOR = 1.15;   // 像素步长 = 最大字号 × 该系数（≥1.1，保证相邻轨道文字不垂直重叠）
const BARRAGE_LANE_FIRST_OFFSET = 8;    // 首行轨道距图层顶部边距（px）
const BARRAGE_LANE_COUNT_MIN = 3;       // 自适应轨道数下限
const BARRAGE_LANE_COUNT_MAX = 18;      // 自适应轨道数上限
// 图层高度不可用（布局未完成 / 图层隐藏）时的安全退化：沿用修复前的 7 条百分比布局
const BARRAGE_LANE_FALLBACK = { count: 7, base: 8, step: 11, unit: 'percent' };
const BARRAGE_MAX_NODES = 60;   // 同屏 DOM 节点上限
const BARRAGE_PRESET_KEY = 'jinchao:barrage-preset';
const BARRAGE_DEFAULT_STYLE = { color: '#ffffff', fontSize: 25, speed: 'normal' };

// 模块级弹幕状态：当前视频的弹幕列表、在屏节点映射、轨道占用
const barrageState = {
  videoId: null,
  videoEl: null,
  layer: null,
  list: [],                                              // 当前视频弹幕（按 offset_ms 升序）
  elements: new Map(),                                   // barrageId → 在屏 DOM 节点
  nodes: new Set(),                                      // 在屏节点（含无 id 的本地弹幕，供渲染循环遍历）
  lanes: new Array(BARRAGE_LANE_FALLBACK.count).fill(0), // 每条轨道的空闲时刻（视频时间毫秒）
  laneCount: BARRAGE_LANE_FALLBACK.count,               // 当前轨道数（自适应）
  laneBase: BARRAGE_LANE_FALLBACK.base,                 // 首行轨道位置
  laneStep: BARRAGE_LANE_FALLBACK.step,                 // 轨道步长
  laneUnit: BARRAGE_LANE_FALLBACK.unit,                 // 位置单位：'px'（实测高度可用）/ 'percent'（退化）
  laneHeight: -1,                                       // 上次计算轨道时的图层高度缓存
  laneWidth: -1,                                        // 上次计算轨道时的图层宽度缓存
  cursor: 0,                                             // 下一条待挂接弹幕的下标（第一个 offset_ms > 当前播放毫秒）
  editHandler: null,                                     // 点击自己的弹幕时的回调
  onResize: null,
  handlers: null,                                        // 当前视频元素上已绑定的媒体事件处理器（换视频时解绑）
  rafId: null,                                           // requestAnimationFrame 句柄
  running: false,                                        // 渲染循环是否在运行
};

function normalizeBarrageColor(value) {
  return BARRAGE_COLORS.indexOf(value) >= 0 ? value : BARRAGE_DEFAULT_STYLE.color;
}

function normalizeBarrageFontSize(value) {
  const size = Number(value);
  return BARRAGE_FONT_SIZES.indexOf(size) >= 0 ? size : BARRAGE_DEFAULT_STYLE.fontSize;
}

function normalizeBarrageSpeed(value) {
  return BARRAGE_SPEEDS.indexOf(value) >= 0 ? value : BARRAGE_DEFAULT_STYLE.speed;
}

// 归一化弹幕对象：缺字段或非白名单值一律回退默认值
function normalizeBarrage(barrage) {
  const source = barrage && typeof barrage === 'object' ? barrage : {};
  const rawSize = source.font_size !== undefined ? source.font_size : source.fontSize;
  return Object.assign({}, source, {
    content: source.content === undefined || source.content === null ? '' : String(source.content),
    offset_ms: Number(source.offset_ms) || 0,
    color: normalizeBarrageColor(source.color),
    font_size: normalizeBarrageFontSize(rawSize),
    speed: normalizeBarrageSpeed(source.speed),
  });
}

// 确定性时长：速度档位基础时长 + 随文字长度增长的补偿（最多 3 秒）
function barrageDurationSeconds(barrage) {
  const base = BARRAGE_BASE_DURATION[barrage && barrage.speed] || BARRAGE_BASE_DURATION.normal;
  const content = (barrage && barrage.content) || '';
  return base + Math.min(3, content.length * 0.15);
}

// ===== 轨道分配 =====

// 依据图层实测高度与最大字号计算轨道几何；高度不可用时退化为安全默认值
function computeBarrageGeometry(layer) {
  const height = layer ? layer.clientHeight : 0;
  if (!(height > 0)) return Object.assign({}, BARRAGE_LANE_FALLBACK);
  const step = BARRAGE_MAX_FONT_SIZE * BARRAGE_LANE_GAP_FACTOR;
  const base = BARRAGE_LANE_FIRST_OFFSET;
  const count = Math.max(
    BARRAGE_LANE_COUNT_MIN,
    Math.min(BARRAGE_LANE_COUNT_MAX, Math.floor((height - base) / step) + 1)
  );
  return { count, base, step, unit: 'px' };
}

// 按需重算：图层尺寸变化时更新轨道几何并重置占用（视频元数据加载前高度可能为 0）
function syncBarrageLanes(force) {
  const layer = barrageState.layer;
  const height = layer ? layer.clientHeight : 0;
  const width = layer ? layer.clientWidth : 0;
  if (!force && height === barrageState.laneHeight && width === barrageState.laneWidth) return;
  barrageState.laneHeight = height;
  barrageState.laneWidth = width;
  const geometry = computeBarrageGeometry(layer);
  barrageState.laneCount = geometry.count;
  barrageState.laneBase = geometry.base;
  barrageState.laneStep = geometry.step;
  barrageState.laneUnit = geometry.unit;
  resetBarrageLanes();
}

// 按「当前」轨道数重建占用数组（自适应后长度不再固定为 7）
function resetBarrageLanes() {
  barrageState.lanes = new Array(barrageState.laneCount).fill(0);
}

// 优先最靠上的空闲轨道；全部占用时取最早空闲的一条
// nowMs 为视频时间毫秒（与暂停/倍速无关，轨道占用语义始终一致）
function pickBarrageLane(nowMs) {
  for (let i = 0; i < barrageState.lanes.length; i++) {
    if (barrageState.lanes[i] <= nowMs) return i;
  }
  let candidate = 0;
  for (let i = 1; i < barrageState.lanes.length; i++) {
    if (barrageState.lanes[i] < barrageState.lanes[candidate]) candidate = i;
  }
  return candidate;
}

// 估算该弹幕「从右侧完全进入」所需时长，折算为该轨道下一次可用时刻（视频时间毫秒）
function occupyBarrageLane(lane, nowMs, durationMs, itemWidth) {
  const layerWidth = barrageState.layer ? barrageState.layer.clientWidth : 0;
  const ratio = layerWidth > 0 && itemWidth > 0 ? layerWidth / (layerWidth + itemWidth) : 0.6;
  barrageState.lanes[lane] = nowMs + durationMs * ratio;
}

// ===== 在屏节点管理 =====

// 登记在屏节点：有真实 id 时同时写入 elements 映射（编辑链路依赖 elements.get(id) === item）
function registerBarrageNode(item, id) {
  barrageState.nodes.add(item);
  if (id !== undefined && id !== null) barrageState.elements.set(id, item);
}

function unregisterBarrageNode(item) {
  barrageState.nodes.delete(item);
  barrageState.elements.forEach((node, id) => {
    if (node === item) barrageState.elements.delete(id);
  });
}

// 超出同屏上限时从最早的节点开始回收
function enforceBarrageLimit(layer) {
  const nodes = layer.querySelectorAll('.barrage');
  let overflow = nodes.length - BARRAGE_MAX_NODES;
  for (let i = 0; overflow > 0 && i < nodes.length; i++, overflow--) {
    unregisterBarrageNode(nodes[i]);
    nodes[i].remove();
  }
}

function clearBarrageLayer(layer) {
  const target = layer || barrageState.layer;
  if (target) target.querySelectorAll('.barrage').forEach(item => item.remove());
  barrageState.elements.clear();
  barrageState.nodes.clear();
}

// 横向位移距离：元素需从图层右外侧完整移到左外侧，故为「图层宽 + 元素宽 + 2」
function computeBarrageTravel(item, layer) {
  const target = layer || barrageState.layer;
  const itemWidth = item ? item.offsetWidth : 0;
  const measured = target ? target.clientWidth : 0;
  // 图层被隐藏等异常情况下 clientWidth 为 0，退化为最小位移，避免位移过小导致元素停在画面内
  const layerWidth = measured > 0 ? measured : 320;
  return layerWidth + itemWidth + 2;
}

// 位置 = 视频时间的函数：progress=0 时左边缘正好在图层右边界（配合 CSS 的 left:100%）
function applyBarragePosition(item, videoMs) {
  const meta = item ? item.__barrage : null;
  if (!meta || !(meta.durationMs > 0)) return 0;
  const progress = (videoMs - meta.offsetMs) / meta.durationMs;
  item.style.translate = `${-progress * meta.travel}px 0`;
  return progress;
}

// 生成一条弹幕节点：atMs 为挂接时刻的视频毫秒，位置由 offsetMs 与 atMs 共同决定
function spawnBarrage(layer, content, barrage, atMs) {
  if (!layer) return null;
  // 减动效偏好：弹幕完全依赖位移表达，直接不渲染
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (layer.dataset.off === '1') return null;
  const data = normalizeBarrage(Object.assign({}, barrage || {}, {
    content: barrage && barrage.content !== undefined ? barrage.content : content,
  }));
  if (!data.content) return null;

  const videoEl = barrageState.videoEl;
  const nowMs = Number.isFinite(atMs) ? atMs : (videoEl ? videoEl.currentTime * 1000 : 0);

  const item = document.createElement('span');
  item.className = 'barrage';
  item.textContent = data.content;
  item.style.color = data.color;
  item.style.fontSize = `${data.font_size}px`;
  const durationMs = barrageDurationSeconds(data) * 1000;

  // 按需重算轨道几何（图层高度在视频元数据加载前可能为 0，故不能只在初始化时算一次）
  syncBarrageLanes();
  const lane = pickBarrageLane(nowMs);
  const laneTop = barrageState.laneBase + lane * barrageState.laneStep;
  item.style.top = barrageState.laneUnit === 'percent' ? `${laneTop}%` : `${laneTop}px`;

  // 自己的弹幕可点击编辑（回调由 setBarrageEditHandler 注册）
  if (data.isOwn || data.is_own) {
    item.classList.add('barrage-own');
    if (data.id !== undefined && data.id !== null) item.dataset.barrageId = String(data.id);
    item.addEventListener('click', () => {
      if (typeof barrageState.editHandler === 'function') barrageState.editHandler(data.id);
    });
  }

  layer.appendChild(item);
  item.__barrage = {
    offsetMs: data.offset_ms,
    durationMs,
    travel: computeBarrageTravel(item, layer),
    speed: data.speed,
    frozen: false,
  };
  applyBarragePosition(item, nowMs);
  occupyBarrageLane(lane, nowMs, durationMs, item.offsetWidth);
  registerBarrageNode(item, data.id);
  return item;
}

// 弹幕开关
function toggleBarrageLayer(button) {
  const panel = button && button.closest ? button.closest('.video-detail-panel') : null;
  const layer = panel ? panel.querySelector('.barrage-layer') : document.getElementById('barrage-layer');
  if (!layer) return;
  const wasOff = layer.dataset.off === '1';
  layer.dataset.off = wasOff ? '0' : '1';
  layer.style.display = wasOff ? '' : 'none';
  if (button) button.textContent = wasOff ? '关闭弹幕' : '开启弹幕';

  // 无论开或关都清空节点与映射、重置轨道占用，避免隐藏期间节点无界堆积
  clearBarrageLayer(layer);
  resetBarrageLanes();
  const videoEl = panel ? panel.querySelector('.video-player') : null;
  // 重新开启时只重建当前飞行窗口内的少量弹幕，不回放历史、不集中爆发
  if (wasOff && videoEl && barrageState.videoEl === videoEl) {
    syncBarrageLanes(true);
    rebuildBarrageFrame();
  }
}

// ===== 弹幕数据与在屏节点的对外接口（Task 5 实时更新使用） =====

// 返回当前视频弹幕数组的引用（按 offset_ms 升序），调用方直接改字段即可
function getBarrageCache() {
  return barrageState.list;
}

function setBarrageCache(list) {
  barrageState.list = Array.isArray(list)
    ? list.map(item => normalizeBarrage(item)).sort((a, b) => a.offset_ms - b.offset_ms)
    : [];
  return barrageState.list;
}

function addBarrageToCache(barrage) {
  if (!barrage) return null;
  const item = normalizeBarrage(barrage);
  barrageState.list.push(item);
  barrageState.list.sort((a, b) => a.offset_ms - b.offset_ms);
  return item;
}

function updateBarrageInCache(id, fields) {
  const index = barrageState.list.findIndex(item => item && item.id === id);
  if (index < 0) return false;
  const merged = normalizeBarrage(Object.assign({}, barrageState.list[index], fields || {}));
  barrageState.list[index] = merged;
  barrageState.list.sort((a, b) => a.offset_ms - b.offset_ms);
  return true;
}

function removeBarrageFromCache(id) {
  const index = barrageState.list.findIndex(item => item && item.id === id);
  if (index < 0) return false;
  barrageState.list.splice(index, 1);
  return true;
}

// 命中在屏节点时立即改写文本与样式，返回是否命中（同步重算时长与位移距离）
function updateBarrageElement(id, fields) {
  const item = barrageState.elements.get(id);
  if (!item || !fields) return false;
  if (fields.content !== undefined) item.textContent = String(fields.content);
  if (fields.color !== undefined) item.style.color = normalizeBarrageColor(fields.color);
  const rawSize = fields.font_size !== undefined ? fields.font_size : fields.fontSize;
  if (rawSize !== undefined) item.style.fontSize = `${normalizeBarrageFontSize(rawSize)}px`;
  const meta = item.__barrage;
  if (meta) {
    if (fields.speed !== undefined) meta.speed = normalizeBarrageSpeed(fields.speed);
    if (fields.speed !== undefined || fields.content !== undefined) {
      meta.durationMs = barrageDurationSeconds({ content: item.textContent, speed: meta.speed }) * 1000;
    }
    // 改字号或内容会改变元素宽度，位移距离必须重算
    meta.travel = computeBarrageTravel(item, barrageState.layer);
    if (!meta.frozen) applyBarragePosition(item, barrageState.videoEl ? barrageState.videoEl.currentTime * 1000 : 0);
  }
  return true;
}

function removeBarrageElement(id) {
  const item = barrageState.elements.get(id);
  if (!item) return false;
  unregisterBarrageNode(item);
  item.remove();
  return true;
}

function setBarrageEditHandler(fn) {
  barrageState.editHandler = typeof fn === 'function' ? fn : null;
}

// 下一条待挂接弹幕的下标：第一个 offset_ms > 当前播放毫秒的弹幕
function barrageCursorFor(list, nowMs) {
  let index = 0;
  while (index < list.length && list[index].offset_ms <= nowMs) index += 1;
  return index;
}

// ===== 发送前预设样式 =====

function getBarragePreset() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(BARRAGE_PRESET_KEY) || 'null');
  } catch (error) {
    stored = null;
  }
  const source = stored && typeof stored === 'object' ? stored : {};
  const rawSize = source.fontSize !== undefined ? source.fontSize : source.font_size;
  return {
    color: normalizeBarrageColor(source.color),
    fontSize: normalizeBarrageFontSize(rawSize),
    speed: normalizeBarrageSpeed(source.speed),
  };
}

function setBarragePreset(preset) {
  const merged = Object.assign({}, getBarragePreset(), preset && typeof preset === 'object' ? preset : {});
  const rawSize = merged.fontSize !== undefined ? merged.fontSize : merged.font_size;
  const normalized = {
    color: normalizeBarrageColor(merged.color),
    fontSize: normalizeBarrageFontSize(rawSize),
    speed: normalizeBarrageSpeed(merged.speed),
  };
  try {
    localStorage.setItem(BARRAGE_PRESET_KEY, JSON.stringify(normalized));
  } catch (error) {
    // 存储不可用时仅内存生效
  }
  return normalized;
}

// ===== 加载与挂接 =====

// 换视频 / 重入页面：解绑旧视频的媒体事件并停止渲染循环，避免重复绑定与内存泄漏
function detachBarrageMedia() {
  const videoEl = barrageState.videoEl;
  const handlers = barrageState.handlers;
  if (videoEl && handlers) {
    Object.keys(handlers).forEach(type => videoEl.removeEventListener(type, handlers[type]));
  }
  barrageState.handlers = null;
  stopBarrageLoop(false);
}

// ===== 时间轴渲染循环 =====

// 断点重建：清空后用当前时刻重建「仍在飞行窗口内」的弹幕，并把游标设为第一个未到点的下标
function rebuildBarrageFrame() {
  const layer = barrageState.layer;
  clearBarrageLayer(layer);
  resetBarrageLanes();
  barrageState.cursor = 0;
  const videoEl = barrageState.videoEl;
  if (!layer || !videoEl) return;
  const tMs = videoEl.currentTime * 1000;
  if (!Number.isFinite(tMs)) return;
  // 关闭弹幕 / 减动效：只定位游标，不重建节点
  if (layer.dataset.off === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    barrageState.cursor = barrageCursorFor(barrageState.list, tMs);
    return;
  }
  const list = barrageState.list;
  for (let i = 0; i < list.length; i++) {
    const barrage = list[i];
    if (barrage.offset_ms > tMs) break; // 列表按 offset_ms 升序，其后均未到点
    if (tMs - barrage.offset_ms > barrageDurationSeconds(barrage) * 1000) continue; // 已过期不补挂
    spawnBarrage(layer, barrage.content, barrage, tMs);
  }
  barrageState.cursor = barrageCursorFor(list, tMs);
  enforceBarrageLimit(layer);
}

// 单帧渲染：补挂到期弹幕 + 按视频时间更新在屏弹幕位置
function renderBarrageFrame() {
  const layer = barrageState.layer;
  const videoEl = barrageState.videoEl;
  if (!layer || !videoEl) return;
  if (layer.dataset.off === '1') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tMs = videoEl.currentTime * 1000;
  if (!Number.isFinite(tMs)) return;

  const list = barrageState.list;
  while (barrageState.cursor < list.length && list[barrageState.cursor].offset_ms <= tMs) {
    const barrage = list[barrageState.cursor];
    barrageState.cursor += 1;
    if (tMs - barrage.offset_ms > barrageDurationSeconds(barrage) * 1000) continue; // 已过期，仅推进游标
    if (barrage.id !== undefined && barrage.id !== null && barrageState.elements.has(barrage.id)) continue;
    spawnBarrage(layer, barrage.content, barrage, tMs);
  }

  barrageState.nodes.forEach(item => {
    const meta = item.__barrage;
    if (!meta || meta.frozen) return; // 编辑中的弹幕位置冻结，其余照常随视频运动
    const progress = (tMs - meta.offsetMs) / meta.durationMs;
    if (progress < 0 || progress > 1) {
      unregisterBarrageNode(item);
      item.remove();
      return;
    }
    item.style.translate = `${-progress * meta.travel}px 0`;
  });

  enforceBarrageLimit(layer);
}

// RAF 循环：播放时每帧按视频时间重算位置；暂停 / 结束时停在最后一帧
function barrageLoopTick() {
  barrageState.rafId = null;
  renderBarrageFrame();
  if (barrageState.running) barrageState.rafId = requestAnimationFrame(barrageLoopTick);
}

function startBarrageLoop() {
  barrageState.running = true;
  if (barrageState.rafId === null) barrageState.rafId = requestAnimationFrame(barrageLoopTick);
}

function stopBarrageLoop(renderOnce) {
  barrageState.running = false;
  if (barrageState.rafId !== null) {
    cancelAnimationFrame(barrageState.rafId);
    barrageState.rafId = null;
  }
  if (renderOnce) renderBarrageFrame();
}

// 图层尺寸变化后按新宽度重算在屏节点的位移距离
function refreshBarrageTravels() {
  barrageState.nodes.forEach(item => {
    if (item.__barrage) item.__barrage.travel = computeBarrageTravel(item, barrageState.layer);
  });
}

// 加载历史弹幕并挂接到播放进度
async function setupVideoBarrages(videoId, videoEl) {
  const panel = videoEl && videoEl.closest ? videoEl.closest('.video-detail-panel') : null;
  const layer = panel ? panel.querySelector('.barrage-layer') : document.getElementById('barrage-layer');
  if (!videoEl || !layer) return;

  detachBarrageMedia();
  barrageState.videoId = videoId;
  barrageState.videoEl = videoEl;
  barrageState.layer = layer;
  clearBarrageLayer(layer);
  syncBarrageLanes(true);
  barrageState.cursor = 0;

  // 播放由 RAF 循环驱动；暂停 / 结束时停在最后一帧（位置仍是视频时间的函数）
  const handlers = {
    play: () => startBarrageLoop(),
    pause: () => stopBarrageLoop(true),
    ended: () => stopBarrageLoop(true),
    seeked: () => rebuildBarrageFrame(),
    loadedmetadata: () => { syncBarrageLanes(true); rebuildBarrageFrame(); },
    durationchange: () => rebuildBarrageFrame(),
  };
  Object.keys(handlers).forEach(type => videoEl.addEventListener(type, handlers[type]));
  barrageState.handlers = handlers;

  let list = [];
  try {
    const response = await fetch(`${API_BASE}/api/barrages/${videoId}`);
    const data = await response.json();
    if (Array.isArray(data)) list = data;
  } catch (error) {
    list = [];
  }
  setBarrageCache(list);
  rebuildBarrageFrame(); // 定位到当前播放时间，仅挂接飞行窗口内的弹幕

  // 窗口尺寸变化后轨道几何与位移距离失效：强制重算并重新渲染一帧
  if (barrageState.onResize) window.removeEventListener('resize', barrageState.onResize);
  barrageState.onResize = () => { syncBarrageLanes(true); refreshBarrageTravels(); renderBarrageFrame(); };
  window.addEventListener('resize', barrageState.onResize);
}

// 发送弹幕：本地立即飘动 + 持久化
async function handleBarrageSend(event, videoId) {
  event.preventDefault();
  const form = event.target;
  const content = form.elements.content.value.trim();
  if (!content) return;

  const panel = form.closest ? form.closest('.video-detail-panel') : null;
  const videoEl = panel ? panel.querySelector('.video-player') : document.querySelector(`[data-video-id="${videoId}"] .video-player`);
  const offsetMs = Math.round((videoEl ? videoEl.currentTime : 0) * 1000);
  const preset = getBarragePreset();
  try {
    const response = await fetch(`${API_BASE}/api/barrages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, content, offsetMs, color: preset.color, fontSize: preset.fontSize, speed: preset.speed }),
    });
    const data = await response.json();
    if (!data.success) {
      showToast(data.message, 'error');
      return;
    }
    form.reset();
    showToast('弹幕发送成功', 'success'); // 减动效下弹幕不渲染，需要成功反馈

    // 后端返回完整弹幕行时以其为准；旧服务进程无 barrage 字段时退回本地构造
    if (data.barrage) {
      addBarrageToCache(data.barrage);
    } else {
      addBarrageToCache({ id: null, content, offset_ms: offsetMs, color: preset.color, font_size: preset.fontSize, speed: preset.speed, isOwn: true, canEdit: true });
    }
    // 成功后立刻按当前时刻重建一帧：正在播放时新弹幕随即出现（暂停时停在起点）
    if (videoEl && barrageState.videoEl === videoEl) rebuildBarrageFrame();
    refreshBarragePanel(); // 新增的弹幕可能进入「我的弹幕」面板
  } catch (error) {
    showToast('弹幕发送失败，请重试', 'error');
  }
}

// ===== 弹幕样式选择器（发送栏预设与编辑浮层共用） =====

// 颜色中文名（用于 aria-label 与 title）
const BARRAGE_COLOR_LABELS = {
  '#ffffff': '白色', '#fe0302': '红色', '#ff7204': '橙色', '#ffaa02': '琥珀色',
  '#ffd302': '金黄色', '#ffff00': '黄色', '#a0ee00': '草绿色', '#00cd00': '绿色',
  '#019899': '青色', '#4266be': '蓝色', '#89d5ff': '浅蓝色', '#cc0273': '玫红色',
};
const BARRAGE_FONT_SIZE_LABELS = { 18: '小', 25: '中', 32: '大' };
const BARRAGE_SPEED_LABELS = { slow: '慢', normal: '正常', fast: '快' };

function barrageColorLabel(color) {
  return BARRAGE_COLOR_LABELS[color] || '自定义';
}

function barrageFontSizeLabel(size) {
  return BARRAGE_FONT_SIZE_LABELS[size] || '中';
}

function barrageSpeedLabel(speed) {
  return BARRAGE_SPEED_LABELS[speed] || '正常';
}

// 样式摘要：颜色圆点 + 字号 + 速度（管理面板与编辑浮层共用）
function barrageStyleSummaryMarkup(barrage) {
  const item = normalizeBarrage(barrage);
  const speedLabel = barrageSpeedLabel(item.speed);
  return `<span class="barrage-style-dot" style="background:${item.color}" aria-hidden="true"></span>`
    + `<span class="barrage-style-text" title="字号 ${item.font_size}px，速度${speedLabel}">${barrageFontSizeLabel(item.font_size)}号 · ${speedLabel}</span>`;
}

// 三组样式选择器（颜色单选 / 字号三档 / 速度三档），作为发送栏工具条与编辑浮层的公共片段
function barragePresetGroupMarkup(style) {
  const current = normalizeBarrage(style || {});
  const swatches = BARRAGE_COLORS.map(color => {
    const active = color === current.color;
    const label = barrageColorLabel(color);
    return `<button class="barrage-swatch${active ? ' is-active' : ''}" type="button" role="radio" aria-checked="${active}" data-barrage-color="${color}" style="--barrage-swatch:${color}" title="${label}" aria-label="颜色${label}"></button>`;
  }).join('');
  const sizes = BARRAGE_FONT_SIZES.map(size => {
    const active = size === current.font_size;
    const label = barrageFontSizeLabel(size);
    return `<button class="barrage-choice${active ? ' is-active' : ''}" type="button" role="radio" aria-checked="${active}" data-barrage-size="${size}" title="${size} 像素" aria-label="字号${label}，${size} 像素">${label}</button>`;
  }).join('');
  const speeds = BARRAGE_SPEEDS.map(speed => {
    const active = speed === current.speed;
    const label = barrageSpeedLabel(speed);
    return `<button class="barrage-choice${active ? ' is-active' : ''}" type="button" role="radio" aria-checked="${active}" data-barrage-speed="${speed}" title="滚动速度${label}" aria-label="滚动速度${label}">${label}</button>`;
  }).join('');
  return `
    <div class="barrage-preset-group">
      <span class="barrage-preset-label">颜色</span>
      <div class="barrage-swatches" role="radiogroup" aria-label="弹幕颜色">${swatches}</div>
    </div>
    <div class="barrage-preset-group">
      <span class="barrage-preset-label">字号</span>
      <div class="barrage-choices" role="radiogroup" aria-label="弹幕字号">${sizes}</div>
    </div>
    <div class="barrage-preset-group">
      <span class="barrage-preset-label">速度</span>
      <div class="barrage-choices" role="radiogroup" aria-label="弹幕滚动速度">${speeds}</div>
    </div>
  `;
}

// 发送栏下方工具条 + 「我的弹幕」管理面板骨架
function barrageToolbarMarkup(videoId) {
  return `
    <div class="barrage-toolbar" data-barrage-toolbar>
      ${barragePresetGroupMarkup(getBarragePreset())}
      <button class="btn btn-secondary barrage-panel-toggle" type="button" aria-expanded="false" aria-controls="barrage-panel-${videoId}" onclick="toggleBarragePanel(this)">我的弹幕</button>
    </div>
    <section class="barrage-panel" id="barrage-panel-${videoId}" data-barrage-panel hidden aria-label="我的弹幕管理">
      <div class="barrage-panel-head">
        <h3>我的弹幕</h3>
        <span class="barrage-panel-count" data-barrage-panel-count></span>
      </div>
      <div class="barrage-panel-list" data-barrage-panel-list></div>
      <p class="dash-visually-hidden" data-barrage-status role="status" aria-live="polite"></p>
    </section>
  `;
}

// 按给定样式回填选中态（发送栏与编辑浮层共用）
function reflectBarrageStyle(root, style) {
  if (!root) return;
  const current = normalizeBarrage(style || {});
  root.querySelectorAll('[data-barrage-color]').forEach(button => {
    const active = button.dataset.barrageColor === current.color;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  root.querySelectorAll('[data-barrage-size]').forEach(button => {
    const active = Number(button.dataset.barrageSize) === current.font_size;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  root.querySelectorAll('[data-barrage-speed]').forEach(button => {
    const active = button.dataset.barrageSpeed === current.speed;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

// 事件委托：工具条上的样式按钮 → 写入 localStorage 预设并刷新选中态
function handleBarrageToolbarClick(event) {
  const button = event.target.closest ? event.target.closest('[data-barrage-color], [data-barrage-size], [data-barrage-speed]') : null;
  if (!button) return;
  const preset = getBarragePreset();
  if (button.dataset.barrageColor !== undefined) preset.color = button.dataset.barrageColor;
  if (button.dataset.barrageSize !== undefined) preset.fontSize = Number(button.dataset.barrageSize);
  if (button.dataset.barrageSpeed !== undefined) preset.speed = button.dataset.barrageSpeed;
  reflectBarrageStyle(event.currentTarget, setBarragePreset(preset));
}

// 由任意容器解析出当前视频详情面板
function resolveBarragePanel(element) {
  if (element && element.nodeType === 1) {
    if (element.classList.contains('video-detail-panel')) return element;
    const nested = element.querySelector('.video-detail-panel');
    if (nested) return nested;
    const closest = element.closest ? element.closest('.video-detail-panel') : null;
    if (closest) return closest;
  }
  return document.querySelector('.video-detail-panel');
}

// 渲染后绑定：回填预设选中态 + 事件委托（同一面板只绑定一次）
function setupBarrageControls(root) {
  const panel = resolveBarragePanel(root);
  if (!panel) return;
  const toolbar = panel.querySelector('[data-barrage-toolbar]');
  if (toolbar) {
    if (toolbar.dataset.bound !== '1') {
      toolbar.dataset.bound = '1';
      toolbar.addEventListener('click', handleBarrageToolbarClick);
    }
    reflectBarrageStyle(toolbar, getBarragePreset());
  }
  refreshBarragePanel(panel);
}

// 无障碍：把操作结果写入 aria-live 容器播报
function announceBarrage(message) {
  const status = document.querySelector('[data-barrage-status]');
  if (status) status.textContent = message;
}

// ===== 我的弹幕管理面板 =====

// 未登录判定（首次点击时查询一次并缓存，避免重复请求）
let barragePanelAuth = { checked: false, loggedIn: false };

async function isBarrageUserLoggedIn() {
  if (barragePanelAuth.checked) return barragePanelAuth.loggedIn;
  try {
    const response = await fetch(`${API_BASE}/api/user`);
    const data = await response.json();
    barragePanelAuth.loggedIn = Boolean(data && data.success);
  } catch (error) {
    barragePanelAuth.loggedIn = false;
  }
  barragePanelAuth.checked = true;
  return barragePanelAuth.loggedIn;
}

function setBarragePanelOpen(panel, open) {
  const section = panel.querySelector('[data-barrage-panel]');
  if (!section) return;
  section.hidden = !open;
  const toggle = panel.querySelector('.barrage-panel-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? '收起我的弹幕' : '我的弹幕';
  }
}

// 「我的弹幕」开关：未登录只提示，不发起写请求
async function toggleBarragePanel(button) {
  const panel = resolveBarragePanel(button);
  if (!panel) return;
  const section = panel.querySelector('[data-barrage-panel]');
  if (!section) return;
  if (!section.hidden) {
    setBarragePanelOpen(panel, false);
    return;
  }
  if (!(await isBarrageUserLoggedIn())) {
    showToast('请先登录', 'error');
    return;
  }
  refreshBarragePanel(panel);
  setBarragePanelOpen(panel, true);
}

// 面板单行：时间点 / 内容 / 样式摘要 / 发送者（非本人时） / 编辑·删除
function barragePanelRowMarkup(barrage) {
  const item = normalizeBarrage(barrage);
  const sender = item.isOwn ? '' : `<span class="barrage-panel-user" title="发送者">${escapeHtml(item.username || '未知用户')}</span>`;
  return `
    <article class="barrage-panel-row" data-barrage-row-id="${item.id}">
      <span class="barrage-panel-time" title="弹幕时间点">${formatDuration(item.offset_ms / 1000)}</span>
      <span class="barrage-panel-content" title="${escapeAttribute(item.content)}">${escapeHtml(item.content)}</span>
      <span class="barrage-panel-style">${barrageStyleSummaryMarkup(item)}</span>
      ${sender}
      <span class="barrage-panel-actions">
        <button class="btn btn-secondary barrage-panel-action" type="button" aria-label="编辑这条弹幕" onclick="openBarrageEditor(${item.id})">编辑</button>
        <button class="btn btn-danger barrage-panel-action" type="button" aria-label="删除这条弹幕" onclick="deleteBarrage(${item.id})">删除</button>
      </span>
    </article>
  `;
}

// 面板列表：仅列出 canEdit 的弹幕，按时间点倒序；无内容时显示空状态
function refreshBarragePanel(root) {
  const panel = resolveBarragePanel(root);
  if (!panel) return;
  const listEl = panel.querySelector('[data-barrage-panel-list]');
  if (!listEl) return;
  const list = getBarrageCache()
    .filter(item => item && item.canEdit === true && item.id !== null && item.id !== undefined)
    .slice()
    .sort((a, b) => b.offset_ms - a.offset_ms);
  const countEl = panel.querySelector('[data-barrage-panel-count]');
  if (countEl) countEl.textContent = list.length ? `共 ${list.length} 条` : '';
  listEl.innerHTML = list.length
    ? list.map(barragePanelRowMarkup).join('')
    : emptyStateMarkup(EMPTY_STATE_ICONS.box, '暂无可管理的弹幕', '发送一条弹幕，就能在这里编辑或删除它');
}

// 删除弹幕：二次确认 → DELETE → 同步移除在屏元素与缓存 → 刷新面板
async function deleteBarrage(barrageId) {
  const item = getBarrageCache().find(row => row && row.id === barrageId);
  if (!item) return;
  if (!item.canEdit) {
    showToast('无权删除该弹幕', 'error');
    return;
  }
  if (!window.confirm(`确定删除这条弹幕吗？\n${item.content}`)) return;
  try {
    const response = await fetch(`${API_BASE}/api/barrages/${barrageId}`, { method: 'DELETE' });
    const data = await response.json();
    if (!data.success) {
      showToast(data.message || '弹幕删除失败', 'error');
      return;
    }
    removeBarrageFromCache(barrageId);
    removeBarrageElement(barrageId);
    if (barrageEditorState.id === barrageId) closeBarrageEditor(false);
    refreshBarragePanel();
    announceBarrage('弹幕已删除');
    showToast(data.message || '弹幕已删除', 'success');
  } catch (error) {
    showToast('弹幕删除失败，请重试', 'error');
  }
}

// ===== 播放器内就地编辑浮层 =====

const barrageEditorState = { id: null, original: null, draft: null, root: null, keyHandler: null };

// 点击自己的弹幕（或面板「编辑」）打开浮层：暂停在屏动画并记录原始值用于取消回滚
function openBarrageEditor(barrageId) {
  const item = getBarrageCache().find(row => row && row.id === barrageId);
  if (!item) return;
  if (!item.canEdit) {
    showToast('无权编辑该弹幕', 'error');
    return;
  }
  const panel = resolveBarragePanel(null);
  const frame = panel ? panel.querySelector('.video-frame') : null;
  if (!panel || !frame) return;

  closeBarrageEditor(false); // 先清理残留浮层与全局监听

  barrageEditorState.id = barrageId;
  barrageEditorState.root = panel;
  barrageEditorState.original = { content: item.content, color: item.color, font_size: item.font_size, speed: item.speed };
  barrageEditorState.draft = { content: item.content, color: item.color, font_size: item.font_size, speed: item.speed };

  const node = barrageState.elements.get(barrageId);
  if (node) {
    node.classList.add('is-editing');
    if (node.__barrage) node.__barrage.frozen = true; // 该条位置冻结，其余弹幕照常随视频运动
  }

  const overlay = document.createElement('div');
  overlay.className = 'barrage-editor';
  overlay.dataset.barrageEditor = '1';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', '编辑弹幕');
  overlay.innerHTML = `
    <div class="barrage-editor-head">
      <h3 class="barrage-editor-title">编辑弹幕</h3>
      <span class="barrage-editor-time">${formatDuration(item.offset_ms / 1000)}</span>
    </div>
    <label class="barrage-editor-field">
      <span class="dash-visually-hidden">弹幕内容</span>
      <input class="barrage-input" data-barrage-editor-content maxlength="100" value="${escapeAttribute(item.content)}" placeholder="输入弹幕内容">
    </label>
    <div class="barrage-editor-style">${barragePresetGroupMarkup(item)}</div>
    <div class="barrage-editor-preview">
      <span class="barrage-editor-preview-label">预览</span>
      <div class="barrage-editor-preview-stage"><span class="barrage-preview-item" data-barrage-preview></span></div>
    </div>
    <div class="barrage-editor-actions">
      <button class="btn btn-secondary" type="button" data-barrage-editor-cancel>取消</button>
      <button class="btn btn-danger" type="button" data-barrage-editor-delete>删除</button>
      <button class="btn btn-primary" type="button" data-barrage-editor-save>保存</button>
    </div>
  `;
  frame.appendChild(overlay);

  overlay.addEventListener('click', handleBarrageEditorClick);
  overlay.addEventListener('input', handleBarrageEditorInput);
  barrageEditorState.keyHandler = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeBarrageEditor(true);
    }
  };
  document.addEventListener('keydown', barrageEditorState.keyHandler);

  reflectBarrageStyle(overlay, barrageEditorState.draft);
  applyBarrageEditorDraft();
  const input = overlay.querySelector('[data-barrage-editor-content]');
  if (input) input.focus();
}

// 关闭浮层；rollback 为 true 时用原始值回滚在屏元素并恢复飘动
function closeBarrageEditor(rollback) {
  const { id, root, original } = barrageEditorState;
  const overlay = root ? root.querySelector('[data-barrage-editor]') : null;
  if (overlay) overlay.remove();
  const node = id === null || id === undefined ? null : barrageState.elements.get(id);
  if (node) {
    node.classList.remove('is-editing');
    if (node.__barrage) node.__barrage.frozen = false; // 解除冻结，恢复随视频时间运动
    if (rollback && original) {
      updateBarrageElement(id, { content: original.content, color: original.color, font_size: original.font_size, speed: original.speed });
    }
  }
  if (barrageEditorState.keyHandler) document.removeEventListener('keydown', barrageEditorState.keyHandler);
  barrageEditorState.id = null;
  barrageEditorState.original = null;
  barrageEditorState.draft = null;
  barrageEditorState.root = null;
  barrageEditorState.keyHandler = null;
}

// 实时预览：在屏元素临时改样式 + 预览区示例同步（未在屏的弹幕保存后按新样式渲染）
function applyBarrageEditorDraft() {
  const { id, draft, root } = barrageEditorState;
  if (!draft) return;
  const overlay = root ? root.querySelector('[data-barrage-editor]') : null;
  const preview = overlay ? overlay.querySelector('[data-barrage-preview]') : null;
  if (preview) {
    preview.textContent = draft.content || '弹幕预览';
    preview.style.color = draft.color;
    preview.style.fontSize = `${draft.font_size}px`;
  }
  if (id !== null && id !== undefined) {
    updateBarrageElement(id, { content: draft.content, color: draft.color, font_size: draft.font_size, speed: draft.speed });
  }
}

function handleBarrageEditorClick(event) {
  const overlay = event.currentTarget;
  const target = event.target;
  if (target.closest('[data-barrage-editor-cancel]')) {
    closeBarrageEditor(true);
    return;
  }
  if (target.closest('[data-barrage-editor-save]')) {
    saveBarrageEdit();
    return;
  }
  if (target.closest('[data-barrage-editor-delete]')) {
    deleteBarrage(barrageEditorState.id);
    return;
  }
  const styleButton = target.closest('[data-barrage-color], [data-barrage-size], [data-barrage-speed]');
  if (!styleButton) return;
  const draft = barrageEditorState.draft;
  if (!draft) return;
  if (styleButton.dataset.barrageColor !== undefined) draft.color = styleButton.dataset.barrageColor;
  if (styleButton.dataset.barrageSize !== undefined) draft.font_size = Number(styleButton.dataset.barrageSize);
  if (styleButton.dataset.barrageSpeed !== undefined) draft.speed = styleButton.dataset.barrageSpeed;
  reflectBarrageStyle(overlay, draft);
  applyBarrageEditorDraft();
}

function handleBarrageEditorInput(event) {
  const input = event.target.closest ? event.target.closest('[data-barrage-editor-content]') : null;
  if (!input || !barrageEditorState.draft) return;
  barrageEditorState.draft.content = input.value;
  applyBarrageEditorDraft();
}

function setBarrageEditorBusy(busy) {
  const root = barrageEditorState.root;
  const overlay = root ? root.querySelector('[data-barrage-editor]') : null;
  if (!overlay) return;
  overlay.classList.toggle('is-busy', Boolean(busy));
  overlay.querySelectorAll('[data-barrage-editor-save], [data-barrage-editor-delete]').forEach(button => {
    button.disabled = Boolean(busy);
  });
}

// 保存编辑：PATCH 成功后立即改写缓存与在屏元素（不重置播放游标），失败保持浮层可重试
async function saveBarrageEdit() {
  const { id, draft } = barrageEditorState;
  if (id === null || id === undefined || !draft) return;
  const content = String(draft.content || '').trim();
  if (!content) {
    showToast('弹幕内容不能为空', 'error');
    return;
  }
  setBarrageEditorBusy(true);
  try {
    const response = await fetch(`${API_BASE}/api/barrages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, color: draft.color, fontSize: draft.font_size, speed: draft.speed }),
    });
    const data = await response.json();
    if (!data.success) {
      showToast(data.message || '弹幕更新失败', 'error');
      return;
    }
    const updated = normalizeBarrage(data.barrage
      ? Object.assign({}, data.barrage, { content })
      : { id, content, color: draft.color, font_size: draft.font_size, speed: draft.speed });
    updateBarrageInCache(id, updated);
    updateBarrageElement(id, updated);
    closeBarrageEditor(false);
    refreshBarragePanel();
    announceBarrage('弹幕已更新');
    showToast(data.message || '弹幕已更新', 'success');
  } catch (error) {
    showToast('弹幕更新失败，请重试', 'error');
  } finally {
    setBarrageEditorBusy(false);
  }
}

// ===== 关注系统 =====

// 关注 / 取消关注（toggle），同步所有同目标按钮
async function toggleFollow(userId, button) {
  try {
    const response = await fetch(`${API_BASE}/api/follows/${userId}`, { method: 'POST' });
    const data = await response.json();
    if (!data.success) {
      showToast(data.message, 'error');
      return;
    }
    document.querySelectorAll(`[data-follow-user="${userId}"]`).forEach(item => {
      item.classList.toggle('following', data.isFollowing);
      item.textContent = data.isFollowing ? '已关注' : '+ 关注';
    });
    const fans = document.getElementById('up-fans');
    if (fans) fans.textContent = `粉丝 ${formatCount(data.follower_count)}`;
  } catch (error) {
    showToast('操作失败，请重试', 'error');
  }
}

// 详情页 UP 主信息：粉丝数 + 关注按钮（自己不显示）
async function setupUpCard(userId) {
  const fans = document.getElementById('up-fans');
  const actions = document.getElementById('up-actions');
  if (!fans || !actions) return;

  try {
    const [statusResponse, userResponse] = await Promise.all([
      fetch(`${API_BASE}/api/follows/status/${userId}`),
      fetch(`${API_BASE}/api/user`),
    ]);
    const statusData = await statusResponse.json();
    const userData = await userResponse.json();
    if (!statusData.success) return;
    fans.textContent = `粉丝 ${formatCount(statusData.follower_count)}`;
    if (!userData.success || userData.user.id === userId) return;
    actions.innerHTML = followButtonMarkup(statusData.isFollowing, userId);
  } catch (error) {
    // 关注状态加载失败不影响详情页
  }
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadProfile() {
  const form = document.getElementById('profile-form');
  if (!form) return;
  const response = await fetch(`${API_BASE}/api/user`);
  const data = await response.json();
  if (!data.success) return;
  const user = data.user;
  form.elements.username.value = user.username;
  form.elements.bio.value = user.bio || '';
  const preview = document.getElementById('profile-preview');
  if (preview) {
    preview.innerHTML = `${avatarMarkup(user.avatarUrl, user.username)}<span>${escapeHtml(user.username)}</span>`;
  }
  fillDashboardHero(user);
}

// 身份区信息（仅 dashboard 存在这些节点，缺失时静默跳过）
function fillDashboardHero(user) {
  const heroAvatar = document.getElementById('dash-hero-avatar');
  if (heroAvatar) heroAvatar.innerHTML = avatarMarkup(user.avatarUrl, user.username);

  const email = document.getElementById('dash-email');
  if (email) email.textContent = user.email || '—';

  const joined = document.getElementById('dash-joined');
  if (joined && user.created_at) joined.textContent = new Date(user.created_at).toLocaleDateString('zh-CN');

  const role = document.getElementById('dash-role');
  if (role && user.role === 'admin') {
    role.textContent = '管理员';
    role.hidden = false;
  }

  const spaceLink = document.getElementById('dash-view-space');
  if (spaceLink) spaceLink.href = `/space.html?user=${encodeURIComponent(user.id)}`;
}

// 数据概览统计（dashboard 专属）
async function loadUserStats() {
  const container = document.getElementById('dash-stats');
  if (!container) return;

  let stats = null;
  try {
    const response = await fetch(`${API_BASE}/api/user/stats`);
    const data = await response.json();
    if (data.success) stats = data.stats;
  } catch (error) {
    stats = null;
  }

  container.setAttribute('aria-busy', 'false');
  if (!stats) return; // 拉取失败时保留占位符，不阻塞页面

  container.querySelectorAll('.dash-stat').forEach(card => {
    const value = stats[card.dataset.stat];
    const target = card.querySelector('.dash-stat-value');
    if (target) target.textContent = formatCount(value || 0);
  });

  const badge = document.getElementById('dash-quick-badge');
  if (badge && stats.unreadNotifications > 0) {
    badge.textContent = formatCount(stats.unreadNotifications);
    badge.hidden = false;
  }
}

// 创作中心标签页（鼠标点击 + 键盘方向键，同步 aria 状态）
function setupDashboardTabs() {
  const tablist = document.querySelector('.dash-tabs');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

  const activate = (tab, focus = false) => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) {
        panel.classList.toggle('is-active', selected);
        panel.hidden = !selected;
      }
    });
    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      activate(tabs[(index + step + tabs.length) % tabs.length], true);
    });
  });

  // 身份区「开始创作」等入口：跳转到指定面板
  document.querySelectorAll('[data-dash-jump]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const tab = document.getElementById(`tab-${trigger.dataset.dashJump}`);
      if (!tab) return;
      activate(tab);
      document.getElementById('dash-workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const form = event.target;
  const response = await fetch(`${API_BASE}/api/user/profile`, {
    method: 'PUT',
    body: new FormData(form),
  });
  const data = await response.json();
  showMessage('profile-message', data.message, !data.success);
  if (data.success) await loadProfile();
}

// 弹幕层是 <video> 的兄弟节点，只有全屏「外层容器」才能让它一起进入全屏；
// 因此屏蔽原生播放器的全屏 / 画中画 / 投屏入口，改用容器全屏，保证弹幕始终可见
function setupVideoFullscreen(frame, videoEl) {
  if (!frame || !videoEl || frame.dataset.fsBound === '1') return;
  frame.dataset.fsBound = '1';

  const button = frame.querySelector('[data-video-fullscreen]');
  const currentFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const canFullscreen = Boolean(document.fullscreenEnabled && (frame.requestFullscreen || frame.webkitRequestFullscreen));

  // 画中画与投屏会把视频单独抽离页面，弹幕同样无法叠加
  videoEl.disablePictureInPicture = true;
  videoEl.disableRemotePlayback = true;

  const settle = result => (result && typeof result.catch === 'function' ? result.catch(() => {}) : result);

  function enterFullscreen() {
    return settle(frame.requestFullscreen ? frame.requestFullscreen() : frame.webkitRequestFullscreen());
  }
  function leaveFullscreen() {
    return settle(document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
  }
  function refreshButton() {
    if (!button) return;
    const active = currentFullscreen() === frame;
    button.innerHTML = uiIcon(active ? 'fullscreenExit' : 'fullscreen', 18);
    const label = active ? '退出全屏' : '全屏播放';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  if (button && canFullscreen) {
    button.addEventListener('click', () => {
      if (currentFullscreen() === frame) leaveFullscreen();
      else enterFullscreen();
    });
  } else if (button) {
    button.hidden = true; // iPhone 等不支持元素全屏的环境不提供该入口
  }

  function handleFullscreenChange() {
    if (!frame.isConnected) {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      return;
    }
    // 原生控件把 <video> 单独全屏了：弹幕层不在其中，直接把全屏对象换成外层容器
    if (currentFullscreen() === videoEl) {
      showToast('原生全屏不显示弹幕，已切换为站内全屏', 'info');
      if (!canFullscreen) {
        leaveFullscreen();
        return;
      }
      const switched = frame.requestFullscreen ? frame.requestFullscreen() : frame.webkitRequestFullscreen();
      // 已在全屏态下切换目标无需再次授权；万一失败就退出，避免停在看不到弹幕的原生播放器里
      if (switched && typeof switched.catch === 'function') switched.catch(() => leaveFullscreen());
      return;
    }
    refreshButton();
    // 全屏后播放器尺寸变化：轨道几何与位移距离需要重算
    if (barrageState.videoEl === videoEl && barrageState.onResize) barrageState.onResize();
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  // iPhone 的系统全屏播放器无法叠加任何 HTML，只能退出并回到页内播放
  videoEl.addEventListener('webkitbeginfullscreen', () => {
    if (canFullscreen) return; // 支持容器全屏的环境交给上面的守卫处理
    try { videoEl.webkitExitFullscreen(); } catch (error) { /* 原生播放器可能已自行退出 */ }
    showToast('系统全屏播放器不显示弹幕，请使用播放器右上角的全屏按钮', 'info');
  });

  // 画中画同样脱离页面
  videoEl.addEventListener('enterpictureinpicture', () => {
    if (document.exitPictureInPicture) settle(document.exitPictureInPicture());
    else if (videoEl.webkitSetPresentationMode) videoEl.webkitSetPresentationMode('inline');
    showToast('画中画不显示弹幕，已退出画中画', 'info');
  });

  refreshButton();
}

function initializeVideoPlayers() {
  document.querySelectorAll('.video-player').forEach(video => {
    const hlsUrl = video.dataset.hls;
    const mp4Url = video.dataset.mp4;
    const webmUrl = video.dataset.webm;

    if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    } else if (hlsUrl && window.Hls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      video._hls = hls;
    } else if (mp4Url) {
      video.src = mp4Url;
    } else if (webmUrl) {
      video.src = webmUrl;
    }

    const videoContainer = video.closest('.video-card, .video-detail-panel');
    setupVideoFullscreen(video.closest('.video-frame'), video);
    const speedControl = videoContainer && videoContainer.querySelector('[data-video-speed]');
    if (!speedControl) return;
    speedControl.addEventListener('change', event => {
      video.playbackRate = Number(event.target.value);
    });
  });
}

async function loadVideoComments(videoId) {
  const commentsElement = document.getElementById(`comments-${videoId}`);
  const response = await fetch(`${API_BASE}/api/videos/${videoId}/comments`);
  const comments = await response.json();
  commentsElement.innerHTML = comments.length === 0
    ? '<p class="empty-comments">暂无评论</p>'
    : comments.map(comment => `
      <div class="comment">
        <div class="comment-author"><span class="author-line">${userAvatarMarkup(comment.user_id, comment.avatarUrl, comment.username)}<strong>${escapeHtml(comment.username)}</strong></span><span>${escapeHtml(comment.content)}</span></div>
        <button class="comment-like ${comment.liked ? 'is-liked' : ''}" type="button" onclick="toggleCommentLike('video', ${comment.id}, this)">赞 ${comment.like_count || 0}</button>
      </div>
    `).join('');
}

async function loadPostComments(postId) {
  const commentsElement = document.getElementById(`post-comments-${postId}`);
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`);
  const comments = await response.json();
  commentsElement.innerHTML = comments.length === 0
    ? '<p class="empty-comments">暂无评论</p>'
    : comments.map(comment => `
      <div class="comment">
        <div class="comment-author"><span class="author-line">${userAvatarMarkup(comment.user_id, comment.avatarUrl, comment.username)}<strong>${escapeHtml(comment.username)}</strong></span><span>${escapeHtml(comment.content)}</span></div>
        <button class="comment-like ${comment.liked ? 'is-liked' : ''}" type="button" onclick="toggleCommentLike('post', ${comment.id}, this)">赞 ${comment.like_count || 0}</button>
      </div>
    `).join('');
}

async function toggleCommentLike(type, commentId, button) {
  const response = await fetch(`${API_BASE}/api/${type === 'post' ? 'posts' : 'videos'}/comments/${commentId}/like`, { method: 'POST' });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  button.classList.toggle('is-liked', data.liked);
  button.textContent = `赞 ${data.likeCount}`;
}

async function submitPostComment(event, postId) {
  event.preventDefault();
  const form = event.target;
  const response = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: form.elements.content.value }),
  });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  form.reset();
  await loadPostComments(postId);
}

// 点赞 / 收藏按钮的内联图标
const LIKE_ICON = '<svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
const STAR_ICON = '<svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

// 收藏按钮：图标 + 文案 + 收藏数，供详情页复用
function favoriteButtonMarkup(contentType, contentId, favorited, favoriteCount) {
  return `<button class="btn btn-secondary favorite-button${favorited ? ' is-active' : ''}" type="button" aria-pressed="${favorited ? 'true' : 'false'}" onclick="toggleFavorite('${contentType}', ${contentId}, this)">${STAR_ICON}<span class="favorite-label">${favorited ? '已收藏' : '收藏'}</span><span class="favorite-count">${formatCount(favoriteCount || 0)}</span></button>`;
}

async function toggleVideoLike(videoId) {
  const response = await fetch(`${API_BASE}/api/videos/${videoId}/like`, { method: 'POST' });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }

  const card = document.querySelector(`[data-video-id="${videoId}"]`);
  const button = card.querySelector('.like-button');
  button.classList.toggle('is-liked', data.liked);
  button.setAttribute('aria-pressed', data.liked ? 'true' : 'false');
  button.querySelector('.like-label').textContent = data.liked ? '已点赞' : '点赞';
  button.querySelector('.like-count').textContent = formatCount(data.likeCount);
  showToast(data.liked ? '点赞成功' : '已取消点赞', data.liked ? 'success' : 'info');
}

async function submitVideoComment(event, videoId) {
  event.preventDefault();
  const form = event.target;
  const response = await fetch(`${API_BASE}/api/videos/${videoId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: form.elements.content.value }),
  });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }

  form.reset();
  await loadVideoComments(videoId);
  const count = document.querySelector(`[data-video-id="${videoId}"] .comment-count`);
  count.textContent = Number(count.textContent) + 1;
}

function setupMentionInputs() {
  document.querySelectorAll('[data-mention-input]').forEach(input => {
    input.addEventListener('input', async () => {
      const match = input.value.match(/@([^\s@]*)$/);
      const datalist = document.getElementById(input.getAttribute('list'));
      if (!match || !datalist) return;
      const response = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(match[1])}`);
      const users = await response.json();
      datalist.innerHTML = users.map(user => `<option value="@${escapeAttribute(user.username)}"></option>`).join('');
    });
  });
}

async function handleFileUpload(event) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = '上传中...';

  try {
    const response = await fetch(`${API_BASE}/api/files`, {
      method: 'POST',
      body: new FormData(form),
    });
    const data = await response.json();
    showMessage('file-message', data.message, !data.success);
    if (data.success) {
      form.reset();
      await loadFiles();
    }
  } catch (error) {
    showMessage('file-message', '上传失败，请重试', true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '上传文件';
  }
}

async function handleVideoUpload(event) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = '上传并转码中...';
  try {
    const response = await fetch(`${API_BASE}/api/videos`, {
      method: 'POST',
      body: new FormData(form),
    });
    const data = await response.json();
    showMessage('video-message', data.message, !data.success);
    if (data.success) {
      form.reset();
    }
  } catch (error) {
    showMessage('video-message', '上传失败，请重试', true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '上传视频';
  }
}

async function deleteVideo(videoId) {
  if (!window.confirm('确定下架这个视频吗？下架后视频和互动内容都会删除。')) return;

  const response = await fetch(`${API_BASE}/api/videos/${videoId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }

  // 按当前页面所在的视频列表刷新
  if (document.getElementById('space-videos')) {
    const userId = new URLSearchParams(window.location.search).get('user');
    await loadVideos('space-videos', 100, 'latest', userId);
  } else if (document.getElementById('videos-list')) {
    const activeTab = document.querySelector('#category-tabs .category-tab.active');
    await loadRecommendVideos(activeTab ? activeTab.dataset.category : '');
  } else {
    await loadVideos();
  }
}

// ===== 站内通知 =====
const CONTENT_TYPE_NAMES = { post: '文章', video: '视频', file: '文件' };

const NOTIFICATION_TYPE_LABELS = {
  like: '点赞了你的视频',
  comment: '评论了你的内容',
  comment_like: '点赞了你的评论',
  mention: '在评论中提到了你',
  follow: '关注了你',
  friend_request: '申请添加你为好友',
  friend_accept: '接受了你的好友申请',
  message: '给你发送了私信',
};

function notificationTypeLabel(type) {
  return NOTIFICATION_TYPE_LABELS[type] || '有新动态';
}

function contentTypeName(type) {
  return CONTENT_TYPE_NAMES[type] || '内容';
}

function renderNotificationItem(notification) {
  return `
    <article class="notification-item${notification.is_read ? '' : ' is-unread'}">
      <div class="notification-main">
        ${notification.actor_name
          ? userAvatarMarkup(null, notification.actorAvatarUrl, notification.actor_name)
          : '<span class="avatar avatar-fallback" aria-hidden="true">🔔</span>'}
        <div class="notification-body">
          <p class="notification-title"><strong>${escapeHtml(notification.actor_name || '系统通知')}</strong> ${escapeHtml(notificationTypeLabel(notification.type))}</p>
          ${notification.preview ? `<p class="notification-preview">${escapeHtml(String(notification.preview).slice(0, 120))}</p>` : ''}
          <p class="notification-meta">${escapeHtml(contentTypeName(notification.content_type))} · ${new Date(notification.created_at).toLocaleString('zh-CN')}</p>
        </div>
      </div>
      <div class="notification-actions">
        ${notification.link ? `<a class="btn btn-secondary" href="${escapeAttribute(notification.link)}">查看</a>` : ''}
        ${notification.is_read ? '' : `<button class="btn btn-secondary" type="button" onclick="markNotificationRead(${notification.id})">标记已读</button>`}
        <button class="btn btn-danger" type="button" onclick="deleteNotification(${notification.id})">删除</button>
      </div>
    </article>
  `;
}

async function loadNotificationsPage() {
  const list = document.getElementById('notification-list');
  if (!list) return;

  const response = await fetch(`${API_BASE}/api/notifications`);
  const data = await response.json();
  if (!data.success) {
    list.innerHTML = `<p class="loading">${escapeHtml(data.message || '请先登录')}</p>`;
    return;
  }

  const countElement = document.getElementById('notification-unread-count');
  if (countElement) countElement.textContent = data.unread ? `${data.unread} 条未读` : '全部已读';
  list.innerHTML = data.notifications.length
    ? data.notifications.map(renderNotificationItem).join('')
    : '<p class="empty-comments">暂无通知</p>';
}

async function markNotificationRead(notificationId) {
  await fetch(`${API_BASE}/api/notifications/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: notificationId }),
  });
  await loadNotificationsPage();
  refreshNavBadges();
}

async function markAllNotificationsRead() {
  await fetch(`${API_BASE}/api/notifications/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  await loadNotificationsPage();
  refreshNavBadges();
}

async function deleteNotification(notificationId) {
  await fetch(`${API_BASE}/api/notifications/${notificationId}`, { method: 'DELETE' });
  await loadNotificationsPage();
  refreshNavBadges();
}

// ===== 收藏 / 浏览历史 =====
async function toggleFavorite(contentType, contentId, button) {
  const response = await fetch(`${API_BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, contentId }),
  });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  if (button) {
    button.classList.toggle('is-active', Boolean(data.favorited));
    button.setAttribute('aria-pressed', data.favorited ? 'true' : 'false');
    const label = button.querySelector('.favorite-label');
    const count = button.querySelector('.favorite-count');
    if (label) label.textContent = data.favorited ? '已收藏' : '收藏';
    if (count) count.textContent = formatCount(data.favoriteCount || 0);
  }
  showToast(data.message, data.favorited ? 'success' : 'info');
}

async function removeFavorite(contentType, contentId) {
  const response = await fetch(`${API_BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, contentId }),
  });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  await loadFavoritesPage();
}

function renderContentSummaryCard(item, timeField) {
  const summary = item.summary ? escapeHtml(String(item.summary).slice(0, 160)) : '暂无简介';
  const metric = item.type === 'file' ? `下载 ${item.download_count || 0}` : `浏览 ${item.view_count || 0}`;
  const timeLabel = timeField === 'viewed_at' ? '浏览于' : '收藏于';

  return `
    <article class="search-result-item detail-card" data-detail-url="/detail.html?type=${item.type}&id=${item.id}" tabindex="0" role="link">
      <span class="detail-type">${escapeHtml(contentTypeName(item.type))}</span>
      <h3>${escapeHtml(item.title || '未命名')}</h3>
      <p class="author-line">${userAvatarMarkup(item.user_id, item.avatarUrl, item.username)}<span>${escapeHtml(item.username || '未知用户')}</span></p>
      ${item.type === 'video' ? `<div class="search-video-cover">${item.posterUrl ? `<img src="${escapeAttribute(item.posterUrl)}" alt="${escapeAttribute(item.title)}封面">` : '<span>暂无封面</span>'}<span class="video-cover-icon">播放</span></div>` : ''}
      <p>${summary}</p>
      <p class="search-metric">${metric} · ${timeLabel} ${new Date(item[timeField]).toLocaleString('zh-CN')}</p>
      <div class="detail-actions">
        <a class="btn btn-secondary" href="/detail.html?type=${item.type}&id=${item.id}">查看详情</a>
        ${timeField === 'created_at' ? `<button class="btn btn-danger" type="button" onclick="removeFavorite('${item.type}', ${item.id})">取消收藏</button>` : ''}
      </div>
    </article>
  `;
}

async function loadFavoritesPage() {
  const list = document.getElementById('favorites-list');
  if (!list) return;

  const typeSelect = document.getElementById('favorites-type');
  const type = typeSelect ? typeSelect.value : '';
  const response = await fetch(`${API_BASE}/api/favorites${type ? `?type=${encodeURIComponent(type)}` : ''}`);
  const data = await response.json();
  if (!data.success) {
    list.innerHTML = `<p class="loading">${escapeHtml(data.message || '请先登录')}</p>`;
    return;
  }

  const countElement = document.getElementById('favorites-count');
  if (countElement) countElement.textContent = `${data.items.length} 项`;
  list.innerHTML = data.items.length
    ? data.items.map(item => renderContentSummaryCard(item, 'created_at')).join('')
    : emptyStateMarkup(EMPTY_STATE_ICONS.box, '收藏夹空空如也', '看到喜欢的内容点个收藏，方便以后回顾', '/', '去逛逛');
}

async function loadHistoryPage() {
  const list = document.getElementById('history-list');
  if (!list) return;

  const typeSelect = document.getElementById('history-type');
  const type = typeSelect ? typeSelect.value : '';
  const response = await fetch(`${API_BASE}/api/history${type ? `?type=${encodeURIComponent(type)}` : ''}`);
  const data = await response.json();
  if (!data.success) {
    list.innerHTML = `<p class="loading">${escapeHtml(data.message || '请先登录')}</p>`;
    return;
  }

  const countElement = document.getElementById('history-count');
  if (countElement) countElement.textContent = `${data.items.length} 项`;
  list.innerHTML = data.items.length
    ? data.items.map(item => renderContentSummaryCard(item, 'viewed_at')).join('')
    : emptyStateMarkup(EMPTY_STATE_ICONS.box, '暂无浏览历史', '看过的内容会自动记录在这里', '/browse.html?type=video', '去看视频');
}

async function clearHistory() {
  if (!window.confirm('确定清空全部浏览历史吗？')) return;
  const response = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) {
    showToast(data.message, 'error');
    return;
  }
  await loadHistoryPage();
}

// ===== 举报内容 =====
async function reportContent(contentType, contentId) {
  const reason = window.prompt('请填写举报原因（2-300字）：');
  if (reason === null) return;

  const response = await fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, contentId, reason }),
  });
  const data = await response.json();
  showToast(data.message, data.success ? 'info' : 'error');
}

// UP 主主页（B站个人空间）
async function loadSpacePage() {
  const container = document.getElementById('space-header');
  if (!container) return;

  const userId = new URLSearchParams(window.location.search).get('user');
  if (!userId) {
    container.innerHTML = '<p class="loading">用户地址不正确</p>';
    return;
  }

  try {
    const [userResponse, followResponse] = await Promise.all([
      fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`),
      fetch(`${API_BASE}/api/follows/status/${encodeURIComponent(userId)}`).catch(() => null),
    ]);
    const data = await userResponse.json();
    if (!userResponse.ok || !data.success) {
      container.innerHTML = `<p class="loading">${escapeHtml(data.message || '用户不存在')}</p>`;
      return;
    }

    const user = data.user;
    document.title = `${user.username} 的主页 - 烬潮`;

    let followData = { success: false, isFollowing: false };
    if (followResponse && followResponse.ok) {
      followData = await followResponse.json();
    }

    const avatar = user.avatarUrl
      ? `<img class="space-avatar" src="${escapeAttribute(user.avatarUrl)}" alt="${escapeAttribute(user.username)}的头像">`
      : `<span class="space-avatar" aria-hidden="true">${escapeHtml(String(user.username).slice(0, 1))}</span>`;
    const action = data.isSelf
      ? '<a class="btn btn-secondary" href="/dashboard.html">编辑我的资料</a>'
      : (data.isFollowing || followData.isFollowing
        ? followButtonMarkup(true, user.id)
        : followButtonMarkup(false, user.id));

    container.innerHTML = `
      ${avatar}
      <div class="space-info">
        <h1>${escapeHtml(user.username)}</h1>
        <p class="space-bio">${escapeHtml(user.bio || '这个UP主还没有填写简介')}</p>
        <div class="space-stats">
          <div class="space-stat"><strong>${formatCount(user.follower_count)}</strong><span>粉丝</span></div>
          <div class="space-stat"><strong>${formatCount(user.following_count)}</strong><span>关注</span></div>
          <div class="space-stat"><strong>${formatCount(user.like_count)}</strong><span>获赞</span></div>
        </div>
        <p class="space-bio">投稿 ${formatCount(user.video_count)} · 文章 ${user.post_count} · 文件 ${user.file_count} · 加入于 ${new Date(user.created_at).toLocaleDateString('zh-CN')}</p>
        <div class="space-actions">${action}</div>
      </div>
    `;

    await loadVideos('space-videos', 100, 'latest', user.id);
  } catch (error) {
    container.innerHTML = '<p class="loading">主页加载失败</p>';
  }
}

// 我的关注：已关注 UP 主的最新视频动态流
async function loadFollowing() {
  const list = document.getElementById('following-list');
  if (!list) return;

  try {
    const response = await fetch(`${API_BASE}/api/follows`);
    const data = await response.json();

    if (data && data.success === false) {
      list.innerHTML = `<p class="loading">${escapeHtml(data.message || '请先登录')}，<a href="/login.html">去登录</a> 后即可查看关注动态</p>`;
      return;
    }
    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = emptyStateMarkup(EMPTY_STATE_ICONS.box, '还没有关注动态', '关注感兴趣的UP主，第一时间看到他们的新视频', '/browse.html?type=video', '去发现 UP 主');
      return;
    }
    list.innerHTML = data.map(video => renderVideoCard(video)).join('');
  } catch (error) {
    list.innerHTML = '<p class="loading">关注动态加载失败</p>';
  }
}

// 公开的个人主页（他人视角）
async function loadProfilePage() {
  const container = document.getElementById('profile-page');
  if (!container) return;

  const userId = new URLSearchParams(window.location.search).get('user');
  if (!userId) {
    container.innerHTML = '<p class="loading">用户地址不正确</p>';
    return;
  }

  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    container.innerHTML = `<p class="loading">${escapeHtml(data.message || '用户不存在')}</p>`;
    return;
  }

  const user = data.user;
  document.title = `${user.username} - 烬潮`;

  let action = '';
  if (data.isSelf) {
    action = '<a class="btn btn-secondary" href="/dashboard.html">编辑我的资料</a>';
  } else if (data.isFriend) {
    action = `<a class="btn btn-secondary" href="/chat.html?user=${user.id}">发送私信</a><button class="btn btn-danger" type="button" onclick="removeFriendFromProfile(${user.id})">删除好友</button>`;
  } else {
    action = `<button class="btn btn-primary" type="button" onclick="sendFriendRequestFromProfile(${user.id})">添加好友</button>`;
  }

  container.innerHTML = `
    <article class="profile-page-card">
      <div class="author-line">${userAvatarMarkup(user.id, user.avatarUrl, user.username)}<div><h1>${escapeHtml(user.username)}</h1><p class="profile-bio">${escapeHtml(user.bio || '这个用户还没有填写简介')}</p></div></div>
      <p class="profile-meta">加入时间：${new Date(user.created_at).toLocaleString('zh-CN')}</p>
      <div class="profile-stats"><span>文章 ${user.post_count || 0}</span><span>视频 ${user.video_count || 0}</span><span>文件 ${user.file_count || 0}</span></div>
      <div class="detail-actions">${action}</div>
    </article>
    <section class="submission-category"><div class="section-heading"><h2>TA 的文章</h2></div><div id="profile-posts" class="posts-list">${skeletonRows(3)}</div></section>
    <section class="submission-category"><div class="section-heading"><h2>TA 的视频</h2></div><div id="profile-videos" class="videos-list">${skeletonCards(4)}</div></section>
    <section class="submission-category"><div class="section-heading"><h2>TA 的文件</h2></div><div id="profile-files" class="files-list">${skeletonRows(3)}</div></section>
  `;

  setupDetailCards();
  await Promise.all([
    loadPosts('profile-posts', 20, 'latest', user.id),
    loadVideos('profile-videos', 20, 'latest', user.id),
    loadFiles('profile-files', 20, 'latest', user.id),
  ]);
}

async function sendFriendRequestFromProfile(userId) {
  await sendFriendRequest(userId);
  await loadProfilePage();
}

async function removeFriendFromProfile(userId) {
  if (!window.confirm('确定删除好友吗？')) return;
  await fetch(`${API_BASE}/api/friends/${userId}`, { method: 'DELETE' });
  await loadProfilePage();
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 区块入场微动画（IntersectionObserver） =====
// 由 JS 挂 .reveal 类（无 JS 时页面永不隐藏）；进入视口后加 .is-visible 并停止观察。
// 减动效偏好由 CSS 的 prefers-reduced-motion 兜底为直接显示，此处无需判断。
(function initSectionReveal() {
  const REVEAL_TARGETS = 'main > section, .container > section, main > div > section';

  function revealSections() {
    const targets = document.querySelectorAll(REVEAL_TARGETS);
    // 无 IntersectionObserver 支持时不挂类，内容保持直接可见
    if (!targets.length || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    targets.forEach(section => {
      section.classList.add('reveal');
      observer.observe(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealSections);
  } else {
    revealSections();
  }
})();

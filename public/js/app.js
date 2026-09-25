// API基础URL
const API_BASE = '';

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

// 显示消息
function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.textContent = message;
  element.className = 'message ' + (isError ? 'error' : 'success');
  element.style.display = 'block';
  
  setTimeout(() => {
    element.style.display = 'none';
  }, 3000);
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

// 根据登录状态更新公共导航
async function updateNavigation() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  try {
    const response = await fetch(`${API_BASE}/api/user`);
    const data = await response.json();
    const authLinks = navLinks.querySelector('.auth-links');

    if (authLinks) authLinks.remove();

    const links = document.createElement('span');
    links.className = 'auth-links';
    links.innerHTML = data.success
      ? '<a class="nav-icon-link" href="/notifications.html" title="通知" aria-label="通知">🔔<span class="nav-badge" id="nav-notification-badge" hidden></span></a><a class="nav-icon-link" href="/friends.html" title="私信与好友" aria-label="私信与好友">✉️<span class="nav-badge" id="nav-message-badge" hidden></span></a><a href="/dashboard.html">我的</a>'
      : '<a class="btn btn-nav" href="/register.html">注册</a><a class="btn btn-nav btn-nav-active" href="/login.html">登录</a>';
    navLinks.appendChild(links);

    if (data.success) startNavBadgePolling();
  } catch (error) {
    // 导航失败时保留页面，不影响主页浏览
  }
}

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
    window.alert(data.message);
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
  window.alert(data.message);
  if (data.success) await loadFriendsPage();
}

async function respondFriendRequest(requestId, action) {
  const response = await fetch(`${API_BASE}/api/friends/requests/${requestId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
  const data = await response.json();
  window.alert(data.message);
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
  form.addEventListener('submit', async event => { event.preventDefault(); const response = await fetch(`${API_BASE}/api/messages/${encodeURIComponent(userId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: form.elements.content.value }) }); const data = await response.json(); if (!data.success) window.alert(data.message); else { form.reset(); await load(); } });
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
      postsList.innerHTML = '<p class="loading">暂无文章</p>';
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

// 加载公开视频
async function loadVideos(targetId = 'videos-list', limit = 100, sort = 'latest', userId = null) {
  const videosList = document.getElementById(targetId);
  if (!videosList) return;

  try {
    const [videosResponse, userResponse] = await Promise.all([
      fetch(`${API_BASE}/api/videos?limit=${limit}&sort=${sort}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`),
      fetch(`${API_BASE}/api/user`),
    ]);
    const videos = await videosResponse.json();
    const userData = await userResponse.json();

    if (videos.length === 0) {
      videosList.innerHTML = '<p class="loading">暂无视频</p>';
      return;
    }

    videosList.innerHTML = videos.map(video => `
      <article class="video-card detail-card" data-video-id="${video.id}" data-detail-url="/detail.html?type=video&id=${video.id}" tabindex="0" role="link">
        <div class="video-heading"><h3>${escapeHtml(video.title)}</h3>${userData.success && userData.user.id === video.user_id ? `<button class="btn btn-danger video-delete-button" type="button" onclick="deleteVideo(${video.id})">下架</button>` : ''}</div>
        <div class="meta">
          <span class="author-line">${userAvatarMarkup(video.user_id, video.avatarUrl, video.username)}<span>作者：${escapeHtml(video.username)}</span></span>
          <span>发布于：${new Date(video.created_at).toLocaleString('zh-CN')}</span>
        </div>
        <div class="video-cover">${video.posterUrl ? `<img class="video-cover-image" src="${escapeAttribute(video.posterUrl)}" alt="${escapeAttribute(video.title)}封面">` : ''}<span class="video-cover-icon">播放</span></div>
        <div class="video-stats">
          <span>浏览 ${video.view_count || 0}</span>
          <span>评论 ${video.comment_count || 0}</span>
        </div>
      </article>
    `).join('');

  } catch (error) {
    videosList.innerHTML = '<p class="loading">视频加载失败</p>';
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
      filesList.innerHTML = '<p class="loading">暂无文件</p>';
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
    window.alert(verifyData.message);
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
    window.alert(data.message);
    return;
  }
  await loadFiles();
}

function setupGlobalSearch() {
  const form = document.getElementById('global-search-form');
  const input = document.getElementById('global-search-input');
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
  const input = document.getElementById('global-search-input');
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
    results.innerHTML = '<p class="loading">请输入关键词开始搜索</p>';
    return;
  }

  try {
    const limit = isFullView ? 100 : 4;
    const typeParam = requestedType ? `&type=${requestedType}` : '';
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}&sort=${sortSelect ? sortSelect.value : 'hot'}${typeParam}`);
    if (!response.ok) throw new Error('search request failed');
    const items = await response.json();
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
            <button class="btn btn-secondary${item.favorited ? ' is-active' : ''}" type="button" onclick="toggleFavorite('post', ${item.id}, this)">${item.favorited ? '已收藏' : '收藏'}</button>
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
          <button class="btn btn-secondary${item.favorited ? ' is-active' : ''}" type="button" onclick="toggleFavorite('file', ${item.id}, this)">${item.favorited ? '已收藏' : '收藏'}</button>
          <button class="btn btn-secondary" type="button" onclick="reportContent('file', ${item.id})">举报</button>
        </div>
      </article>
    `;
  } catch (error) {
    detail.innerHTML = '<p class="loading">内容不存在或加载失败</p>';
  }
}

function renderVideoDetail(video) {
  return `
    <article class="detail-panel video-detail-panel" data-video-id="${video.id}">
      <span class="detail-type">视频</span>
      <h1>${escapeHtml(video.title)}</h1>
      <div class="meta"><span class="author-line">${userAvatarMarkup(video.user_id, video.avatarUrl, video.username)}<span>作者：${escapeHtml(video.username)}</span></span><span>发布于：${new Date(video.created_at).toLocaleString('zh-CN')}</span><span>浏览 ${video.view_count || 0}</span></div>
      <div class="video-frame">
        <video class="video-player" controls autoplay="false" preload="metadata" poster="${escapeAttribute(video.posterUrl || '')}" data-hls="${escapeAttribute(video.hlsUrl || '')}" data-mp4="${escapeAttribute(video.mp4Url || '')}" data-webm="${escapeAttribute(video.webmUrl || '')}">
          ${video.mp4Url ? `<source src="${escapeAttribute(video.mp4Url)}" type="video/mp4">` : ''}
          ${video.webmUrl ? `<source src="${escapeAttribute(video.webmUrl)}" type="video/webm">` : ''}
        </video>
      </div>
      <label class="video-speed">播放速度
        <select data-video-speed aria-label="播放速度"><option value="0.5">0.5x</option><option value="1" selected>正常</option><option value="1.5">1.5x</option><option value="2">2x</option></select>
      </label>
      <div class="video-stats"><button class="btn like-button ${video.liked ? 'is-liked' : ''}" type="button" onclick="toggleVideoLike(${video.id})">${video.liked ? '已点赞' : '点赞'} <span class="like-count">${video.like_count}</span></button><button class="btn btn-secondary${video.favorited ? ' is-active' : ''}" type="button" onclick="toggleFavorite('video', ${video.id}, this)">${video.favorited ? '已收藏' : '收藏'}</button><button class="btn btn-secondary" type="button" onclick="reportContent('video', ${video.id})">举报</button><span>浏览 ${video.view_count || 0}</span><span>评论 <span class="comment-count">${video.comment_count}</span></span></div>
      <div class="comments" id="comments-${video.id}"><p class="loading">加载评论中...</p></div>
      <form class="comment-form" onsubmit="submitVideoComment(event, ${video.id})"><input name="content" data-mention-input list="mention-users" maxlength="500" placeholder="写下评论，使用 @用户名 提及他人" required><button class="btn btn-secondary" type="submit">评论</button></form><datalist id="mention-users"></datalist>
    </article>
  `;
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
  form.elements.username.value = data.user.username;
  form.elements.bio.value = data.user.bio || '';
  document.getElementById('profile-preview').innerHTML = `${avatarMarkup(data.user.avatarUrl, data.user.username)}<span>${escapeHtml(data.user.username)}</span>`;
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
    window.alert(data.message);
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
    window.alert(data.message);
    return;
  }
  form.reset();
  await loadPostComments(postId);
}

async function toggleVideoLike(videoId) {
  const response = await fetch(`${API_BASE}/api/videos/${videoId}/like`, { method: 'POST' });
  const data = await response.json();
  if (!data.success) {
    window.alert(data.message);
    return;
  }

  const card = document.querySelector(`[data-video-id="${videoId}"]`);
  const button = card.querySelector('.like-button');
  button.classList.toggle('is-liked', data.liked);
  button.firstChild.textContent = data.liked ? '已点赞 ' : '点赞 ';
  button.querySelector('.like-count').textContent = data.likeCount;
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
    window.alert(data.message);
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
    window.alert(data.message);
    return;
  }
  await loadVideos();
}

// ===== 站内通知 =====
const CONTENT_TYPE_NAMES = { post: '文章', video: '视频', file: '文件' };

const NOTIFICATION_TYPE_LABELS = {
  like: '点赞了你的视频',
  comment: '评论了你的内容',
  comment_like: '点赞了你的评论',
  mention: '在评论中提到了你',
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
    window.alert(data.message);
    return;
  }
  if (button) {
    button.classList.toggle('is-active', Boolean(data.favorited));
    button.textContent = data.favorited ? '已收藏' : '收藏';
  }
}

async function removeFavorite(contentType, contentId) {
  const response = await fetch(`${API_BASE}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, contentId }),
  });
  const data = await response.json();
  if (!data.success) {
    window.alert(data.message);
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
    : '<p class="empty-comments">还没有收藏内容</p>';
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
    : '<p class="empty-comments">还没有浏览记录</p>';
}

async function clearHistory() {
  if (!window.confirm('确定清空全部浏览历史吗？')) return;
  const response = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.success) {
    window.alert(data.message);
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
  window.alert(data.message);
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
    <section class="submission-category"><div class="section-heading"><h2>TA 的文章</h2></div><div id="profile-posts" class="posts-list"><p class="loading">加载中...</p></div></section>
    <section class="submission-category"><div class="section-heading"><h2>TA 的视频</h2></div><div id="profile-videos" class="videos-list"><p class="loading">加载中...</p></div></section>
    <section class="submission-category"><div class="section-heading"><h2>TA 的文件</h2></div><div id="profile-files" class="files-list"><p class="loading">加载中...</p></div></section>
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

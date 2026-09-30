const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEmail,
  validateEmail,
  validateRegistrationInput,
  validatePostInput,
  validateUploadFile,
} = require('../validation');

test('normalizeEmail trims and lowercases the value', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com');
});

test('validateEmail rejects invalid email format', () => {
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail('user@example.com'), true);
});

test('validateRegistrationInput rejects blank username or weak password', () => {
  const blankUser = validateRegistrationInput({
    username: '   ',
    email: 'user@example.com',
    code: 'ABC123',
    password: '123456',
  });

  const weakPassword = validateRegistrationInput({
    username: 'alice',
    email: 'user@example.com',
    code: 'ABC123',
    password: '123',
  });

  assert.equal(blankUser.valid, false);
  assert.equal(weakPassword.valid, false);
});

test('validateRegistrationInput accepts valid registration data', () => {
  const result = validateRegistrationInput({
    username: 'alice',
    email: 'alice@example.com',
    code: 'ABC123',
    password: 'Password123',
  });

  assert.equal(result.valid, true);
  assert.equal(result.email, 'alice@example.com');
  assert.equal(result.username, 'alice');
});

test('validatePostInput rejects empty title or content', () => {
  assert.equal(validatePostInput({ title: '', content: '正文' }).valid, false);
  assert.equal(validatePostInput({ title: '标题', content: '   ' }).valid, false);
  assert.equal(validatePostInput({ title: '标题', content: '正文' }).valid, true);
});

test('validateUploadFile accepts whitelisted extensions', () => {
  // 图片 / 音频 / 视频 / 文档压缩包各取一个代表，且大小写不敏感
  assert.equal(validateUploadFile('photo.PNG'), null);
  assert.equal(validateUploadFile('song.mp3'), null);
  assert.equal(validateUploadFile('clip.mp4'), null);
  assert.equal(validateUploadFile('archive.zip'), null);
});

test('validateUploadFile rejects dangerous executable extensions', () => {
  assert.match(validateUploadFile('virus.exe'), /可执行文件/);
  assert.match(validateUploadFile('script.BAT'), /可执行文件/);
});

test('validateUploadFile rejects unknown extensions', () => {
  assert.match(validateUploadFile('mystery.xyz'), /不支持的文件格式/);
});

test('validateUploadFile rejects names without an extension', () => {
  assert.match(validateUploadFile('README'), /缺少扩展名/);
  assert.match(validateUploadFile(''), /缺少扩展名/);
});

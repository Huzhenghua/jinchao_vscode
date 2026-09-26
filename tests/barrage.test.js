const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BARRAGE_COLORS,
  BARRAGE_FONT_SIZES,
  BARRAGE_SPEEDS,
  BARRAGE_MAX_OFFSET_MS,
  validateBarrageCreate,
  validateBarrageUpdate,
} = require('../validation');

test('barrage constants expose the expected whitelist values', () => {
  assert.equal(BARRAGE_COLORS.length, 12);
  assert.equal(BARRAGE_COLORS[0], '#ffffff');
  assert.equal(BARRAGE_COLORS.includes('#cc0273'), true);
  assert.deepEqual(BARRAGE_FONT_SIZES, [18, 25, 32]);
  assert.deepEqual(BARRAGE_SPEEDS, ['slow', 'normal', 'fast']);
  assert.equal(BARRAGE_MAX_OFFSET_MS, 86400000);
});

test('validateBarrageCreate rejects empty or blank content', () => {
  assert.equal(validateBarrageCreate({ content: '' }).valid, false);
  assert.equal(validateBarrageCreate({ content: '   ' }).valid, false);
  assert.equal(validateBarrageCreate({}).message, '弹幕内容不能为空且不超过100字');
});

test('validateBarrageCreate handles the 100 character boundary and emoji', () => {
  const exact = validateBarrageCreate({ content: 'a'.repeat(100) });
  assert.equal(exact.valid, true);
  assert.equal(exact.content.length, 100);

  assert.equal(validateBarrageCreate({ content: 'a'.repeat(101) }).valid, false);

  const emoji = validateBarrageCreate({ content: '前方高能 🎉🎉' });
  assert.equal(emoji.valid, true);
  assert.equal(emoji.content, '前方高能 🎉🎉');

  const trimmed = validateBarrageCreate({ content: '  带空格的弹幕  ' });
  assert.equal(trimmed.valid, true);
  assert.equal(trimmed.content, '带空格的弹幕');
});

test('validateBarrageCreate defaults offsetMs to 0 or parses numeric strings', () => {
  assert.equal(validateBarrageCreate({ content: '弹幕' }).offsetMs, 0);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: null }).offsetMs, 0);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: '' }).offsetMs, 0);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: '3000' }).offsetMs, 3000);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: 86400000 }).offsetMs, 86400000);
});

test('validateBarrageCreate rejects invalid offsetMs', () => {
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: -1 }).valid, false);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: 86400001 }).valid, false);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: 1.5 }).valid, false);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: 'abc' }).valid, false);
  assert.equal(validateBarrageCreate({ content: '弹幕', offsetMs: -1 }).message, '弹幕时间点不合法');
});

test('validateBarrageCreate normalizes color case-insensitively', () => {
  assert.equal(validateBarrageCreate({ content: '弹幕', color: '#89d5ff' }).color, '#89d5ff');
  assert.equal(validateBarrageCreate({ content: '弹幕', color: '#89D5FF' }).color, '#89d5ff');
  assert.equal(validateBarrageCreate({ content: '弹幕', color: '#FFFFFF' }).color, '#ffffff');
  assert.equal(validateBarrageCreate({ content: '弹幕' }).color, '#ffffff');
});

test('validateBarrageCreate rejects css injection attempts in color', () => {
  assert.equal(validateBarrageCreate({ content: '弹幕', color: 'red;background:url(x)' }).color, '#ffffff');
  assert.equal(validateBarrageCreate({ content: '弹幕', color: '#ffffff;}' }).color, '#ffffff');
  assert.equal(validateBarrageCreate({ content: '弹幕', color: 'red' }).color, '#ffffff');
});

test('validateBarrageCreate normalizes fontSize', () => {
  [18, 25, 32].forEach(size => {
    assert.equal(validateBarrageCreate({ content: '弹幕', fontSize: size }).fontSize, size);
  });

  const fromString = validateBarrageCreate({ content: '弹幕', fontSize: '32' });
  assert.equal(fromString.fontSize, 32);
  assert.equal(typeof fromString.fontSize, 'number');

  assert.equal(validateBarrageCreate({ content: '弹幕', fontSize: 999 }).fontSize, 25);
  assert.equal(validateBarrageCreate({ content: '弹幕', fontSize: '18.5' }).fontSize, 25);
  assert.equal(validateBarrageCreate({ content: '弹幕' }).fontSize, 25);
});

test('validateBarrageCreate normalizes speed', () => {
  ['slow', 'normal', 'fast'].forEach(speed => {
    assert.equal(validateBarrageCreate({ content: '弹幕', speed }).speed, speed);
  });

  assert.equal(validateBarrageCreate({ content: '弹幕', speed: 'FAST' }).speed, 'fast');
  assert.equal(validateBarrageCreate({ content: '弹幕', speed: 'turbo' }).speed, 'normal');
  assert.equal(validateBarrageCreate({ content: '弹幕' }).speed, 'normal');
});

test('validateBarrageUpdate returns only the provided fields', () => {
  const contentOnly = validateBarrageUpdate({ content: '  改过的弹幕  ' });
  assert.equal(contentOnly.valid, true);
  assert.deepEqual(contentOnly.fields, { content: '改过的弹幕' });

  const colorOnly = validateBarrageUpdate({ color: '#CC0273' });
  assert.equal(colorOnly.valid, true);
  assert.deepEqual(colorOnly.fields, { color: '#cc0273' });
});

test('validateBarrageUpdate accepts several provided fields at once', () => {
  const result = validateBarrageUpdate({ content: '新弹幕', fontSize: '18', speed: 'SLOW' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.fields, { content: '新弹幕', fontSize: 18, speed: 'slow' });
});

test('validateBarrageUpdate rejects an empty payload', () => {
  const empty = validateBarrageUpdate({});
  assert.equal(empty.valid, false);
  assert.equal(empty.message, '没有需要更新的内容');
});

test('validateBarrageUpdate rejects invalid provided values', () => {
  assert.equal(validateBarrageUpdate({ content: '   ' }).valid, false);
  assert.equal(validateBarrageUpdate({ content: 'a'.repeat(101) }).valid, false);
  assert.equal(validateBarrageUpdate({ color: 'red;background:url(x)' }).valid, false);
  assert.equal(validateBarrageUpdate({ color: '#ffffff;}' }).valid, false);
  assert.equal(validateBarrageUpdate({ fontSize: 999 }).valid, false);
  assert.equal(validateBarrageUpdate({ speed: 'turbo' }).valid, false);
});

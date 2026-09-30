const test = require('node:test');
const assert = require('node:assert/strict');

// 与 server.js / 前端 app.js 共用同一份实现（UMD 模块，Node 端直接 require）
const {
  HEAT_WEIGHTS,
  IMAGE_GALLERY_LIMIT,
  AUDIO_LIST_LIMIT,
  computeFileHeat,
  compareFileBatches,
  splitGallery,
  splitAudios,
  imagesOverflowCount,
  audiosOverflowCount,
} = require('../public/js/file-card-logic.js');

// ===== 热度计算 =====

test('computeFileHeat 按 下载×3 + 收藏×5 + 浏览×1 加权求和', () => {
  assert.deepEqual(HEAT_WEIGHTS, { download: 3, favorite: 5, view: 1 });

  assert.equal(computeFileHeat({ downloadCount: 2 }), 6);
  assert.equal(computeFileHeat({ favoriteCount: 3 }), 15);
  assert.equal(computeFileHeat({ viewCount: 4 }), 4);
  assert.equal(computeFileHeat({ downloadCount: 2, favoriteCount: 3, viewCount: 4 }), 25);
});

test('computeFileHeat 对空值 / 非法值按 0 处理', () => {
  assert.equal(computeFileHeat(), 0);
  assert.equal(computeFileHeat({}), 0);
  assert.equal(computeFileHeat({ downloadCount: null, favoriteCount: undefined, viewCount: NaN }), 0);
  assert.equal(computeFileHeat({ downloadCount: -5, favoriteCount: 'abc', viewCount: 0 }), 0);
});

// ===== 批次排序：热度降序 → 上传时间降序 =====

test('compareFileBatches 按热度降序排列', () => {
  const batches = [
    { batchId: 'a', heat: 10, created_at: '2026-01-03T00:00:00.000Z' },
    { batchId: 'b', heat: 30, created_at: '2026-01-01T00:00:00.000Z' },
    { batchId: 'c', heat: 20, created_at: '2026-01-02T00:00:00.000Z' },
  ];

  assert.deepEqual(batches.slice().sort(compareFileBatches).map(item => item.batchId), ['b', 'c', 'a']);
});

test('compareFileBatches 热度相同时按上传时间降序（最新在前）', () => {
  const batches = [
    { batchId: 'older', heat: 12, created_at: '2026-01-01T08:00:00.000Z' },
    { batchId: 'newer', heat: 12, created_at: '2026-02-01T08:00:00.000Z' },
    { batchId: 'middle', heat: 12, created_at: '2026-01-15T08:00:00.000Z' },
  ];

  assert.deepEqual(
    batches.slice().sort(compareFileBatches).map(item => item.batchId),
    ['newer', 'middle', 'older'],
  );
});

test('compareFileBatches 热度与时间都相同时顺序稳定（按 batchId 兜底）', () => {
  const sameTime = '2026-01-01T00:00:00.000Z';
  const batches = [
    { batchId: 'z-last', heat: 5, created_at: sameTime },
    { batchId: 'a-first', heat: 5, created_at: sameTime },
  ];

  assert.deepEqual(batches.slice().sort(compareFileBatches).map(item => item.batchId), ['a-first', 'z-last']);
});

// ===== 九宫格切分（缩略图 9 格，第 9 格模糊 + "+X"）=====

function makeItems(count) {
  return Array.from({ length: count }, (item, index) => ({ id: index + 1 }));
}

test('splitGallery：9 张以内全部清晰展示，无溢出格', () => {
  assert.equal(IMAGE_GALLERY_LIMIT, 9);

  [0, 1, 8, 9].forEach(count => {
    const result = splitGallery(makeItems(count));
    assert.equal(result.visible.length, count);
    assert.equal(result.overflow, null);
    assert.equal(result.overflowCount, 0);
    assert.equal(imagesOverflowCount(count), 0);
  });
});

test('splitGallery：超过 9 张时前 8 张清晰，第 9 格用第 9 张图并给出 +X', () => {
  const ten = splitGallery(makeItems(10));
  assert.equal(ten.visible.length, 8);
  assert.equal(ten.overflow.id, 9, '第 9 格应使用第 9 张图片作为模糊底图');
  assert.equal(ten.overflowCount, 1, 'X = 总数 - 9');
  assert.equal(imagesOverflowCount(10), 1);

  const twelve = splitGallery(makeItems(12));
  assert.equal(twelve.visible.length, 8);
  assert.equal(twelve.overflow.id, 9);
  assert.equal(twelve.overflowCount, 3);
  assert.equal(imagesOverflowCount(12), 3);
  assert.equal(imagesOverflowCount(9), 0);
  assert.equal(imagesOverflowCount(1), 0);
});

test('splitGallery：非数组入参按空列表处理', () => {
  assert.deepEqual(splitGallery(null), { visible: [], overflow: null, overflowCount: 0 });
  assert.deepEqual(splitGallery(undefined), { visible: [], overflow: null, overflowCount: 0 });
});

// ===== 音频切分（最多 3 个，第 3 格溢出 + "+X"）=====

test('splitAudios：3 个以内全部为正常可交互播放器', () => {
  assert.equal(AUDIO_LIST_LIMIT, 3);

  [0, 1, 2, 3].forEach(count => {
    const result = splitAudios(makeItems(count));
    assert.equal(result.visible.length, count);
    assert.equal(result.overflow, null);
    assert.equal(result.overflowCount, 0);
    assert.equal(audiosOverflowCount(count), 0);
  });
});

test('splitAudios：超过 3 个时前 2 个正常，第 3 格为溢出格并给出 +X', () => {
  const four = splitAudios(makeItems(4));
  assert.equal(four.visible.length, 2);
  assert.equal(four.overflow.id, 3, '第 3 格应使用第 3 个音频作为模糊底样');
  assert.equal(four.overflowCount, 1, 'X = 总数 - 3');
  assert.equal(audiosOverflowCount(4), 1);

  const six = splitAudios(makeItems(6));
  assert.equal(six.visible.length, 2);
  assert.equal(six.overflow.id, 3);
  assert.equal(six.overflowCount, 3);
  assert.equal(audiosOverflowCount(6), 3);
  assert.equal(audiosOverflowCount(3), 0);
});
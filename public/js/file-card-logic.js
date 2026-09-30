/**
 * 文件卡片纯逻辑：热度计算 / 批次排序 / 九宫格与音频切分
 *
 * 采用 UMD 写法，前后端共用同一份实现，避免逻辑重复：
 * - 浏览器：<script src="/js/file-card-logic.js"></script> 后使用 window.FileCardLogic
 * - Node：server.js 与单元测试通过 require('./public/js/file-card-logic.js') 引入
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FileCardLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 热度权重：收藏代表用户主动认可（权重最高），下载次之，浏览最廉价
  const HEAT_WEIGHTS = { download: 3, favorite: 5, view: 1 };

  // 九宫格最多 9 格（前 8 张清晰，第 9 格模糊 + 溢出数），音频最多 3 个（前 2 个正常，第 3 格为溢出格）
  const IMAGE_GALLERY_LIMIT = 9;
  const AUDIO_LIST_LIMIT = 3;

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  // 热点值：下载量 × 3 + 收藏数 × 5 + 浏览量 × 1
  function computeFileHeat({ downloadCount, favoriteCount, viewCount } = {}) {
    return toCount(downloadCount) * HEAT_WEIGHTS.download
      + toCount(favoriteCount) * HEAT_WEIGHTS.favorite
      + toCount(viewCount) * HEAT_WEIGHTS.view;
  }

  function createdTime(batch) {
    const time = Date.parse((batch && batch.created_at) || '');
    return Number.isFinite(time) ? time : 0;
  }

  // 批次排序：热度降序 → 上传时间降序 → batchId 兜底，保证顺序稳定可复现
  function compareFileBatches(a, b) {
    const heatDiff = toCount(b && b.heat) - toCount(a && a.heat);
    if (heatDiff !== 0) return heatDiff;

    const timeDiff = createdTime(b) - createdTime(a);
    if (timeDiff !== 0) return timeDiff;

    return String((a && a.batchId) || '').localeCompare(String((b && b.batchId) || ''));
  }

  function sliceLimit(limit, fallback) {
    const value = Number(limit);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  // 九宫格切分：超出上限时前 limit-1 张清晰展示，
  // 第 limit 格用被遮住的下一张图（前端做高斯模糊）+ 溢出数量（总数 - limit）
  function splitGallery(images, limit) {
    const list = Array.isArray(images) ? images : [];
    const max = sliceLimit(limit, IMAGE_GALLERY_LIMIT);
    if (list.length <= max) {
      return { visible: list.slice(), overflow: null, overflowCount: 0 };
    }
    return {
      visible: list.slice(0, max - 1),
      overflow: list[max - 1],
      overflowCount: list.length - max,
    };
  }

  // 音频切分：超出上限时前 limit-1 个正常播放，第 limit 格为溢出格（总数 - limit）
  function splitAudios(audios, limit) {
    return splitGallery(audios, sliceLimit(limit, AUDIO_LIST_LIMIT));
  }

  function overflowCountOf(total, limit, fallback) {
    const count = toCount(total);
    const max = sliceLimit(limit, fallback);
    return count > max ? count - max : 0;
  }

  function imagesOverflowCount(total, limit) {
    return overflowCountOf(total, limit, IMAGE_GALLERY_LIMIT);
  }

  function audiosOverflowCount(total, limit) {
    return overflowCountOf(total, limit, AUDIO_LIST_LIMIT);
  }

  return {
    HEAT_WEIGHTS,
    IMAGE_GALLERY_LIMIT,
    AUDIO_LIST_LIMIT,
    computeFileHeat,
    compareFileBatches,
    splitGallery,
    splitAudios,
    imagesOverflowCount,
    audiosOverflowCount,
  };
});
/*!
 * LenChat - vision.js
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Screenshots and images for visual debugging.
 *
 */
(function (global) {
    'use strict';

    var cfg = null;
    var IMG_EXT = /\.(png|jpe?g|webp|gif)$/i;
    var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

    function init(config) { cfg = config; }

    function isImage(path) { return IMG_EXT.test(String(path || '')); }

    function mimeOf(file) {
        if (file.type && /^image\//.test(file.type)) { return file.type; }
        var m = String(file.name || '').toLowerCase().match(/\.(\w+)$/);
        return (m && MIME[m[1]]) || 'image/png';
    }


    function readDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { resolve(String(fr.result)); };
            fr.onerror = function () { reject(fr.error); };
            fr.readAsDataURL(file);
        });
    }

    function loadImg(src) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('The browser could not decode this image.')); };
            img.src = src;
        });
    }

    function bytesOfDataUrl(u) { return Math.round((u.length - u.indexOf(',') - 1) * 0.75); }

    function draw(img, w, h, fillWhite) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var g = c.getContext('2d');
        if (fillWhite) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
        g.drawImage(img, 0, 0, w, h);
        return c;
    }

    async function prepare(file) {
        var limits = (cfg && cfg.limits) || {};
        var maxEdge = limits.image_max_edge || 1600;
        var mime = mimeOf(file);
        var url = await readDataUrl(file);
        var img = await loadImg(url);
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { throw new Error('Empty image.'); }

        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
        var out = url, outMime = mime;

        var reencode = scale < 1 || mime === 'image/gif' || bytesOfDataUrl(url) > 1500000;
        if (reencode) {
            if (mime === 'image/jpeg') {
                outMime = 'image/jpeg';
                out = draw(img, tw, th, true).toDataURL('image/jpeg', 0.9);
            } else {
                outMime = 'image/png';
                out = draw(img, tw, th, false).toDataURL('image/png');
                if (bytesOfDataUrl(out) > 2200000) {
                    outMime = 'image/jpeg';
                    out = draw(img, tw, th, true).toDataURL('image/jpeg', 0.88);
                }
            }
        }

        var ts = Math.min(1, 160 / Math.max(w, h));
        var thumb = draw(img, Math.max(1, Math.round(w * ts)), Math.max(1, Math.round(h * ts)), true).toDataURL('image/jpeg', 0.7);

        return {
            kind: 'image',
            mime: outMime,
            data: out.slice(out.indexOf(',') + 1),
            width: reencode ? tw : w,
            height: reencode ? th : h,
            origWidth: w,
            origHeight: h,
            bytes: bytesOfDataUrl(out),
            thumb: thumb
        };
    }

    function tokensFor(img) {
        var px = (img.width || 1024) * (img.height || 768);
        return Math.max(85, Math.min(1600, Math.round(px / 750)));
    }


    var NEGATIVE = [
        /gpt-oss/, /gpt-3\.5/, /\bo[13]-mini/, /\bo1-preview/, /deepseek-(chat|reasoner|coder|v\d|r\d)(?!.*vl)/,
        /llama-3\.[13]-/, /llama3\.[13]/, /qwen[\w.-]*coder/, /moonshot-v1-(8k|32k|128k)$/, /grok-3-mini/,
        /^lite$/, /^generalv/, /4\.0ultra/, /glm-4-(flash|plus|air)$/, /hunyuan-(turbo|large|lite)$/, /ernie-(speed|4\.0|4\.5-turbo-128k)/,
        /embedding/, /whisper/, /tts/
    ];
    var POSITIVE = [
        /gpt-4o/, /chatgpt-4o/, /gpt-4\.1/, /gpt-4\.5/, /gpt-4-turbo/, /gpt-4-vision/, /gpt-5/, /\bo1\b(?!-mini)/, /\bo3\b(?!-mini)/, /\bo4/,
        /vision/, /-vl\b/, /-vl-/, /\bvl-/, /llava/, /pixtral/, /\bvlm/, /omni/, /multimodal/, /gemma-3/,
        /llama-?4/, /llama-3\.2-(11|90)b/, /grok-4/, /grok-\d-vision/, /claude/, /gemini/, /kimi-k2\.5/, /glm-4\.?\dv/,
        /mistral-(small|medium)/, /doubao-.*(vision|seed-1)/, /qwen-?(plus|max)-vl/
    ];

    function modelHasVision(kind, model) {
        var m = String(model || '').toLowerCase();
        if (kind === 'anthropic') { return !/claude-(instant|2)/.test(m); }
        if (kind === 'gemini') { return !/embedding|imagen|tts/.test(m); }
        for (var i = 0; i < NEGATIVE.length; i++) { if (NEGATIVE[i].test(m)) { return false; } }
        for (var j = 0; j < POSITIVE.length; j++) { if (POSITIVE[j].test(m)) { return true; } }
        return false;
    }

    function usesVision(settings, providerId) {
        var mode = settings.visionMode || 'auto';
        if (mode === 'vision') { return true; }
        if (mode === 'ocr') { return false; }
        var meta = cfg.providers[providerId];
        var model = (settings.providers[providerId] || {}).model;
        return modelHasVision(meta ? meta.kind : 'openai', model);
    }


    var loading = null;
    var worker = null, workerLang = '', idle = null;

    function loadTesseract() {
        if (global.Tesseract) { return Promise.resolve(global.Tesseract); }
        if (loading) { return loading; }
        var v = (cfg && cfg.vision) || {};
        if (!v.ocr_src) { return Promise.reject(new Error('OCR is not configured (config.php -> vision.ocr_src).')); }
        loading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = v.ocr_src;
            if (v.ocr_integrity) { s.integrity = v.ocr_integrity; s.crossOrigin = 'anonymous'; }
            s.onload = function () { global.Tesseract ? resolve(global.Tesseract) : reject(new Error('OCR engine did not initialise.')); };
            s.onerror = function () {
                loading = null;
                reject(new Error('Could not load the OCR engine (offline, blocked, or the CDN host is missing from the Content-Security-Policy).'));
            };
            document.head.appendChild(s);
        });
        return loading;
    }

    var progressCb = null;

    async function getWorker(lang) {
        clearTimeout(idle);
        if (worker && workerLang === lang) { return worker; }
        if (worker) { try { await worker.terminate(); } catch (e) {  } worker = null; }
        var T = await loadTesseract();
        worker = await T.createWorker(lang, 1, {
            logger: function (m) { if (progressCb && m && typeof m.progress === 'number') { progressCb(m.status, m.progress); } }
        });
        workerLang = lang;
        return worker;
    }

    function scheduleRelease() {
        clearTimeout(idle);
        idle = setTimeout(function () {
            if (worker) { try { worker.terminate(); } catch (e) {  } worker = null; }
        }, 90000);
    }

    async function ocr(image, lang, onProgress) {
        progressCb = onProgress || null;
        try {
            var w = await getWorker(String(lang || (cfg.vision && cfg.vision.ocr_lang) || 'eng'));
            var res = await w.recognize('data:' + image.mime + ';base64,' + image.data);
            var text = (res && res.data && res.data.text) || '';
            return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        } finally {
            progressCb = null;
            scheduleRelease();
        }
    }

    global.LenVision = {
        init: init,
        isImage: isImage,
        prepare: prepare,
        usesVision: usesVision,
        modelHasVision: modelHasVision,
        tokensFor: tokensFor,
        ocr: ocr
    };
})(window);

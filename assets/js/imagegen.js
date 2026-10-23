/*!
 * LenChat - imagegen.js
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Image generation.
 *
 *
 * Commands: "/imagine ...", "draw ...", "generate/create an image of ...".
 * "draw" style commands are ignored when the message mentions svg, holds a code fence or is very long,
 * so "draw a sequence diagram in svg" still goes to the text model.
 *
 */
(function (global) {
    'use strict';

    var cfg = null;
    function init(config) { cfg = config; }

    var HINT = 'Image requests: when the user asks you to draw, design or illustrate something, answer with either ' +
        '(a) ONE complete standalone ```svg code block (valid SVG with a viewBox, no scripts, no external resources), or ' +
        '(b) a markdown image alone on its own line: ![short description](https://image.pollinations.ai/prompt/URL-ENCODED-PROMPT?model=flux&width=1024&height=1024&nologo=true). ' +
        'Prefer SVG for logos, icons, diagrams and charts; prefer the Pollinations URL for photos and artwork. Keep any other text brief.';

    var FORCED = /^\s*\/imagine\s+([\s\S]+)$/i;
    var NATURAL = [
        /^\s*(?:please\s+)?(?:draw|paint|sketch)\s+(?:me\s+)?([\s\S]{3,})$/i,
        /^\s*(?:please\s+)?(?:generate|create|make)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image|picture|photo|illustration|artwork)s?\s*(?:of|showing|with|:)?\s*([\s\S]{3,})$/i
    ];

    function intent(text) {
        var t = String(text || '');
        var m = t.match(FORCED);
        if (m) { return m[1].trim(); }
        if (t.length > 600 || /```/.test(t) || /\bsvg\b/i.test(t)) { return null; }
        for (var i = 0; i < NATURAL.length; i++) {
            m = t.match(NATURAL[i]);
            if (m) { return m[1].trim(); }
        }
        return null;
    }

    function pollinationsBase() {
        return ((cfg && cfg.image && cfg.image.pollinations) || 'https://image.pollinations.ai/prompt/');
    }

    function pollinationsUrl(prompt, settings) {
        var model = (settings.imageProvider !== 'openai' && settings.imageModel) || 'flux';
        var safe = encodeURIComponent(prompt.slice(0, 900)).replace(/\(/g, '%28').replace(/\)/g, '%29');
        return pollinationsBase() + safe + '?model=' + encodeURIComponent(model) +
            '&width=1024&height=1024&nologo=true&seed=' + Math.floor(Math.random() * 1e9);
    }

    function shrink(dataUrl) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var s = Math.min(1, 1024 / Math.max(img.width, img.height));
                var c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(img.width * s));
                c.height = Math.max(1, Math.round(img.height * s));
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = function () { resolve(dataUrl); };
            img.src = dataUrl;
        });
    }

    async function openaiImage(prompt, settings, signal) {
        var p = settings.providers.openai;
        var key = p && global.LenStorage.activeKey(settings, 'openai');
        if (!key || !key.key) { throw new Error('Add an OpenAI API key to use OpenAI image generation.'); }
        var base = global.LenProvider.resolveBase('openai', p.baseUrl);
        var model = settings.imageModel || 'dall-e-3';
        var body = { model: model, prompt: prompt, n: 1, size: '1024x1024' };
        if (/^dall-e/i.test(model)) { body.response_format = 'b64_json'; }
        var res = await fetch(base + '/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key.key },
            body: JSON.stringify(body),
            signal: signal
        });
        if (!res.ok) {
            var txt = '';
            try { txt = await res.text(); } catch (e) {  }
            var msg = txt;
            try { var j = JSON.parse(txt); msg = (j.error && j.error.message) || txt; } catch (e) {  }
            throw new Error('HTTP ' + res.status + ' - ' + String(msg).slice(0, 300));
        }
        var data = await res.json();
        var d = data.data && data.data[0];
        if (!d || !d.b64_json) { throw new Error('The image API returned no picture.'); }
        return shrink('data:image/png;base64,' + d.b64_json);
    }

    async function generate(prompt, settings, signal) {
        if (settings.imageProvider === 'openai') {
            var src = await openaiImage(prompt, settings, signal);
            return { src: src, alt: prompt, via: 'OpenAI ' + (settings.imageModel || 'dall-e-3'), inline: true };
        }
        var url = pollinationsUrl(prompt, settings);
        return { src: url, alt: prompt, via: 'Pollinations ' + (settings.imageModel || 'flux'), inline: false,
            markdown: '![' + prompt.replace(/[\[\]\n]/g, ' ').slice(0, 120) + '](' + url + ')' };
    }

    global.LenImage = { init: init, intent: intent, generate: generate, pollinationsUrl: pollinationsUrl, HINT: HINT };
})(window);

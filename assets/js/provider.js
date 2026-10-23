/*!
 * LenChat - provider.js  
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Builds provider-specific streaming requests and sends them either
 *   - directly from the browser (fastest, no server involved), or
 *   - through api/stream.php when CORS blocks the browser.
 */
(function (global) {
    'use strict';

    var cfg = null;

    function init(config) { cfg = config; }
    function meta(id) { return cfg.providers[id]; }
    function trimSlash(u) { return String(u || '').trim().replace(/\/+$/, ''); }

    function toBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var bin = '';
        for (var i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
    }

    function resolveBase(id, typed) {
        var m = meta(id);
        var raw = trimSlash(typed);
        if (!raw) { return trimSlash(m.base_url); }
        if (m.kind === 'azure') { return raw; }
        try {
            var u = new URL(raw);
            var def = m.base_url ? new URL(m.base_url) : null;
            if (def && u.origin === def.origin) {
                var path = u.pathname.replace(/\/+$/, '');
                var defPath = def.pathname.replace(/\/+$/, '');
                if (path !== defPath && (path === '' || defPath.indexOf(path + '/') === 0)) {
                    return def.origin + defPath;
                }
            }
        } catch (e) {  }
        return raw;
    }

    function positiveInt(v) {
        var n = parseInt(v, 10);
        return isFinite(n) && n > 0 ? n : 0;
    }


    function anthropicMsg(x) {
        if (!x.images || !x.images.length) { return { role: x.role, content: x.content }; }
        var c = x.images.map(function (i) {
            return { type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } };
        });
        c.push({ type: 'text', text: x.content });
        return { role: x.role, content: c };
    }

    function openaiMsg(x) {
        if (!x.images || !x.images.length) { return { role: x.role, content: x.content }; }
        var c = [{ type: 'text', text: x.content }];
        x.images.forEach(function (i) {
            c.push({ type: 'image_url', image_url: { url: 'data:' + i.mime + ';base64,' + i.data } });
        });
        return { role: x.role, content: c };
    }

    function geminiMsg(x) {
        var parts = (x.images || []).map(function (i) { return { inline_data: { mime_type: i.mime, data: i.data } }; });
        parts.push({ text: x.content });
        return { role: x.role === 'assistant' ? 'model' : 'user', parts: parts };
    }


    function build(id, conf, system, wire, opts) {
        opts = opts || {};
        var m = meta(id);
        var base = resolveBase(id, conf.baseUrl);
        var model = String(conf.model || (m.models && m.models[0]) || '').trim();
        var t = parseFloat(opts.temperature);
        var hasTemp = isFinite(t);
        var maxOut = positiveInt(opts.maxTokens);
        if (!base) {
            throw new Error('Enter an endpoint for ' + m.label + ' in Settings' +
                (m.kind === 'azure' ? ' (your resource URL, e.g. https://my-resource.openai.azure.com).' : '.'));
        }
        if (!model) {
            throw new Error('Choose a model for ' + m.label + ' first' + (m.kind === 'azure' ? ' (type your deployment name).' : '.'));
        }

        if (m.kind === 'anthropic') {
            var a = { model: model, max_tokens: maxOut || 4096, stream: true, messages: wire.map(anthropicMsg) };
            if (system) { a.system = system; }
            if (hasTemp) { a.temperature = Math.min(1, Math.max(0, t)); }
            return {
                url: base + '/messages',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': conf.key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(a),
                extract: function (e) {
                    if (e.type === 'error') { return { error: (e.error && e.error.message) || 'Anthropic stream error' }; }
                    if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') { return { text: e.delta.text }; }
                    if (e.type === 'message_delta' && e.delta && e.delta.stop_reason) { return { finish: e.delta.stop_reason }; }
                    return {};
                }
            };
        }

        if (m.kind === 'gemini') {
            var g = {
                contents: wire.map(geminiMsg)
            };
            if (system) { g.systemInstruction = { parts: [{ text: system }] }; }
            var gc = {};
            if (hasTemp) { gc.temperature = t; }
            if (maxOut) { gc.maxOutputTokens = maxOut; }
            if (hasTemp || maxOut) { g.generationConfig = gc; }
            return {
                url: base + '/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':streamGenerateContent?alt=sse',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': conf.key },
                body: JSON.stringify(g),
                extract: function (e) {
                    var cand = e.candidates && e.candidates[0];
                    var parts = cand && cand.content && cand.content.parts;
                    if (parts || (cand && cand.finishReason)) {
                        var r = { text: (parts || []).map(function (p) { return p.text || ''; }).join('') };
                        if (cand.finishReason) { r.finish = cand.finishReason; }
                        return r;
                    }
                    if (e.promptFeedback && e.promptFeedback.blockReason) {
                        return { error: 'Blocked by Gemini: ' + e.promptFeedback.blockReason };
                    }
                    return {};
                }
            };
        }

        var mapped = wire.map(openaiMsg);
        var msgs = system ? [{ role: 'system', content: system }].concat(mapped) : mapped;
        var o = { model: model, messages: msgs, stream: true };
        if (hasTemp) { o.temperature = t; }
        if (maxOut) {
            o[(id === 'openai' || m.kind === 'azure') ? 'max_completion_tokens' : 'max_tokens'] = maxOut;
        }
        var headers = { 'Content-Type': 'application/json' };
        var url = base + '/chat/completions';
        if (m.kind === 'azure') {
            url = base + '/openai/deployments/' + encodeURIComponent(model) + '/chat/completions?api-version=' +
                encodeURIComponent(m.api_version || '2024-10-21');
            headers['api-key'] = conf.key;
        } else if (conf.key) {
            headers.Authorization = 'Bearer ' + conf.key;
        }
        if (id === 'openrouter') { headers['X-Title'] = 'LenChat'; }
        return {
            url: url,
            headers: headers,
            body: JSON.stringify(o),
            extract: function (e) {
                var ch = e.choices && e.choices[0];
                var r = {};
                if (ch && ch.delta && ch.delta.content) { r.text = ch.delta.content; }
                if (ch && ch.finish_reason) { r.finish = ch.finish_reason; }
                return r;
            }
        };
    }


    async function httpError(res) {
        var txt = '';
        try { txt = await res.text(); } catch (e) {  }
        var msg = txt;
        if (/^\s*</.test(txt)) {
            msg = 'The host returned an HTML page (a web application firewall or error page), not an API response.';
        } else {
            try {
                var j = JSON.parse(txt);
                if (Array.isArray(j)) { j = j[0] || {}; }
                msg = (j.error && (j.error.message || j.error)) || j.message || txt;
            } catch (e) {  }
        }
        if (typeof msg !== 'string') { msg = JSON.stringify(msg); }
        var err = new Error('HTTP ' + res.status + ' - ' + (msg || res.statusText).slice(0, 600));
        err.status = res.status;
        return err;
    }

    async function viaServer(req, settings, signal) {
        if (!cfg.relayEnabled) { throw new Error('The server relay is disabled in config.php.'); }
        var envelope = JSON.stringify({ url: req.url, headers: req.headers, body: req.body });
        return fetch(cfg.streamEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ d: toBase64(envelope), t: settings.token || '' }),
            signal: signal
        });
    }

    async function send(id, settings, wire, signal, keyId, extraSystem) {
        if (!global.LenBrand || !global.LenBrand.ok()) {
            throw new Error('LenChat paused: its credits and support links are not showing. See the notice at the bottom of the page.');
        }
        var m = meta(id);
        var p = settings.providers[id];
        var keyObj = global.LenStorage.activeKey(settings, id, keyId);
        if (!m.local && !(keyObj && keyObj.key)) { throw new Error('Add your ' + m.label + ' API key in Settings.'); }

        var conf = { key: keyObj ? keyObj.key : '', baseUrl: p.baseUrl, model: p.model };
        var system = settings.sendSystem ? String(settings.systemPrompt || '').trim() : '';
        if (settings.sendSystem && global.LenImage) { system += (system ? '\n\n' : '') + global.LenImage.HINT; }
        if (settings.fileSkill !== false && global.LenDocs) { system += (system ? '\n\n' : '') + global.LenDocs.skillPrompt(); }
        if (extraSystem) { system += (system ? '\n\n' : '') + extraSystem; }
        var req = build(id, conf, system, wire, { temperature: settings.temperature, maxTokens: settings.maxTokens });
        var mode = m.local ? 'direct' : settings.transport;
        var res = null;

        if (mode !== 'server') {
            try {
                res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: signal });
            } catch (err) {
                if (err.name === 'AbortError') { throw err; }
                if (mode === 'direct' || !cfg.relayEnabled) {
                    throw new Error(m.local
                        ? 'Cannot reach ' + m.label + '. Is it running, and is OLLAMA_ORIGINS allowing this site?'
                        : 'Network or CORS error. Set Transport to "Auto" or "Server relay" in Settings.');
                }
                res = null;
            }
        }
        if (!res) { res = await viaServer(req, settings, signal); }
        if (!res.ok) { throw await httpError(res); }
        return { res: res, extract: req.extract, keyLabel: keyObj ? keyObj.label : '' };
    }

    global.LenProvider = { init: init, meta: meta, build: build, send: send, resolveBase: resolveBase };
})(window);

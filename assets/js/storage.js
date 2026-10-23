/*!
 * LenChat - storage.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Everything the app remembers lives in the localStorage:
 *   settings  : API keys (many per provider, with labels), endpoints, models,
 *               system prompt, budget controls, theme, transport
 *   sessions  : conversation history (with optional attached-file context)
 *
 */
(function (global) {
    'use strict';

    var NS = 'lenchat:';
    var KEYS = { settings: NS + 'settings', sessions: NS + 'sessions', current: NS + 'current' };
    var cfg = null;

    var DEFAULT_SYSTEM =
        'You are a senior software engineer pairing with the user. Attached project files arrive as markdown ' +
        'sections headed by their path. Be precise, prefer minimal changes, name the file before every code ' +
        'block, use fenced code blocks with language tags, and show complete files only when asked.';


    function read(key, fallback) {
        try {
            var raw = global.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function dropPixels(k, v) { return k === 'images' ? undefined : v; }

    function write(key, value) {
        try {
            global.localStorage.setItem(key, JSON.stringify(value, key === KEYS.sessions ? dropPixels : undefined));
            return true;
        } catch (e) {
            return false;
        }
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function init(config) {
        cfg = config;
    }


    function defaultSettings() {
        var d = cfg.defaults || {};
        var providers = {};
        Object.keys(cfg.providers).forEach(function (id) {
            var p = cfg.providers[id];
            providers[id] = {
                baseUrl: '',
                model: (p.models && p.models[0]) || '',
                customModels: [],
                keys: [],
                activeKey: ''
            };
        });
        return {
            provider: cfg.defaultProvider,
            providers: providers,
            systemPrompt: DEFAULT_SYSTEM,
            sendSystem: true,
            temperature: '',
            maxTokens: d.max_tokens || '',
            contextMode: d.context_mode || 'last',
            contextN: d.context_n || 6,
            keepContext: 3,
            transport: 'auto',
            token: '',
            theme: 'dark',
            visionMode: 'auto',
            imageProvider: 'pollinations',
            imageModel: '',
            sidebarCollapsed: false,
            autoHeal: 'ask',
            fileSkill: true,
            voice: { commands: true, handsFree: false, autoRead: false, silenceMs: 1800 },
            update: { lastCheck: 0, latest: '', dismissed: '' },
            stt: { engine: 'native', url: '', model: 'whisper-1', key: '', lang: '' },
            tts: { engine: 'native', voice: '', rate: 1, pitch: 1, url: '', model: '', voiceId: '', key: '' }
        };
    }

    function cleanKeys(list) {
        if (!Array.isArray(list)) { return []; }
        return list.filter(function (k) { return k && typeof k === 'object'; }).map(function (k, i) {
            return {
                id: String(k.id || uid()),
                label: String(k.label || ('Key ' + (i + 1))),
                key: String(k.key || '')
            };
        });
    }

    function getSettings() {
        var d = defaultSettings();
        var s = read(KEYS.settings, {}) || {};
        var out = Object.assign({}, d, s);
        out.providers = {};
        Object.keys(d.providers).forEach(function (id) {
            var stored = (s.providers || {})[id] || {};
            var merged = Object.assign({}, d.providers[id], stored);
            merged.keys = cleanKeys(stored.keys);
            if (!merged.keys.length && stored.key) {
                merged.keys = [{ id: uid(), label: 'Key 1', key: String(stored.key) }];
            }
            delete merged.key;
            merged.customModels = Array.isArray(stored.customModels) ? stored.customModels.map(String) : [];
            var active = merged.keys.some(function (k) { return k.id === merged.activeKey; });
            if (!active) { merged.activeKey = merged.keys.length ? merged.keys[0].id : ''; }
            out.providers[id] = merged;
        });
        if (!cfg.providers[out.provider]) { out.provider = d.provider; }
        if (['prompt', 'last', 'all'].indexOf(out.contextMode) < 0) { out.contextMode = 'last'; }
        out.contextN = Math.max(1, parseInt(out.contextN, 10) || 6);
        out.sendSystem = out.sendSystem !== false;
        if (['auto', 'vision', 'ocr'].indexOf(out.visionMode) < 0) { out.visionMode = 'auto'; }
        if (['pollinations', 'openai'].indexOf(out.imageProvider) < 0) { out.imageProvider = 'pollinations'; }
        out.imageModel = String(out.imageModel || '');
        out.sidebarCollapsed = !!out.sidebarCollapsed;
        out.stt = Object.assign({}, d.stt, s.stt || {});
        out.tts = Object.assign({}, d.tts, s.tts || {});
        if (['native', 'custom'].indexOf(out.stt.engine) < 0) { out.stt.engine = 'native'; }
        if (['native', 'openai', 'elevenlabs'].indexOf(out.tts.engine) < 0) { out.tts.engine = 'native'; }
        if (['ask', 'auto', 'off'].indexOf(out.autoHeal) < 0) { out.autoHeal = 'ask'; }
        out.fileSkill = out.fileSkill !== false;
        out.voice = Object.assign({}, d.voice, s.voice || {});
        out.voice.commands = out.voice.commands !== false;
        out.voice.handsFree = !!out.voice.handsFree;
        out.voice.autoRead = !!out.voice.autoRead;
        out.voice.silenceMs = Math.min(6000, Math.max(800, parseInt(out.voice.silenceMs, 10) || 1800));
        out.update = Object.assign({}, d.update, s.update || {});
        return out;
    }

    function saveSettings(settings) {
        return write(KEYS.settings, settings);
    }

    function activeKey(settings, providerId, keyId) {
        var p = settings.providers[providerId];
        if (!p) { return null; }
        var want = keyId || p.activeKey;
        for (var i = 0; i < p.keys.length; i++) { if (p.keys[i].id === want) { return p.keys[i]; } }
        return p.keys[0] || null;
    }

    function modelsFor(settings, providerId) {
        var preset = (cfg.providers[providerId] && cfg.providers[providerId].models) || [];
        var custom = (settings.providers[providerId] && settings.providers[providerId].customModels) || [];
        var seen = {};
        return preset.concat(custom).filter(function (m) {
            if (!m || seen[m]) { return false; }
            seen[m] = true;
            return true;
        });
    }


    function allSessions() {
        var list = read(KEYS.sessions, []);
        return Array.isArray(list) ? list : [];
    }

    function persist(list) {
        if (write(KEYS.sessions, list)) { return true; }

        var inline = [];
        list.forEach(function (s) {
            s.messages.forEach(function (m) { if (m.role === 'assistant' && /data:image\//.test(m.content || '')) { inline.push(m); } });
        });
        for (var j = 0; j < inline.length; j++) {
            inline[j].content = inline[j].content.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, '_[image removed to free browser storage]_');
            if (write(KEYS.sessions, list)) { return false; }
        }

        var bulky = [];
        list.slice().sort(function (a, b) { return a.updated - b.updated; }).forEach(function (s) {
            s.messages.forEach(function (m) { if (m.context) { bulky.push(m); } });
        });
        for (var i = 0; i < bulky.length; i++) {
            bulky[i].context = '';
            bulky[i].contextDropped = true;
            if (write(KEYS.sessions, list)) { return false; }
        }
        return false;
    }

    function listSessions() {
        return allSessions().sort(function (a, b) { return b.updated - a.updated; });
    }

    function getSession(id) {
        var all = allSessions();
        for (var i = 0; i < all.length; i++) { if (all[i].id === id) { return all[i]; } }
        return null;
    }

    function createSession() {
        return { id: uid(), title: 'New session', created: Date.now(), updated: Date.now(), messages: [], tags: [] };
    }

    function saveSession(session) {
        var all = allSessions();
        var idx = -1;
        all.forEach(function (s, i) { if (s.id === session.id) { idx = i; } });
        if (!session.messages.length) {
            if (idx >= 0) { all.splice(idx, 1); persist(all); }
            return true;
        }
        session.updated = Date.now();
        if (idx >= 0) { all[idx] = session; } else { all.push(session); }
        return persist(all);
    }

    function normalizeTags(input) {
        var list = Array.isArray(input) ? input : String(input || '').split(/[,\n]+/);
        var seen = {}, out = [];
        list.forEach(function (t) {
            t = String(t).replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_\-.]/gu, '').slice(0, 24);
            if (t && !seen[t] && out.length < 8) { seen[t] = 1; out.push(t); }
        });
        return out;
    }

    function setTags(id, tags) {
        var all = allSessions(), hit = null;
        all.forEach(function (s) { if (s.id === id) { s.tags = normalizeTags(tags); hit = s; } });
        if (hit) { persist(all); }
        return hit ? hit.tags : [];
    }

    function allTags() {
        var n = {};
        allSessions().forEach(function (s) { (s.tags || []).forEach(function (t) { n[t] = (n[t] || 0) + 1; }); });
        return Object.keys(n).map(function (t) { return { tag: t, count: n[t] }; }).sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag); });
    }

    function removeSession(id) {
        persist(allSessions().filter(function (s) { return s.id !== id; }));
    }

    function getCurrentId() { return read(KEYS.current, null); }
    function setCurrentId(id) { write(KEYS.current, id); }


    function exportSessions() {
        return JSON.stringify({ app: 'LenChat', version: 2, exportedAt: new Date().toISOString(), sessions: allSessions() }, null, 2);
    }

    function importSessions(text) {
        var data = JSON.parse(text);
        var incoming = Array.isArray(data) ? data : data.sessions;
        if (!Array.isArray(incoming)) { throw new Error('This file does not contain LenChat sessions.'); }
        var all = allSessions();
        var count = 0;
        incoming.forEach(function (s) {
            if (!s || !s.id || !Array.isArray(s.messages)) { return; }
            s.tags = normalizeTags(s.tags || []);
            var idx = -1;
            all.forEach(function (x, i) { if (x.id === s.id) { idx = i; } });
            if (idx >= 0) { all[idx] = s; } else { all.push(s); }
            count++;
        });
        persist(all);
        return count;
    }


    function exportConfig(settings, opts) {
        opts = opts || {};
        var copy = JSON.parse(JSON.stringify(settings));
        if (opts.keys === false) {
            Object.keys(copy.providers).forEach(function (id) { copy.providers[id].keys = []; copy.providers[id].activeKey = ''; });
            copy.token = '';
            if (copy.stt) { copy.stt.key = ''; }
            if (copy.tts) { copy.tts.key = ''; }
        }
        delete copy.update;
        return JSON.stringify({
            app: 'LenChat', kind: 'config', version: 1, appVersion: cfg && cfg.version, exportedAt: new Date().toISOString(),
            includesKeys: opts.keys !== false, settings: copy
        }, null, 2);
    }

    function importConfig(text) {
        var data = JSON.parse(text);
        var inc = data && data.kind === 'config' ? data.settings : (data && data.settings && data.app === 'LenChat' ? data.settings : null);
        if (!inc || typeof inc !== 'object' || !inc.providers) { throw new Error('This file is not a LenChat configuration export.'); }
        var current = getSettings();
        var merged = Object.assign({}, inc);
        var keyCount = 0, provCount = 0;
        merged.providers = {};
        Object.keys(cfg.providers).forEach(function (id) {
            var i = (inc.providers || {})[id] || {};
            var c = current.providers[id];
            var theirs = cleanKeys(i.keys);
            var have = {};
            theirs.forEach(function (k) { have[k.key] = 1; });
            var keep = c.keys.filter(function (k) { return k.key && !have[k.key]; });
            var keys = theirs.concat(keep);
            keyCount += theirs.filter(function (k) { return k.key; }).length;
            if (Object.keys(i).length) { provCount++; }
            merged.providers[id] = Object.assign({}, i, { keys: keys, activeKey: i.activeKey || (keys[0] && keys[0].id) || '' });
        });
        delete merged.update;
        if (!write(KEYS.settings, merged)) { throw new Error('Browser storage is full, the configuration could not be saved.'); }
        return { settings: getSettings(), providers: provCount, keys: keyCount };
    }

    function wipeAll() {
        Object.keys(KEYS).forEach(function (k) { try { global.localStorage.removeItem(KEYS[k]); } catch (e) {  } });
        try { global.localStorage.removeItem('lenchat:brand'); } catch (e) {  }
    }

    global.LenStorage = {
        init: init,
        uid: uid,
        getSettings: getSettings,
        saveSettings: saveSettings,
        activeKey: activeKey,
        modelsFor: modelsFor,
        listSessions: listSessions,
        getSession: getSession,
        createSession: createSession,
        saveSession: saveSession,
        removeSession: removeSession,
        normalizeTags: normalizeTags,
        setTags: setTags,
        allTags: allTags,
        exportConfig: exportConfig,
        importConfig: importConfig,
        getCurrentId: getCurrentId,
        setCurrentId: setCurrentId,
        exportSessions: exportSessions,
        importSessions: importSessions,
        wipeAll: wipeAll
    };
})(window);

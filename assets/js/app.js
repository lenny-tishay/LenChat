/*!
 * LenChat - app.js
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
(function () {
    'use strict';

    var cfg = JSON.parse(document.getElementById('lenchat-config').textContent);
    LenStorage.init(cfg);
    LenProvider.init(cfg);
    LenVision.init(cfg);
    LenImage.init(cfg);
    LenDocs.init(cfg);
    LenUpdater.init(cfg);

    function $(id) { return document.getElementById(id); }
    var esc = LenEngine.escapeHtml;
    function ic(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"></use></svg>'; }

    var el = {
        sidebar: $('sidebar'), sessionList: $('session-list'), title: $('session-title'),
        selProvider: $('sel-provider'), selKey: $('sel-key'), keyWrap: $('key-wrap'), selModel: $('sel-model'),
        messages: $('messages'), empty: $('empty'), emptySlot: $('empty-slot'),
        prompt: $('inp-prompt'), send: $('btn-send'),
        tray: $('attach-tray'), traySummary: $('tray-summary'), trayChips: $('tray-chips'),
        trayTree: $('tray-tree'), trayTreeBox: $('tray-treebox'),
        optCtx: $('opt-ctx'), optN: $('opt-n'), optNWrap: $('opt-n-wrap'), optSys: $('opt-sys'),
        optMax: $('opt-max'), optEst: $('opt-est'),
        overlay: $('drop-overlay'), toast: $('toast'),
        drawer: $('drawer'), backdrop: $('drawer-backdrop'), keyRows: $('key-rows')
    };

    var settings = LenStorage.getSettings();
    var session = null;
    var attachments = [];
    var images = [];
    var skippedFiles = [];
    var abortCtl = null;
    var busy = false;
    var draft = null;
    var toastTimer = null;
    var estTimer = null;

    LenBrand.init(cfg);

    function toast(msg, bad) {
        el.toast.textContent = msg;
        el.toast.classList.toggle('bad', !!bad);
        el.toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.toast.hidden = true; }, bad ? 6000 : 3000);
    }

    function relTime(ts) {
        var s = Math.round((Date.now() - ts) / 1000);
        if (s < 60) { return 'just now'; }
        if (s < 3600) { return Math.floor(s / 60) + ' min ago'; }
        if (s < 86400) { return Math.floor(s / 3600) + ' h ago'; }
        return new Date(ts).toLocaleDateString();
    }

    function persistSession() {
        LenHistory.invalidate();
        if (!LenStorage.saveSession(session)) {
            toast('Browser storage is full - oldest file attachments were trimmed from history.', true);
        }
    }

    function saveSettings() { LenStorage.saveSettings(settings); }


    function applyTheme() {
        var light = settings.theme === 'light';
        document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
        $('btn-theme').innerHTML = ic(light ? 'moon' : 'sun');
        $('btn-theme').title = light ? 'Switch to dark theme' : 'Switch to light theme';
    }

    var narrow = window.matchMedia('(max-width: 820px)');

    function applySidebar() {
        var collapsed = !!settings.sidebarCollapsed && !narrow.matches;
        $('app').classList.toggle('collapsed', collapsed);
        var open = narrow.matches ? el.sidebar.classList.contains('open') : !collapsed;
        $('btn-toggle-sidebar').setAttribute('aria-expanded', String(open));
        $('btn-toggle-sidebar').title = open ? 'Hide sidebar' : 'Show sidebar';
        $('sidebar-backdrop').hidden = !(narrow.matches && open);
        placeFooter();
    }

    function placeFooter() {
        var slot = $('foot-slot');
        if (!slot) { return; }
        var home = document.querySelector('.composer');
        if (home && slot.parentNode !== home) { home.appendChild(slot); }
    }

    function closeSidebar() { el.sidebar.classList.remove('open'); applySidebar(); }

    function toggleSidebar() {
        if (narrow.matches) { el.sidebar.classList.toggle('open'); applySidebar(); return; }
        settings.sidebarCollapsed = !settings.sidebarCollapsed;
        saveSettings();
        applySidebar();
    }

    function renderProviderBar() {
        var id = settings.provider;
        var p = settings.providers[id];
        var meta = cfg.providers[id];

        el.selProvider.innerHTML = Object.keys(cfg.providers).map(function (pid) {
            return '<option value="' + esc(pid) + '">' + esc(cfg.providers[pid].label) + '</option>';
        }).join('');
        el.selProvider.value = id;

        el.keyWrap.hidden = !!meta.local;
        if (!meta.local) {
            var opts = p.keys.length
                ? p.keys.map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(k.label) + '</option>'; }).join('')
                : '<option value="">No key yet</option>';
            el.selKey.innerHTML = opts + '<option value="__manage">Manage keys\u2026</option>';
            el.selKey.value = p.keys.length ? p.activeKey : '';
        }

        var list = LenStorage.modelsFor(settings, id);
        if (p.model && list.indexOf(p.model) < 0) { list = [p.model].concat(list); }
        el.selModel.innerHTML =
            (p.model ? '' : '<option value="">Select a model</option>') +
            list.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join('') +
            '<option value="__custom">+ Custom model\u2026</option>';
        el.selModel.value = p.model || '';
        $('btn-model-chip').querySelector('span').textContent = meta.label + (p.model ? ' \u00B7 ' + p.model : '');
    }

    var hist = { q: '', tab: 'chats', tag: '', snips: [] };

    function markHtml(parts) {
        return esc(parts[0]) + '<mark>' + esc(parts[1]) + '</mark>' + esc(parts[2]);
    }

    function renderTagBar() {
        var bar = $('tag-bar'), tags = LenStorage.allTags();
        bar.hidden = !tags.length;
        bar.innerHTML = tags.slice(0, 24).map(function (t) {
            return '<button class="tag-chip' + (hist.tag === t.tag ? ' on' : '') + '" type="button" data-tag-filter="' + esc(t.tag) + '">#' + esc(t.tag) + '<b>' + t.count + '</b></button>';
        }).join('');
    }

    function renderSessions() {
        renderTagBar();
        if (hist.tab === 'snips') { renderSnippets(); return; }
        var searching = !!(hist.q.trim() || hist.tag);
        var rows = searching
            ? LenHistory.searchSessions(hist.q, { tag: hist.tag })
            : LenStorage.listSessions().map(function (s) { return { session: s, snippet: null }; });
        if (!rows.length) {
            el.sessionList.innerHTML = '<div class="list-empty">' + (searching ? 'Nothing matches. Try fewer words, or #tag, code:word, file:name.' : 'No saved sessions yet.') + '</div>';
            return;
        }
        el.sessionList.innerHTML = rows.map(function (r) {
            var s = r.session, active = session && s.id === session.id ? ' active' : '';
            var tags = (s.tags || []).length ? '<div class="session-tags">' + s.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '';
            var snip = r.snippet ? '<div class="session-snip">' + markHtml(r.snippet) + '</div>' : '';
            return '<div class="session' + active + '" role="listitem" data-id="' + esc(s.id) + '">' +
                '<div class="session-main"><div class="session-name">' + esc(s.title) + '</div>' +
                '<div class="session-meta">' + s.messages.length + ' msgs &middot; ' + esc(relTime(s.updated)) + '</div>' + tags + snip + '</div>' +
                '<button class="session-tag-btn" type="button" data-tag-edit="' + esc(s.id) + '" aria-label="Edit tags" title="Tags">' + ic('tag') + '</button>' +
                '<button class="session-del" type="button" data-del="' + esc(s.id) + '" aria-label="Delete session">' + ic('x') + '</button></div>';
        }).join('');
    }

    function renderSnippets() {
        hist.snips = LenHistory.searchSnippets(hist.q, { tag: hist.tag }).slice(0, 150);
        if (!hist.snips.length) {
            el.sessionList.innerHTML = '<div class="list-empty">' + (hist.q.trim() || hist.tag ? 'No code snippet matches.' : 'Code from your chats will be listed here.') + '</div>';
            return;
        }
        el.sessionList.innerHTML = hist.snips.map(function (n, i) {
            return '<div class="snip" role="listitem" data-i="' + i + '"><div class="snip-head"><span class="snip-name">' + esc(n.name || ('snippet.' + (LenCanvas.fileName(n.lang, '').split('.').pop()))) + '</span>' +
                '<span class="snip-lang">' + esc(n.lang || 'text') + '</span>' +
                '<button class="snip-copy" type="button" data-snip-copy="' + i + '" aria-label="Copy snippet" title="Copy">' + ic('copy') + '</button></div>' +
                '<div class="snip-prev">' + esc(n.preview) + '</div><div class="snip-from">' + esc(n.session.title) + ' &middot; ' + esc(relTime(n.updated)) + '</div></div>';
        }).join('');
    }

    function setHistTab(tab) {
        hist.tab = tab;
        $('tab-chats').classList.toggle('on', tab === 'chats'); $('tab-chats').setAttribute('aria-selected', String(tab === 'chats'));
        $('tab-snips').classList.toggle('on', tab === 'snips'); $('tab-snips').setAttribute('aria-selected', String(tab === 'snips'));
        renderSessions();
    }

    var histTimer = null;
    $('hist-q').addEventListener('input', function () {
        clearTimeout(histTimer);
        histTimer = setTimeout(function () { hist.q = $('hist-q').value; renderSessions(); }, 120);
    });
    $('tab-chats').addEventListener('click', function () { setHistTab('chats'); });
    $('tab-snips').addEventListener('click', function () { setHistTab('snips'); });
    $('tag-bar').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tag-filter]');
        if (!b) { return; }
        var t = b.getAttribute('data-tag-filter');
        hist.tag = hist.tag === t ? '' : t;
        renderSessions();
    });

    var tagFor = '';
    function openTagModal(id) {
        var s = LenStorage.getSession(id);
        if (!s) { return; }
        tagFor = id;
        $('tag-session').textContent = s.title;
        $('tag-input').value = (s.tags || []).join(', ');
        $('tag-suggest').innerHTML = LenStorage.allTags().slice(0, 14).map(function (t) {
            return '<button class="tag-chip" type="button" data-tag-add="' + esc(t.tag) + '">#' + esc(t.tag) + '</button>';
        }).join('');
        $('tag-modal').hidden = false;
        $('tag-input').focus();
    }
    function closeTagModal() { $('tag-modal').hidden = true; tagFor = ''; }
    function saveTags() {
        var tags = LenStorage.setTags(tagFor, $('tag-input').value);
        if (session && session.id === tagFor) { session.tags = tags; }
        LenHistory.invalidate();
        closeTagModal();
        renderSessions();
        toast(tags.length ? 'Tags saved: ' + tags.map(function (t) { return '#' + t; }).join(' ') : 'Tags cleared.');
    }
    $('tag-x').addEventListener('click', closeTagModal);
    $('tag-cancel').addEventListener('click', closeTagModal);
    $('tag-save').addEventListener('click', saveTags);
    $('tag-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveTags(); } });
    $('tag-suggest').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tag-add]');
        if (!b) { return; }
        var cur = LenStorage.normalizeTags($('tag-input').value), t = b.getAttribute('data-tag-add');
        if (cur.indexOf(t) < 0) { cur.push(t); }
        $('tag-input').value = cur.join(', ');
    });

    function jumpToBlock(sessionId, mi, ord) {
        if (!session || session.id !== sessionId) { if (busy) { stop(); } openSession(sessionId); }
        var row = el.messages.querySelector('.msg[data-index="' + mi + '"]');
        var code = row && row.querySelector('.code[data-ord="' + ord + '"]');
        var target = code || row;
        if (target) {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            if (code) { code.classList.add('flash'); setTimeout(function () { code.classList.remove('flash'); }, 1600); }
        }
    }

    function openSession(id) {
        var found = id && LenStorage.getSession(id);
        session = found || LenStorage.createSession();
        LenStorage.setCurrentId(session.id);
        el.title.textContent = session.title;
        renderMessages();
        renderSessions();
        stopSpeaking();
        closeSidebar();
        scheduleEstimate();
    }

    function newSession() {
        if (busy) { stop(); }
        session = LenStorage.createSession();
        LenStorage.setCurrentId(session.id);
        el.title.textContent = session.title;
        renderMessages();
        renderSessions();
        el.prompt.focus();
        stopSpeaking();
        closeSidebar();
        scheduleEstimate();
    }


    function otherKeys() {
        var p = settings.providers[settings.provider];
        return p.keys.filter(function (k) { return k.id !== p.activeKey && k.key; });
    }

    function canContinue(m) { return m.role === 'assistant' && !m.error && !!m.content && (m.truncated || m.stopped); }

    function buildMsgEl(m, index, isLast) {
        var row = document.createElement('div');
        row.className = 'msg ' + m.role;
        row.dataset.index = index;

        var avatar = '<div class="avatar">' + (m.role === 'user' ? 'You' : 'AI') + '</div>';
        var inner = '';
        var metaLine = '';

        if (m.role === 'user') {
            var pics = (m.imageMeta || []).map(function (im) {
                return '<span class="chip chip-img" title="' + esc(im.name) + '"><img class="chip-thumb" src="' + esc(im.thumb) + '" alt=""><span>' + esc(im.name) + '</span></span>';
            }).join('');
            if ((m.files && m.files.length) || pics) {
                var shown = (m.files || []).slice(0, 8).map(function (p) { return '<span class="chip"><span>' + esc(p) + '</span></span>'; }).join('');
                var more = m.files && m.files.length > 8 ? '<span class="chip">+' + (m.files.length - 8) + ' more</span>' : '';
                inner += '<div class="file-chips">' + pics + shown + more + '</div>';
            }
            inner += esc(m.content);
        } else {
            inner += LenEngine.renderMarkdown(m.content || '');
            if (m.error) { inner += '<div class="err">' + esc(m.error) + '</div>'; }
            if (m.stopped) { inner += '<div class="stopped">Stopped.</div>'; }
            if (m.truncated && !m.stopped) { inner += '<div class="cut">' + ic('forward') + 'The reply hit the output limit and was cut off.</div>'; }
            var bits = [];
            if (m.provider && cfg.providers[m.provider]) { bits.push(cfg.providers[m.provider].label); }
            if (m.model) { bits.push(m.model); }
            if (m.keyLabel) { bits.push(m.keyLabel); }
            if (bits.length) { metaLine = '<div class="msg-meta">' + esc(bits.join(' \u00B7 ')) + '</div>'; }
        }

        var streaming = busy && isLast && m.role === 'assistant';
        var actions = '';
        if (m.role === 'user' && !busy) { actions += '<button class="act" type="button" data-act="edit" title="Edit this prompt and regenerate from here">' + ic('edit') + 'Edit</button>'; }
        actions += '<button class="act" type="button" data-act="copy">' + ic('copy') + 'Copy</button>';
        if (m.role === 'assistant' && m.content && !(busy && isLast) && !m.error && m.provider !== 'image') {
            actions += '<span class="more-wrap"><button class="act" type="button" data-act="more" aria-haspopup="menu" aria-expanded="false" title="Save this reply as a file">' + ic('download') + 'Export</button>' +
                '<span class="menu" role="menu" hidden>' +
                '<button type="button" role="menuitem" data-act="msg-md">' + ic('download') + 'Markdown (.md)</button>' +
                '<button type="button" role="menuitem" data-act="msg-html">' + ic('download') + 'Web page (.html)</button>' +
                '<button type="button" role="menuitem" data-act="msg-pdf">' + ic('download') + 'PDF (.pdf)</button>' +
                '<button type="button" role="menuitem" data-act="msg-docx">' + ic('download') + 'Word (.docx)</button></span></span>';
        }
        if (m.role === 'assistant' && m.content && !(busy && isLast) && !m.error && m.provider !== 'image') {
            actions += '<button class="act" type="button" data-act="speak" title="Read aloud">' + ic('volume') + 'Listen</button>';
        }
        if (!streaming) {
            actions += '<button class="act act-del" type="button" data-act="del" title="Delete this message - it stops counting toward your token budget">' + ic('trash') + 'Delete</button>';
        }
        if (isLast && !busy && canContinue(m)) {
            actions += '<button class="act act-key" type="button" data-act="continue" title="Ask the model to carry on where it stopped">' + ic('forward') + 'Continue output</button>';
        }
        if (m.role === 'assistant' && isLast && !busy) {
            actions += '<button class="act" type="button" data-act="retry">' + ic('refresh') + 'Regenerate</button>';
            if (m.error) {
                otherKeys().slice(0, 4).forEach(function (k) {
                    actions += '<button class="act act-key" type="button" data-act="retry-key" data-key="' + esc(k.id) + '">' +
                        ic('key') + 'Retry with ' + esc(k.label) + '</button>';
                });
            }
        }

        row.innerHTML = avatar + '<div class="bubble-wrap"><div class="bubble">' + inner + '</div>' + metaLine +
            '<div class="msg-actions">' + actions + '</div></div>';
        return row;
    }

    function renderMessages() {
        el.messages.querySelectorAll('.msg').forEach(function (n) { n.remove(); });
        var none = session.messages.length === 0;
        el.empty.hidden = !none;
        if (none) { LenBrand.paintEmpty(el.emptySlot); }
        var frag = document.createDocumentFragment();
        session.messages.forEach(function (m, i) {
            frag.appendChild(buildMsgEl(m, i, i === session.messages.length - 1));
        });
        el.messages.appendChild(frag);
        scrollToEnd(true);
    }

    function scrollToEnd(force) {
        var box = el.messages;
        var near = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
        if (force || near) { box.scrollTop = box.scrollHeight; }
    }

    function setBusy(on) {
        busy = on;
        el.send.innerHTML = on ? ic('stop') + '<span>Stop</span>' : ic('send') + '<span>Send</span>';
        el.send.classList.toggle('btn-danger', on);
        el.send.classList.toggle('btn-primary', !on);
    }


    function syncOpts() {
        el.optCtx.value = settings.contextMode;
        el.optN.value = settings.contextN;
        el.optNWrap.hidden = settings.contextMode !== 'last';
        el.optSys.setAttribute('aria-pressed', settings.sendSystem ? 'true' : 'false');
        el.optSys.querySelector('b').textContent = settings.sendSystem ? 'On' : 'Off';
        el.optMax.value = settings.maxTokens || '';
        scheduleEstimate();
    }

    function scheduleEstimate() {
        clearTimeout(estTimer);
        estTimer = setTimeout(updateEstimate, 120);
    }

    function updateEstimate() {
        if (!session) { return; }
        var text = el.prompt.value.trim();
        var pending = {
            role: 'user',
            content: text || (attachments.length ? 'Please review the attached files.' : ''),
            context: attachments.length ? '#' : ''
        };
        var wire = LenEngine.toWire(session.messages.concat([pending]), {
            mode: settings.contextMode, n: settings.contextN, keepFiles: settings.keepContext
        });
        var sys = settings.sendSystem ? settings.systemPrompt : '';
        var chars = LenReader.totalChars(attachments) + attachments.length * 80;
        var tokens = LenEngine.estimateTokens(wire, sys) + LenReader.approxTokens(chars);
        if (images.length) {
            var seeing = LenVision.usesVision(settings, settings.provider);
            images.forEach(function (im) { tokens += seeing ? LenVision.tokensFor(im) : 250; });
        }
        var out = parseInt(settings.maxTokens, 10);
        el.optEst.textContent = '~' + LenReader.formatTokens(tokens) + ' in' +
            (out > 0 ? ' \u00B7 \u2264' + LenReader.formatTokens(out) + ' out' : '');
        var what = settings.contextMode === 'prompt' ? 'only your newest prompt'
            : settings.contextMode === 'all' ? 'the whole conversation'
            : 'the last ' + settings.contextN + ' messages';
        el.optEst.title = 'Estimated tokens in the next request: ' + what +
            (settings.sendSystem ? ' + system prompt' : ', no system prompt') + '.';
    }


    var CONTINUE_PROMPT = 'Continue exactly where your previous reply stopped. Do not repeat anything already written and do not add a preamble. ' +
        'If you were inside a code block, keep going inside it.';

    function titleFrom(text, files) {
        var t = text.replace(/\s+/g, ' ').trim();
        if (t) { return t.length > 48 ? t.slice(0, 47) + '\u2026' : t; }
        return files.length ? 'Files: ' + files[0].path.split('/').pop() : 'New session';
    }

    function isCut(finish, text) {
        if (/^(length|max_tokens|max_output_tokens)$/i.test(finish || '')) { return true; }
        return !finish && ((text.match(/```/g) || []).length % 2 === 1);
    }

    function fenceFor(t) {
        var f = '```';
        while (t.indexOf(f) >= 0) { f += '`'; }
        return f;
    }

    async function ocrImages(list) {
        var out = ['## Attached screenshots (text read with OCR)',
            'The selected model cannot see pictures, so the text below was read from ' + list.length + ' image' + (list.length === 1 ? '' : 's') +
            ' in the browser. OCR can confuse similar characters (O/0, l/1, rn/m), so double-check code, paths and numbers.'];
        for (var i = 0; i < list.length; i++) {
            var im = list[i], n = i + 1;
            toast('Reading text from ' + im.name + ' (' + n + '/' + list.length + ')\u2026');
            var txt = await LenVision.ocr(im, (cfg.vision || {}).ocr_lang, function (status, p) {
                toast('OCR ' + n + '/' + list.length + ': ' + status + ' ' + Math.round(p * 100) + '%');
            });
            out.push('', '### `' + im.name + '` (' + im.origWidth + 'x' + im.origHeight + ' px, OCR)');
            if (txt) { var f = fenceFor(txt); out.push(f + 'text\n' + txt + '\n' + f); } else { out.push('_No readable text was found in this image._'); }
        }
        return out.join('\n');
    }

    async function send() {
        if (busy) { stop(); return; }
        if (el.send.disabled) { return; }
        stopMic();
        healChain.n = 0;
        var text = el.prompt.value.trim();
        if (!text && !attachments.length && !images.length) { return; }

        var asImage = (!attachments.length && !images.length) ? LenImage.intent(text) : null;
        var provider = cfg.providers[settings.provider];
        var key = LenStorage.activeKey(settings, settings.provider);
        if (!asImage && !provider.local && !(key && key.key)) {
            toast('Add your ' + provider.label + ' API key first.', true);
            openDrawer();
            return;
        }
        if (!LenBrand.ok()) { toast('LenChat is paused until its credits and support links are visible.', true); return; }

        var files = attachments.slice();
        var pics = images.slice();
        var seeing = LenVision.usesVision(settings, settings.provider);
        var ocrMd = '';
        if (pics.length && !seeing) {
            el.send.disabled = true;
            try { ocrMd = await ocrImages(pics); }
            catch (err) { toast('Could not read the screenshot text: ' + ((err && err.message) || err), true); return; }
            finally { el.send.disabled = false; }
        }

        var fallback = pics.length && !files.length
            ? 'Please look at the attached screenshot' + (pics.length === 1 ? '' : 's') + '.'
            : 'Please review the attached files.';
        var userMsg = { role: 'user', content: text || fallback, ts: Date.now() };
        if (files.length) { userMsg.files = files.map(function (f) { return f.path; }); }
        var ctx = [];
        if (files.length) { ctx.push(LenReader.buildBundle(files)); }
        if (pics.length) {
            userMsg.imageMeta = pics.map(function (im) { return { name: im.name, thumb: im.thumb, w: im.width, h: im.height }; });
            if (seeing) {
                userMsg.images = pics.map(function (im) { return { mime: im.mime, data: im.data, width: im.width, height: im.height }; });
            } else {
                userMsg.ocr = true;
                ctx.push(ocrMd);
            }
        }
        if (ctx.length) { userMsg.context = ctx.join('\n\n'); }

        if (!session.messages.length) {
            session.title = titleFrom(text, files.concat(pics));
            el.title.textContent = session.title;
        }
        session.messages.push(userMsg);

        el.prompt.value = '';
        autosize();
        clearAttachments();
        persistSession();
        renderSessions();
        if (asImage) { runImage(asImage); } else { runCompletion(); }
    }

    async function runCompletion(opts) {
        opts = opts || {};
        var providerId = settings.provider;
        var key = LenStorage.activeKey(settings, providerId);
        var cont = !!opts.continueFrom;
        var reply = cont ? opts.continueFrom : {
            role: 'assistant', content: '', ts: Date.now(), provider: providerId,
            model: settings.providers[providerId].model, keyLabel: key ? key.label : ''
        };
        var base = cont ? reply.content : '';
        var history, s = settings;
        if (cont) {
            history = session.messages.concat([{ role: 'user', content: CONTINUE_PROMPT }]);
            s = Object.assign({}, settings);
            if (s.contextMode === 'prompt') { s.contextMode = 'last'; }
            s.contextN = Math.max(3, parseInt(s.contextN, 10) || 3);
            reply.stopped = false; reply.truncated = false; delete reply.error;
        } else {
            session.messages.push(reply);
            history = session.messages.slice(0, -1);
        }
        el.empty.hidden = true;
        setBusy(true);
        renderMessages();

        var row = el.messages.querySelector('.msg:last-child .bubble');
        var frame = false;
        abortCtl = new AbortController();

        var live = LenEngine.createStream(row);
        function paint() {
            frame = false;
            live.update(reply.content);
            scrollToEnd(false);
        }

        try {
            var result = await LenEngine.stream({
                providerId: providerId,
                settings: s,
                messages: history,
                signal: abortCtl.signal,
                keyId: key ? key.id : '',
                onToken: function (full) {
                    reply.content = base + full;
                    if (!frame) { frame = true; requestAnimationFrame(paint); }
                }
            });
            reply.content = base + result.text;
            reply.truncated = isCut(result.finish, reply.content);
            if (!result.text) {
                if (cont) { toast('The model had nothing more to add.'); reply.truncated = false; }
                else { reply.error = 'The model returned an empty response.'; }
            }
        } catch (err) {
            if (err && err.name === 'AbortError') { reply.stopped = true; }
            else {
                var msg = (err && err.message) || 'Something went wrong.';
                if (cont) { toast('Could not continue: ' + msg, true); reply.truncated = true; }
                else { reply.error = msg; }
                if (err && (err.status === 429 || /rate limit|quota/i.test(msg)) && otherKeys().length) {
                    toast('Limit reached on this key. Switch keys in the top bar and regenerate.', true);
                }
            }
        } finally {
            abortCtl = null;
            setBusy(false);
            if (!reply.content && reply.stopped) { session.messages.pop(); }
            persistSession();
            renderMessages();
            renderSessions();
            scheduleEstimate();
            afterReply();
        }
    }

    async function runImage(prompt) {
        var reply = { role: 'assistant', content: '', ts: Date.now(), provider: 'image', model: '' };
        session.messages.push(reply);
        el.empty.hidden = true;
        setBusy(true);
        renderMessages();
        var row = el.messages.querySelector('.msg:last-child .bubble');
        row.innerHTML = '<p>Generating image\u2026</p><span class="cursor"></span>';
        abortCtl = new AbortController();
        try {
            var r;
            try {
                r = await LenImage.generate(prompt, settings, abortCtl.signal);
            } catch (err) {
                if (err && err.name === 'AbortError') { throw err; }
                if (settings.imageProvider !== 'openai') { throw err; }
                toast('OpenAI image failed (' + ((err && err.message) || err) + '). Using Pollinations instead.', true);
                r = await LenImage.generate(prompt, Object.assign({}, settings, { imageProvider: 'pollinations' }), abortCtl.signal);
            }
            reply.content = r.markdown || ('![' + prompt.replace(/[\[\]\n]/g, ' ').slice(0, 120) + '](' + r.src + ')');
            reply.model = r.via;
        } catch (err) {
            if (err && err.name === 'AbortError') { reply.stopped = true; }
            else { reply.error = (err && err.message) || 'Image generation failed.'; }
        } finally {
            abortCtl = null;
            setBusy(false);
            if (!reply.content && reply.stopped) { session.messages.pop(); }
            persistSession();
            renderMessages();
            renderSessions();
            scheduleEstimate();
        }
    }

    function stop() { if (abortCtl) { abortCtl.abort(); } }

    function continueLast() {
        if (busy) { return; }
        var last = session.messages[session.messages.length - 1];
        if (last && canContinue(last)) { runCompletion({ continueFrom: last }); }
    }

    function retryLast() {
        if (busy) { return; }
        var last = session.messages[session.messages.length - 1];
        if (last && last.role === 'assistant') { session.messages.pop(); }
        var lu = session.messages[session.messages.length - 1];
        if (!lu || lu.role !== 'user') { renderMessages(); scheduleEstimate(); return; }
        var prompt = (!lu.context && !lu.imageMeta) ? LenImage.intent(lu.content) : null;
        if (prompt) { runImage(prompt); } else { runCompletion(); }
    }

    function deleteMessage(index) {
        if (busy) { toast('Wait for the reply to finish (or stop it) before deleting.', true); return; }
        if (!session.messages[index]) { return; }
        session.messages.splice(index, 1);
        persistSession();
        renderMessages();
        renderSessions();
        scheduleEstimate();
        toast('Message deleted - it no longer counts toward your context.');
    }


    function clearAttachments() {
        attachments = [];
        images = [];
        skippedFiles = [];
        el.trayTreeBox.hidden = true;
        el.trayTree.textContent = 'Show tree';
        renderTray();
    }

    function renderTray() {
        scheduleEstimate();
        if (!attachments.length && !images.length) { el.tray.hidden = true; return; }
        el.tray.hidden = false;
        var parts = [];
        if (attachments.length) {
            var chars = LenReader.totalChars(attachments);
            parts.push(attachments.length + ' file' + (attachments.length === 1 ? '' : 's') + ' \u00B7 ~' + LenReader.formatTokens(LenReader.approxTokens(chars)) + ' tokens');
        }
        if (images.length) {
            parts.push(images.length + ' image' + (images.length === 1 ? '' : 's') +
                (LenVision.usesVision(settings, settings.provider) ? ' (sent as pictures)' : ' (text read with OCR)'));
        }
        var text = parts.join(' + ');
        if (skippedFiles.length) { text += ' \u00B7 ' + skippedFiles.length + ' skipped'; }
        el.traySummary.textContent = text;
        el.traySummary.title = skippedFiles.slice(0, 40).map(function (s) { return s.path + ' (' + s.reason + ')'; }).join('\n');

        var pics = images.map(function (im) {
            return '<span class="chip chip-img" title="' + esc(im.path) + '"><img class="chip-thumb" src="' + esc(im.thumb) + '" alt=""><span>' + esc(im.name) + '</span>' +
                '<button type="button" data-rm="' + esc(im.path) + '" aria-label="Remove ' + esc(im.name) + '">' + ic('x') + '</button></span>';
        }).join('');
        var shown = attachments.slice(0, 40).map(function (f) {
            return '<span class="chip" title="' + esc(f.path) + '"><span>' + esc(f.path) + '</span>' +
                '<button type="button" data-rm="' + esc(f.path) + '" aria-label="Remove ' + esc(f.path) + '">' + ic('x') + '</button></span>';
        }).join('');
        var more = attachments.length > 40 ? '<span class="chip">+' + (attachments.length - 40) + ' more</span>' : '';
        el.trayChips.innerHTML = pics + shown + more;
        if (!el.trayTreeBox.hidden) { el.trayTreeBox.textContent = LenReader.buildTree(attachments); }
    }

    async function ingest(collected) {
        toast('Reading files\u2026');
        try {
            collected = await collected;
            var zipC = collected.candidates.filter(function (c) { return isZip(c.path); });
            if (zipC.length) {
                collected = { candidates: collected.candidates.filter(function (c) { return !isZip(c.path); }), skipped: collected.skipped.slice() };
                for (var zi = 0; zi < zipC.length; zi++) {
                    try {
                        var picked = await pickFromZip(zipC[zi].file, zipC[zi].path);
                        if (picked) { collected.candidates = collected.candidates.concat(picked); }
                        else { collected.skipped.push({ path: zipC[zi].path, reason: 'cancelled' }); }
                    } catch (zerr) {
                        collected.skipped.push({ path: zipC[zi].path, reason: (zerr && zerr.message) || 'unreadable archive' });
                        toast('Could not open ' + zipC[zi].path + ': ' + ((zerr && zerr.message) || zerr), true);
                    }
                }
            }
            var picC = [], txtC = [];
            collected.candidates.forEach(function (c) { (LenVision.isImage(c.path) ? picC : txtC).push(c); });
            var res = await LenReader.read(txtC, collected.skipped, cfg.limits, LenReader.totalChars(attachments));
            attachments = LenReader.merge(attachments, res.files);
            var skipped = res.skipped.slice();

            var maxImg = (cfg.limits && cfg.limits.max_images) || 6;
            var added = 0;
            for (var i = 0; i < picC.length; i++) {
                var c = picC[i];
                if (c.file.size > 15 * 1024 * 1024) { skipped.push({ path: c.path, reason: 'image larger than 15 MB' }); continue; }
                if (images.length >= maxImg && !images.some(function (x) { return x.path === c.path; })) {
                    skipped.push({ path: c.path, reason: 'more than ' + maxImg + ' images per message' });
                    continue;
                }
                try {
                    var p = await LenVision.prepare(c.file);
                    p.path = c.path;
                    p.name = c.path.split('/').pop();
                    images = images.filter(function (x) { return x.path !== p.path; }).concat([p]);
                    added++;
                } catch (e) { skipped.push({ path: c.path, reason: (e && e.message) || 'unreadable image' }); }
            }
            skippedFiles = skippedFiles.concat(skipped);
            renderTray();
            var n = res.files.length + added;
            if (n) {
                toast('Attached ' + n + ' item' + (n === 1 ? '' : 's') + (skipped.length ? ' (' + skipped.length + ' skipped)' : '') + '.');
            } else {
                toast('Nothing readable found' + (skipped.length ? ' (' + skipped.length + ' skipped).' : '.'), true);
            }
        } catch (err) {
            toast('Could not read files: ' + ((err && err.message) || err), true);
        }
    }


    function openDrawer() {
        closeSheet();
        draft = JSON.parse(JSON.stringify(settings));
        $('set-provider').innerHTML = el.selProvider.innerHTML;
        fillDrawer();
        $('set-sys').value = draft.systemPrompt;
        $('set-send-sys').checked = draft.sendSystem;
        $('set-fileskill').checked = draft.fileSkill !== false;
        $('skill-rule').textContent = LenDocs.RULE;
        $('set-temp').value = draft.temperature;
        $('set-max').value = draft.maxTokens || '';
        $('set-keep').value = draft.keepContext;
        $('set-transport').value = draft.transport;
        $('set-token').value = draft.token;
        $('set-vision').value = draft.visionMode;
        $('set-imgprov').value = draft.imageProvider;
        $('set-imgmodel').value = draft.imageModel;
        $('row-token').hidden = !cfg.relayNeedsToken;
        fillVoice();
        var about = $('about-slot');
        about.textContent = '';
        about.appendChild(LenBrand.aboutNode());
        renderStarters();
        renderUpdateSummary();
        el.drawer.hidden = false;
        el.backdrop.hidden = false;
    }

    function closeDrawer() {
        el.drawer.hidden = true;
        el.backdrop.hidden = true;
        draft = null;
    }

    function keyRowHtml(k, active) {
        return '<div class="key-row" data-kid="' + esc(k.id) + '">' +
            '<input class="kr-label" type="text" placeholder="Label, e.g. Work" maxlength="40" value="' + esc(k.label) + '" aria-label="Key label">' +
            '<input class="kr-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste API key" value="' + esc(k.key) + '" aria-label="API key">' +
            '<label class="kr-use" title="Use this key now"><input type="radio" name="kr-active" value="' + esc(k.id) + '"' + (active ? ' checked' : '') + '>Use</label>' +
            '<button class="btn btn-icon" type="button" data-kdel="' + esc(k.id) + '" aria-label="Remove key">' + ic('trash') + '</button></div>';
    }

    function fillKeys() {
        var c = draft.providers[draft.provider];
        el.keyRows.innerHTML = c.keys.length
            ? c.keys.map(function (k) { return keyRowHtml(k, k.id === c.activeKey); }).join('')
            : '<div class="list-empty">No keys yet. Add as many as you like and switch between them from the top bar.</div>';
        $('key-toggle').textContent = 'Show';
    }

    function fillDrawer() {
        var id = draft.provider, p = cfg.providers[id], c = draft.providers[id];
        $('set-provider').value = id;
        $('keys-section').hidden = !!p.local;
        fillKeys();
        var kl = $('key-link');
        kl.href = LenBrand.links.keys;
        kl.hidden = !!p.local;
        $('set-base').value = c.baseUrl;
        $('set-base').placeholder = p.base_url || (p.kind === 'azure' ? 'https://your-resource.openai.azure.com' : 'https://host/v1');
        $('set-model').value = c.model;
        $('set-model-list').innerHTML = LenStorage.modelsFor(draft, id).map(function (m) { return '<option value="' + esc(m) + '"></option>'; }).join('');
        $('set-custom-models').value = c.customModels.join(', ');
        $('relay-note').textContent = p.local
            ? 'Ollama is called straight from your browser. Start it with OLLAMA_ORIGINS set to this site; the server relay cannot reach your computer.'
            : 'Auto tries your browser first and uses api/stream.php if the provider blocks CORS.';
    }

    function readDrawerProvider() {
        var c = draft.providers[draft.provider];
        var rows = el.keyRows.querySelectorAll('.key-row');
        if (rows.length || !$('keys-section').hidden) {
            c.keys = Array.prototype.map.call(rows, function (r, i) {
                return {
                    id: r.getAttribute('data-kid'),
                    label: r.querySelector('.kr-label').value.trim() || ('Key ' + (i + 1)),
                    key: r.querySelector('.kr-key').value.trim()
                };
            });
            var checked = el.keyRows.querySelector('input[name="kr-active"]:checked');
            c.activeKey = checked ? checked.value : (c.keys[0] ? c.keys[0].id : '');
        }
        c.baseUrl = $('set-base').value.trim();
        c.model = $('set-model').value.trim();
        var seen = {};
        c.customModels = $('set-custom-models').value.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) {
            if (!s || seen[s]) { return false; }
            seen[s] = true;
            return true;
        });
    }

    function saveDrawer() {
        readDrawerProvider();
        var temp = $('set-temp').value.trim();
        if (temp !== '' && !isFinite(parseFloat(temp))) { toast('Temperature must be a number.', true); return; }
        var max = $('set-max').value.trim();
        if (max !== '' && !(parseInt(max, 10) > 0)) { toast('Max output tokens must be a positive number (or empty).', true); return; }
        var bad = Object.keys(draft.providers).filter(function (id) {
            var u = draft.providers[id].baseUrl;
            return u && !/^https?:\/\/[^\s]+$/i.test(u);
        });
        if (bad.length) { toast('Endpoint for ' + cfg.providers[bad[0]].label + ' must start with http:// or https://', true); return; }

        draft.systemPrompt = $('set-sys').value;
        draft.sendSystem = $('set-send-sys').checked;
        draft.fileSkill = $('set-fileskill').checked;
        draft.temperature = temp;
        draft.maxTokens = max === '' ? '' : parseInt(max, 10);
        draft.keepContext = Math.max(0, parseInt($('set-keep').value, 10) || 0);
        draft.transport = $('set-transport').value;
        draft.token = $('set-token').value.trim();
        draft.visionMode = $('set-vision').value;
        draft.imageProvider = $('set-imgprov').value;
        draft.imageModel = $('set-imgmodel').value.trim();
        readVoice();
        settings = draft;
        saveSettings();
        syncHandsUi();
        renderProviderBar();
        syncOpts();
        renderTray();
        closeDrawer();
        toast('Settings saved.');
    }


    function autosize() {
        if (window.CSS && CSS.supports && CSS.supports('field-sizing', 'content')) { return; }
        el.prompt.style.height = 'auto';
        el.prompt.style.height = Math.min(el.prompt.scrollHeight, 220) + 'px';
    }

    function copyText(text, btn) {
        var done = function () {
            if (!btn) { toast('Copied.'); return; }
            var old = btn.innerHTML;
            btn.textContent = 'Copied';
            setTimeout(function () { btn.innerHTML = old; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { toast('Copy failed.', true); });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed.', true); }
            ta.remove();
        }
    }

    function saveBlob(name, text, mime) {
        var url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: mime || 'text/plain' }));
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function downloadFile(name, text) { saveBlob(name, text, 'application/json'); }

    async function downloadImage(link) {
        var href = link.getAttribute('href');
        var name = link.getAttribute('download') || 'lenchat-image';
        if (/^data:/i.test(href)) {
            var ext = /image\/svg/.test(href) ? 'svg' : /image\/jpe?g/.test(href) ? 'jpg' : /image\/webp/.test(href) ? 'webp' : /image\/gif/.test(href) ? 'gif' : 'png';
            var a = document.createElement('a');
            a.href = href; a.download = name.replace(/\.\w+$/, '') + '-' + Date.now() + '.' + ext;
            document.body.appendChild(a); a.click(); a.remove();
            return;
        }
        try {
            var res = await fetch(href, { referrerPolicy: 'no-referrer' });
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            var blob = await res.blob();
            var e2 = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            var url = URL.createObjectURL(blob);
            var b = document.createElement('a');
            b.href = url; b.download = name + '-' + Date.now() + '.' + e2;
            document.body.appendChild(b); b.click(); b.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        } catch (err) {
            window.open(href, '_blank', 'noopener');
        }
    }


    var healChain = { n: 0, auto: false };

    function openSheet() { $('action-sheet').hidden = false; $('sheet-backdrop').hidden = false; $('btn-plus').setAttribute('aria-expanded', 'true'); }
    function closeSheet() { $('action-sheet').hidden = true; $('sheet-backdrop').hidden = true; $('btn-plus').setAttribute('aria-expanded', 'false'); }

    function beginEdit(index) {
        if (busy) { toast('Wait for the reply to finish (or stop it) before editing.', true); return; }
        var m = session.messages[index];
        var row = el.messages.querySelector('.msg[data-index="' + index + '"]');
        if (!m || m.role !== 'user' || !row) { return; }
        var bubble = row.querySelector('.bubble');
        var chips = bubble.querySelector('.file-chips');
        bubble.innerHTML = (chips ? chips.outerHTML : '') + '<textarea class="edit-area" aria-label="Edit prompt"></textarea>' +
            '<div class="edit-actions"><button class="btn" type="button" data-act="edit-cancel">Cancel</button>' +
            '<button class="btn btn-primary" type="button" data-act="edit-save">Save &amp; regenerate</button></div>';
        var ta = bubble.querySelector('.edit-area');
        ta.value = m.content;
        row.querySelector('.msg-actions').hidden = true;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
    }

    function saveEdit(index, text) {
        text = String(text || '').trim();
        var m = session.messages[index];
        if (!m || busy) { return; }
        if (!text) { toast('The prompt cannot be empty.', true); return; }
        var prompt = (!m.context && !m.imageMeta) ? LenImage.intent(text) : null;
        var provider = cfg.providers[settings.provider];
        var key = LenStorage.activeKey(settings, settings.provider);
        if (!prompt && !provider.local && !(key && key.key)) { toast('Add your ' + provider.label + ' API key first.', true); openDrawer(); return; }
        if (!LenBrand.ok()) { toast('LenChat is paused until its credits and support links are visible.', true); return; }
        session.messages = session.messages.slice(0, index + 1);
        m.content = text;
        m.ts = Date.now();
        if (index === 0) { session.title = titleFrom(text, []); el.title.textContent = session.title; }
        healChain.n = 0;
        persistSession();
        renderSessions();
        if (prompt) { runImage(prompt); } else { runCompletion(); }
    }

    function codeSrc(code) { var c = code.querySelector(':scope > pre > code'); return c ? c.textContent : ''; }

    function makeFrame(doc, title) {
        var f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals');
        f.setAttribute('title', title);
        f.setAttribute('referrerpolicy', 'no-referrer');
        f.addEventListener('load', function () { f.contentWindow.postMessage({ lenchatPreview: doc }, '*'); });
        f.src = 'preview.php';
        return f;
    }

    function previewDocFor(code) {
        var src = codeSrc(code);
        var kind = LenCanvas.previewKind(code.getAttribute('data-lang') || '', src, code.getAttribute('data-name') || '');
        return kind ? LenCanvas.previewDoc(kind, src, { heal: settings.autoHeal !== 'off', files: LenCanvas.fileMap(code.closest('.bubble')) }) : '';
    }

    function ensurePreview(code) {
        var pane = code.querySelector('.pv-pane');
        if (!pane) { return false; }
        if (pane.dataset.ready) { return true; }
        var doc = previewDocFor(code);
        if (!doc) { toast('This block cannot be previewed.', true); return false; }
        pane.dataset.ready = '1';
        pane.innerHTML = '<div class="pv-bar"><span>Live sandbox</span>' +
            '<span class="seg" role="group" aria-label="Preview width"><button type="button" class="on" data-act="pv-w" data-w="full">Full</button><button type="button" data-act="pv-w" data-w="tablet">Tablet</button><button type="button" data-act="pv-w" data-w="phone">Phone</button></span>' +
            '<span class="spacer"></span>' +
            '<button class="act" type="button" data-act="pv-console" title="Show console.log output">' + ic('terminal') + 'Console</button>' +
            '<button class="act" type="button" data-act="pv-reload">' + ic('refresh') + 'Reload</button>' +
            '<button class="act" type="button" data-act="pv-full">' + ic('maximize') + 'Full screen</button></div>' +
            '<div class="pv-stage"></div>' +
            '<div class="pv-console" hidden><div class="pv-console-head"><span>Console</span><span class="spacer"></span><button class="act" type="button" data-act="pv-clear">Clear</button></div><div class="pv-lines"></div></div>';
        pane.querySelector('.pv-stage').appendChild(makeFrame(doc, 'Live preview'));
        return true;
    }

    function setTab(code, which) {
        var prev = which === 'preview';
        if (prev && !ensurePreview(code)) { return; }
        code.classList.toggle('show-preview', prev);
        Array.prototype.forEach.call(code.querySelectorAll('.tab'), function (t) {
            var on = t.getAttribute('data-act') === (prev ? 'tab-preview' : 'tab-code');
            t.classList.toggle('on', on);
            t.setAttribute('aria-selected', String(on));
        });
    }

    function reloadPreview(code) {
        var pane = code.querySelector('.pv-pane');
        if (!pane) { return; }
        var old = pane.querySelector('iframe'); if (old) { old.remove(); }
        var b = pane.querySelector('.pv-banner'); if (b) { b.remove(); }
        var lines = pane.querySelector('.pv-lines'); if (lines) { lines.textContent = ''; }
        var stage = pane.querySelector('.pv-stage') || pane;
        stage.appendChild(makeFrame(previewDocFor(code), 'Live preview'));
    }

    var fsCode = null;
    function mountFs() {
        $('fs-body').textContent = '';
        $('fs-banner').hidden = true;
        $('fs-body').appendChild(makeFrame(previewDocFor(fsCode), 'Full-screen live preview'));
    }
    function openFull(code) {
        if (!previewDocFor(code)) { return; }
        fsCode = code;
        mountFs();
        $('fs-preview').hidden = false;
        document.body.classList.add('noscroll');
    }
    function closeFull() {
        $('fs-preview').hidden = true;
        $('fs-body').textContent = '';
        fsCode = null;
        document.body.classList.remove('noscroll');
    }

    function frameFor(win) {
        var all = document.querySelectorAll('iframe');
        for (var i = 0; i < all.length; i++) { if (all[i].contentWindow === win) { return all[i]; } }
        return null;
    }

    function canAutoHeal(code) {
        var row = code.closest('.msg');
        return settings.autoHeal === 'auto' && !busy && row && +row.dataset.index === session.messages.length - 1 && healChain.n < 2;
    }

    function healBannerHtml(err, working) {
        var first = err.split('\n')[0].slice(0, 220);
        return '<span class="grow"><strong>Runtime error:</strong> <code>' + esc(first) + '</code></span>' +
            (working ? '<span>Asking the AI to fix it\u2026</span>' :
                '<button class="act act-key" type="button" data-act="heal-fix">' + ic('refresh') + 'Fix with AI</button>' +
                '<button class="act" type="button" data-act="heal-dismiss">Dismiss</button>');
    }

    function showHeal(code, inFs, report) {
        var err = report.message + (report.stack ? '\n' + report.stack : '');
        code._lcErr = code._lcErr || err;
        err = code._lcErr;
        var auto = canAutoHeal(code);
        var host = inFs ? $('fs-banner') : code.querySelector('.pv-pane');
        var b = inFs ? host : host.querySelector('.pv-banner');
        if (!b) { b = document.createElement('div'); b.className = 'pv-banner'; host.insertBefore(b, host.querySelector('.pv-stage') || host.firstChild); }
        b.hidden = false;
        b.innerHTML = healBannerHtml(err, auto);
        if (auto) { setTimeout(function () { healFix(code, true); }, 500); }
    }

    function healFix(code, auto) {
        var err = code._lcErr;
        if (!err || busy || !code.isConnected) { return; }
        if (fsCode) { closeFull(); }
        var f = fenceFor(err);
        var text = 'The live preview of your last code block failed with a runtime error:\n\n' + f + 'text\n' + err + '\n' + f +
            '\n\nDiagnose the cause and reply with the complete corrected code in a single fenced block, then one sentence saying what was wrong.';
        if (settings.contextMode === 'prompt') {
            var src = codeSrc(code), f2 = fenceFor(src);
            text += '\n\nThe code that failed:\n\n' + f2 + (code.getAttribute('data-lang') || '') + '\n' + src + '\n' + f2;
        }
        if (auto) { healChain.n++; healChain.auto = true; } else { healChain.auto = false; }
        code._lcErr = '';
        session.messages.push({ role: 'user', content: text, ts: Date.now(), heal: true });
        persistSession();
        renderSessions();
        runCompletion();
    }

    function afterReply() {
        autoNarrate();
        if (!healChain.auto) { return; }
        healChain.auto = false;
        var tab = el.messages.querySelector('.msg:last-child .tab[data-act="tab-preview"]');
        if (tab) { setTab(tab.closest('.code'), 'preview'); }
    }

    window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || d.lenHeal !== 1) { return; }
        var frame = frameFor(e.source);
        if (!frame) { return; }
        var inFs = frame.closest('#fs-body');
        var code = inFs ? fsCode : frame.closest('.code');
        if (code) { showHeal(code, !!inFs, d); }
    });

    var lb = { s: 1, x: 0, y: 0, pts: {}, d0: 0, s0: 1 };
    function lbApply() {
        $('lb-img').style.transform = 'translate(' + lb.x + 'px,' + lb.y + 'px) scale(' + lb.s + ')';
        $('lb-pct').textContent = Math.round(lb.s * 100) + '%';
    }
    function lbZoom(f) { lb.s = Math.min(8, Math.max(0.5, lb.s * f)); if (lb.s <= 1) { lb.x = 0; lb.y = 0; } lbApply(); }
    function openLightbox(src, alt, name) {
        lb.s = 1; lb.x = 0; lb.y = 0; lb.pts = {};
        $('lb-img').src = src; $('lb-img').alt = alt || '';
        $('lb-dl').setAttribute('href', src); $('lb-dl').setAttribute('download', name || 'lenchat-image');
        lbApply();
        $('lightbox').hidden = false;
        document.body.classList.add('noscroll');
    }
    function closeLightbox() { $('lightbox').hidden = true; $('lb-img').removeAttribute('src'); document.body.classList.remove('noscroll'); }

    var lbStage = $('lb-stage');
    lbStage.addEventListener('wheel', function (e) { e.preventDefault(); lbZoom(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    lbStage.addEventListener('pointerdown', function (e) {
        lbStage.setPointerCapture(e.pointerId);
        lb.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        lbStage.classList.add('drag');
        var ids = Object.keys(lb.pts);
        if (ids.length === 2) { lb.d0 = Math.hypot(lb.pts[ids[0]].x - lb.pts[ids[1]].x, lb.pts[ids[0]].y - lb.pts[ids[1]].y); lb.s0 = lb.s; }
    });
    lbStage.addEventListener('pointermove', function (e) {
        var p = lb.pts[e.pointerId];
        if (!p) { return; }
        var ids = Object.keys(lb.pts);
        if (ids.length === 2) {
            lb.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            var d = Math.hypot(lb.pts[ids[0]].x - lb.pts[ids[1]].x, lb.pts[ids[0]].y - lb.pts[ids[1]].y);
            if (lb.d0) { lb.s = Math.min(8, Math.max(0.5, lb.s0 * d / lb.d0)); lbApply(); }
            return;
        }
        if (lb.s > 1) { lb.x += e.clientX - p.x; lb.y += e.clientY - p.y; lbApply(); }
        lb.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    function lbUp(e) { delete lb.pts[e.pointerId]; if (!Object.keys(lb.pts).length) { lbStage.classList.remove('drag'); } }
    lbStage.addEventListener('pointerup', lbUp);
    lbStage.addEventListener('pointercancel', lbUp);
    lbStage.addEventListener('dblclick', function () { if (lb.s > 1) { lb.s = 1; lb.x = 0; lb.y = 0; } else { lb.s = 2.5; } lbApply(); });
    lbStage.addEventListener('click', function (e) { if (e.target === lbStage && lb.s <= 1) { closeLightbox(); } });
    $('lb-in').addEventListener('click', function () { lbZoom(1.4); });
    $('lb-out').addEventListener('click', function () { lbZoom(1 / 1.4); });
    $('lb-reset').addEventListener('click', function () { lb.s = 1; lb.x = 0; lb.y = 0; lbApply(); });
    $('lb-close').addEventListener('click', closeLightbox);
    $('lb-dl').addEventListener('click', function (e) { e.preventDefault(); downloadImage($('lb-dl')); });

    el.messages.addEventListener('click', function (e) {
        var img = e.target.closest && e.target.closest('img.zoomable');
        if (!img) { return; }
        var a = img.closest('.img-card').querySelector('a[download]');
        openLightbox(img.currentSrc || img.src, img.alt, a ? a.getAttribute('download') : 'lenchat-image');
    });
    el.messages.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('zoomable')) { e.target.click(); }
        if (e.target.classList && e.target.classList.contains('edit-area')) {
            var row = e.target.closest('.msg');
            if (e.key === 'Escape') { renderMessages(); }
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(+row.dataset.index, e.target.value); }
        }
    });

    var speaking = null;
    function stopSpeaking() { if (speaking) { var s = speaking; speaking = null; if (s.ctl) { s.ctl.stop(); } } }
    function toggleSpeak(btn, text, done) {
        if (speaking && speaking.btn === btn) { stopSpeaking(); return; }
        stopSpeaking();
        var rec = { btn: btn, ctl: null, pause: null };
        speaking = rec;
        btn.classList.add('on'); btn.innerHTML = ic('stop') + 'Stop';
        var pb = document.createElement('button');
        pb.className = 'act on'; pb.type = 'button'; pb.innerHTML = ic('pause') + 'Pause'; pb.title = 'Pause or resume the narration';
        pb.addEventListener('click', function () {
            if (!rec.ctl) { return; }
            if (rec.ctl.paused()) { rec.ctl.resume(); pb.innerHTML = ic('pause') + 'Pause'; } else { rec.ctl.pause(); pb.innerHTML = ic('play') + 'Resume'; }
        });
        btn.parentNode.insertBefore(pb, btn.nextSibling);
        rec.pause = pb;
        rec.ctl = LenSpeech.speak(text, settings, {
            onEnd: function () {
                var mine = speaking === rec;
                if (mine) { speaking = null; }
                if (pb.isConnected) { pb.remove(); }
                if (btn.isConnected) { btn.classList.remove('on'); btn.innerHTML = ic('volume') + 'Listen'; }
                if (mine && typeof done === 'function') { done(); }
            },
            onError: function (m) { toast(m, true); }
        });
    }

    function autoNarrate() {
        var v = settings.voice;
        if (!v.autoRead && !v.handsFree) { return; }
        var last = session.messages[session.messages.length - 1];
        if (!last || last.role !== 'assistant' || last.error || !last.content || last.provider === 'image' || last.stopped) { return; }
        var btn = el.messages.querySelector('.msg:last-child [data-act="speak"]');
        if (!btn) { return; }
        toggleSpeak(btn, last.content, v.handsFree ? function () { if (settings.voice.handsFree && !busy) { startMic(); } } : null);
    }

    var mic = null, micAfter = '', silenceTimer = null;
    function stopMic() { clearTimeout(silenceTimer); if (mic) { mic.stop(); } }
    function toggleMic() { if (mic) { mic.stop(); } else { startMic(); } }

    function syncHandsUi() {
        var v = settings.voice;
        $('btn-hands').setAttribute('aria-pressed', String(!!v.handsFree));
        $('btn-hands').querySelector('b').textContent = v.handsFree ? 'On' : 'Off';
        $('btn-autoread').setAttribute('aria-pressed', String(!!v.autoRead));
        $('btn-autoread').querySelector('b').textContent = v.autoRead ? 'On' : 'Off';
        $('btn-mic').classList.toggle('hands', !!v.handsFree);
    }

    function startMic() {
        if (mic || busy) { return; }
        stopSpeaking();
        var base = el.prompt.value, sep = base && !/\s$/.test(base) ? ' ' : '', ended = false, lastShown = '';
        micAfter = '';
        $('btn-mic').classList.add('rec');
        var v = settings.voice;
        var handlers = {
            onText: function (fin, interim) {
                var shown = base + sep + fin + (interim ? (fin ? ' ' : '') + interim : '');
                if (shown === lastShown) { return; }
                lastShown = shown;
                el.prompt.value = shown;
                autosize(); scheduleEstimate();
                clearTimeout(silenceTimer);
                if (v.handsFree && shown.trim()) {
                    silenceTimer = setTimeout(function () { micAfter = 'send'; if (mic) { mic.stop(); } }, v.silenceMs);
                }
            },
            onEnd: function () {
                ended = true; mic = null; clearTimeout(silenceTimer);
                $('btn-mic').classList.remove('rec');
                var act = micAfter; micAfter = '';
                if (act === 'send') { send(); }
                else if (act === 'clear') { el.prompt.value = ''; autosize(); scheduleEstimate(); }
                else if (act === 'new') { newSession(); }
                else if (act === 'read') { var b = el.messages.querySelector('.msg:last-child [data-act="speak"]'); if (b && session.messages.length) { toggleSpeak(b, session.messages[session.messages.length - 1].content); } }
                else { el.prompt.focus(); }
            },
            onError: function (m) { toast(m, true); settings.voice.handsFree = false; syncHandsUi(); }
        };
        if (v.commands) {
            handlers.onCommand = function (action) {
                if (action === 'stop') { micAfter = ''; } else { micAfter = action; }
                setTimeout(function () { if (mic) { mic.stop(); } }, 120);
            };
        }
        var ctl = LenSpeech.startSTT(settings, handlers);
        if (!ended) { mic = ctl; }
    }

    el.prompt.addEventListener('input', function (e) { if (mic && e.isTrusted && e.inputType) { stopMic(); } });

    function fillVoiceList() {
        var sel = $('set-tts-voice'), cur = draft ? draft.tts.voice : '';
        var list = LenSpeech.voices();
        sel.innerHTML = '<option value="">Browser default</option>' + list.map(function (v) {
            return '<option value="' + esc(v.voiceURI) + '">' + esc(v.name + ' (' + v.lang + ')') + '</option>';
        }).join('');
        sel.value = cur;
    }
    function voiceRows() {
        $('stt-custom').hidden = $('set-stt-engine').value !== 'custom';
        var te = $('set-tts-engine').value;
        $('tts-native').hidden = te !== 'native';
        $('tts-custom').hidden = te === 'native';
        $('rate-val').textContent = $('set-tts-rate').value + '\u00D7';
        $('pitch-val').textContent = $('set-tts-pitch').value;
        $('silence-val').textContent = (parseInt($('set-voice-silence').value, 10) / 1000).toFixed(1) + ' s';
    }
    function fillVoice() {
        var st = draft.stt, tt = draft.tts;
        $('set-stt-engine').value = st.engine; $('set-stt-lang').value = st.lang; $('set-stt-url').value = st.url;
        $('set-stt-model').value = st.model; $('set-stt-key').value = st.key;
        $('set-tts-engine').value = tt.engine; $('set-tts-rate').value = tt.rate; $('set-tts-pitch').value = tt.pitch;
        $('set-tts-url').value = tt.url; $('set-tts-model').value = tt.model; $('set-tts-voiceid').value = tt.voiceId; $('set-tts-key').value = tt.key;
        $('set-heal').value = draft.autoHeal;
        $('set-voice-cmd').checked = draft.voice.commands;
        $('set-voice-autoread').checked = draft.voice.autoRead;
        $('set-voice-hands').checked = draft.voice.handsFree;
        $('set-voice-silence').value = draft.voice.silenceMs;
        fillVoiceList();
        voiceRows();
    }
    function readVoice() {
        draft.stt = { engine: $('set-stt-engine').value, lang: $('set-stt-lang').value.trim(), url: $('set-stt-url').value.trim(),
            model: $('set-stt-model').value.trim() || 'whisper-1', key: $('set-stt-key').value.trim() };
        draft.tts = { engine: $('set-tts-engine').value, voice: $('set-tts-voice').value, rate: parseFloat($('set-tts-rate').value) || 1,
            pitch: parseFloat($('set-tts-pitch').value) || 1, url: $('set-tts-url').value.trim(), model: $('set-tts-model').value.trim(),
            voiceId: $('set-tts-voiceid').value.trim(), key: $('set-tts-key').value.trim() };
        draft.autoHeal = $('set-heal').value;
        draft.voice = { commands: $('set-voice-cmd').checked, autoRead: $('set-voice-autoread').checked, handsFree: $('set-voice-hands').checked,
            silenceMs: parseInt($('set-voice-silence').value, 10) || 1800 };
    }
    ['set-stt-engine', 'set-tts-engine', 'set-tts-rate', 'set-tts-pitch', 'set-voice-silence'].forEach(function (id) { $(id).addEventListener('input', voiceRows); });
    $('btn-tts-test').addEventListener('click', function () {
        readVoice();
        stopSpeaking();
        LenSpeech.speak('Hello, this is how LenChat will read replies aloud.', draft, { onEnd: function () {}, onError: function (m) { toast(m, true); } });
    });
    if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = function () { if (draft) { fillVoiceList(); } }; }

    function isZip(p) { return /\.zip$/i.test(p); }
    function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

    async function pickFromZip(file, path) {
        var z = await LenDocs.openZip(file);
        if (!z.entries.length) { throw new Error('the archive is empty'); }
        var root = { name: '', kids: {} }, rows = [];
        z.entries.forEach(function (en) {
            var n = root;
            en.path.split('/').forEach(function (p) { n.kids[p] = n.kids[p] || { name: p, kids: {} }; n = n.kids[p]; });
            n.entry = en;
            en.can = LenReader.isReadable(en.path);
            en.sel = LenReader.zipDefault(en.path, en.size, cfg.limits);
        });
        function leaves(n, out) {
            out = out || [];
            if (n.entry) { out.push(n.entry); }
            Object.keys(n.kids).forEach(function (k) { leaves(n.kids[k], out); });
            return out;
        }
        var tree = $('zip-tree');
        $('zip-title').textContent = 'Choose files from ' + path.split('/').pop();
        tree.textContent = '';

        function build(n, parent, depth) {
            Object.keys(n.kids).sort(function (a, b) {
                var fa = Object.keys(n.kids[a].kids).length > 0, fb = Object.keys(n.kids[b].kids).length > 0;
                return fa === fb ? a.localeCompare(b) : (fa ? -1 : 1);
            }).forEach(function (k) {
                var c = n.kids[k], isDir = Object.keys(c.kids).length > 0;
                var row = document.createElement('div'); row.className = 'zt-row';
                var cb = document.createElement('input'); cb.type = 'checkbox';
                var name = document.createElement('span'); name.className = 'zt-name'; name.textContent = k + (isDir ? '/' : '');
                var meta = document.createElement('span'); meta.className = 'zt-meta';
                var fold = null, kids = null;
                if (isDir) {
                    fold = document.createElement('button'); fold.type = 'button'; fold.className = 'zt-fold open'; fold.innerHTML = ic('chevron');
                    row.appendChild(fold);
                } else { row.style.paddingLeft = '34px'; }
                row.appendChild(cb); row.appendChild(name); row.appendChild(meta);
                parent.appendChild(row);
                c.cb = cb; c.meta = meta; c.row = row;
                if (isDir) {
                    kids = document.createElement('div'); kids.className = 'zt-kids';
                    parent.appendChild(kids);
                    build(c, kids, depth + 1);
                    if (depth >= 1 || /^(node_modules|vendor|\.git|dist|build)$/.test(k)) { kids.hidden = true; fold.classList.remove('open'); }
                    fold.addEventListener('click', function () { kids.hidden = !kids.hidden; fold.classList.toggle('open', !kids.hidden); });
                    cb.addEventListener('change', function () { leaves(c).forEach(function (en) { if (en.can) { en.sel = cb.checked; } }); refresh(); });
                } else {
                    var en = c.entry;
                    meta.textContent = en.size ? fmtSize(en.size) : '';
                    cb.disabled = !en.can;
                    if (!en.can) { row.title = 'Not a supported text or document type'; row.classList.add('off'); }
                    cb.addEventListener('change', function () { en.sel = cb.checked; refresh(); });
                }
            });
        }
        build(root, tree, 0);

        function refresh() {
            (function walk(n) {
                Object.keys(n.kids).forEach(function (k) {
                    var c = n.kids[k]; walk(c);
                    if (c.entry && !Object.keys(c.kids).length) { c.cb.checked = !!c.entry.sel; return; }
                    var ls = leaves(c).filter(function (x) { return x.can; });
                    var on = ls.filter(function (x) { return x.sel; }).length;
                    c.cb.checked = ls.length > 0 && on === ls.length;
                    c.cb.indeterminate = on > 0 && on < ls.length;
                    c.cb.disabled = !ls.length;
                    c.meta.textContent = on + '/' + ls.length;
                });
            })(root);
            var sel = z.entries.filter(function (x) { return x.sel; });
            var bytes = sel.reduce(function (s, x) { return s + x.size; }, 0);
            $('zip-summary').textContent = sel.length + ' selected \u00B7 ' + fmtSize(bytes);
            $('zip-ok').disabled = !sel.length;
        }
        refresh();

        var tops = {};
        z.entries.forEach(function (en) { tops[en.path.split('/')[0]] = 1; });
        var prefix = Object.keys(tops).length === 1 && z.entries[0].path.indexOf('/') > 0 ? '' : path.replace(/\.zip$/i, '').split('/').pop() + '/';

        $('zip-modal').hidden = false;
        document.body.classList.add('noscroll');
        return new Promise(function (resolve) {
            function done(val) {
                $('zip-modal').hidden = true; tree.textContent = '';
                document.body.classList.remove('noscroll');
                ['zip-ok', 'zip-cancel', 'zip-x', 'zip-all', 'zip-none'].forEach(function (id) { $(id).onclick = null; });
                $('zip-modal').onclick = null;
                resolve(val);
            }
            window.__lcZipCancel = function () { done(null); };
            $('zip-cancel').onclick = $('zip-x').onclick = function () { done(null); };
            $('zip-modal').onclick = function (e) { if (e.target === $('zip-modal')) { done(null); } };
            $('zip-all').onclick = function () { z.entries.forEach(function (x) { if (x.can) { x.sel = true; } }); refresh(); };
            $('zip-none').onclick = function () { z.entries.forEach(function (x) { x.sel = false; }); refresh(); };
            $('zip-ok').onclick = async function () {
                $('zip-ok').disabled = true;
                try {
                    var out = [];
                    for (var i = 0; i < z.entries.length; i++) {
                        var en = z.entries[i];
                        if (en.sel) { out.push({ file: await LenDocs.zipEntryFile(z.zip, en.path), path: prefix + en.path }); }
                    }
                    done(out);
                } catch (err) { toast('Could not extract: ' + ((err && err.message) || err), true); done(null); }
            };
        });
    }


    el.send.addEventListener('click', send);
    el.prompt.addEventListener('input', function () { autosize(); scheduleEstimate(); });
    el.prompt.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    $('btn-attach').addEventListener('click', function () { $('pick-files').click(); });
    $('btn-folder').addEventListener('click', function () { $('pick-folder').click(); });
    ['pick-files', 'pick-folder'].forEach(function (id) {
        $(id).addEventListener('change', function (e) {
            var input = e.target;
            if (input.files.length) { ingest(LenReader.collectFromFileList(input.files, cfg.limits)); }
            input.value = '';
        });
    });

    el.prompt.addEventListener('paste', function (e) {
        var files = Array.prototype.filter.call((e.clipboardData && e.clipboardData.files) || [], function (f) { return /^image\//.test(f.type); });
        if (!files.length) { return; }
        e.preventDefault();
        ingest({
            candidates: files.map(function (f, i) {
                var named = f.name && !/^image\.\w+$/i.test(f.name);
                return { file: f, path: named ? f.name : 'pasted-' + Date.now() + '-' + (i + 1) + '.png' };
            }),
            skipped: []
        });
    });

    el.optCtx.addEventListener('change', function () {
        settings.contextMode = el.optCtx.value;
        saveSettings(); syncOpts();
    });
    el.optN.addEventListener('change', function () {
        settings.contextN = Math.max(1, parseInt(el.optN.value, 10) || 6);
        saveSettings(); syncOpts();
    });
    el.optSys.addEventListener('click', function () {
        settings.sendSystem = !settings.sendSystem;
        saveSettings(); syncOpts();
        toast(settings.sendSystem ? 'System prompt will be sent.' : 'System prompt turned off - saves tokens.');
    });
    el.optMax.addEventListener('change', function () {
        var n = parseInt(el.optMax.value, 10);
        settings.maxTokens = n > 0 ? n : '';
        saveSettings(); syncOpts();
    });

    $('tray-clear').addEventListener('click', clearAttachments);
    el.trayTree.addEventListener('click', function () {
        var show = el.trayTreeBox.hidden;
        el.trayTreeBox.hidden = !show;
        el.trayTree.textContent = show ? 'Hide tree' : 'Show tree';
        if (show) { el.trayTreeBox.textContent = LenReader.buildTree(attachments); }
    });
    el.trayChips.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-rm]');
        if (!rm) { return; }
        var gone = rm.getAttribute('data-rm');
        attachments = attachments.filter(function (f) { return f.path !== gone; });
        images = images.filter(function (f) { return f.path !== gone; });
        renderTray();
    });

    var dragDepth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    window.addEventListener('dragenter', function (e) { if (hasFiles(e)) { e.preventDefault(); dragDepth++; el.overlay.hidden = false; } });
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', function (e) {
        if (!hasFiles(e)) { return; }
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) { el.overlay.hidden = true; }
    });
    window.addEventListener('drop', function (e) {
        if (!hasFiles(e)) { return; }
        e.preventDefault();
        dragDepth = 0;
        el.overlay.hidden = true;
        ingest(LenReader.collectFromDataTransfer(e.dataTransfer, cfg.limits));
    });

    el.messages.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) { return; }
        var act = btn.getAttribute('data-act');
        var code = btn.closest('.code');
        var row = btn.closest('.msg');
        var m = row ? session.messages[+row.dataset.index] : null;

        if (v4Act(act, btn, code, row, m, e)) {
            return;
        } else if (act === 'dl-zip') {
            var fl = LenCanvas.collectFiles(btn.closest('.bubble'));
            if (fl.length < 2) { toast('No named files found in this reply.', true); return; }
            var zu = URL.createObjectURL(LenCanvas.zip(fl)), za = document.createElement('a');
            za.href = zu; za.download = 'lenchat-files.zip'; document.body.appendChild(za); za.click(); za.remove();
            setTimeout(function () { URL.revokeObjectURL(zu); }, 1500);
        } else if (act === 'toggle-code') {
            if (code.classList.contains('editing')) { return; }
            var closed = code.classList.toggle('collapsed');
            btn.innerHTML = ic(closed ? 'expand' : 'shrink') + (closed ? 'Expand' : 'Collapse');
        } else if (act === 'tab-code') {
            setTab(code, 'code');
        } else if (act === 'tab-preview') {
            healChain.n = 0;
            if (code.classList.contains('editing')) { exitEdit(code); }
            setTab(code, 'preview');
        } else if (act === 'pv-reload') {
            code._lcErr = '';
            reloadPreview(code);
        } else if (act === 'pv-full') {
            openFull(code);
        } else if (act === 'heal-fix') {
            healFix(code, false);
        } else if (act === 'heal-dismiss') {
            var bn = btn.closest('.pv-banner'); if (bn) { bn.hidden = true; }
        } else if (act === 'edit') {
            if (row) { beginEdit(+row.dataset.index); }
        } else if (act === 'edit-save') {
            if (row) { saveEdit(+row.dataset.index, row.querySelector('.edit-area').value); }
        } else if (act === 'edit-cancel') {
            renderMessages();
        } else if (act === 'speak') {
            toggleSpeak(btn, m ? m.content : '');
        } else if (act === 'dl-img') {
            e.preventDefault();
            downloadImage(btn);
        } else if (act === 'copy') {
            copyText(m ? m.content : '', btn);
        } else if (act === 'del') {
            if (row) { deleteMessage(+row.dataset.index); }
        } else if (act === 'continue') {
            continueLast();
        } else if (act === 'retry') {
            retryLast();
        } else if (act === 'retry-key') {
            settings.providers[settings.provider].activeKey = btn.getAttribute('data-key');
            saveSettings();
            renderProviderBar();
            retryLast();
        }
    });

    el.messages.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG') { return; }
        var card = img.closest('.img-card');
        if (card) { card.className = 'img-fail'; card.textContent = 'The image could not be loaded. Try again, or change the image provider in Settings.'; }
    }, true);

    $('btn-new').addEventListener('click', newSession);
    el.sessionList.addEventListener('click', function (e) {
        var del = e.target.closest('[data-del]');
        if (del) {
            e.stopPropagation();
            var id = del.getAttribute('data-del');
            LenStorage.removeSession(id);
            if (session && session.id === id) { newSession(); } else { renderSessions(); }
            return;
        }
        var row = e.target.closest('.session');
        if (row && (!session || row.dataset.id !== session.id)) {
            if (busy) { stop(); }
            openSession(row.dataset.id);
        }
    });
    $('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
    $('btn-sidebar-close').addEventListener('click', closeSidebar);
    $('sidebar-backdrop').addEventListener('click', closeSidebar);
    if (narrow.addEventListener) { narrow.addEventListener('change', applySidebar); }

    el.selProvider.addEventListener('change', function () {
        settings.provider = el.selProvider.value;
        saveSettings();
        renderProviderBar();
    });
    el.selKey.addEventListener('change', function () {
        var v = el.selKey.value;
        if (v === '__manage' || v === '') { renderProviderBar(); openDrawer(); return; }
        var p = settings.providers[settings.provider];
        p.activeKey = v;
        saveSettings();
        var k = LenStorage.activeKey(settings, settings.provider);
        toast('Now using key: ' + (k ? k.label : ''));
    });
    el.selModel.addEventListener('change', function () {
        var p = settings.providers[settings.provider];
        var v = el.selModel.value;
        if (v === '__custom') {
            var typed = window.prompt('Model id (for Azure, your deployment name):', '');
            typed = typed ? typed.trim() : '';
            if (typed) {
                if (LenStorage.modelsFor(settings, settings.provider).indexOf(typed) < 0) { p.customModels.push(typed); }
                p.model = typed;
                saveSettings();
            }
            renderProviderBar();
            return;
        }
        p.model = v;
        saveSettings();
    });

    $('btn-theme').addEventListener('click', function () {
        settings.theme = settings.theme === 'light' ? 'dark' : 'light';
        saveSettings();
        applyTheme();
    });

    $('btn-settings').addEventListener('click', openDrawer);
    $('btn-drawer-close').addEventListener('click', closeDrawer);
    $('btn-cancel').addEventListener('click', closeDrawer);
    el.backdrop.addEventListener('click', closeDrawer);
    $('btn-save').addEventListener('click', saveDrawer);
    $('set-provider').addEventListener('change', function () {
        readDrawerProvider();
        draft.provider = $('set-provider').value;
        fillDrawer();
    });
    $('btn-add-key').addEventListener('click', function () {
        readDrawerProvider();
        var c = draft.providers[draft.provider];
        var k = { id: LenStorage.uid(), label: 'Key ' + (c.keys.length + 1), key: '' };
        c.keys.push(k);
        if (!c.activeKey) { c.activeKey = k.id; }
        fillKeys();
        var rows = el.keyRows.querySelectorAll('.kr-key');
        if (rows.length) { rows[rows.length - 1].focus(); }
    });
    el.keyRows.addEventListener('click', function (e) {
        var del = e.target.closest('[data-kdel]');
        if (!del) { return; }
        readDrawerProvider();
        var c = draft.providers[draft.provider];
        var id = del.getAttribute('data-kdel');
        c.keys = c.keys.filter(function (k) { return k.id !== id; });
        if (c.activeKey === id) { c.activeKey = c.keys[0] ? c.keys[0].id : ''; }
        fillKeys();
    });
    $('key-toggle').addEventListener('click', function () {
        var inputs = el.keyRows.querySelectorAll('.kr-key');
        var show = $('key-toggle').textContent === 'Show';
        Array.prototype.forEach.call(inputs, function (i) { i.type = show ? 'text' : 'password'; });
        $('key-toggle').textContent = show ? 'Hide' : 'Show';
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !el.drawer.hidden) { closeDrawer(); }
    });

    $('btn-export').addEventListener('click', function () {
        downloadFile('lenchat-sessions-' + new Date().toISOString().slice(0, 10) + '.json', LenStorage.exportSessions());
    });
    $('btn-import').addEventListener('click', function () { $('pick-import').click(); });
    $('pick-import').addEventListener('change', function (e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) { return; }
        var fr = new FileReader();
        fr.onload = function () {
            try {
                var n = LenStorage.importSessions(String(fr.result));
                renderSessions();
                toast('Imported ' + n + ' session' + (n === 1 ? '' : 's') + '.');
            } catch (err) { toast('Import failed: ' + err.message, true); }
        };
        fr.readAsText(file);
    });
    $('btn-wipe').addEventListener('click', function () {
        if (!window.confirm('Erase ALL LenChat data in this browser, including API keys and every session?')) { return; }
        LenStorage.wipeAll();
        window.location.reload();
    });

    $('btn-plus').addEventListener('click', function () { if ($('action-sheet').hidden) { openSheet(); } else { closeSheet(); } });
    $('btn-model-chip').addEventListener('click', openSheet);
    $('btn-sheet-close').addEventListener('click', closeSheet);
    $('sheet-backdrop').addEventListener('click', closeSheet);
    $('btn-attach').addEventListener('click', closeSheet);
    $('btn-folder').addEventListener('click', closeSheet);
    $('btn-mic').addEventListener('click', toggleMic);
    $('fs-close').addEventListener('click', closeFull);
    $('fs-reload').addEventListener('click', function () { if (fsCode) { fsCode._lcErr = ''; mountFs(); } });
    $('fs-banner').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b || !fsCode) { return; }
        if (b.getAttribute('data-act') === 'heal-fix') { healFix(fsCode, false); } else { $('fs-banner').hidden = true; }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') { return; }
        if (!$('lightbox').hidden) { closeLightbox(); }
        else if (!$('zip-modal').hidden) { if (window.__lcZipCancel) { window.__lcZipCancel(); } }
        else if (!$('fs-preview').hidden) { closeFull(); }
        else if (!$('action-sheet').hidden) { closeSheet(); }
        else if (narrow.matches && el.sidebar.classList.contains('open')) { closeSidebar(); }
    });


    var TK_COLOR = { com: '#8a93a8', str: '#2f8a3a', kw: '#8a3fc2', num: '#b4590d', fn: '#2457c5', var: '#c23a5a', key: '#0f7f89', tag: '#c23a5a', attr: '#946200', at: '#8a3fc2' };

    function codeText(code) { var ta = code.querySelector('.ed-ta'); return ta ? ta.value : codeSrc(code); }
    function codeLang(code) { return code.getAttribute('data-lang') || ''; }
    function codeFile(code) { return LenCanvas.fileName(codeLang(code), code.getAttribute('data-name') || ''); }
    function highlighted(code) { return LenHighlight.highlight(codeText(code), codeLang(code)); }
    function slug(t) { return String(t || 'chat').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'chat'; }

    function downloadBlock(code, btn) {
        if (code.getAttribute('data-kind') === 'doc') {
            var spec = LenDocs.parseSpec(codeSrc(code));
            if (!spec) { toast('The file description is not valid, so the file cannot be built.', true); return; }
            if (btn) { btn.disabled = true; }
            LenDocs.generate(spec).then(function (r) { saveBlob(r.name, r.blob); })
                .catch(function (err) { toast('Could not build the file: ' + ((err && err.message) || err), true); })
                .then(function () { if (btn) { btn.disabled = false; } });
            return;
        }
        var lang = codeLang(code), nm = code.getAttribute('data-name') || '';
        saveBlob(codeFile(code), codeText(code), LenCanvas.mimeFor(lang, nm));
    }

    function richHtml(code) {
        var body = highlighted(code).replace(/<span class="tk-(\w+)">/g, function (_, c) {
            return '<span style="color:' + (TK_COLOR[c] || '#1a1f2e') + (c === 'com' ? ';font-style:italic' : '') + '">';
        });
        return '<pre style="margin:0;padding:12px;border:1px solid #d9dce8;border-radius:6px;background:#f6f7fb;color:#1a1f2e;font:13px/1.5 Consolas,Menlo,monospace;white-space:pre"><code>' + body + '</code></pre>';
    }

    function copyRich(code, btn) {
        var text = codeText(code), html = richHtml(code);
        if (navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([html], { type: 'text/html' })
            })]).then(function () { toast('Copied with syntax colours (pastes as plain text in code editors).'); },
                function () { copyText(text); });
        } else { copyText(text); }
    }

    function closeMenus(except) {
        Array.prototype.forEach.call(document.querySelectorAll('.menu'), function (m) {
            if (m === except) { return; }
            m.hidden = true;
            var b = m.parentNode.querySelector('[data-act="more"]'); if (b) { b.setAttribute('aria-expanded', 'false'); }
        });
    }
    document.addEventListener('click', function (e) { if (!e.target.closest('.more-wrap')) { closeMenus(null); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenus(null); } });

    var editSave = null;

    function enterEdit(code, caret) {
        if (busy || code.classList.contains('editing') || code.classList.contains('streaming') || code.classList.contains('doc')) { return; }
        if (code.classList.contains('show-preview')) { setTab(code, 'code'); }
        var pre = code.querySelector(':scope > pre'), text = codeSrc(code);
        if (code._lcOrig === undefined) { code._lcOrig = text; }
        code.classList.remove('collapsed');
        var bar = document.createElement('div');
        bar.className = 'ed-bar';
        bar.innerHTML = '<span>Editing. Changes are saved to this chat as you type.</span><span class="spacer"></span>' +
            '<button class="act" type="button" data-act="edit-revert" title="Restore the code as the AI wrote it">' + ic('undo') + 'Revert</button>' +
            '<button class="act act-key" type="button" data-act="edit-done">' + ic('check') + 'Done</button>';
        var ed = document.createElement('div');
        ed.className = 'ed';
        ed.innerHTML = '<pre class="ed-hl" aria-hidden="true"><code></code></pre><textarea class="ed-ta" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Edit code"></textarea>';
        pre.parentNode.insertBefore(bar, pre.nextSibling);
        pre.parentNode.insertBefore(ed, bar.nextSibling);
        var ta = ed.querySelector('textarea');
        ta.value = text;
        code.classList.add('editing');
        paintEditor(code);
        ta.focus();
        var at = typeof caret === 'number' ? Math.min(caret, text.length) : text.length;
        ta.setSelectionRange(at, at);
    }

    function paintEditor(code) {
        var ta = code.querySelector('.ed-ta'), hl = code.querySelector('.ed-hl code');
        if (!ta || !hl) { return; }
        hl.innerHTML = LenHighlight.highlight(ta.value, codeLang(code)) + '\n';
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight + 2, Math.round(window.innerHeight * 0.7), 560) + 'px';
        var layer = hl.parentNode;
        layer.scrollTop = ta.scrollTop; layer.scrollLeft = ta.scrollLeft;
    }

    function commitEdit(code, flush) {
        var ta = code.querySelector('.ed-ta');
        if (!ta) { return; }
        var text = ta.value;
        var main = code.querySelector(':scope > pre > code');
        if (main) { main.innerHTML = LenHighlight.highlight(text, codeLang(code)); }
        var row = code.closest('.msg'), m = row ? session.messages[+row.dataset.index] : null, ord = parseInt(code.getAttribute('data-ord'), 10);
        if (m && m.role === 'assistant' && !isNaN(ord)) {
            var next = LenEngine.replaceBlock(m.content, ord, text);
            if (next !== null && next !== m.content) {
                m.content = next;
                m.edited = true;
                clearTimeout(editSave);
                if (flush) { persistSession(); renderSessions(); } else { editSave = setTimeout(persistSession, 700); }
            }
        }
        var pane = code.querySelector('.pv-pane');
        if (pane && pane.dataset.ready) {
            clearTimeout(code._lcPv);
            code._lcPv = setTimeout(function () { code._lcErr = ''; reloadPreview(code); }, flush ? 0 : 450);
        }
    }

    function exitEdit(code) {
        commitEdit(code, true);
        ['.ed', '.ed-bar'].forEach(function (q) { var n = code.querySelector(q); if (n) { n.remove(); } });
        code.classList.remove('editing');
    }

    function revertEdit(code) {
        var ta = code.querySelector('.ed-ta');
        if (!ta || code._lcOrig === undefined) { return; }
        ta.value = code._lcOrig;
        paintEditor(code);
        commitEdit(code, false);
    }

    el.messages.addEventListener('input', function (e) {
        if (!e.target.classList || !e.target.classList.contains('ed-ta')) { return; }
        var code = e.target.closest('.code');
        paintEditor(code);
        clearTimeout(code._lcT);
        code._lcT = setTimeout(function () { commitEdit(code, false); }, 160);
    });
    el.messages.addEventListener('scroll', function (e) {
        if (!e.target.classList || !e.target.classList.contains('ed-ta')) { return; }
        var layer = e.target.parentNode.querySelector('.ed-hl');
        layer.scrollTop = e.target.scrollTop; layer.scrollLeft = e.target.scrollLeft;
    }, true);
    el.messages.addEventListener('keydown', function (e) {
        var t = e.target;
        if (!t.classList || !t.classList.contains('ed-ta')) { return; }
        var code = t.closest('.code');
        if (e.key === 'Escape') { e.preventDefault(); exitEdit(code); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exitEdit(code); return; }
        if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            var ok = false;
            try { ok = document.execCommand('insertText', false, '  '); } catch (err) { ok = false; }
            if (!ok) { var a = t.selectionStart; t.setRangeText('  ', a, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); }
        }
    });
    el.messages.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('pre[data-act="edit-pre"]')) { e.preventDefault(); enterEdit(e.target.closest('.code')); }
    });

    function caretOffset(pre) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount || !pre.contains(sel.anchorNode)) { return undefined; }
        var r = document.createRange();
        r.selectNodeContents(pre.querySelector('code'));
        r.setEnd(sel.anchorNode, sel.anchorOffset);
        return r.toString().length;
    }

    function exportMessage(kind, m) {
        var title = session.title || 'LenChat reply', name = slug(title);
        if (kind === 'md') { saveBlob(name + '.md', m.content, 'text/markdown;charset=utf-8'); return; }
        var spec = LenDocs.fromMarkdown(m.content, title);
        if (kind === 'html') {
            saveBlob(name + '.html', LenDocs.htmlPage(spec, null).replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, function (_, c) { return '<pre><code>' + c + '</code></pre>'; }), 'text/html;charset=utf-8');
            return;
        }
        LenDocs.generate({ type: kind, filename: name, title: title, blocks: spec.blocks })
            .then(function (r) { saveBlob(r.name, r.blob); })
            .catch(function (err) { toast('Export failed: ' + ((err && err.message) || err), true); });
    }

    function v4Act(act, btn, code, row, m, e) {
        var menu = btn.closest('.menu');
        if (menu) { closeMenus(null); }
        switch (act) {
            case 'copy-code': copyText(codeText(code), btn); return true;
            case 'dl-code': downloadBlock(code, btn); return true;
            case 'toggle-spec': { var sp = code.querySelector(':scope > pre'); sp.hidden = !sp.hidden; btn.classList.toggle('on', !sp.hidden); return true; }
            case 'more': {
                var mm = btn.parentNode.querySelector('.menu'), open = mm.hidden;
                closeMenus(mm);
                mm.hidden = !open;
                btn.setAttribute('aria-expanded', String(open));
                return true;
            }
            case 'copy-rich': copyRich(code); return true;
            case 'copy-md': { var f = '```'; var t = codeText(code); while (t.indexOf(f) >= 0) { f += '`'; } copyText(f + codeLang(code) + '\n' + t.replace(/\n$/, '') + '\n' + f); return true; }
            case 'exp-html': saveBlob(codeFile(code).replace(/\.[^.]+$/, '') + '-highlighted.html', LenDocs.codePage(codeFile(code), highlighted(code)), 'text/html;charset=utf-8'); return true;
            case 'exp-pdf': {
                var fn = codeFile(code);
                LenDocs.generate({ type: 'pdf', filename: fn, title: fn, blocks: [{ code: codeText(code) }] })
                    .then(function (r) { saveBlob(r.name, r.blob); })
                    .catch(function (err) { toast('Export failed: ' + ((err && err.message) || err), true); });
                return true;
            }
            case 'exp-txt': saveBlob(codeFile(code).replace(/\.[^.]+$/, '') + '.txt', codeText(code), 'text/plain;charset=utf-8'); return true;
            case 'edit-code': if (code.classList.contains('editing')) { exitEdit(code); } else { enterEdit(code); } return true;
            case 'edit-pre': {
                var sel = window.getSelection();
                if (sel && !sel.isCollapsed && btn.contains(sel.anchorNode)) { return true; }
                enterEdit(code, caretOffset(btn));
                return true;
            }
            case 'edit-done': exitEdit(code); return true;
            case 'edit-revert': revertEdit(code); return true;
            case 'pv-w': {
                var stage = code.querySelector('.pv-stage'), w = btn.getAttribute('data-w');
                stage.classList.remove('w-tablet', 'w-phone');
                if (w !== 'full') { stage.classList.add('w-' + w); }
                Array.prototype.forEach.call(btn.parentNode.children, function (b) { b.classList.toggle('on', b === btn); });
                return true;
            }
            case 'pv-console': { var c = code.querySelector('.pv-console'); c.hidden = !c.hidden; btn.classList.toggle('on', !c.hidden); return true; }
            case 'pv-clear': code.querySelector('.pv-lines').textContent = ''; return true;
            case 'msg-md': case 'msg-html': case 'msg-pdf': case 'msg-docx':
                if (m) { exportMessage(act.slice(4), m); }
                return true;
            default: return false;
        }
    }

    window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || d.lenLog !== 1) { return; }
        var frame = frameFor(e.source);
        if (!frame) { return; }
        var inFs = frame.closest('#fs-body');
        var code = inFs ? fsCode : frame.closest('.code');
        var box = code && code.querySelector('.pv-lines');
        if (!box) { return; }
        var ln = document.createElement('div');
        ln.className = 'ln ' + (/^(warn|error|info)$/.test(d.level) ? d.level : 'log');
        ln.textContent = String(d.text || '');
        box.appendChild(ln);
        while (box.children.length > 150) { box.removeChild(box.firstChild); }
        var con = code.querySelector('.pv-console');
        if (con && con.hidden && d.level === 'error') { con.hidden = false; }
        box.parentNode.scrollTop = box.parentNode.scrollHeight;
    });

    el.sessionList.addEventListener('click', function (e) {
        var tg = e.target.closest('[data-tag-edit]');
        if (tg) { e.stopPropagation(); openTagModal(tg.getAttribute('data-tag-edit')); return; }
        var cp = e.target.closest('[data-snip-copy]');
        if (cp) { e.stopPropagation(); var n = hist.snips[+cp.getAttribute('data-snip-copy')]; if (n) { copyText(n.code); } return; }
        var sn = e.target.closest('.snip');
        if (sn) { e.stopPropagation(); var x = hist.snips[+sn.getAttribute('data-i')]; if (x) { jumpToBlock(x.session.id, x.mi, x.ord); } }
    }, true);

    $('btn-hands').addEventListener('click', function () {
        settings.voice.handsFree = !settings.voice.handsFree;
        saveSettings(); syncHandsUi();
        if (settings.voice.handsFree) { closeSheet(); toast('Hands-free on: speak, pause to send, listen to the reply.'); startMic(); } else { stopMic(); stopSpeaking(); }
    });
    $('btn-autoread').addEventListener('click', function () {
        settings.voice.autoRead = !settings.voice.autoRead;
        saveSettings(); syncHandsUi();
    });

    function renderStarters() {
        $('starters').innerHTML = LenStarters.groups.map(function (g, gi) {
            return '<div class="st-group"><h4>' + esc(g.title) + '</h4><p>' + esc(g.blurb) + '</p>' + g.items.map(function (it, ii) {
                return '<div class="st-item"><div class="st-main"><strong>' + esc(it.title) + '</strong><span>' + esc(it.note) + '</span><code>' + esc(it.prompt) + '</code></div>' +
                    '<button class="btn btn-primary" type="button" data-st="' + gi + ':' + ii + '">Use</button></div>';
            }).join('') + '</div>';
        }).join('');
    }
    $('starters').addEventListener('click', function (e) {
        var b = e.target.closest('[data-st]');
        if (!b) { return; }
        var ix = b.getAttribute('data-st').split(':'), it = LenStarters.groups[+ix[0]].items[+ix[1]];
        closeDrawer();
        el.prompt.value = it.prompt;
        autosize(); scheduleEstimate();
        el.prompt.focus();
        toast('Prompt ready. Edit it, then press Send.');
    });

    var lastUpdate = null;
    function renderUpdateSummary() {
        $('upd-cur').textContent = 'v' + cfg.version;
        var u = settings.update || {};
        $('upd-latest').textContent = u.latest ? 'Latest seen: v' + u.latest : '';
        $('upd-result').hidden = true;
    }

    function renderUpdateResult(r) {
        lastUpdate = r;
        var box = $('upd-result');
        box.hidden = false;
        if (!r.newer) {
            box.innerHTML = '<span class="ok">You are up to date.</span> Installed v' + esc(r.current) + ', latest on GitHub v' + esc(r.latest) + '.';
            return;
        }
        var auto = LenUpdater.autoAvailable();
        box.innerHTML = '<strong>Version ' + esc(r.latest) + ' is available</strong> (you have v' + esc(r.current) + '). <a href="' + esc(r.page) + '" target="_blank" rel="noopener noreferrer">Release page</a>' +
            (r.notes ? '<div class="upd-notes">' + esc(r.notes) + '</div>' : '') +
            (auto
                ? '<p>One-click update is enabled on this server. It replaces the app files, keeps <code>config.php</code> and backs up what it replaces.</p>' +
                  '<div class="upd-row"><input id="upd-token" type="password" autocomplete="off" placeholder="Update token from config.php" aria-label="Update token"><button class="btn btn-primary" type="button" data-upd="apply">Update now</button></div>'
                : '') +
            '<p><strong>' + (auto ? 'Or update by hand' : 'How to update') + '</strong> (your keys, chats and settings are stored in this browser, so an update never touches them):</p>' +
            '<ol><li>Optional safety copy: use <em>Export configuration</em> and <em>Export sessions</em> in this panel.</li>' +
            '<li><a href="' + esc(r.zip) + '" target="_blank" rel="noopener noreferrer">Download the v' + esc(r.latest) + ' zip</a> and unzip it on your computer.</li>' +
            '<li>Upload everything to your hosting (cPanel File Manager or FTP), replacing existing files. <strong>Keep your current <code>config.php</code></strong>: do not overwrite it.</li>' +
            '<li>Reload this page with Ctrl/Cmd + Shift + R.</li></ol>';
    }

    $('btn-check-update').addEventListener('click', function () {
        var b = $('btn-check-update');
        b.disabled = true;
        b.querySelector('span').textContent = 'Checking\u2026';
        LenUpdater.check().then(function (r) {
            settings.update = Object.assign({}, settings.update, { lastCheck: Date.now(), latest: r.latest });
            saveSettings();
            $('upd-latest').textContent = 'Latest on GitHub: v' + r.latest;
            renderUpdateResult(r);
        }).catch(function (err) {
            $('upd-result').hidden = false;
            $('upd-result').innerHTML = '<span class="bad">' + esc((err && err.message) || 'The update check failed.') + '</span>';
        }).then(function () { b.disabled = false; b.querySelector('span').textContent = 'Check GitHub for updates'; });
    });

    $('upd-result').addEventListener('click', function (e) {
        var b = e.target.closest('[data-upd]');
        if (!b || !lastUpdate) { return; }
        if (b.getAttribute('data-upd') === 'reload') { window.location.reload(); return; }
        var token = ($('upd-token') || {}).value || '';
        if (!token) { toast('Enter the update token from config.php.', true); return; }
        if (!window.confirm('Update LenChat to v' + lastUpdate.latest + '? App files are replaced, config.php is kept, and a backup is made on the server.')) { return; }
        b.disabled = true; b.textContent = 'Updating\u2026';
        LenUpdater.apply(token, lastUpdate.tag).then(function (r) {
            $('upd-result').innerHTML = '<span class="ok">Updated to v' + esc(r.version) + '.</span> ' + esc(r.files) + ' files written, backup in <code>' + esc(r.backup) + '</code>. ' +
                esc(r.message || '') + '<div class="upd-row"><button class="btn btn-primary" type="button" data-upd="reload">Reload now</button></div>';
        }).catch(function (err) {
            b.disabled = false; b.textContent = 'Update now';
            toast((err && err.message) || 'Update failed.', true);
        });
    });

    $('btn-cfg-export').addEventListener('click', function () {
        var withKeys = $('cfg-keys').checked;
        saveSettings();
        saveBlob('lenchat-config-' + new Date().toISOString().slice(0, 10) + '.json', LenStorage.exportConfig(settings, { keys: withKeys }), 'application/json');
        toast(withKeys ? 'Configuration exported. It contains your API keys: keep the file private.' : 'Configuration exported without API keys.');
    });
    $('btn-cfg-import').addEventListener('click', function () { $('pick-config').click(); });
    $('pick-config').addEventListener('change', function (e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) { return; }
        var fr = new FileReader();
        fr.onload = function () {
            try {
                if (!window.confirm('Import this configuration? It replaces your current settings. API keys already saved here are kept.')) { return; }
                var r = LenStorage.importConfig(String(fr.result));
                settings = r.settings;
                closeDrawer();
                applyTheme(); renderProviderBar(); syncOpts(); syncHandsUi(); renderTray();
                toast('Configuration imported: ' + r.keys + ' API key' + (r.keys === 1 ? '' : 's') + ' and all settings.');
            } catch (err) { toast('Import failed: ' + err.message, true); }
        };
        fr.readAsText(file);
    });

    function backgroundUpdateCheck() {
        var u = settings.update || {};
        if (!navigator.onLine || Date.now() - (u.lastCheck || 0) < 864e5) { return; }
        LenUpdater.check().then(function (r) {
            settings.update = Object.assign({}, settings.update, { lastCheck: Date.now(), latest: r.latest });
            saveSettings();
            if (r.newer && settings.update.dismissed !== r.latest) {
                settings.update.dismissed = r.latest; saveSettings();
                toast('LenChat v' + r.latest + ' is available. Open Settings > Updates.');
            }
        }).catch(function () {  });
    }

    applyTheme();
    applySidebar();
    renderProviderBar();
    setBusy(false);
    syncOpts();
    openSession(LenStorage.getCurrentId());
    autosize();
    syncHandsUi();
    setTimeout(backgroundUpdateCheck, 4000);
})();
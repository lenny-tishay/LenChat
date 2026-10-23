/*!
 * LenChat - engine.js  
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
(function (global) {
    'use strict';


    function toWire(messages, opts) {
        opts = opts || {};
        var usable = messages.filter(function (m) {
            if (m.role === 'assistant') { return !!m.content && !m.error; }
            return true;
        });

        var mode = opts.mode || 'all';
        if (mode === 'prompt') {
            var lastUser = null;
            for (var u = usable.length - 1; u >= 0; u--) {
                if (usable[u].role === 'user') { lastUser = usable[u]; break; }
            }
            usable = lastUser ? [lastUser] : [];
        } else if (mode === 'last') {
            usable = usable.slice(-Math.max(1, opts.n || 6));
            while (usable.length && usable[0].role !== 'user') { usable.shift(); }
        }

        function hasMedia(m) { return m.role === 'user' && (m.context || (m.images && m.images.length)); }
        usable = dropLeadingAssistant(usable);
        var withCtx = usable.filter(hasMedia);
        var keepN = opts.keepFiles > 0 ? opts.keepFiles : 0;
        var keep = new Set(keepN ? withCtx.slice(-keepN) : []);
        var newest = usable[usable.length - 1];
        if (newest && hasMedia(newest)) { keep.add(newest); }

        var wire = [];
        usable.forEach(function (m) {
            var text = m.content || '';
            var imgs = null;
            if (m.role === 'user') {
                if (keep.has(m)) {
                    if (m.context) { text += '\n\n---\n\n' + m.context; }
                    if (m.images && m.images.length) { imgs = m.images; }
                } else if (m.files && m.files.length) {
                    text += '\n\n(Files attached earlier, omitted to save context: ' + m.files.join(', ') + ')';
                }
                if (!imgs && !m.ocr && m.imageMeta && m.imageMeta.length) {
                    text += '\n\n(Screenshots attached earlier, not resent: ' + m.imageMeta.map(function (i) { return i.name; }).join(', ') + ')';
                }
            }
            var last = wire[wire.length - 1];
            if (last && last.role === m.role) {
                last.content += '\n\n' + text;
                if (imgs) { last.images = (last.images || []).concat(imgs); }
            } else {
                var w = { role: m.role, content: text };
                if (imgs) { w.images = imgs; }
                wire.push(w);
            }
        });
        return wire;
    }

    function dropLeadingAssistant(list) {
        var i = 0;
        while (i < list.length && list[i].role !== 'user') { i++; }
        return list.slice(i);
    }

    function estimateTokens(wire, system) {
        var chars = (system || '').length;
        var pics = 0;
        wire.forEach(function (m) {
            chars += m.content.length;
            (m.images || []).forEach(function (im) { pics += global.LenVision ? global.LenVision.tokensFor(im) : 800; });
        });
        return Math.ceil(chars / 4) + pics;
    }


    async function stream(o) {
        var s = o.settings;
        var wire = toWire(o.messages, { mode: s.contextMode, n: s.contextN, keepFiles: s.keepContext });
        var sent = await global.LenProvider.send(o.providerId, s, wire, o.signal, o.keyId, o.extraSystem);
        var reader = sent.res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var full = '';
        var finish = '';

        function handleLine(raw) {
            var line = raw.replace(/\r$/, '');
            if (line.indexOf('data:') !== 0) { return; }
            var data = line.slice(5).trim();
            if (!data || data === '[DONE]') { return; }
            var evt;
            try { evt = JSON.parse(data); } catch (e) { return; }
            if (evt.error) {
                throw new Error(typeof evt.error === 'string' ? evt.error : (evt.error.message || 'Provider error'));
            }
            var r = sent.extract(evt);
            if (r.error) { throw new Error(r.error); }
            if (r.finish) { finish = r.finish; }
            if (r.text) {
                full += r.text;
                if (o.onToken) { o.onToken(full); }
            }
        }

        for (;;) {
            var chunk = await reader.read();
            if (chunk.done) { break; }
            buffer += decoder.decode(chunk.value, { stream: true });
            var nl;
            while ((nl = buffer.indexOf('\n')) >= 0) {
                handleLine(buffer.slice(0, nl));
                buffer = buffer.slice(nl + 1);
            }
        }
        if (buffer) { handleLine(buffer); }
        return { text: full, keyLabel: sent.keyLabel, finish: finish };
    }


    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function inline(text) {
        var spans = [];
        var s = escapeHtml(text).replace(/`([^`\n]+)`/g, function (_, code) {
            spans.push('<code>' + code + '</code>');
            return '\u0000' + (spans.length - 1) + '\u0000';
        });
        s = s.replace(/!\[([^\]\n]*)\]\((https:\/\/[^\s)]+|data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+)\)/g,
                function (_, alt, src) { return imageCard(src, alt, 'lenchat-image'); })
            .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
        return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return spans[+i]; });
    }

    function renderText(src) {
        var lines = src.split('\n');
        var html = '';
        var para = [];
        var list = null;

        function flushPara() {
            if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; }
        }
        function closeList() {
            if (list) { html += '</' + list + '>'; list = null; }
        }

        lines.forEach(function (line) {
            var m;
            if (/^\s*$/.test(line)) { flushPara(); closeList(); return; }
            if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
                flushPara(); closeList();
                var lvl = Math.min(m[1].length, 4);
                html += '<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>';
            } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
                flushPara(); closeList(); html += '<hr>';
            } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
                flushPara();
                if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
                html += '<li>' + inline(m[1]) + '</li>';
            } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
                flushPara();
                if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
                html += '<li>' + inline(m[1]) + '</li>';
            } else if ((m = line.match(/^>\s?(.*)$/))) {
                flushPara(); closeList();
                html += '<blockquote>' + inline(m[1]) + '</blockquote>';
            } else {
                closeList();
                para.push(line);
            }
        });
        flushPara(); closeList();
        return html;
    }

    function ic(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"></use></svg>'; }

    function imageCard(src, alt, filename, noDownload) {
        return '<span class="img-card"><img class="zoomable" tabindex="0" title="Click to enlarge" src="' + src + '" alt="' + alt + '" loading="lazy" referrerpolicy="no-referrer">' +
            (noDownload ? '' : '<span class="img-actions"><a class="img-btn" data-act="dl-img" href="' + src + '" download="' + filename +
            '" target="_blank" rel="noopener noreferrer" title="Download image">' + ic('download') + '<span>Download</span></a></span>') + '</span>';
    }


    var FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;
    var FENCE_BARE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

    function unwrapLendoc(t) {
        if (t.lang !== 'lendoc' || !global.LenCanvas || !global.LenDocs) { return t; }
        var C = global.LenCanvas, D = global.LenDocs;
        var sp = D.parseSpec(t.code);
        if (sp && D.isBinary(sp)) { return Object.assign({}, t, { doc: sp }); }
        var infoWords = String(t.info || '').trim().split(/\s+/).slice(1);
        var infoType = (infoWords[0] || '').toLowerCase().replace(/^\./, '');
        if (!sp) {
            if (!infoType && !t.name) { return t; }
            var nm0 = C.safePath(t.name || '');
            return Object.assign({}, t, { lang: C.langOf(infoType, nm0), name: nm0 });
        }
        var type = String(sp.type || infoType || '').toLowerCase().replace(/^\./, '');
        var name = C.safePath(sp.filename || t.name || '');
        var lang = C.langOf(type, name);
        if (name && !/\.[A-Za-z0-9]{1,8}$/.test(name)) { name = C.fileName(lang, name); }
        return Object.assign({}, t, { lang: lang, name: name, code: D.textBody(sp), wrap: { type: type, filename: name } });
    }

    function Tokenizer() {
        this.buf = '';
        this.out = [];
        this.text = [];
        this.code = null;
        this.label = '';
        this.consumed = 0;
        this.lineStart = 0;
        this.lineLen = 0;
        this.ord = 0;
    }

    Tokenizer.prototype.push = function (chunk) {
        this.buf += chunk;
        var nl;
        while ((nl = this.buf.indexOf('\n')) >= 0) {
            var raw = this.buf.slice(0, nl);
            this.lineStart = this.consumed;
            this.lineLen = raw.length;
            this.consumed += raw.length + 1;
            this.line(raw.replace(/\r$/, ''));
            this.buf = this.buf.slice(nl + 1);
        }
    };

    Tokenizer.prototype.flushText = function () {
        if (this.text.length) { this.out.push({ type: 'text', raw: this.text.join('\n') }); this.text = []; }
    };

    Tokenizer.prototype.line = function (ln) {
        var c = this.code, m;
        if (c) {
            var bare = ln.match(FENCE_BARE);
            if (bare && bare[1].charAt(0) === c.ch && bare[1].length >= c.len) {
                if (c.nest > 0) { c.nest--; c.lines.push(this.strip(c, ln)); return; }
                c.closeStart = this.lineStart;
                c.closeEnd = this.lineStart + this.lineLen;
                this.seal(true);
                return;
            }
            if (c.nest !== undefined && (m = ln.match(FENCE_OPEN)) && m[2].charAt(0) === c.ch && m[3].trim()) { c.nest++; }
            c.lines.push(this.strip(c, ln));
            return;
        }
        if ((m = ln.match(FENCE_OPEN)) && !(m[2].charAt(0) === '`' && m[3].indexOf('`') >= 0)) {
            this.flushText();
            var info = global.LenCanvas ? global.LenCanvas.parseInfo(m[3]) : { lang: m[3].trim().split(/\s+/)[0].toLowerCase(), name: '' };
            var name = info.name || (global.LenCanvas ? global.LenCanvas.nameFromLabel(this.label, info.lang) : '');
            this.code = {
                lang: info.lang, name: name, ch: m[2].charAt(0), len: m[2].length, info: m[3],
                openStart: this.lineStart, bodyStart: this.consumed, closeStart: -1, closeEnd: -1,
                indent: m[1].replace(/\t/g, '    ').length, lines: [],
                nest: (m[2].length === 3 && /^(?:markdown|md|mdx)$/.test(info.lang)) ? 0 : undefined
            };
            return;
        }
        if (/^\s*$/.test(ln)) { this.flushText(); return; }
        this.text.push(ln);
        this.label = ln;
    };

    Tokenizer.prototype.strip = function (c, ln) {
        if (!c.indent) { return ln; }
        var i = 0;
        while (i < c.indent && (ln.charAt(i) === ' ' || ln.charAt(i) === '\t')) { i++; }
        return ln.slice(i);
    };

    Tokenizer.prototype.seal = function (closed) {
        var c = this.code, C = global.LenCanvas;
        var code = c.lines.join('\n');
        var name = c.name || (C ? C.nameFromComment(code, c.lang) : '');
        this.out.push(unwrapLendoc({
            type: 'code', lang: C ? C.langOf(c.lang, name) : c.lang, name: name, code: code, info: c.info,
            closed: closed, truncated: !closed, complete: true, ord: this.ord++,
            openStart: c.openStart, bodyStart: c.bodyStart, closeStart: closed ? c.closeStart : this.consumed,
            closeEnd: closed ? c.closeEnd : this.consumed, fenceCh: c.ch, fenceLen: c.len, indent: c.indent
        }));
        this.code = null;
        this.label = '';
    };

    Tokenizer.prototype.pending = function () {
        var c = this.code, tail = this.buf;
        if (c) {
            var part = /^[ \t]*[`~]*$/.test(tail) ? '' : this.strip(c, tail);
            var body = c.lines.join('\n');
            if (part) { body += (c.lines.length ? '\n' : '') + part; }
            var C = global.LenCanvas;
            return { type: 'code', lang: C ? C.langOf(c.lang, c.name) : c.lang, name: c.name, code: body, complete: false };
        }
        if (/^\s*[`~]+[\w+#.:=\-]*$/.test(tail)) { tail = ''; }
        var raw = this.text.join('\n');
        if (tail) { raw += (raw ? '\n' : '') + tail; }
        return { type: 'text', raw: raw };
    };

    Tokenizer.prototype.drain = function () { var r = this.out; this.out = []; return r; };

    Tokenizer.prototype.finish = function () {
        if (this.buf) {
            this.lineStart = this.consumed; this.lineLen = this.buf.length; this.consumed += this.buf.length;
            this.line(this.buf.replace(/\r$/, '')); this.buf = '';
        }
        if (this.code) { this.seal(false); }
        this.flushText();
    };


    function codeBlock(t) {
        var lang = t.lang || '', name = t.name || '', clean = t.code;
        var L = global.LenHighlight, C = global.LenCanvas, D = global.LenDocs;

        if (t.doc) {
            var dn = D.isBinary(t.doc) ? (String(t.doc.filename || t.doc.title || 'document').replace(/\.[a-z0-9]{2,5}$/i, '') + '.' + String(t.doc.type).toLowerCase()) : 'document';
            return '<div class="code doc" data-kind="doc" data-lang="lendoc" data-docname="' + escapeHtml(dn) + '" data-ord="' + (t.ord === undefined ? '' : t.ord) + '">' +
                '<div class="doc-card"><span class="doc-type">' + escapeHtml(String(t.doc.type).toUpperCase()) + '</span><span class="doc-name" title="' + escapeHtml(dn) + '">' + escapeHtml(dn) + '</span>' +
                '<button class="btn btn-primary" type="button" data-act="dl-code" title="Build and download ' + escapeHtml(dn) + '">' + ic('download') + 'Download</button>' +
                '<button class="act" type="button" data-act="toggle-spec" title="Show the JSON description of this file">' + ic('code') + 'Spec</button></div>' +
                '<pre hidden><code>' + escapeHtml(clean) + '</code></pre></div>';
        }

        var kind = (C && !t.truncated) ? C.previewKind(lang, clean, name) : '';
        var long = clean.split('\n').length > 80;
        var svgCard = '';
        if (kind === 'svg') {
            svgCard = '<div class="svg-out">' + imageCard('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clean), 'SVG drawing', name ? name.split('/').pop() : 'drawing.svg', true) + '</div>';
        }
        var live = kind && kind !== 'svg';
        var label = name ? '<span class="code-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</span>' : '';
        var tabs = live
            ? '<span class="code-tabs" role="tablist"><button class="tab on" type="button" role="tab" aria-selected="true" data-act="tab-code">' + ic('code') + 'Code</button>' +
              '<button class="tab" type="button" role="tab" aria-selected="false" data-act="tab-preview">' + ic('eye') + 'Live preview</button></span>' + label
            : '<span class="code-lang">' + (label || (lang ? escapeHtml(lang) : 'text')) + '</span>';
        var fold = long || kind === 'svg';
        var editable = true;
        var tools =
            '<button class="act" type="button" data-act="copy-code" title="Copy the code">' + ic('copy') + 'Copy</button>' +
            '<button class="act act-key" type="button" data-act="dl-code" title="Download as ' + escapeHtml(C ? C.fileName(lang, name) : 'a file') + '">' + ic('download') + 'Download</button>' +
            (editable ? '<button class="act" type="button" data-act="edit-code" title="Edit this code in place">' + ic('edit') + 'Edit</button>' : '') +
            '<span class="more-wrap"><button class="act" type="button" data-act="more" aria-haspopup="menu" aria-expanded="false" title="More copy and export options">' + ic('more') + '<span class="sr">More</span></button>' +
            '<span class="menu" role="menu" hidden>' +
                '<button type="button" role="menuitem" data-act="copy-rich">' + ic('copy') + 'Copy with syntax colours</button>' +
                '<button type="button" role="menuitem" data-act="copy-md">' + ic('copy') + 'Copy as Markdown</button>' +
                '<button type="button" role="menuitem" data-act="exp-html">' + ic('download') + 'Export highlighted .html</button>' +
                '<button type="button" role="menuitem" data-act="exp-pdf">' + ic('download') + 'Export as .pdf</button>' +
                '<button type="button" role="menuitem" data-act="exp-txt">' + ic('download') + 'Save as .txt</button>' +
            '</span></span>' +
            '<button class="act act-fold" type="button" data-act="toggle-code">' + ic(fold ? 'expand' : 'shrink') + (fold ? 'Expand' : 'Collapse') + '</button>';
        var body = L ? L.highlight(clean, lang) : escapeHtml(clean);
        return svgCard + '<div class="code' + (fold ? ' collapsed' : '') + '" data-lang="' + escapeHtml(lang) + '" data-name="' + escapeHtml(name) +
            '" data-kind="' + kind + '" data-ord="' + (t.ord === undefined ? '' : t.ord) + '"' + (t.wrap ? ' data-wrap="1"' : '') + (t.truncated ? ' data-truncated="1"' : '') +
            '><div class="code-head">' + tabs + '<span class="code-tools">' + tools + '</span></div>' +
            '<pre tabindex="0" title="Click to edit" data-act="edit-pre"><code>' + body + '</code></pre>' + (live ? '<div class="pv-pane"></div>' : '') + '</div>';
    }

    function renderToken(t) { return t.type === 'text' ? renderText(t.raw) : codeBlock(t); }

    function filesBar(n) {
        return '<span class="files-label">' + ic('folder') + n + ' files in this reply</span>' +
            '<button class="act act-key" type="button" data-act="dl-zip">' + ic('download') + 'Download all (.zip)</button>';
    }

    function renderMarkdown(md) {
        var tk = new Tokenizer(), html = '', names = {}, n = 0;
        tk.push(String(md || ''));
        tk.finish();
        tk.drain().forEach(function (t) {
            if (t.type === 'code' && t.name && !names[t.name]) { names[t.name] = 1; n++; }
            html += renderToken(t);
        });
        return html + (n > 1 ? '<div class="files-bar">' + filesBar(n) + '</div>' : '');
    }

    function longestFence(text) {
        var n = 0;
        String(text).split('\n').forEach(function (ln) { var m = ln.match(/^\s*(`{3,}|~{3,})/); if (m) { n = Math.max(n, m[1].length); } });
        return n;
    }

    function replaceBlock(md, ord, newText) {
        var tk = new Tokenizer();
        tk.push(String(md || '')); tk.finish();
        var tok = null;
        tk.drain().forEach(function (t) { if (t.type === 'code' && t.ord === ord) { tok = t; } });
        if (!tok) { return null; }
        var body = newText;
        if (tok.wrap) {
            body = JSON.stringify({ type: tok.wrap.type, filename: tok.wrap.filename, content: newText }, null, 2);
        }
        var need = Math.max(3, longestFence(body) + 1, tok.fenceLen || 3);
        var fence = new Array(need + 1).join(tok.fenceCh || '`');
        var pad = new Array((tok.indent || 0) + 1).join(' ');
        var text = pad + fence + (tok.info ? tok.info : '') + '\n' +
            body.split('\n').map(function (ln) { return ln ? pad + ln : ln; }).join('\n') + '\n' + pad + fence;
        return md.slice(0, tok.openStart) + text + md.slice(tok.closeEnd);
    }


    function createStream(root, opts) {
        opts = opts || {};
        var showCursor = opts.cursor !== false;
        var tk, tail, bar, cursor, len = 0, last = 0, names = {}, nNames = 0;
        var codeEl = null, codeText = null, shown = 0, tpl = document.createElement('template');

        function reset() {
            root.textContent = '';
            tk = new Tokenizer();
            len = 0; last = 0; names = {}; nNames = 0; codeEl = null; codeText = null; shown = 0;
            tail = document.createElement('div'); tail.className = 'blk-tail';
            bar = document.createElement('div'); bar.className = 'files-bar'; bar.hidden = true;
            cursor = document.createElement('span'); cursor.className = 'cursor';
            root.appendChild(tail); root.appendChild(bar);
        }

        function seal(t) {
            if (t.type === 'code') {
                if (codeEl) { tail.textContent = ''; codeEl = null; codeText = null; shown = 0; }
                if (t.name && !names[t.name]) { names[t.name] = 1; nNames++; }
            }
            tpl.innerHTML = renderToken(t);
            root.insertBefore(tpl.content, tail);
        }

        function placeCursor() {
            if (!showCursor) { return; }
            var host = codeEl || tail.lastElementChild || tail;
            if (!codeEl && /^(?:UL|OL)$/.test(host.tagName) && host.lastElementChild) { host = host.lastElementChild; }
            if (!codeEl && !/^(?:P|LI|H[1-6]|BLOCKQUOTE)$/.test(host.tagName)) { host = tail; }
            host.appendChild(cursor);
        }

        function paintTail() {
            var p = tk.pending();
            if (p.type === 'code') {
                if (!codeEl) {
                    var label = p.name || p.lang || 'code';
                    tail.innerHTML = '<div class="code streaming" data-lang="' + escapeHtml(p.lang) + '"><div class="code-head"><span class="code-lang">' +
                        escapeHtml(label) + '</span><span class="code-state">Writing\u2026</span></div><pre><code></code></pre></div>';
                    codeEl = tail.querySelector('code');
                    codeText = document.createTextNode('');
                    codeEl.appendChild(codeText);
                    shown = 0;
                }
                var s = p.code;
                if (s.length >= shown) { if (s.length > shown) { codeText.appendData(s.slice(shown)); } } else { codeText.data = s; }
                shown = s.length;
                var pre = codeEl.parentNode;
                pre.scrollTop = pre.scrollHeight;
            } else {
                codeEl = null; codeText = null; shown = 0;
                tail.innerHTML = p.raw ? renderText(p.raw) : '';
            }
            placeCursor();
        }

        function paintBar() {
            bar.hidden = nNames < 2;
            if (nNames >= 2 && bar.dataset.n !== String(nNames)) { bar.dataset.n = String(nNames); bar.innerHTML = filesBar(nNames); }
        }

        function update(full) {
            full = String(full || '');
            if (!tk || full.length < len || (len && full.charCodeAt(len - 1) !== last)) { reset(); }
            if (full.length > len) { tk.push(full.slice(len)); len = full.length; last = full.charCodeAt(len - 1); }
            tk.drain().forEach(seal);
            paintTail();
            paintBar();
        }

        function end() {
            if (!tk) { return; }
            tk.finish();
            tk.drain().forEach(seal);
            tail.textContent = ''; codeEl = null; codeText = null;
            paintBar();
        }

        reset();
        return { update: update, end: end, reset: reset };
    }

    global.LenEngine = {
        toWire: toWire,
        estimateTokens: estimateTokens,
        stream: stream,
        renderMarkdown: renderMarkdown,
        replaceBlock: replaceBlock,
        createStream: createStream,
        Tokenizer: Tokenizer,
        escapeHtml: escapeHtml
    };
})(window);
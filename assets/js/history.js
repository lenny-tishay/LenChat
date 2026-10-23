/*!
 * LenChat - history.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Local search over saved sessions and the code snippets inside them. Nothing leaves the browser.
 *
 */
(function (global) {
    'use strict';

    var index = null;

    function invalidate() { index = null; }

    function splitCode(md) {
        var blocks = [], text = [];
        var re = /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)(?:\n[ \t]*\2[`~]*[ \t]*(?=\n|$)|$)/g;
        var last = 0, m;
        md = String(md || '');
        while ((m = re.exec(md))) {
            text.push(md.slice(last, m.index));
            var info = (m[3] || '').trim(), lang = '', name = '';
            var words = info.split(/\s+/).filter(Boolean);
            if (global.LenCanvas) { var pi = global.LenCanvas.parseInfo(info); lang = pi.lang; name = pi.name; }
            else { lang = (words[0] || '').toLowerCase(); }
            var code = m[4] || '';
            if (lang === 'lendoc') {
                var sp = global.LenDocs && global.LenDocs.parseSpec(code);
                if (sp) {
                    lang = String(sp.type || '').toLowerCase();
                    name = sp.filename || name;
                    code = global.LenDocs.isBinary(sp) ? JSON.stringify(sp) : global.LenDocs.textBody(sp);
                    if (global.LenDocs.isBinary(sp)) { lang = String(sp.type).toLowerCase(); }
                } else if (words[1]) { lang = words[1].toLowerCase(); }
            }
            blocks.push({ lang: lang, name: name, code: code, ord: blocks.length });
            last = re.lastIndex;
            if (m[0].length === 0) { re.lastIndex++; }
        }
        text.push(md.slice(last));
        return { text: text.join('\n'), blocks: blocks };
    }

    function build() {
        index = (global.LenStorage.listSessions() || []).map(function (s) {
            var all = [], code = [], user = [];
            (s.messages || []).forEach(function (m, mi) {
                if (m.provider === 'image') { all.push(String(m.content || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')); return; }
                var p = splitCode(m.content);
                all.push(p.text);
                if (m.role === 'user') { user.push(p.text); }
                p.blocks.forEach(function (b) { b.mi = mi; code.push(b); });
            });
            var text = all.join('\n');
            return {
                s: s,
                title: String(s.title || '').toLowerCase(),
                tags: (s.tags || []).map(String),
                text: text, low: text.toLowerCase(),
                code: code.map(function (b) { return { name: b.name, lang: b.lang, code: b.code, low: b.code.toLowerCase(), lname: String(b.name).toLowerCase(), ord: b.ord, mi: b.mi }; })
            };
        });
        return index;
    }

    function parse(q) {
        var out = { terms: [], not: [], tags: [], lang: '', file: '', code: [], phrases: [] };
        var s = String(q || '').trim();
        s = s.replace(/"([^"]+)"/g, function (_, ph) { out.phrases.push(ph.toLowerCase()); return ' '; });
        s.split(/\s+/).filter(Boolean).forEach(function (w) {
            var lw = w.toLowerCase(), m;
            if ((m = lw.match(/^(?:#|tag:)(.+)$/))) { out.tags.push(m[1]); }
            else if ((m = lw.match(/^lang:(.+)$/))) { out.lang = m[1]; }
            else if ((m = lw.match(/^file:(.+)$/))) { out.file = m[1]; }
            else if ((m = lw.match(/^code:(.+)$/))) { out.code.push(m[1]); }
            else if (lw.length > 1 && lw.charAt(0) === '-') { out.not.push(lw.slice(1)); }
            else { out.terms.push(lw); }
        });
        return out;
    }

    function hasTag(entry, tag) {
        return entry.tags.some(function (t) { return t === tag || t.indexOf(tag) === 0; });
    }

    function codeMatches(entry, q) {
        return entry.code.some(function (b) {
            var okLang = !q.lang || b.lang === q.lang || b.lang.indexOf(q.lang) === 0;
            var okFile = !q.file || b.lname.indexOf(q.file) >= 0;
            var okCode = q.code.every(function (w) { return b.low.indexOf(w) >= 0 || b.lname.indexOf(w) >= 0; });
            return okLang && okFile && okCode;
        });
    }

    function snippetAround(text, low, needle) {
        var i = needle ? low.indexOf(needle) : -1;
        if (i < 0) { return null; }
        var from = Math.max(0, i - 42), to = Math.min(text.length, i + needle.length + 70);
        var pre = text.slice(from, i).replace(/\s+/g, ' '), mid = text.slice(i, i + needle.length), post = text.slice(i + needle.length, to).replace(/\s+/g, ' ');
        return [(from > 0 ? '\u2026' : '') + pre, mid, post + (to < text.length ? '\u2026' : '')];
    }

    function searchSessions(query, opts) {
        opts = opts || {};
        var q = parse(query);
        var idx = index || build();
        var needsText = q.terms.length || q.phrases.length || q.not.length || q.tags.length || q.lang || q.file || q.code.length;
        var out = [];
        idx.forEach(function (e) {
            if (opts.tag && !hasTag(e, opts.tag)) { return; }
            if (!needsText) { out.push({ session: e.s, score: e.s.updated, snippet: null, hits: 0 }); return; }
            var score = 0, hits = 0, snippet = null;
            for (var i = 0; i < q.tags.length; i++) { if (!hasTag(e, q.tags[i])) { return; } score += 6; }
            if ((q.lang || q.file || q.code.length) && !codeMatches(e, q)) { return; }
            if (q.lang || q.file || q.code.length) { score += 4; }
            var words = q.terms.concat(q.phrases);
            for (var j = 0; j < words.length; j++) {
                var w = words[j], inTitle = e.title.indexOf(w) >= 0, inTag = e.tags.some(function (t) { return t.indexOf(w) >= 0; });
                var inText = e.low.indexOf(w) >= 0;
                var inCode = e.code.some(function (b) { return b.low.indexOf(w) >= 0 || b.lname.indexOf(w) >= 0; });
                if (!inTitle && !inTag && !inText && !inCode) { return; }
                score += (inTitle ? 8 : 0) + (inTag ? 5 : 0) + (inCode ? 3 : 0) + (inText ? 1 : 0);
                hits++;
                if (!snippet) { snippet = snippetAround(e.text, e.low, w); }
                if (!snippet) {
                    for (var k = 0; k < e.code.length && !snippet; k++) { snippet = snippetAround(e.code[k].code, e.code[k].low, w); }
                }
            }
            for (var n = 0; n < q.not.length; n++) {
                if (e.low.indexOf(q.not[n]) >= 0 || e.title.indexOf(q.not[n]) >= 0) { return; }
            }
            if (!words.length && !snippet && e.text) { snippet = [e.text.replace(/\s+/g, ' ').slice(0, 90), '', '']; }
            out.push({ session: e.s, score: score * 1e13 + e.s.updated, snippet: snippet, hits: hits });
        });
        return out.sort(function (a, b) { return b.score - a.score; });
    }

    function searchSnippets(query, opts) {
        opts = opts || {};
        var q = parse(query);
        var idx = index || build();
        var words = q.terms.concat(q.phrases, q.code);
        var out = [];
        idx.forEach(function (e) {
            if (opts.tag && !hasTag(e, opts.tag)) { return; }
            if (q.tags.length && !q.tags.every(function (t) { return hasTag(e, t); })) { return; }
            e.code.forEach(function (b) {
                if (!b.code.trim()) { return; }
                if (q.lang && !(b.lang === q.lang || b.lang.indexOf(q.lang) === 0)) { return; }
                if (q.file && b.lname.indexOf(q.file) < 0) { return; }
                for (var i = 0; i < words.length; i++) {
                    if (b.low.indexOf(words[i]) < 0 && b.lname.indexOf(words[i]) < 0 && e.title.indexOf(words[i]) < 0) { return; }
                }
                for (var n = 0; n < q.not.length; n++) { if (b.low.indexOf(q.not[n]) >= 0) { return; } }
                var first = b.code.split('\n').filter(function (l) { return l.trim(); })[0] || '';
                out.push({ session: e.s, name: b.name, lang: b.lang, code: b.code, ord: b.ord, mi: b.mi, preview: first.trim().slice(0, 100), updated: e.s.updated });
            });
        });
        return out.sort(function (a, b) { return b.updated - a.updated; });
    }

    global.LenHistory = { invalidate: invalidate, searchSessions: searchSessions, searchSnippets: searchSnippets, parse: parse, _splitCode: splitCode };
})(window);

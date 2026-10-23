/*!
 * LenChat - docs.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
(function (global) {
    'use strict';

    var cfg = null;
    function init(config) { cfg = config; }

    var DOC_EXT = /\.(pdf|docx|xlsx|xlsm|xls)$/i;
    function isDoc(path) { return DOC_EXT.test(String(path || '')); }
    function extOf(path) { var m = String(path || '').toLowerCase().match(/\.(\w+)$/); return m ? m[1] : ''; }


    var loading = {};
    function lib(name) {
        var def = cfg && cfg.libs && cfg.libs[name];
        if (!def || !def.src) { return Promise.reject(new Error('Library "' + name + '" is not configured (config.php -> libs).')); }
        if (global[def.global]) { return Promise.resolve(global[def.global]); }
        if (loading[name]) { return loading[name]; }
        loading[name] = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = def.src;
            if (def.integrity) { s.integrity = def.integrity; s.crossOrigin = 'anonymous'; }
            s.onload = function () { global[def.global] ? resolve(global[def.global]) : reject(new Error(name + ' did not initialise.')); };
            s.onerror = function () {
                delete loading[name];
                reject(new Error('Could not load ' + name + ' (offline, blocked, or its CDN host is missing from the Content-Security-Policy).'));
            };
            document.head.appendChild(s);
        });
        return loading[name];
    }

    function buf(file) {
        if (file.arrayBuffer) { return file.arrayBuffer(); }
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { resolve(fr.result); };
            fr.onerror = function () { reject(fr.error); };
            fr.readAsArrayBuffer(file);
        });
    }


    var pdfWorkerReady = null;
    async function pdfjs() {
        var P = await lib('pdfjs');
        if (!pdfWorkerReady) {
            pdfWorkerReady = (async function () {
                try {
                    var r = await fetch(cfg.libs.pdfjs_worker.src);
                    if (!r.ok) { throw new Error('HTTP ' + r.status); }
                    P.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await r.text()], { type: 'text/javascript' }));
                } catch (e) {  }
            })();
        }
        await pdfWorkerReady;
        return P;
    }

    async function pdfText(file) {
        var P = await pdfjs();
        var doc = await P.getDocument({ data: new Uint8Array(await buf(file)) }).promise;
        var out = [], pages = Math.min(doc.numPages, 300);
        for (var i = 1; i <= pages; i++) {
            var page = await doc.getPage(i);
            var tc = await page.getTextContent();
            var line = '', lines = [];
            tc.items.forEach(function (it) {
                line += it.str;
                if (it.hasEOL) { lines.push(line); line = ''; } else if (it.str && !/\s$/.test(it.str)) { line += ' '; }
            });
            if (line) { lines.push(line); }
            var t = lines.join('\n').replace(/[ \t]+\n/g, '\n').trim();
            if (t) { out.push('--- page ' + i + ' ---\n' + t); }
        }
        if (doc.numPages > pages) { out.push('(' + (doc.numPages - pages) + ' more pages not read)'); }
        if (!out.length) { throw new Error('no selectable text (scanned PDF?). Attach a screenshot of the page instead so OCR can read it.'); }
        return out.join('\n\n');
    }

    async function docxText(file) {
        var M = await lib('mammoth');
        var r = await M.extractRawText({ arrayBuffer: await buf(file) });
        var t = String(r.value || '').trim();
        if (!t) { throw new Error('the document has no text.'); }
        return t;
    }

    async function xlsxText(file) {
        var X = await lib('sheetjs');
        var wb = X.read(await buf(file), { type: 'array' });
        var out = wb.SheetNames.map(function (n) {
            return '## Sheet: ' + n + '\n' + X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false }).trim();
        });
        return out.join('\n\n');
    }

    async function extractText(file, path) {
        var e = extOf(path || file.name);
        if (e === 'pdf') { return pdfText(file); }
        if (e === 'docx') { return docxText(file); }
        return xlsxText(file);
    }


    async function openZip(file) {
        var Z = await lib('jszip');
        var lim = (cfg && cfg.limits) || {};
        if (file.size > (lim.max_zip_bytes || 52428800)) { throw new Error('The archive is larger than ' + Math.round((lim.max_zip_bytes || 52428800) / 1048576) + ' MB.'); }
        var zip = await Z.loadAsync(file);
        var entries = [], total = 0, maxN = lim.max_zip_entries || 2000;
        zip.forEach(function (path, e) {
            if (e.dir || /(^|\/)__MACOSX\//.test(path)) { return; }
            var size = (e._data && e._data.uncompressedSize) || 0;
            total += size;
            if (entries.length < maxN) { entries.push({ path: path, size: size }); }
        });
        if (total > 400 * 1048576) { throw new Error('The archive expands to more than 400 MB, so it was not opened.'); }
        return { zip: zip, entries: entries };
    }

    async function zipEntryFile(zip, path) {
        var blob = await zip.file(path).async('blob');
        return new File([blob], path.split('/').pop(), { type: blob.type || '' });
    }


    var BINARY = /^(docx|xlsx|pdf)$/i;
    function isBinary(spec) { return !!spec && BINARY.test(String(spec.type || '')); }

    function escapeStringControls(t) {
        var out = '', inStr = false, esc = false;
        for (var i = 0; i < t.length; i++) {
            var ch = t.charAt(i);
            if (inStr) {
                if (esc) { out += ch; esc = false; continue; }
                if (ch === '\\') { out += ch; esc = true; continue; }
                if (ch === '"') { out += ch; inStr = false; continue; }
                if (ch === '\n') { out += '\\n'; continue; }
                if (ch === '\r') { out += '\\r'; continue; }
                if (ch === '\t') { out += '\\t'; continue; }
                out += ch;
            } else {
                if (ch === '"') { inStr = true; }
                out += ch;
            }
        }
        return out;
    }

    function unescapeLoose(s) {
        return s.replace(/\\(u[0-9a-fA-F]{4}|[\s\S])/g, function (_, e) {
            if (e.charAt(0) === 'u' && e.length === 5) { return String.fromCharCode(parseInt(e.slice(1), 16)); }
            return e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === 'b' ? '\b' : e === 'f' ? '\f' : e;
        });
    }

    function parseLoose(text) {
        var t = String(text || '').trim().replace(/^```[\w-]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        if (!t) { return null; }
        var o;
        try { o = JSON.parse(t); if (o && typeof o === 'object') { return o; } } catch (e) {  }
        try { o = JSON.parse(escapeStringControls(t)); if (o && typeof o === 'object') { return o; } } catch (e) {  }
        var ty = t.match(/"type"\s*:\s*"([^"\n]+)"/);
        var fn = t.match(/"filename"\s*:\s*"([^"\n]+)"/);
        var start = t.search(/"content"\s*:\s*"/);
        if (!ty || start < 0) { return null; }
        var from = t.indexOf('"', t.indexOf(':', start) + 1) + 1;
        var to = t.lastIndexOf('"');
        if (to <= from) { return null; }
        var body = t.slice(from, to);
        var tail = body.search(/",\s*"(?:type|filename)"\s*:/);
        if (tail >= 0) { body = body.slice(0, tail); }
        return { type: ty[1], filename: fn ? fn[1] : '', content: unescapeLoose(body) };
    }

    function parseSpec(text) {
        var s = parseLoose(text);
        return s && typeof s === 'object' && !Array.isArray(s) && typeof s.type === 'string' && s.type ? s : null;
    }

    function safeName(n, ext) {
        var base = String(n || 'document').replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[^\w.\- ]+/g, '').trim().slice(0, 60) || 'document';
        return base + '.' + ext;
    }

    function blocksOf(spec) {
        var out = [];
        if (spec.title) { out.push({ k: 'h', n: 1, t: String(spec.title) }); }
        var src = Array.isArray(spec.blocks) ? spec.blocks : String(spec.content || '').split(/\n{2,}/).map(function (p) { return { p: p }; });
        src.forEach(function (b) {
            if (typeof b === 'string') { out.push({ k: 'p', t: b }); }
            else if (b.h !== undefined) { out.push({ k: 'h', n: Math.min(3, Math.max(1, b.level || b.n || 2)), t: String(b.h) }); }
            else if (b.p !== undefined) { out.push({ k: 'p', t: String(b.p) }); }
            else if (Array.isArray(b.ul)) { b.ul.forEach(function (x) { out.push({ k: 'li', t: String(x), mark: '\u2022' }); }); }
            else if (Array.isArray(b.ol)) { b.ol.forEach(function (x, i) { out.push({ k: 'li', t: String(x), mark: (i + 1) + '.' }); }); }
            else if (Array.isArray(b.table)) { out.push({ k: 'tbl', rows: b.table.map(function (r) { return r.map(String); }) }); }
            else if (b.code !== undefined) { out.push({ k: 'code', t: String(b.code) }); }
        });
        return out;
    }

    function xml(s) {
        return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function makeDocx(spec) {
        var Z = await lib('jszip');
        function run(t, o) {
            o = o || {};
            return '<w:r><w:rPr>' + (o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') + (o.b ? '<w:b/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + xml(t) + '</w:t></w:r>';
        }
        function para(t, o) { return '<w:p>' + (o && o.ind ? '<w:pPr><w:ind w:left="' + o.ind + '" w:hanging="300"/></w:pPr>' : '') + run(t, o) + '</w:p>'; }
        var body = blocksOf(spec).map(function (b) {
            if (b.k === 'h') { return para(b.t, { b: 1, sz: b.n === 1 ? 36 : b.n === 2 ? 30 : 26 }); }
            if (b.k === 'li') { return para(b.mark + ' ' + b.t, { ind: 500 }); }
            if (b.k === 'code') { return b.t.split('\n').map(function (ln) { return para(ln, { mono: 1, sz: 19 }); }).join(''); }
            if (b.k === 'tbl') {
                var bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) { return '<w:' + s + ' w:val="single" w:sz="4" w:color="999999"/>'; }).join('');
                return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' + bd + '</w:tblBorders></w:tblPr>' +
                    b.rows.map(function (r, ri) {
                        return '<w:tr>' + r.map(function (c) { return '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>' + para(c, { b: ri === 0 }) + '</w:tc>'; }).join('') + '</w:tr>';
                    }).join('') + '</w:tbl><w:p/>';
            }
            return para(b.t);
        }).join('');
        var zip = new Z();
        zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>');
        return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }

    async function makeXlsx(spec) {
        var X = await lib('sheetjs');
        var wb = X.utils.book_new();
        var sheets = Array.isArray(spec.sheets) && spec.sheets.length ? spec.sheets : [{ name: 'Sheet1', rows: spec.rows || [] }];
        sheets.forEach(function (s, i) {
            var name = String(s.name || 'Sheet' + (i + 1)).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet' + (i + 1);
            X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(Array.isArray(s.rows) ? s.rows : []), name);
        });
        var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
        return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function makePdf(spec) {
        var W = 595, H = 842, M = 56, objs = [], pages = [], cur = null, y = 0;
        var MAP = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u2192': '->', '\u2190': '<-', '\u2713': 'v', '\u00A0': ' ', '\t': '    ' };
        function lat(s) { return String(s).replace(/[^\x20-\x7E\xA0-\xFF]/g, function (c) { return MAP[c] !== undefined ? MAP[c] : c === '\u2022' ? '\x95' : c === '\u2013' || c === '\u2014' ? '-' : '?'; }); }
        function esc(s) { return lat(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
        function newPage() { cur = []; pages.push(cur); y = H - M; }
        function wrap(t, size, width) {
            var max = Math.max(10, Math.floor(width / (size * 0.5))), out = [];
            String(t).split('\n').forEach(function (para) {
                var line = '';
                para.split(/\s+/).forEach(function (w) {
                    while (w.length > max) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, max)); w = w.slice(max); }
                    if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; } else { line = (line + ' ' + w).trim(); }
                });
                out.push(line);
            });
            return out;
        }
        function putCode(t) {
            var size = 8.5, max = Math.floor((W - 2 * M) / (size * 0.6));
            String(t).split('\n').forEach(function (ln) {
                for (var o = 0; o === 0 || o < ln.length; o += max) {
                    if (y - size < M) { newPage(); }
                    cur.push('BT /F3 ' + size + ' Tf ' + M + ' ' + Math.round(y - size) + ' Td (' + esc(ln.slice(o, o + max)) + ') Tj ET');
                    y -= size * 1.35;
                }
            });
            y -= 6;
        }
        function put(t, size, bold, indent) {
            wrap(t, size, W - 2 * M - (indent || 0)).forEach(function (ln) {
                if (y - size < M) { newPage(); }
                cur.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + (M + (indent || 0)) + ' ' + Math.round(y - size) + ' Td (' + esc(ln) + ') Tj ET');
                y -= size * 1.4;
            });
        }
        newPage();
        blocksOf(spec).forEach(function (b) {
            if (b.k === 'h') { y -= 6; put(b.t, b.n === 1 ? 20 : b.n === 2 ? 15 : 12.5, true); y -= 3; }
            else if (b.k === 'li') { put(b.mark + ' ' + b.t, 11, false, 14); }
            else if (b.k === 'tbl') { b.rows.forEach(function (r, i) { put(r.join('   |   '), 10, i === 0); }); y -= 6; }
            else if (b.k === 'code') { putCode(b.t); }
            else { put(b.t, 11, false); y -= 5; }
        });
        var kids = [], body = [];
        pages.forEach(function (ops, i) {
            var pid = 6 + i * 2, cid = pid + 1, stream = ops.join('\n');
            kids.push(pid + ' 0 R');
            body[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + cid + ' 0 R >>';
            body[cid] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
        });
        body[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        body[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>';
        body[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        body[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        body[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
        var out = '%PDF-1.4\n', offs = [];
        for (var i = 1; i < body.length; i++) { offs[i] = out.length; out += i + ' 0 obj\n' + body[i] + '\nendobj\n'; }
        var x = out.length;
        out += 'xref\n0 ' + body.length + '\n0000000000 65535 f \n';
        for (var j = 1; j < body.length; j++) { out += ('0000000000' + offs[j]).slice(-10) + ' 00000 n \n'; }
        out += 'trailer\n<< /Size ' + body.length + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF';
        var bytes = new Uint8Array(out.length);
        for (var k = 0; k < out.length; k++) { bytes[k] = out.charCodeAt(k) & 255; }
        return new Blob([bytes], { type: 'application/pdf' });
    }


    var TYPE_EXT = {
        javascript: 'js', js: 'js', mjs: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py', bash: 'sh', sh: 'sh',
        shell: 'sh', powershell: 'ps1', markdown: 'md', md: 'md', html: 'html', htm: 'html', svg: 'svg', xml: 'xml', json: 'json', css: 'css',
        scss: 'scss', less: 'less', php: 'php', sql: 'sql', yaml: 'yml', yml: 'yml', toml: 'toml', ini: 'ini', java: 'java', kotlin: 'kt',
        swift: 'swift', go: 'go', rust: 'rs', rs: 'rs', ruby: 'rb', rb: 'rb', c: 'c', cpp: 'cpp', csharp: 'cs', cs: 'cs', csv: 'csv',
        txt: 'txt', text: 'txt', vue: 'vue', svelte: 'svelte', dart: 'dart', env: 'env'
    };
    var EXT_MIME = {
        html: 'text/html', svg: 'image/svg+xml', json: 'application/json', css: 'text/css', js: 'text/javascript', jsx: 'text/javascript',
        xml: 'application/xml', md: 'text/markdown', csv: 'text/csv', yml: 'text/yaml', sh: 'text/x-shellscript'
    };

    function textName(spec) {
        var t = String(spec.type || 'txt').toLowerCase().replace(/^\./, '');
        var ext = TYPE_EXT[t] || (/^[a-z0-9]{1,8}$/.test(t) ? t : 'txt');
        var fn = String(spec.filename || '').replace(/\\/g, '/').split('/').filter(function (p) { return p && p !== '.' && p !== '..'; }).pop() || '';
        fn = fn.replace(/[^\w.\-@+ ]/g, '_').slice(0, 80);
        if (!fn) { return 'file.' + ext; }
        return /\.[A-Za-z0-9]{1,8}$/.test(fn) ? fn : fn + '.' + ext;
    }
    function textBody(spec) {
        var d = spec.content !== undefined ? spec.content : spec.data;
        if (typeof d === 'string') { return d; }
        if (d === undefined || d === null) { return ''; }
        return JSON.stringify(d, null, 2);
    }

    async function generate(spec) {
        var t = String(spec.type || '').toLowerCase();
        if (t === 'docx') { return { blob: await makeDocx(spec), name: safeName(spec.filename, 'docx') }; }
        if (t === 'xlsx') { return { blob: await makeXlsx(spec), name: safeName(spec.filename, 'xlsx') }; }
        if (t === 'pdf') { return { blob: makePdf(spec), name: safeName(spec.filename, 'pdf') }; }
        var name = textName(spec);
        var ext = (name.match(/\.([A-Za-z0-9]+)$/) || [])[1] || 'txt';
        return { blob: new Blob([textBody(spec)], { type: (EXT_MIME[ext.toLowerCase()] || 'text/plain') + ';charset=utf-8' }), name: name };
    }


    function stripInline(t) {
        return String(t).replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, '$1$2').replace(/`([^`]+)`/g, '$1');
    }

    function fromMarkdown(md, title) {
        var lines = String(md || '').replace(/\r\n/g, '\n').split('\n'), blocks = [], para = [], i = 0, m;
        function flush() { if (para.length) { blocks.push({ p: stripInline(para.join(' ')) }); para = []; } }
        while (i < lines.length) {
            var ln = lines[i];
            if ((m = ln.match(/^\s*(`{3,}|~{3,})/))) {
                flush();
                var fence = m[1], code = [];
                i++;
                while (i < lines.length && !(lines[i].trim().indexOf(fence.charAt(0).repeat(fence.length)) === 0 && /^[`~]+\s*$/.test(lines[i].trim()))) { code.push(lines[i]); i++; }
                i++;
                blocks.push({ code: code.join('\n') });
                continue;
            }
            if (/^\s*$/.test(ln)) { flush(); i++; continue; }
            if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { flush(); blocks.push({ h: stripInline(m[2]), level: Math.min(3, m[1].length) }); i++; continue; }
            if (/^\s*\|.*\|\s*$/.test(ln)) {
                flush();
                var rows = [];
                while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
                    if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i])) { rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return stripInline(c.trim()); })); }
                    i++;
                }
                blocks.push({ table: rows });
                continue;
            }
            if (/^\s*[-*+]\s+/.test(ln)) {
                flush();
                var ul = [];
                while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { ul.push(stripInline(lines[i].replace(/^\s*[-*+]\s+/, ''))); i++; }
                blocks.push({ ul: ul });
                continue;
            }
            if (/^\s*\d+[.)]\s+/.test(ln)) {
                flush();
                var ol = [];
                while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { ol.push(stripInline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))); i++; }
                blocks.push({ ol: ol });
                continue;
            }
            para.push(ln.trim());
            i++;
        }
        flush();
        return { title: title || '', blocks: blocks };
    }

    function h(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    var PAGE_CSS = 'body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1a1f2e}' +
        'pre{background:#f6f7fb;border:1px solid #d9dce8;border-radius:8px;padding:12px;overflow:auto;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}' +
        'code{font-family:ui-monospace,Menlo,Consolas,monospace}table{border-collapse:collapse}td,th{border:1px solid #d9dce8;padding:4px 10px}' +
        '.tk-com{color:#8a93a8;font-style:italic}.tk-str{color:#2f8a3a}.tk-kw{color:#8a3fc2}.tk-num{color:#b4590d}.tk-fn{color:#2457c5}' +
        '.tk-var{color:#c23a5a}.tk-key{color:#0f7f89}.tk-tag{color:#c23a5a}.tk-attr{color:#946200}.tk-at{color:#8a3fc2}';

    function htmlPage(spec, hl) {
        var out = [];
        blocksOf(spec).forEach(function (b) {
            if (b.k === 'h') { out.push('<h' + b.n + '>' + h(b.t) + '</h' + b.n + '>'); }
            else if (b.k === 'li') { out.push('<p>' + h(b.mark) + ' ' + h(b.t) + '</p>'); }
            else if (b.k === 'tbl') { out.push('<table>' + b.rows.map(function (r, ri) { return '<tr>' + r.map(function (c) { return '<' + (ri ? 'td' : 'th') + '>' + h(c) + '</' + (ri ? 'td' : 'th') + '>'; }).join('') + '</tr>'; }).join('') + '</table>'); }
            else if (b.k === 'code') { out.push('<pre><code>' + (hl ? hl(b.t) : h(b.t)) + '</code></pre>'); }
            else { out.push('<p>' + h(b.t) + '</p>'); }
        });
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
            h(spec.title || 'LenChat export') + '</title><style>' + PAGE_CSS + '</style></head><body>' + out.join('\n') + '</body></html>';
    }

    function codePage(title, highlightedHtml) {
        return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
            h(title) + '</title><style>' + PAGE_CSS + '</style></head><body><h3>' + h(title) + '</h3><pre><code>' + highlightedHtml + '</code></pre></body></html>';
    }


    var RULE = 'When generating multiple files or code snippets simultaneously in a single prompt, you MUST wrap EACH file in its own separate and independent ```lendoc block. \n\n' +
        'For every file, use the exact format:\n' +
        '```lendoc [file_type] [filename]\n' +
        '{\n' +
        '  "type": "[file_type]",\n' +
        '  "filename": "[filename]",\n' +
        '  "content": "[raw code or markup]"\n' +
        '}\n' +
        '```';

    var HINT = 'Technical notes for the lendoc format: the body of each block is ONE JSON object, so inside "content" every newline must be written as \\n, ' +
        'every double quote as \\" and every backslash as \\\\ (the app turns it back into the real file, with a Download button and a live preview for web code). ' +
        'Use "type" = the file\'s language or extension (html, css, js, php, json, md, svg, py ...) and put the complete file text in "content". ' +
        'Binary documents use the same block with these shapes: ' +
        '{"type":"docx"|"pdf","filename":"name","title":"...","blocks":[{"h":"Heading","level":2},{"p":"Paragraph"},{"ul":["a","b"]},{"ol":["a","b"]},{"table":[["Col A","Col B"],["1","2"]]}]} ; ' +
        '{"type":"xlsx","filename":"name","sheets":[{"name":"Sheet1","rows":[["Header","Header"],["value",1]]}]}. ' +
        'Use one lendoc block per file; never put two files in one block and never repeat a file inside a second block.';

    function skillPrompt() { return RULE + '\n\n' + HINT; }

    global.LenDocs = {
        init: init, isDoc: isDoc, extractText: extractText, openZip: openZip, zipEntryFile: zipEntryFile,
        generate: generate, parseSpec: parseSpec, parseLoose: parseLoose, isBinary: isBinary, textName: textName, textBody: textBody,
        fromMarkdown: fromMarkdown, htmlPage: htmlPage, codePage: codePage, RULE: RULE, HINT: HINT, skillPrompt: skillPrompt
    };
})(window);
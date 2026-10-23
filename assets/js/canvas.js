/*!
 * LenChat - canvas.js  
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
(function (global) {
    'use strict';

    var EXT = {
        javascript: 'js', js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py',
        bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', powershell: 'ps1', ps1: 'ps1', markdown: 'md', md: 'md', mdx: 'md',
        html: 'html', htm: 'html', xhtml: 'html', svg: 'svg', xml: 'xml', json: 'json', jsonc: 'json', css: 'css', scss: 'scss',
        sass: 'sass', less: 'less', php: 'php', sql: 'sql', yaml: 'yml', yml: 'yml', toml: 'toml', ini: 'ini', java: 'java',
        kotlin: 'kt', swift: 'swift', go: 'go', rust: 'rs', rs: 'rs', ruby: 'rb', rb: 'rb', c: 'c', cpp: 'cpp', 'c++': 'cpp',
        csharp: 'cs', cs: 'cs', dart: 'dart', vue: 'vue', svelte: 'svelte', twig: 'twig', csv: 'csv', text: 'txt', txt: 'txt', '': 'txt'
    };
    var LANG_BY_EXT = {
        js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', py: 'python', sh: 'bash',
        ps1: 'powershell', md: 'markdown', html: 'html', htm: 'html', svg: 'svg', xml: 'xml', json: 'json', css: 'css', scss: 'scss',
        sass: 'sass', less: 'less', php: 'php', sql: 'sql', yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', java: 'java',
        kt: 'kotlin', swift: 'swift', go: 'go', rs: 'rust', rb: 'ruby', c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp', dart: 'dart',
        vue: 'vue', svelte: 'svelte', twig: 'twig', csv: 'csv', txt: 'text'
    };
    var MIME = {
        html: 'text/html', svg: 'image/svg+xml', json: 'application/json', css: 'text/css', js: 'text/javascript', jsx: 'text/javascript',
        xml: 'application/xml', md: 'text/markdown', csv: 'text/csv', yml: 'text/yaml', sh: 'text/x-shellscript'
    };

    var FILE_RE = /^[\w@.+\-\/\\]*[\w\-]\.[A-Za-z][A-Za-z0-9]{0,7}$/;

    function norm(lang) { return String(lang || '').toLowerCase().trim(); }
    function extOf(name) { var m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/); return m ? m[1] : ''; }
    function canonExt(e) { return e === 'htm' ? 'html' : e === 'yaml' ? 'yml' : e; }
    function base(name) { return String(name || '').split('/').pop(); }

    function safePath(n) {
        return String(n || '').replace(/\\/g, '/').replace(/^[a-z]:/i, '').split('/')
            .filter(function (p) { return p && p !== '.' && p !== '..'; }).join('/')
            .replace(/[^\w.\-\/@+ ]/g, '_').slice(0, 160);
    }

    function compatible(lang, name) {
        var l = norm(lang), e = canonExt(extOf(name));
        if (!e) { return false; }
        if (!l || l === 'text' || l === 'txt') { return !!LANG_BY_EXT[e] || !!MIME[e]; }
        return canonExt(EXT[l] || l) === e;
    }

    function langOf(lang, name) {
        var l = norm(lang);
        if (l && l !== 'text' && l !== 'txt') { return l; }
        return LANG_BY_EXT[extOf(name)] || l;
    }


    function parseInfo(info) {
        var s = String(info || '').trim().replace(/^\{\s*\.?/, '').replace(/\}\s*$/, '').trim();
        var lang = '', name = '', rest = '';
        var m = s.match(/^(\S+)\s*([\s\S]*)$/);
        if (m) {
            var first = m[1];
            rest = m[2];
            var c = first.indexOf(':');
            if (c > 0 && c < first.length - 1 && !/^[a-z]+:\/\//i.test(first)) { rest = first.slice(c + 1) + ' ' + rest; first = first.slice(0, c); }
            first = first.replace(/^\./, '');
            if (FILE_RE.test(first) && LANG_BY_EXT[extOf(first)] && !Object.prototype.hasOwnProperty.call(EXT, norm(first))) {
                name = first;
            } else {
                lang = norm(first);
            }
        }
        if (!name && rest) {
            var kv = rest.match(/(?:title|file(?:name)?|path|name)\s*[=:]\s*(?:"([^"]+)"|'([^']+)'|(\S+))/i);
            if (kv) {
                name = kv[1] || kv[2] || kv[3];
            } else {
                var bare = rest.split(/\s+/).map(function (x) { return x.replace(/^["'`]+|["'`]+$/g, ''); }).filter(function (x) { return FILE_RE.test(x); });
                if (bare.length) { name = bare[0]; }
            }
        }
        name = safePath(name);
        if (name && !lang) { lang = LANG_BY_EXT[extOf(name)] || ''; }
        return { lang: lang, name: name };
    }

    function nameFromLabel(line, lang) {
        var s = String(line || '').replace(/\bhttps?:\/\/\S+/gi, ' ');
        if (!s.trim() || s.length > 160) { return ''; }
        var re = /(?:^|[\s`*_#(\[:>])([\w@][\w@.+\-\/]*\.[A-Za-z][A-Za-z0-9]{0,7})(?=$|[\s`*_)\]:,;.!?])/g, m, found = '';
        while ((m = re.exec(s))) { if (compatible(lang, m[1])) { found = m[1]; } }
        return safePath(found);
    }

    function nameFromComment(code, lang) {
        var lines = String(code || '').split('\n', 4);
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (!ln.trim() || /^\s*(?:<\?php|<\?xml|#!|<!doctype)/i.test(ln)) { continue; }
            var m = ln.match(/^\s*(?:\/\/|#|--|\/\*+|<!--)\s*(?:file(?:name)?|path)\s*[:=]\s*([^\s*>]+)\s*(?:\*\/|-->)?\s*$/i) ||
                    ln.match(/^\s*(?:\/\/|#|\/\*+|<!--)\s*([\w@.+\-\/]+\.[A-Za-z][A-Za-z0-9]{0,7})\s*(?:\*\/|-->)?\s*$/);
            if (m && compatible(lang, m[1])) { return safePath(m[1]); }
            break;
        }
        return '';
    }


    function fileName(lang, name) {
        var ext = EXT[norm(lang)] || 'txt';
        if (name) {
            var b = base(safePath(name)) || 'snippet';
            return /\.[A-Za-z0-9]{1,8}$/.test(b) ? b : b + '.' + ext;
        }
        return 'snippet.' + ext;
    }
    function mimeFor(lang, name) {
        var e = name ? canonExt(extOf(name)) : (EXT[norm(lang)] || 'txt');
        return (MIME[e] || 'text/plain') + ';charset=utf-8';
    }


    function previewKind(lang, code, name) {
        var l = langOf(lang, name), c = String(code || '');
        if (!c.trim()) { return ''; }
        var generic = (l === '' || l === 'text' || l === 'xml');
        if (l === 'svg' || (generic && /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(c))) { return 'svg'; }
        if (/^(?:html?|xhtml)$/.test(l) || (generic && /^\s*(?:<!doctype html|<html[\s>]|<body[\s>])/i.test(c))) { return 'html'; }
        if (/^(?:js|javascript|mjs|jsx)$/.test(l) &&
            /customElements\.define|HTMLElement|document\.(?:getElementById|querySelector|body|createElement|write)|<canvas|getContext\(|requestAnimationFrame/.test(c)) {
            return 'js';
        }
        return '';
    }

    var HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';

    var HEAL = '<script>(function(){var n=0,m=0;function r(t,x,s){if(n++>5){return}try{parent.postMessage({lenHeal:1,type:t,message:String(x||"").slice(0,800),stack:String(s||"").slice(0,1200)},"*")}catch(e){}}' +
        'function L(l,a){if(m++>200){return}try{parent.postMessage({lenLog:1,level:l,text:[].map.call(a,function(v){try{return typeof v==="object"?JSON.stringify(v):String(v)}catch(e){return String(v)}}).join(" ").slice(0,600)},"*")}catch(e){}}' +
        'window.addEventListener("error",function(e){if(e.target&&e.target!==window){return}r("error",e.message+(e.lineno?" (line "+e.lineno+")":""),e.error&&e.error.stack)});' +
        'window.addEventListener("unhandledrejection",function(e){var x=e.reason;r("promise",x&&x.message||x,x&&x.stack)});' +
        '["log","info","warn"].forEach(function(k){var o=console[k];console[k]=function(){L(k,arguments);o.apply(console,arguments)}});' +
        'var ce=console.error;console.error=function(){r("console",[].map.call(arguments,String).join(" "));L("error",arguments);ce.apply(console,arguments)}})();</scr' + 'ipt>';

    function needsHeal(kind, code) {
        if (kind === 'js') { return true; }
        return kind === 'html' && /<script[\s>]|\bon[a-z]+\s*=/i.test(code);
    }

    function withHeal(doc) {
        if (/<head[^>]*>/i.test(doc)) { return doc.replace(/<head[^>]*>/i, function (m) { return m + HEAL; }); }
        if (/<html[^>]*>/i.test(doc)) { return doc.replace(/<html[^>]*>/i, function (m) { return m + HEAL; }); }
        return HEAL + doc;
    }


    function resolve(files, ref) {
        if (!files || !ref || /^(?:[a-z][a-z0-9+.\-]*:|\/\/|#)/i.test(ref)) { return null; }
        var p = ref.split(/[?#]/)[0].replace(/^(?:\.\/)+/, '').replace(/^\/+/, '');
        if (Object.prototype.hasOwnProperty.call(files, p)) { return { name: p, text: files[p] }; }
        var b = base(p);
        for (var k in files) {
            if (Object.prototype.hasOwnProperty.call(files, k) && base(k) === b) { return { name: k, text: files[k] }; }
        }
        return null;
    }

    function attr(tag, name) {
        var m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
        return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : '';
    }

    function inlineAssets(html, files) {
        if (!files) { return html; }
        var used = {};
        html = html.replace(/<link\b[^>]*>/gi, function (tag) {
            if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) { return tag; }
            var f = resolve(files, attr(tag, 'href'));
            if (f) { used[f.name] = 1; }
            return f ? '<style data-src="' + f.name.replace(/"/g, '') + '">' + f.text.replace(/<\/style/gi, '<\\/style') + '</style>' : tag;
        });
        html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')([^>]*)>\s*<\/script>/gi, function (all, a, d, s, b) {
            var f = resolve(files, d || s);
            if (f) { used[f.name] = 1; }
            return f ? '<script' + (a + b).replace(/\s+$/, '') + ' data-src="' + f.name.replace(/"/g, '') + '">' + f.text.replace(/<\/script/gi, '<\\/script') + '</scr' + 'ipt>' : all;
        });
        html = html.replace(/(<img\b[^>]*?\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, function (all, pre, d, s) {
            var f = resolve(files, d || s);
            return f && /\.svg$/i.test(f.name) ? pre + '"data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.text) + '"' : all;
        });
        return injectOrphans(html, files, used);
    }

    function injectOrphans(html, files, used) {
        var css = '', js = '';
        Object.keys(files).forEach(function (n) {
            if (used[n]) { return; }
            var e = canonExt(extOf(n));
            if (e === 'css') { css += '<style data-src="' + n.replace(/"/g, '') + '">' + files[n].replace(/<\/style/gi, '<\\/style') + '</style>'; }
            else if ((e === 'js' || e === 'mjs') && /document\.|window\.|addEventListener|querySelector|getElementById/.test(files[n]) && !/\brequire\(|\bprocess\.env|module\.exports/.test(files[n])) {
                js += '<script data-src="' + n.replace(/"/g, '') + '">' + files[n].replace(/<\/script/gi, '<\\/script') + '</scr' + 'ipt>';
            }
        });
        if (css) { html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, function (m) { return css + m; }) : css + html; }
        if (js) { html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, function (m) { return js + m; }) : html + js; }
        return html;
    }

    function previewDoc(kind, code, opts) {
        opts = opts || {};
        var d = previewDoc0(kind, code, opts.files);
        return (opts.heal && needsHeal(kind, String(code || ''))) ? withHeal(d) : d;
    }

    function previewDoc0(kind, code, files) {
        code = String(code || '');
        if (kind === 'svg') {
            return '<!doctype html><html><head>' + HEAD + '<style>html,body{margin:0;height:100%;background:#fff}' +
                'body{display:grid;place-items:center}svg{max-width:100%;max-height:100vh;height:auto}</style></head><body>' +
                code + '</body></html>';
        }
        if (kind === 'js') {
            var tags = [], re = /customElements\.define\(\s*['"]([a-z][\w.-]*-[\w.-]*)['"]/g, m;
            while ((m = re.exec(code))) { if (tags.indexOf(m[1]) < 0) { tags.push(m[1]); } }
            var inst = tags.map(function (t) { return '<' + t + '></' + t + '>'; }).join('');
            var mod = /^\s*(?:import|export)\s/m.test(code);
            return '<!doctype html><html><head>' + HEAD + '<style>body{font-family:system-ui,sans-serif;margin:12px}</style></head><body>' +
                '<div id="app"></div>' + inst + '<script' + (mod ? ' type="module"' : '') + '>' +
                code.replace(/<\/script/gi, '<\\/script') + '</scr' + 'ipt></body></html>';
        }
        var doc = code;
        if (!/<html[\s>]/i.test(doc) && !/^\s*<!doctype/i.test(doc)) {
            doc = '<!doctype html><html><head>' + HEAD + '</head><body>' + doc + '</body></html>';
        }
        return inlineAssets(doc, files);
    }


    function collectFiles(root) {
        var map = {}, order = [];
        Array.prototype.forEach.call(root.querySelectorAll('.code[data-name]:not(.streaming)'), function (c) {
            var n = c.getAttribute('data-name');
            var pre = c.querySelector('pre code');
            if (!n || !pre) { return; }
            if (!Object.prototype.hasOwnProperty.call(map, n)) { order.push(n); }
            map[n] = pre.textContent;
        });
        return order.map(function (n) { return { name: n, text: map[n] }; });
    }
    function fileMap(root) {
        var o = {};
        if (root) { collectFiles(root).forEach(function (f) { o[f.name] = f.text; }); }
        return o;
    }


    var CRC = null;
    function crc32(bytes) {
        if (!CRC) {
            CRC = new Uint32Array(256);
            for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } CRC[n] = c >>> 0; }
        }
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) { crc = CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zip(files) {
        var enc = new TextEncoder(), parts = [], central = [], offset = 0, now = new Date();
        var dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        var dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        files.forEach(function (f) {
            var nb = enc.encode(safePath(f.name) || 'file.txt'), db = enc.encode(String(f.text)), crc = crc32(db);
            var h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
            h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true);
            h.setUint32(18, db.length, true); h.setUint32(22, db.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
            parts.push(h.buffer, nb, db);
            var c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
            c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true);
            c.setUint32(20, db.length, true); c.setUint32(24, db.length, true); c.setUint16(28, nb.length, true);
            c.setUint32(42, offset, true);
            central.push(c.buffer, nb);
            offset += 30 + nb.length + db.length;
        });
        var size = central.reduce(function (n, p) { return n + p.byteLength; }, 0);
        var e = new DataView(new ArrayBuffer(22));
        e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
        e.setUint32(12, size, true); e.setUint32(16, offset, true);
        return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
    }

    global.LenCanvas = {
        needsHeal: needsHeal, previewKind: previewKind, previewDoc: previewDoc, fileName: fileName, mimeFor: mimeFor,
        parseInfo: parseInfo, nameFromLabel: nameFromLabel, nameFromComment: nameFromComment, langOf: langOf, safePath: safePath,
        collectFiles: collectFiles, fileMap: fileMap, zip: zip
    };
})(window);

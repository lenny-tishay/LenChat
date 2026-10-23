/*!
 * LenChat - reader.js
 *
 * Client-side file ingestion. Nothing here touches the network.
 */
(function (global) {
    'use strict';


    var TEXT_EXT = new Set((
        'php phtml inc js mjs cjs jsx ts tsx vue svelte astro css scss sass less html htm xhtml twig blade ' +
        'json jsonc json5 xml svg yml yaml toml ini conf cfg env md mdx markdown txt rst csv tsv sql graphql ' +
        'py rb go rs java kt kts swift c h cpp hpp cc cs lua pl r dart sh bash zsh bat ps1 gradle properties ' +
        'htaccess gitignore gitattributes editorconfig dockerignore lock log tf pdf docx xlsx xlsm xls'
    ).split(' '));

    var TEXT_NAMES = new Set([
        'dockerfile', 'makefile', 'procfile', 'readme', 'license', 'changelog', 'composer.json',
        '.htaccess', '.env', '.env.example', '.gitignore', '.editorconfig', '.eslintrc', '.prettierrc'
    ]);

    var IGNORE_DIRS = new Set([
        'node_modules', '.git', '.svn', '.hg', 'vendor', 'dist', 'build', '.next', '.nuxt', '.cache',
        '__pycache__', '.idea', '.vscode', 'coverage', '.parcel-cache', 'storage/framework', 'bower_components'
    ]);

    var IGNORE_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|\.DS_Store|Thumbs\.db)$|\.min\.(js|css)$|\.map$/i;

    var LANG = {
        js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
        php: 'php', phtml: 'php', inc: 'php', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
        html: 'html', htm: 'html', twig: 'twig', json: 'json', jsonc: 'json', xml: 'xml', svg: 'xml',
        yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', md: 'markdown', mdx: 'markdown', sql: 'sql',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
        c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', lua: 'lua', sh: 'bash', bash: 'bash',
        zsh: 'bash', bat: 'bat', ps1: 'powershell', vue: 'vue', svelte: 'svelte', dart: 'dart', tf: 'hcl'
    };

    function extOf(path) {
        var name = path.split('/').pop().toLowerCase();
        var i = name.lastIndexOf('.');
        return i > 0 ? name.slice(i + 1) : (i === 0 ? name.slice(1) : '');
    }

    function isReadable(path) {
        var name = path.split('/').pop().toLowerCase();
        return TEXT_NAMES.has(name) || TEXT_EXT.has(extOf(path));
    }


    function entryFile(entry) {
        return new Promise(function (resolve, reject) { entry.file(resolve, reject); });
    }

    async function readAllEntries(dirEntry) {
        var reader = dirEntry.createReader();
        var all = [];
        for (;;) {
            var batch = await new Promise(function (resolve, reject) { reader.readEntries(resolve, reject); });
            if (!batch.length) { break; }
            all = all.concat(Array.prototype.slice.call(batch));
        }
        return all;
    }

    async function walk(entry, prefix, out, skipped, maxFiles) {
        if (out.length >= maxFiles) { return; }
        if (entry.isFile) {
            try {
                out.push({ file: await entryFile(entry), path: prefix + entry.name });
            } catch (e) {
                skipped.push({ path: prefix + entry.name, reason: 'unreadable' });
            }
        } else if (entry.isDirectory) {
            if (IGNORE_DIRS.has(entry.name)) {
                skipped.push({ path: prefix + entry.name + '/', reason: 'ignored folder' });
                return;
            }
            var kids = await readAllEntries(entry);
            for (var i = 0; i < kids.length; i++) {
                await walk(kids[i], prefix + entry.name + '/', out, skipped, maxFiles);
            }
        }
    }

    async function collectFromDataTransfer(dt, limits) {
        var maxFiles = (limits && limits.max_files) || 300;
        var entries = [];
        var plain = [];
        var items = dt.items ? Array.prototype.slice.call(dt.items) : [];

        items.forEach(function (it) {
            if (it.kind !== 'file') { return; }
            var entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
            if (entry) { entries.push(entry); } else if (it.getAsFile) { plain.push(it.getAsFile()); }
        });
        if (!items.length && dt.files) {
            plain = Array.prototype.slice.call(dt.files);
        }

        var out = [];
        var skipped = [];
        for (var i = 0; i < entries.length; i++) {
            await walk(entries[i], '', out, skipped, maxFiles);
        }
        plain.forEach(function (f) { if (f) { out.push({ file: f, path: f.name }); } });
        return { candidates: out, skipped: skipped };
    }

    function collectFromFileList(list, limits) {
        var maxFiles = (limits && limits.max_files) || 300;
        var out = [];
        var skipped = [];
        Array.prototype.slice.call(list).forEach(function (f) {
            var path = f.webkitRelativePath || f.name;
            var parts = path.split('/');
            var blocked = parts.slice(0, -1).some(function (p) { return IGNORE_DIRS.has(p); });
            if (blocked) { skipped.push({ path: path, reason: 'ignored folder' }); return; }
            if (out.length < maxFiles) { out.push({ file: f, path: path }); }
        });
        return { candidates: out, skipped: skipped };
    }


    function readText(file) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { resolve(String(fr.result)); };
            fr.onerror = function () { reject(fr.error); };
            fr.readAsText(file);
        });
    }

    function looksBinary(text) {
        if (text.indexOf('\u0000') !== -1) { return true; }
        var sample = text.slice(0, 4000);
        var bad = (sample.match(/\uFFFD/g) || []).length;
        return sample.length > 0 && bad / sample.length > 0.02;
    }

    async function read(candidates, skippedIn, limits, usedChars) {
        var maxBytes = (limits && limits.max_file_bytes) || 262144;
        var maxTotal = (limits && limits.max_total_chars) || 600000;
        var total = usedChars || 0;
        var files = [];
        var skipped = (skippedIn || []).slice();

        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (IGNORE_FILE.test(c.path)) { skipped.push({ path: c.path, reason: 'lock/minified/map file' }); continue; }
            if (!isReadable(c.path)) { skipped.push({ path: c.path, reason: 'not a text/source type' }); continue; }
            var isDoc = !!(global.LenDocs && global.LenDocs.isDoc(c.path));
            var cap = isDoc ? ((limits && limits.max_doc_bytes) || 15728640) : maxBytes;
            if (c.file.size > cap) { skipped.push({ path: c.path, reason: 'larger than ' + Math.round(cap / 1024) + ' KB' }); continue; }

            var text;
            try { text = isDoc ? await global.LenDocs.extractText(c.file, c.path) : await readText(c.file); }
            catch (e) { skipped.push({ path: c.path, reason: isDoc ? ((e && e.message) || 'unreadable document') : 'unreadable' }); continue; }
            if (!isDoc && looksBinary(text)) { skipped.push({ path: c.path, reason: 'binary content' }); continue; }
            if (total + text.length > maxTotal) { skipped.push({ path: c.path, reason: 'over total size budget' }); continue; }

            total += text.length;
            files.push({
                path: c.path,
                size: c.file.size,
                lang: LANG[extOf(c.path)] || '',
                content: text.replace(/\r\n/g, '\n')
            });
        }
        return { files: files, skipped: skipped };
    }

    function merge(existing, incoming) {
        var map = new Map();
        existing.concat(incoming).forEach(function (f) { map.set(f.path, f); });
        return Array.from(map.values()).sort(function (a, b) { return a.path.localeCompare(b.path); });
    }

    function totalChars(files) {
        return files.reduce(function (n, f) { return n + f.content.length; }, 0);
    }

    function approxTokens(chars) {
        return Math.ceil(chars / 4);
    }

    function formatTokens(n) {
        return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
    }


    function buildTree(files) {
        var root = {};
        files.forEach(function (f) {
            var node = root;
            f.path.split('/').forEach(function (part) { node = node[part] = node[part] || {}; });
        });
        var lines = [];
        (function render(node, prefix) {
            var names = Object.keys(node).sort(function (a, b) {
                var da = Object.keys(node[a]).length > 0, db = Object.keys(node[b]).length > 0;
                return da === db ? a.localeCompare(b) : (da ? -1 : 1);
            });
            names.forEach(function (name, i) {
                var last = i === names.length - 1;
                var isDir = Object.keys(node[name]).length > 0;
                lines.push(prefix + (last ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ') + name + (isDir ? '/' : ''));
                if (isDir) { render(node[name], prefix + (last ? '    ' : '\u2502   ')); }
            });
        })(root, '');
        return lines.join('\n');
    }

    function fenceFor(content) {
        var longest = 0;
        (content.match(/`+/g) || []).forEach(function (run) { longest = Math.max(longest, run.length); });
        return new Array(Math.max(3, longest + 1) + 1).join('`');
    }

    function buildBundle(files) {
        if (!files.length) { return ''; }
        var chars = totalChars(files);
        var out = [];
        out.push('## Attached project files');
        out.push(files.length + ' file' + (files.length === 1 ? '' : 's') + ', about ' + formatTokens(approxTokens(chars)) + ' tokens.');
        out.push('');
        out.push('### File tree');
        out.push('```text\n' + buildTree(files) + '\n```');
        files.forEach(function (f) {
            var fence = fenceFor(f.content);
            out.push('');
            out.push('### `' + f.path + '`');
            out.push(fence + f.lang + '\n' + f.content.replace(/\n$/, '') + '\n' + fence);
        });
        return out.join('\n');
    }

    function zipDefault(path, size, limits) {
        var parts = path.split('/');
        if (parts.slice(0, -1).some(function (p) { return IGNORE_DIRS.has(p); })) { return false; }
        if (IGNORE_FILE.test(path) || !isReadable(path)) { return false; }
        var cap = (global.LenDocs && global.LenDocs.isDoc(path)) ? ((limits && limits.max_doc_bytes) || 15728640) : ((limits && limits.max_file_bytes) || 262144);
        return !size || size <= cap;
    }

    global.LenReader = {
        isReadable: isReadable,
        zipDefault: zipDefault,
        collectFromDataTransfer: collectFromDataTransfer,
        collectFromFileList: collectFromFileList,
        read: read,
        merge: merge,
        totalChars: totalChars,
        approxTokens: approxTokens,
        formatTokens: formatTokens,
        buildTree: buildTree,
        buildBundle: buildBundle
    };
})(window);
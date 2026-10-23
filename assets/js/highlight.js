/*!
 * LenChat - highlight.js
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
(function (global) {
    'use strict';

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function kw(list) { return new RegExp('\\b(?:' + list + ')\\b'); }

    var KW_C = 'abstract|as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|final|finally|for|foreach|function|if|implements|import|in|instanceof|interface|let|namespace|new|null|of|package|private|protected|public|readonly|return|static|struct|super|switch|this|throw|throws|true|try|type|typeof|use|using|var|void|while|with|yield|fn|func|go|impl|mut|pub|match|mod|trait|echo|fun|val|from|int|string|bool|boolean|float|double|char|long|short|self|undefined|array|isset|empty|require|include|declare|unset';
    var KW_PY = 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield|self|print|end|do|then|module|require|unless|puts|begin|rescue|ensure|elsif';
    var KW_SH = 'if|then|else|elif|fi|for|while|do|done|case|esac|function|in|echo|export|local|return|cd|sudo|npm|git|composer|php|node|set|source|alias|exit|read';
    var KW_SQL = 'select|from|where|and|or|not|insert|into|values|update|set|delete|create|table|alter|drop|index|join|left|right|inner|outer|on|as|group|by|order|having|limit|offset|union|distinct|null|is|in|like|between|exists|case|when|then|else|end|primary|key|foreign|references|default|unique|constraint|database|view|begin|commit|rollback|asc|desc|count|sum|avg|min|max|int|varchar|text|boolean|timestamp|date';

    var NUM = /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/;
    var STR = /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/;
    var PYSTR = /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/;
    var FN = /\b[A-Za-z_$][\w$]*(?=\()/;

    var FAMILIES = {
        c: { rules: [['com', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/], ['str', STR], ['kw', kw(KW_C)], ['num', NUM], ['fn', FN]] },
        php: { rules: [['com', /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/], ['str', STR], ['var', /\$[A-Za-z_]\w*/], ['kw', kw(KW_C)], ['num', NUM], ['fn', FN]] },
        py: { rules: [['com', /#[^\n]*/], ['str', PYSTR], ['kw', kw(KW_PY)], ['num', NUM], ['fn', FN]] },
        sh: { rules: [['com', /#[^\n]*/], ['str', STR], ['var', /\$\{?[A-Za-z_]\w*\}?/], ['kw', kw(KW_SH)], ['num', NUM]] },
        yaml: { rules: [['com', /#[^\n]*/], ['str', STR], ['key', /[\w.-]+(?=\s*[:=])/], ['kw', kw('true|false|null|yes|no|on|off')], ['num', NUM]] },
        css: { rules: [['com', /\/\*[\s\S]*?(?:\*\/|$)/], ['str', STR], ['at', /@[\w-]+/], ['key', /[\w-]+(?=\s*:)/], ['num', /#[\da-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|rem|em|%|vh|vw|ms|s|deg|fr)?/]] },
        markup: { rules: [['com', /<!--[\s\S]*?(?:-->|$)/], ['tag', /<\/?[A-Za-z][\w:-]*|\/?>/], ['attr', /[\w:@.-]+(?=\s*=)/], ['str', /"[^"]*"?|'[^']*'?/]] },
        json: { rules: [['key', /"(?:\\.|[^"\\\n])*"(?=\s*:)/], ['str', /"(?:\\.|[^"\\\n])*"?/], ['kw', kw('true|false|null')], ['num', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/]] },
        sql: { ci: true, rules: [['com', /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/], ['str', /'(?:''|[^'])*'?/], ['kw', kw(KW_SQL)], ['num', NUM]] }
    };

    var ALIAS = {
        javascript: 'c', js: 'c', mjs: 'c', cjs: 'c', jsx: 'c', typescript: 'c', ts: 'c', tsx: 'c', java: 'c', c: 'c', h: 'c',
        cpp: 'c', 'c++': 'c', hpp: 'c', cs: 'c', csharp: 'c', go: 'c', rust: 'c', rs: 'c', kotlin: 'c', kt: 'c', swift: 'c',
        dart: 'c', scala: 'c', php: 'php',
        python: 'py', py: 'py', ruby: 'py', rb: 'py',
        bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', powershell: 'sh', ps1: 'sh', bat: 'sh',
        yaml: 'yaml', yml: 'yaml', toml: 'yaml', ini: 'yaml', env: 'yaml',
        css: 'css', scss: 'css', sass: 'css', less: 'css',
        html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup', xhtml: 'markup', vue: 'markup', svelte: 'markup', twig: 'markup',
        json: 'json', jsonc: 'json', json5: 'json',
        sql: 'sql'
    };

    function compile(f) {
        if (!f.re) {
            f.cls = f.rules.map(function (r) { return r[0]; });
            f.re = new RegExp(f.rules.map(function (r) { return '(' + r[1].source + ')'; }).join('|'), f.ci ? 'gi' : 'g');
        }
        return f;
    }

    function supports(lang) { return !!ALIAS[String(lang || '').toLowerCase()]; }

    function highlight(code, lang) {
        var fam = ALIAS[String(lang || '').toLowerCase()];
        if (!fam || code.length > 60000) { return esc(code); }
        var f = compile(FAMILIES[fam]);
        var re = f.re, out = '', last = 0, m;
        re.lastIndex = 0;
        while ((m = re.exec(code))) {
            if (m[0] === '') { re.lastIndex++; continue; }
            var i = 1;
            while (i < m.length && m[i] === undefined) { i++; }
            out += esc(code.slice(last, m.index)) + '<span class="tk-' + f.cls[i - 1] + '">' + esc(m[0]) + '</span>';
            last = re.lastIndex;
        }
        return out + esc(code.slice(last));
    }

    global.LenHighlight = { highlight: highlight, supports: supports };
})(window);

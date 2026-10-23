/*!
 * LenChat - updater.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Update checker for the repository on GitHub.
 * Your data never needs to move: keys, sessions and settings live in this browser's localStorage, and the
 * only server-side file you may have edited is config.php, which updates never touch.
 *
 * Exposed as window.LenUpdater.
 */
(function (global) {
    'use strict';

    var cfg = null;
    function init(config) { cfg = config; }

    function repo() { return (cfg && cfg.update && cfg.update.repo) || 'lenny-tishay/LenChat'; }

    function parts(v) {
        var m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+.]?([0-9A-Za-z.-]+))?/);
        if (!m) { return null; }
        return { n: [+m[1], +(m[2] || 0), +(m[3] || 0)], pre: m[4] || '' };
    }

    function compare(a, b) {
        var x = parts(a), y = parts(b);
        if (!x || !y) { return 0; }
        for (var i = 0; i < 3; i++) { if (x.n[i] !== y.n[i]) { return x.n[i] > y.n[i] ? 1 : -1; } }
        if (x.pre === y.pre) { return 0; }
        if (!x.pre) { return 1; }
        if (!y.pre) { return -1; }
        return x.pre > y.pre ? 1 : -1;
    }

    function json(url) {
        var ctl = new AbortController();
        var kill = setTimeout(function () { ctl.abort(); }, 9000);
        return fetch(url, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal })
            .then(function (r) {
                clearTimeout(kill);
                if (r.status === 403 || r.status === 429) { throw new Error('GitHub is rate-limiting this network right now. Try again in a few minutes.'); }
                if (!r.ok) { var e = new Error('GitHub answered HTTP ' + r.status + '.'); e.status = r.status; throw e; }
                return r.json();
            }, function (err) {
                clearTimeout(kill);
                throw new Error(err && err.name === 'AbortError' ? 'GitHub did not answer in time.' : 'Could not reach GitHub (offline, or the network blocks it).');
            });
    }

    function result(current, tag, extra) {
        var latest = String(tag || '').replace(/^v/i, '');
        return Object.assign({
            current: current, latest: latest, tag: tag, newer: compare(latest, current) > 0,
            page: 'https://github.com/' + repo() + '/releases/tag/' + encodeURIComponent(tag),
            zip: 'https://github.com/' + repo() + '/archive/refs/tags/' + encodeURIComponent(tag) + '.zip',
            notes: '', published: '', source: 'release'
        }, extra || {});
    }

    function check() {
        var current = (cfg && cfg.version) || '0.0.0';
        var base = 'https://api.github.com/repos/' + repo();
        return json(base + '/releases/latest').then(function (r) {
            return result(current, r.tag_name || r.name, { notes: String(r.body || '').slice(0, 1800), published: r.published_at || '', page: r.html_url || undefined, source: 'release' });
        }).catch(function (err) {
            if (err.status !== 404) { throw err; }
            return json(base + '/tags?per_page=20').then(function (tags) {
                var best = null;
                (tags || []).forEach(function (t) { if (parts(t.name) && (!best || compare(t.name, best.name) > 0)) { best = t; } });
                if (!best) { throw Object.assign(new Error('no tags'), { status: 404 }); }
                return result(current, best.name, { source: 'tag' });
            });
        }).catch(function (err) {
            if (err.status !== 404) { throw err; }
            var branch = (cfg && cfg.update && cfg.update.branch) || 'main';
            return fetch('https://raw.githubusercontent.com/' + repo() + '/' + encodeURIComponent(branch) + '/config.php', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
                .then(function (r) { if (!r.ok) { throw new Error('The repository has no published release yet.'); } return r.text(); })
                .then(function (t) {
                    var m = t.match(/'version'\s*=>\s*'([^']+)'/);
                    if (!m) { throw new Error('Could not read the version from the repository.'); }
                    return result(current, m[1], {
                        source: 'branch', page: 'https://github.com/' + repo(),
                        zip: 'https://github.com/' + repo() + '/archive/refs/heads/' + encodeURIComponent(branch) + '.zip'
                    });
                });
        });
    }

    function autoAvailable() { return !!(cfg && cfg.update && cfg.update.autoAvailable); }

    function apply(token, tag) {
        if (!autoAvailable()) { return Promise.reject(new Error('One-click update is not enabled on this server (config.php -> update).')); }
        return fetch(cfg.update.endpoint || 'api/update.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ t: token || '', tag: tag })
        }).then(function (r) {
            return r.text().then(function (txt) {
                var j = null;
                try { j = JSON.parse(txt); } catch (e) {  }
                if (!r.ok || !j || !j.ok) {
                    throw new Error((j && j.error && (j.error.message || j.error)) || ('The updater answered HTTP ' + r.status + '.'));
                }
                return j;
            });
        });
    }

    global.LenUpdater = { init: init, compare: compare, check: check, apply: apply, autoAvailable: autoAvailable };
})(window);

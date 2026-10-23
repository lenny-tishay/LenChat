/*!
 * LenChat - brand.js
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * Licensed under AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * modified versions must keep the credit line, the donate link, the GitHub link and the
 * licence links visible. 
 */
(function (global) {
    'use strict';

    var STORE = 'lenchat:brand';
    var DAY = 24 * 60 * 60 * 1000;

    var LINKS = Object.freeze({
        donate: 'https://leonard.lentech.co.ke/donate',
        repo: 'https://github.com/lenny-tishay/LenChat',
        license: 'https://github.com/lenny-tishay/LenChat/blob/main/LICENSE',
        enterprise: 'https://lentech.co.ke/enterprise',
        keys: 'https://ai.lentech.co.ke',
        remote: 'https://leonard.lentech.co.ke/lendev/remote/brand.json'
    });

    var TEXT = Object.freeze({
        credit: 'Open source project by LENTECH DIGIWORKS (lentech.co.ke)',
        owner: 'LENTECH DIGIWORKS',
        author: 'Leonard Muia',
        role: 'Chief Creative Officer & Founder',
        supportLabel: 'Support',
        supportNote: 'Free and open source'
    });

    var EXPECT = 'biyfw7';

    var cfg = null;
    var remote = {};
    var nodes = {};
    var timer = null;
    var observer = null;
    var noticeShown = false;


    function el(tag, attrs, kids) {
        var n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            if (k === 'text') { n.textContent = attrs[k]; } else { n.setAttribute(k, attrs[k]); }
        });
        (kids || []).forEach(function (c) { if (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } });
        return n;
    }

    function icon(name) {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'ic');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS(ns, 'use');
        use.setAttribute('href', '#i-' + name);
        svg.appendChild(use);
        return svg;
    }

    function link(href, label, iconName, cls) {
        var a = el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', 'class': cls || '' });
        if (iconName) { a.appendChild(icon(iconName)); }
        a.appendChild(el('span', { text: label }));
        return a;
    }


    function signature() {
        var s = [LINKS.donate, LINKS.repo, LINKS.license, LINKS.enterprise, LINKS.keys, TEXT.credit, TEXT.owner].join('|');
        var h = 5381;
        for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
        return (h >>> 0).toString(36);
    }

    function donateUrl() { return remote.donate || LINKS.donate; }

    function shown(node) {
        if (!node || !node.isConnected) { return false; }
        var r = node.getBoundingClientRect();
        if (r.width < 6 || r.height < 6) { return false; }
        for (var n = node; n && n.nodeType === 1; n = n.parentElement) {
            var cs = global.getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) { return false; }
        }
        return parseFloat(global.getComputedStyle(node).fontSize) >= 10;
    }

    function hrefIs(root, want) {
        var as = root.querySelectorAll('a');
        for (var i = 0; i < as.length; i++) { if (as[i].getAttribute('href') === want) { return as[i]; } }
        return null;
    }

    function intact() {
        if (signature() !== EXPECT) { return false; }
        var b = nodes.badge, f = nodes.foot;
        if (!b || !f || !b.isConnected || !f.isConnected) { return false; }
        if (!hrefIs(b, donateUrl())) { return false; }
        var d = hrefIs(f, donateUrl());
        var parts = [hrefIs(f, LINKS.repo), hrefIs(f, LINKS.license), hrefIs(f, LINKS.enterprise)];
        if (!d || parts.some(function (x) { return !x; })) { return false; }
        var credit = f.querySelector('[data-credit]');
        if (!credit || credit.textContent !== TEXT.credit) { return false; }
        return shown(d) && shown(credit) && parts.every(shown);
    }


    function buildBadge() {
        var label = remote.supportLabel || TEXT.supportLabel;
        var note = remote.supportNote || TEXT.supportNote;
        var btn = link(donateUrl(), label, 'coffee', 'lc-b-btn');
        btn.setAttribute('title', 'Support ' + TEXT.owner + ' - donate');
        return el('div', { 'class': 'lc-badge' }, [
            el('div', { 'class': 'lc-b-text' }, [
                el('strong', { text: TEXT.owner }),
                el('span', { text: note })
            ]),
            btn
        ]);
    }

    function buildFoot() {
        return el('div', { 'class': 'lc-foot' }, [
            el('span', { 'class': 'lc-credit', 'data-credit': '1', text: TEXT.credit }),
            el('nav', { 'class': 'lc-links', 'aria-label': 'Project links' }, [
                link(donateUrl(), 'Support', 'heart', 'lc-support'),
                link(LINKS.repo, 'GitHub', 'github'),
                link(LINKS.license, 'AGPL-3.0 License'),
                link(LINKS.enterprise, 'Commercial license')
            ])
        ]);
    }

    function slot(id, parentSel, className) {
        var s = document.getElementById(id);
        if (s && s.isConnected) { return s; }
        var parent = document.querySelector(parentSel) || document.body;
        s = el('div', { id: id, 'class': className });
        parent.appendChild(s);
        return s;
    }

    function mount() {
        var s1 = slot('support-slot', '.sidebar', 'lc-slot');
        var s2 = slot('foot-slot', '.composer', 'lc-slot');
        s1.textContent = '';
        s2.textContent = '';
        nodes.badge = buildBadge();
        nodes.foot = buildFoot();
        s1.appendChild(nodes.badge);
        s2.appendChild(nodes.foot);
    }

    function paintEmpty(target) {
        if (!target) { return; }
        target.textContent = '';
        target.appendChild(el('p', { 'class': 'lc-empty-note' }, [
            'LenChat is free and open source. If it saves you time or money, ',
            link(donateUrl(), 'help it grow', 'heart', 'lc-inline'),
            '.'
        ]));
    }

    function aboutNode() {
        var card = el('section', { 'class': 'about' }, [
            el('h3', { text: 'About LenChat' }),
            el('p', { text: 'LenChat v' + (cfg ? cfg.version : '') + ' is free, open source software by ' +
                TEXT.author + ', ' + TEXT.role + ' at ' + TEXT.owner + '. It runs on your own API keys, so every ' +
                'contribution goes straight into keeping it maintained and improving.' }),
            el('div', { 'class': 'about-actions' }, [
                link(donateUrl(), 'Donate or support', 'heart', 'btn btn-primary'),
                link(LINKS.repo, 'GitHub', 'github', 'btn'),
                link(LINKS.enterprise, 'Commercial license', null, 'btn')
            ]),
            el('p', { 'class': 'about-fine', text: 'Licensed under AGPL-3.0 with additional attribution terms (see the License link in the footer).' })
        ]);
        if (remote.announcement && remote.announcement.text) {
            var a = el('p', { 'class': 'about-news' });
            if (remote.announcement.url) {
                a.appendChild(link(remote.announcement.url, remote.announcement.text));
            } else {
                a.textContent = remote.announcement.text;
            }
            card.insertBefore(a, card.children[1]);
        }
        return card;
    }


    function showNotice() {
        if (noticeShown) { return; }
        noticeShown = true;
        var n = el('div', { id: 'lc-notice', role: 'alert', 'class': 'lc-notice' }, [
            el('strong', { text: 'LenChat is paused. ' }),
            'Its credits and support links are hidden or were removed on this page (an extension or an edited copy can do this). ' +
            'Make them visible again to continue. ',
            link(LINKS.license, 'Read the license')
        ]);
        document.body.appendChild(n);
    }

    function hideNotice() {
        var n = document.getElementById('lc-notice');
        if (n) { n.remove(); }
        noticeShown = false;
    }


    function check() {
        if (intact()) { hideNotice(); return true; }
        mount();
        if (intact()) { hideNotice(); return true; }
        showNotice();
        return false;
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(check, 200);
    }


    function trustedHost(u) {
        try {
            var x = new URL(u);
            return x.protocol === 'https:' && (x.hostname === 'lentech.co.ke' || /\.lentech\.co\.ke$/.test(x.hostname));
        } catch (e) { return false; }
    }

    /**
     * Remote JSON may adjust wording and the donate link (lentech.co.ke hosts only).
     * It can never remove or replace the credit line, GitHub or licence links.
     */
    function sanitize(d) {
        var o = {};
        if (!d || typeof d !== 'object') { return o; }
        if (typeof d.supportLabel === 'string') { o.supportLabel = d.supportLabel.slice(0, 28); }
        if (typeof d.supportNote === 'string') { o.supportNote = d.supportNote.slice(0, 48); }
        if (typeof d.donate === 'string' && trustedHost(d.donate)) { o.donate = d.donate; }
        if (d.announcement && typeof d.announcement.text === 'string') {
            o.announcement = {
                text: d.announcement.text.slice(0, 160),
                url: typeof d.announcement.url === 'string' && trustedHost(d.announcement.url) ? d.announcement.url : ''
            };
        }
        return o;
    }

    function readCache() {
        try {
            var c = JSON.parse(global.localStorage.getItem(STORE) || 'null');
            if (c && c.t && Date.now() - c.t < DAY) { return c.d; }
        } catch (e) {  }
        return null;
    }

    function fetchRemote() {
        var cached = readCache();
        if (cached) { remote = sanitize(cached); return Promise.resolve(); }
        var ctl = new AbortController();
        var kill = setTimeout(function () { ctl.abort(); }, 4000);
        return fetch(LINKS.remote, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                remote = sanitize(d);
                try { global.localStorage.setItem(STORE, JSON.stringify({ t: Date.now(), d: remote })); } catch (e) {  }
            })
            .catch(function () {  })
            .then(function () { clearTimeout(kill); });
    }


    function init(config) {
        cfg = config;
        mount();
        fetchRemote().then(function () { mount(); check(); });
        observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        global.addEventListener('resize', schedule);
        setInterval(check, 5000);
        check();
    }

    global.LenBrand = Object.freeze({
        init: init,
        ok: check,
        paintEmpty: paintEmpty,
        aboutNode: aboutNode,
        icon: icon,
        links: LINKS,
        signature: signature
    });
})(window);
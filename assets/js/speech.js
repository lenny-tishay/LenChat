/*!
 * LenChat - speech.js 
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Voice in and out.
 */
(function (global) {
    'use strict';

    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    function nativeSTT() { return !!SR; }
    function trim(u) { return String(u || '').trim().replace(/\/+$/, ''); }
    function noop() {}
    function idleCtl() { return { stop: noop, pause: noop, resume: noop, paused: function () { return false; }, active: function () { return false; } }; }


    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function words(s) { s = norm(s); return s ? s.split(' ') : []; }
    function wkey(w) {
        var k = String(w).toLowerCase();
        try { k = k.replace(/[^\p{L}\p{N}']/gu, ''); } catch (e) { k = k.replace(/[^a-z0-9']/g, ''); }
        return k || String(w).toLowerCase();
    }
    function keys(arr) { return arr.map(wkey); }
    function sameRun(a, ai, b, bi, n) {
        for (var i = 0; i < n; i++) { if (a[ai + i] !== b[bi + i]) { return false; } }
        return true;
    }

    function mergeText(base, piece) {
        base = norm(base); piece = norm(piece);
        if (!piece) { return base; }
        if (!base) { return piece; }
        var b = words(base), p = words(piece), bk = keys(b), pk = keys(p);
        if (pk.length >= bk.length && sameRun(bk, 0, pk, 0, bk.length)) { return piece; }
        if (bk.length >= pk.length && sameRun(bk, bk.length - pk.length, pk, 0, pk.length)) { return base; }
        var max = Math.min(bk.length, pk.length) - 1;
        for (var n = max; n >= 2; n--) {
            if (sameRun(bk, bk.length - n, pk, 0, n)) { return b.concat(p.slice(n)).join(' '); }
        }
        return base + ' ' + piece;
    }

    function collapseRepeats(text) {
        var w = words(text), k = keys(w), changed = true, guard = 0;
        while (changed && guard++ < 50) {
            changed = false;
            for (var n = 8; n >= 2 && !changed; n--) {
                for (var i = 0; i + 2 * n <= w.length; i++) {
                    if (sameRun(k, i, k, i + n, n)) {
                        w.splice(i + n, n); k.splice(i + n, n);
                        changed = true;
                        break;
                    }
                }
            }
        }
        return w.join(' ');
    }


    var COMMANDS = [
        ['send', /^(?:please\s+)?(?:send(?:\s+(?:it|this|that|message|the message|prompt|the prompt))?|submit(?:\s+(?:it|prompt))?)$/],
        ['clear', /^(?:please\s+)?(?:clear|delete|erase)\s+(?:the\s+)?(?:text|prompt|message|everything|all)$/],
        ['stop', /^(?:please\s+)?(?:stop|end|finish)\s+(?:listening|dictation|dictating|recording)$/],
        ['new', /^(?:please\s+)?(?:new|start\s+(?:a\s+)?new)\s+(?:chat|session|conversation)$/],
        ['read', /^(?:please\s+)?(?:read|narrate)\s+(?:it|that|the\s+(?:reply|answer|response))(?:\s+(?:aloud|out\s+loud))?$/]
    ];

    function parseCommand(text) {
        var t = String(text || '').toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) { return ''; }
        for (var i = 0; i < COMMANDS.length; i++) { if (COMMANDS[i][1].test(t)) { return COMMANDS[i][0]; } }
        return '';
    }


    function startSTT(settings, h) {
        var c = settings.stt || {};
        h = Object.assign({ onText: noop, onEnd: noop, onError: noop }, h || {});
        return c.engine === 'custom' ? customSTT(settings, h) : nativeRecognition(c, h);
    }

    function nativeRecognition(c, h) {
        if (!SR) {
            h.onError('This browser has no built-in speech recognition. Choose a custom speech endpoint in Settings.');
            h.onEnd();
            return idleCtl();
        }

        var state = 'idle';
        var rec = null;
        var committed = '';
        var instFinal = '', instInterim = '';
        var userStop = false;
        var endedFired = false;
        var shortRuns = 0, lastStart = 0, restarts = 0;
        var cmdSeen = {};
        var cmdSkip = {};
        var emitTimer = null, lastEmitKey = '', killTimer = null;
        var wantCommands = typeof h.onCommand === 'function';

        function total() { return mergeText(committed, instFinal); }

        function emit(force) {
            clearTimeout(emitTimer);
            emitTimer = null;
            var fin = collapseRepeats(total());
            var tail = instInterim;
            if (tail) {
                var merged = mergeText(fin, tail);
                tail = merged.indexOf(fin) === 0 ? merged.slice(fin.length).trim() : tail;
                if (collapseRepeats(fin + ' ' + tail) === fin) { tail = ''; }
            }
            var k = fin + '\u0001' + tail;
            if (!force && k === lastEmitKey) { return; }
            lastEmitKey = k;
            h.onText(fin, tail);
        }

        function schedule() { if (!emitTimer) { emitTimer = setTimeout(function () { emit(false); }, 60); } }

        function finish() {
            if (endedFired) { return; }
            endedFired = true;
            state = 'done';
            clearTimeout(killTimer);
            clearTimeout(emitTimer);
            if (instInterim) { instFinal = mergeText(instFinal, instInterim); instInterim = ''; }
            emit(true);
            h.onEnd();
        }

        function readResults(e) {
            var fin = '', interim = '', i, r, t;
            for (i = 0; i < e.results.length; i++) {
                r = e.results[i];
                t = r[0] ? r[0].transcript : '';
                if (r.isFinal) {
                    if (wantCommands && !cmdSeen[i]) {
                        cmdSeen[i] = true;
                        var action = parseCommand(t);
                        if (action) { cmdSkip[i] = true; try { h.onCommand(action); } catch (err) {  } }
                    }
                    if (!cmdSkip[i]) { fin = mergeText(fin, t); }
                } else {
                    interim = mergeText(interim, t);
                }
            }
            instFinal = fin;
            instInterim = interim;
        }

        function build() {
            var r = new SR();
            r.lang = c.lang || navigator.language || 'en-US';
            r.continuous = true;
            r.interimResults = true;
            r.maxAlternatives = 1;
            r.onstart = function () { if (state === 'starting') { state = 'listening'; } };
            r.onresult = function (e) {
                if (state === 'done' || r !== rec) { return; }
                readResults(e);
                schedule();
            };
            r.onerror = function (e) {
                if (r !== rec) { return; }
                var code = e && e.error;
                if (code === 'no-speech' || code === 'aborted') { return; }
                userStop = true;
                h.onError(
                    code === 'not-allowed' || code === 'service-not-allowed' ? 'Microphone permission was denied.' :
                    code === 'audio-capture' ? 'No microphone was found.' :
                    code === 'network' ? 'Speech recognition needs a network connection in this browser.' :
                    'Speech recognition error: ' + code);
            };
            r.onend = function () {
                if (r !== rec) { return; }
                if (instInterim) { instFinal = mergeText(instFinal, instInterim); instInterim = ''; }
                committed = mergeText(committed, instFinal);
                instFinal = '';
                cmdSeen = {}; cmdSkip = {};
                rec = null;
                if (userStop || state === 'stopping') { finish(); return; }
                var ran = Date.now() - lastStart;
                shortRuns = ran < 700 ? shortRuns + 1 : 0;
                if (shortRuns >= 3 || restarts >= 40) { h.onError('The microphone stopped unexpectedly.'); finish(); return; }
                restarts++;
                setTimeout(function () { if (!userStop && state !== 'done') { begin(); } else { finish(); } }, 220);
            };
            return r;
        }

        function begin() {
            rec = build();
            state = 'starting';
            lastStart = Date.now();
            try { rec.start(); }
            catch (err) { rec = null; h.onError('Could not start the microphone.'); finish(); }
        }

        begin();

        return {
            active: function () { return state === 'starting' || state === 'listening'; },
            stop: function () {
                if (state === 'done' || state === 'stopping') { return; }
                userStop = true;
                state = 'stopping';
                if (!rec) { finish(); return; }
                try { rec.stop(); } catch (err) { finish(); return; }
                killTimer = setTimeout(function () {
                    try { if (rec) { rec.abort(); } } catch (err) {  }
                    finish();
                }, 1800);
            }
        };
    }

    function customSTT(settings, h) {
        var c = settings.stt;
        var url = String(c.url || '').trim();
        if (!url) { h.onError('Add a speech-to-text endpoint URL in Settings.'); h.onEnd(); return idleCtl(); }
        if (!navigator.mediaDevices || !global.MediaRecorder) { h.onError('Recording is not supported here (it needs HTTPS and a modern browser).'); h.onEnd(); return idleCtl(); }
        var rec = null, chunks = [], ended = false, stopped = false;
        function finish() { if (!ended) { ended = true; h.onEnd(); } }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
            rec = new MediaRecorder(s);
            rec.ondataavailable = function (e) { if (e.data && e.data.size) { chunks.push(e.data); } };
            rec.onstop = function () {
                s.getTracks().forEach(function (t) { t.stop(); });
                var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
                if (!blob.size) { finish(); return; }
                var fd = new FormData();
                fd.append('file', blob, 'speech.' + (/mp4/.test(blob.type) ? 'm4a' : 'webm'));
                fd.append('model', c.model || 'whisper-1');
                if (c.lang) { fd.append('language', String(c.lang).split('-')[0]); }
                var key = c.key || '';
                fetch(url, { method: 'POST', headers: key ? { Authorization: 'Bearer ' + key } : {}, body: fd })
                    .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200)); }); })
                    .then(function (j) { h.onText(collapseRepeats(String(j.text || '')), ''); })
                    .catch(function (e) { h.onError('Transcription failed: ' + (e.message || e)); })
                    .then(finish);
            };
            rec.start();
            if (stopped) { rec.stop(); }
        }).catch(function () { h.onError('Microphone permission was denied.'); finish(); });
        return {
            active: function () { return !ended && !stopped; },
            stop: function () { stopped = true; if (rec && rec.state !== 'inactive') { rec.stop(); } }
        };
    }


    function voices() { return global.speechSynthesis ? global.speechSynthesis.getVoices() : []; }

    function plainText(md) {
        return String(md || '')
            .replace(/```[\s\S]*?(```|$)/g, ' (code block omitted). ')
            .replace(/~~~[\s\S]*?(~~~|$)/g, ' (code block omitted). ')
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/https?:\/\/\S+/g, ' link ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/<[^>\n]+>/g, ' ')
            .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/gm, ' ')
            .replace(/\|/g, ', ')
            .replace(/^\s{0,3}#{1,6}\s+/gm, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/[*_>#~]/g, '')
            .replace(/\n{2,}/g, '. ')
            .replace(/\s+/g, ' ').trim();
    }

    function chunks(text, max) {
        var out = [], parts = text.match(/[^.!?\u3002]+[.!?\u3002]*\s*/g) || [text];
        var cur = '';
        parts.forEach(function (p) {
            if ((cur + p).length > max && cur) { out.push(cur); cur = ''; }
            while (p.length > max) { out.push(p.slice(0, max)); p = p.slice(max); }
            cur += p;
        });
        if (cur.trim()) { out.push(cur); }
        return out;
    }

    function speak(text, settings, h) {
        var t = settings.tts || {};
        h = Object.assign({ onEnd: noop, onError: noop }, h || {});
        var plain = plainText(text);
        if (!plain) { h.onEnd(); return idleCtl(); }
        return (t.engine === 'openai' || t.engine === 'elevenlabs') ? remoteTTS(plain, settings, h) : nativeTTS(plain, t, h);
    }

    function nativeTTS(plain, t, h) {
        var synth = global.speechSynthesis;
        if (!synth) { h.onError('This browser has no speech synthesis.'); h.onEnd(); return idleCtl(); }
        synth.cancel();
        var list = chunks(plain, 180), i = 0, dead = false, isPaused = false;
        var voice = voices().filter(function (v) { return v.voiceURI === t.voice; })[0];
        function end() { if (!dead) { dead = true; h.onEnd(); } }
        function next() {
            if (dead || i >= list.length) { end(); return; }
            var u = new SpeechSynthesisUtterance(list[i++]);
            if (voice) { u.voice = voice; u.lang = voice.lang; }
            u.rate = Math.min(2, Math.max(0.5, parseFloat(t.rate) || 1));
            u.pitch = Math.min(2, Math.max(0, parseFloat(t.pitch) || 1));
            u.onend = next;
            u.onerror = function (e) {
                if (e.error !== 'canceled' && e.error !== 'interrupted') { h.onError('Speech error: ' + e.error); }
                end();
            };
            synth.speak(u);
        }
        next();
        return {
            active: function () { return !dead; },
            stop: function () { if (dead) { return; } dead = true; synth.cancel(); h.onEnd(); },
            pause: function () { if (!dead && !isPaused) { isPaused = true; synth.pause(); } },
            resume: function () { if (!dead && isPaused) { isPaused = false; synth.resume(); } },
            paused: function () { return isPaused; }
        };
    }

    function remoteTTS(plain, settings, h) {
        var t = settings.tts, ctl = new AbortController(), audio = null, url = '', done = false, isPaused = false;
        function end() { if (!done) { done = true; if (url) { URL.revokeObjectURL(url); } h.onEnd(); } }
        var req;
        if (t.engine === 'elevenlabs') {
            var base = trim(t.url) || 'https://api.elevenlabs.io/v1';
            req = { url: base + '/text-to-speech/' + encodeURIComponent(t.voiceId || ''), headers: { 'Content-Type': 'application/json', 'xi-api-key': t.key || '' },
                body: JSON.stringify({ text: plain.slice(0, 4500), model_id: t.model || 'eleven_multilingual_v2' }) };
        } else {
            var key = t.key;
            if (!key) { var ok = global.LenStorage.activeKey(settings, 'openai'); key = ok ? ok.key : ''; }
            req = { url: (trim(t.url) || 'https://api.openai.com/v1/audio/speech'), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
                body: JSON.stringify({ model: t.model || 'tts-1', voice: t.voiceId || 'alloy', input: plain.slice(0, 4000), response_format: 'mp3' }) };
        }
        fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: ctl.signal })
            .then(function (r) { return r.ok ? r.blob() : r.text().then(function (x) { throw new Error('HTTP ' + r.status + ' ' + x.slice(0, 200)); }); })
            .then(function (b) {
                if (done) { return null; }
                url = URL.createObjectURL(b);
                audio = new Audio(url);
                audio.onended = end;
                audio.onerror = function () { h.onError('Could not play the audio.'); end(); };
                return audio.play();
            })
            .catch(function (e) { if (e.name !== 'AbortError') { h.onError('Voice request failed: ' + (e.message || e)); } end(); });
        return {
            active: function () { return !done; },
            stop: function () { ctl.abort(); if (audio) { audio.pause(); } end(); },
            pause: function () { if (audio && !done && !isPaused) { isPaused = true; audio.pause(); } },
            resume: function () { if (audio && !done && isPaused) { isPaused = false; audio.play(); } },
            paused: function () { return isPaused; }
        };
    }

    global.LenSpeech = {
        nativeSTT: nativeSTT, startSTT: startSTT, voices: voices, speak: speak, plainText: plainText, parseCommand: parseCommand,
        _mergeText: mergeText, _collapseRepeats: collapseRepeats
    };
})(window);

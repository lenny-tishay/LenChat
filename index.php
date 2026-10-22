<?php
/**
 * LenChat - index.php
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * Licensed under AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 */
declare(strict_types=1);

$cfg = require __DIR__ . '/config.php';
$cfg['update'] = array_merge(['repo' => 'lenny-tishay/LenChat', 'branch' => 'main', 'auto_enabled' => false, 'token' => ''], (array) ($cfg['update'] ?? []));

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: SAMEORIGIN');
$ocrHost = (string) parse_url((string) ($cfg['vision']['ocr_src'] ?? ''), PHP_URL_HOST);
$libHosts = [];
foreach (($cfg['libs'] ?? []) as $l) {
    $h = (string) parse_url((string) ($l['src'] ?? ''), PHP_URL_HOST);
    if ($h !== '' && $h !== $ocrHost && !in_array($h, $libHosts, true)) { $libHosts[] = $h; }
}
$libSrc = '';
foreach ($libHosts as $h) { $libSrc .= " https://{$h}"; }
$imgHost = (string) parse_url((string) ($cfg['image']['pollinations'] ?? ''), PHP_URL_HOST);
if (!empty($cfg['security']['send_csp'])) {
    header("Content-Security-Policy: default-src 'self'; "
        . "script-src 'self'" . ($ocrHost !== '' ? " https://{$ocrHost}" : '') . $libSrc . " 'wasm-unsafe-eval'; "
        . "worker-src 'self' blob:; media-src 'self' blob:; style-src 'self'; "
        . "img-src 'self' data: blob:" . ($imgHost !== '' ? " https://{$imgHost}" : '') . "; "
        . "connect-src 'self' blob: https: http://localhost:* http://127.0.0.1:*; frame-src 'self'; object-src 'none'; "
        . "base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
}

$client = [
    'name'            => $cfg['app_name'],
    'version'         => $cfg['version'],
    'defaultProvider' => $cfg['default_provider'],
    'streamEndpoint'  => $cfg['stream_endpoint'],
    'relayEnabled'    => !empty($cfg['relay']['enabled']),
    'relayNeedsToken' => (string) $cfg['relay']['access_token'] !== '',
    'providers'       => $cfg['providers'],
    'defaults'        => $cfg['defaults'],
    'limits'          => $cfg['limits'],
    'vision'          => $cfg['vision'] ?? [],
    'image'           => $cfg['image'] ?? [],
    'libs'            => $cfg['libs'] ?? [],
    'update'          => [
        'repo'          => $cfg['update']['repo'],
        'branch'        => $cfg['update']['branch'],
        'autoAvailable' => !empty($cfg['update']['auto_enabled']) && (string) $cfg['update']['token'] !== '',
        'endpoint'      => 'api/update.php',
    ],
];
$clientJson = json_encode($client, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

function lc_v($rel)
{
    $f = __DIR__ . '/' . $rel;
    return $rel . '?v=' . (is_file($f) ? filemtime($f) : '1');
}
$e = static function ($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); };
$ic = static function ($name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' . $name . '"></use></svg>'; };
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title><?= $e($cfg['app_name']) ?> - drop code, ask AI</title>
    <meta name="description" content="Free, open source, developer-first AI workspace. Drop project files, bring your own API keys, ask any model.">
    <link rel="stylesheet" href="<?= $e(lc_v('assets/css/style.css')) ?>">
    <script type="application/json" id="lenchat-config"><?= $clientJson ?></script>
    <link rel="icon" type="image/png" href="assets/logo.png">
</head>
<body>
  



<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-paperclip" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></symbol>
    <symbol id="i-folder" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6M9 13h6"/></symbol>
    <symbol id="i-send" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></symbol>
    <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
    <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></symbol>
    <symbol id="i-heart" viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></symbol>
    <symbol id="i-coffee" viewBox="0 0 24 24"><path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
    <symbol id="i-key" viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></symbol>
    <symbol id="i-github" viewBox="0 0 24 24"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></symbol>
    <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></symbol>
    <symbol id="i-terminal" viewBox="0 0 24 24"><path d="m4 17 6-6-6-6M12 19h8"/></symbol>
    <symbol id="i-gauge" viewBox="0 0 24 24"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></symbol>
    <symbol id="i-panel" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-expand" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="i-shrink" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></symbol>
    <symbol id="i-maximize" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></symbol>
    <symbol id="i-forward" viewBox="0 0 24 24"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></symbol>
    <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></symbol>
    <symbol id="i-volume" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></symbol>
    <symbol id="i-edit" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></symbol>
    <symbol id="i-zoom-in" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></symbol>
    <symbol id="i-zoom-out" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></symbol>
    <symbol id="i-code" viewBox="0 0 24 24"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
    <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></symbol>
    <symbol id="i-tag" viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></symbol>
    <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
    <symbol id="i-play" viewBox="0 0 24 24"><path d="m7 4 13 8-13 8Z"/></symbol>
    <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/></symbol>
    <symbol id="i-undo" viewBox="0 0 24 24"><path d="M3 7v6h6M3.5 13A9 9 0 1 0 6 6.7"/></symbol>
</svg>

<div class="app" id="app">
    <div class="sidebar-backdrop" id="sidebar-backdrop" hidden></div>

    <aside class="sidebar" id="sidebar">
        <button class="btn btn-icon sidebar-close" id="btn-sidebar-close" type="button" aria-label="Close sidebar" title="Close">&times;</button>
        <div class="brand">
            <img src="assets/logo.png" alt="LenChat logo" class="brand-logo">
            <div>
                <div class="brand-name"><?= $e($cfg['app_name']) ?></div>
                <div class="brand-sub">v<?= $e($cfg['version']) ?> &middot; </div>
            </div>
        </div>
        <button class="btn btn-primary btn-block" id="btn-new" type="button"><?= $ic('plus') ?><span>New session</span></button>
        <div class="hist-tools">
    <form autocomplete="off" onsubmit="return false;" style="margin:0; padding:0;">
        <label class="hist-search"><?= $ic('search') ?><input id="hist-q" type="search" placeholder="Search" autocomplete="off" spellcheck="false" aria-label="Search history"></label>
    </form>
    <div class="hist-tabs" role="tablist">
                <button class="tab on" type="button" role="tab" aria-selected="true" id="tab-chats">Chats</button>
                <button class="tab" type="button" role="tab" aria-selected="false" id="tab-snips">Snippets</button>
            </div>
            <div class="tag-bar" id="tag-bar" hidden></div>
        </div>
        <div class="session-list" id="session-list" role="list"></div>

        <div id="support-slot" class="lc-slot"></div>

        <div class="sidebar-foot">
            <button class="btn" id="btn-settings" type="button"><?= $ic('sliders') ?><span>Settings</span></button>
            <button class="btn btn-icon" id="btn-theme" type="button" title="Switch light / dark" aria-label="Switch theme"></button>
        </div>
    </aside>

    <main class="main">
        <header class="topbar">
            <button class="btn btn-icon" id="btn-toggle-sidebar" type="button" title="Show / hide sidebar" aria-label="Toggle sidebar" aria-expanded="true" aria-controls="sidebar"><?= $ic('panel') ?></button>
            <div class="title" id="session-title">New session</div>
            <button class="model-chip" id="btn-model-chip" type="button" title="Provider, key and model" aria-haspopup="dialog"><?= $ic('sliders') ?><span></span></button>
        </header>

        <section class="messages" id="messages" aria-live="polite">
            <div class="empty" id="empty">
                <h1>Drop your code. Ask the question.</h1>
                <p>Drag files, a whole folder or screenshots anywhere on this page (or paste an image). Everything is read in your browser and attached to your next prompt.</p>
                <ul>
                    <li>Keys, history and files stay in this browser.</li>
                    <li>Add several keys per provider and swap them from the + menu when one hits its limit.</li>
                    <li>Choose how much history each message carries, and delete any message to stop paying for it.</li>
                    <li>Images go to vision models as pictures, or are read with OCR for text-only models.</li>
                    <li>Try <kbd>/imagine...</kbd> for an image, or ask for HTML to get a live preview.</li>
                </ul>
                <div id="empty-slot"></div>
            </div>
        </section>

        <footer class="composer">
            <div class="attach-tray" id="attach-tray" hidden>
                <div class="tray-head">
                    <strong id="tray-summary"></strong>
                    <span class="spacer"></span>
                    <button class="link-btn" id="tray-tree" type="button">Show tree</button>
                    <button class="link-btn" id="tray-clear" type="button">Remove all</button>
                </div>
                <div class="chips" id="tray-chips"></div>
                <pre class="treebox" id="tray-treebox" hidden></pre>
            </div>

            <div class="sheet-backdrop" id="sheet-backdrop" hidden></div>
            <section class="sheet" id="action-sheet" hidden role="dialog" aria-label="Chat tools">
                <div class="sheet-head"><strong>Chat tools</strong><button class="btn btn-icon" id="btn-sheet-close" type="button" aria-label="Close">&times;</button></div>
                <div class="sheet-actions">
                    <button class="btn" id="btn-attach" type="button"><?= $ic('paperclip') ?><span>Files, ZIP, PDF&hellip;</span></button>
                    <button class="btn" id="btn-folder" type="button"><?= $ic('folder') ?><span>Whole folder</span></button>
                </div>
                <div class="sheet-actions">
                    <button class="btn" id="btn-hands" type="button" aria-pressed="false" title="Speak your prompt, hear the reply, repeat"><?= $ic('mic') ?><span>Hands-free <b>Off</b></span></button>
                    <button class="btn" id="btn-autoread" type="button" aria-pressed="false" title="Read every finished reply aloud"><?= $ic('volume') ?><span>Auto-read <b>Off</b></span></button>
                </div>
                <div class="model-pick">
                    <label class="pick"><span>Provider</span><select id="sel-provider"></select></label>
                    <label class="pick" id="key-wrap"><span>API key</span><select id="sel-key"></select></label>
                    <label class="pick"><span>Model</span><select id="sel-model"></select></label>
                </div>
            <div class="opts" id="opts">
                <label class="opt" title="How much of the conversation is sent with each message">
                    <?= $ic('layers') ?>
                    <select id="opt-ctx" aria-label="Context sent">
                        <option value="prompt">Prompt + files only</option>
                        <option value="last">Last messages</option>
                        <option value="all">Whole conversation</option>
                    </select>
                </label>
                <label class="opt" id="opt-n-wrap" hidden title="Number of recent messages to send">
                    <input id="opt-n" type="number" min="1" max="200" step="1" aria-label="Number of recent messages">
                    <span>msgs</span>
                </label>
                <button class="opt toggle" id="opt-sys" type="button" aria-pressed="true" title="Send the system prompt with each message">
                    <?= $ic('terminal') ?><span>System prompt <b>On</b></span>
                </button>
                <label class="opt" title="Cap on the length of each reply (max_tokens). Empty = provider default.">
                    <?= $ic('gauge') ?><span>Max out</span>
                    <input id="opt-max" type="number" min="1" step="256" placeholder="auto" aria-label="Maximum output tokens">
                </label>
                <span class="spacer"></span>
                <span class="est" id="opt-est"></span>
            </div>
            </section>

            <div class="composer-box">
                <button class="btn btn-icon" id="btn-plus" type="button" title="Tools, models and attachments" aria-label="Open tools" aria-expanded="false"><?= $ic('plus') ?></button>
                <textarea id="inp-prompt" rows="1" placeholder="Ask your AI" aria-label="Message"></textarea>
                <button class="btn btn-icon" id="btn-mic" type="button" title="Dictate" aria-label="Dictate"><?= $ic('mic') ?></button>
                <button class="btn btn-primary" id="btn-send" type="button"></button>
            </div>
           

            <!-- Credits and licence links: rendered by assets/js/brand.js -->
            <div id="foot-slot" class="lc-slot"></div>
        </footer>
    </main>
</div>

<div class="drop-overlay" id="drop-overlay" hidden>
    <div class="drop-card"><?= $ic('folder') ?><span>Release to attach files or folders</span></div>
</div>

<div class="drawer-backdrop" id="drawer-backdrop" hidden></div>
<aside class="drawer" id="drawer" hidden role="dialog" aria-modal="true" aria-label="Settings">
    <div class="drawer-head">
        <h2>Settings</h2>
        <button class="btn btn-icon" id="btn-drawer-close" type="button" aria-label="Close settings"><?= $ic('x') ?></button>
    </div>
    <div class="drawer-body">
        <label class="field">
            <span>Provider</span>
            <select id="set-provider"></select>
        </label>

        <section class="field" id="keys-section">
            <span>
                <span>API keys</span>
                <a id="key-link" class="field-link" target="_blank" rel="noopener noreferrer">Get api key</a>
            </span>
            <div class="key-rows" id="key-rows"></div>
            <div class="key-tools">
                <button class="btn" id="btn-add-key" type="button"><?= $ic('plus') ?><span>Add key</span></button>
                <button class="link-btn" id="key-toggle" type="button">Show</button>
            </div>
            <p class="note">Label each key (for example &ldquo;Work&rdquo; or &ldquo;Backup&rdquo;). The one marked Use is active; switch any time from the top bar.</p>
        </section>

        <label class="field">
            <span>Endpoint</span>
            <input id="set-base" type="text" autocomplete="off" spellcheck="false">
        </label>

        <label class="field">
            <span>Model</span>
            <input id="set-model" list="set-model-list" type="text" autocomplete="off" spellcheck="false">
            <datalist id="set-model-list"></datalist>
        </label>

        <label class="field">
            <span>Your own models</span>
            <textarea id="set-custom-models" rows="2" spellcheck="false" placeholder="model-a, model-b, my-deployment"></textarea>
        </label>
        <p class="note">Comma separated. They appear in the model picker next to the presets.</p>

        <label class="field">
            <span>System prompt</span>
            <textarea id="set-sys" rows="5" spellcheck="false"></textarea>
        </label>
        <label class="check">
            <input id="set-send-sys" type="checkbox">
            <span>Send the system prompt with each message (turn off to save tokens)</span>
        </label>

        <h3 class="set-h">File generation skill</h3>
        <label class="check">
            <input id="set-fileskill" type="checkbox">
            <span>Enable the File Generation Skill</span>
        </label>
        <p class="note">When on, this rule is added to every request, even if the system prompt is off. It cannot be edited, so every model returns files in the same shape.</p>
        <details class="rule-box">
            <summary>Show the rule that is sent</summary>
            <pre id="skill-rule" class="treebox"></pre>
        </details>

        <div class="field-grid">
            <label class="field">
                <span>Temperature</span>
                <input id="set-temp" type="number" min="0" max="2" step="0.1" placeholder="provider default">
            </label>
            <label class="field">
                <span>Max output tokens</span>
                <input id="set-max" type="number" min="1" step="256" placeholder="provider default">
            </label>
        </div>
        <div class="field-grid">
            <label class="field">
                <span>Keep files for last</span>
                <input id="set-keep" type="number" min="0" max="20" step="1">
            </label>
            <label class="field">
                <span>Transport</span>
                <select id="set-transport">
                    <option value="auto">Auto</option>
                    <option value="direct">Direct from browser</option>
                    <option value="server">Server relay</option>
                </select>
            </label>
        </div>
        <p class="note" id="relay-note"></p>

        <label class="field" id="row-token" hidden>
            <span>Relay access token</span>
            <input id="set-token" type="password" autocomplete="off" spellcheck="false">
        </label>

        <div class="field-grid">
            <label class="field">
                <span>Screenshots</span>
                <select id="set-vision">
                    <option value="auto">Auto (guess from model)</option>
                    <option value="vision">Always send the picture</option>
                    <option value="ocr">Always read text (OCR)</option>
                </select>
            </label>
            <label class="field">
                <span>Image generation</span>
                <select id="set-imgprov">
                    <option value="pollinations">Pollinations (free, no key)</option>
                    <option value="openai">OpenAI images (uses your OpenAI key)</option>
                </select>
            </label>
        </div>
        <label class="field">
            <span>Image model (optional)</span>
            <input id="set-imgmodel" type="text" autocomplete="off" spellcheck="false" placeholder="flux / turbo  -  dall-e-3 / gpt-image-1">
        </label>

        <h3 class="set-h">Voice</h3>
        <div class="field-grid">
            <label class="field"><span>Dictation (STT)</span>
                <select id="set-stt-engine"><option value="native">Browser (Web Speech)</option><option value="custom">Custom endpoint</option></select></label>
            <label class="field"><span>Language (optional)</span><input id="set-stt-lang" type="text" placeholder="en-US, sw-KE ..." autocomplete="off"></label>
        </div>
        <div id="stt-custom" hidden>
            <label class="field"><span>Transcription URL</span><input id="set-stt-url" type="text" placeholder="https://api.openai.com/v1/audio/transcriptions" autocomplete="off" spellcheck="false"></label>
            <div class="field-grid">
                <label class="field"><span>Model</span><input id="set-stt-model" type="text" placeholder="whisper-1" autocomplete="off"></label>
                <label class="field"><span>API key</span><input id="set-stt-key" type="password" autocomplete="off"></label>
            </div>
        </div>
        <label class="field"><span>Read aloud (TTS)</span>
            <select id="set-tts-engine"><option value="native">Browser voices</option><option value="openai">OpenAI-style API</option><option value="elevenlabs">ElevenLabs</option></select></label>
        <div id="tts-native">
            <label class="field"><span>Voice</span><select id="set-tts-voice"></select></label>
            <div class="field-grid">
                <label class="field"><span>Speed <b id="rate-val"></b></span><input id="set-tts-rate" type="range" min="0.5" max="2" step="0.1"></label>
                <label class="field"><span>Pitch <b id="pitch-val"></b></span><input id="set-tts-pitch" type="range" min="0" max="2" step="0.1"></label>
            </div>
        </div>
        <div id="tts-custom" hidden>
            <label class="field"><span>Endpoint (optional)</span><input id="set-tts-url" type="text" placeholder="default for the chosen API" autocomplete="off" spellcheck="false"></label>
            <div class="field-grid">
                <label class="field"><span>Model</span><input id="set-tts-model" type="text" placeholder="tts-1 / eleven_multilingual_v2" autocomplete="off"></label>
                <label class="field"><span>Voice / voice id</span><input id="set-tts-voiceid" type="text" placeholder="alloy" autocomplete="off"></label>
            </div>
            <label class="field"><span>API key</span><input id="set-tts-key" type="password" autocomplete="off" placeholder="empty = reuse your OpenAI key"></label>
        </div>
        <label class="check"><input id="set-voice-cmd" type="checkbox"><span>Voice commands while dictating: &ldquo;send it&rdquo;, &ldquo;clear the text&rdquo;, &ldquo;stop listening&rdquo;, &ldquo;new chat&rdquo;</span></label>
        <label class="check"><input id="set-voice-autoread" type="checkbox"><span>Read every finished reply aloud</span></label>
        <label class="check"><input id="set-voice-hands" type="checkbox"><span>Hands-free conversation: send after a pause, read the reply, then listen again</span></label>
        <label class="field"><span>Pause before auto-send <b id="silence-val"></b></span><input id="set-voice-silence" type="range" min="800" max="5000" step="200"></label>
        <button class="btn" id="btn-tts-test" type="button"><?= $ic('volume') ?><span>Test voice</span></button>
        <p class="note">External voice calls go straight from your browser, so the provider must allow browser (CORS) requests.</p>

        <h3 class="set-h">Live preview</h3>
        <label class="field"><span>When a preview throws an error</span>
            <select id="set-heal"><option value="ask">Offer a &ldquo;Fix with AI&rdquo; button</option><option value="auto">Fix automatically (up to 2 tries)</option><option value="off">Do nothing</option></select></label>

        <h3 class="set-h">Prompt starters &amp; examples</h3>
        <p class="note starters-note">Tap <b>Use</b> to put a prompt in the message box. Each one shows something LenChat can do.</p>
        <div id="starters"></div>

        <h3 class="set-h">Updates</h3>
        <div class="upd" id="upd">
            <div class="upd-line"><span>Installed <b id="upd-cur"></b></span><span id="upd-latest"></span></div>
            <div class="upd-actions">
                <button class="btn" id="btn-check-update" type="button"><?= $ic('refresh') ?><span>Check GitHub for updates</span></button>
            </div>
            <div id="upd-result" hidden></div>
        </div>

        <h3 class="set-h">Configuration</h3>
        <p class="note">One file with your API keys, system prompt, skill switch, voice and every other setting. Import it on a new browser or machine. Sessions have their own export below.</p>
        <label class="check"><input id="cfg-keys" type="checkbox" checked><span>Include API keys and tokens in the export</span></label>
        <div class="drawer-actions cfg-actions">
            <button class="btn" id="btn-cfg-export" type="button"><?= $ic('download') ?><span>Export configuration</span></button>
            <button class="btn" id="btn-cfg-import" type="button"><?= $ic('upload') ?><span>Import configuration</span></button>
        </div>

        <div id="about-slot"></div>

        <div class="drawer-actions">
            <button class="btn" id="btn-export" type="button"><?= $ic('download') ?><span>Export sessions</span></button>
            <button class="btn" id="btn-import" type="button"><?= $ic('upload') ?><span>Import sessions</span></button>
            <button class="btn btn-danger" id="btn-wipe" type="button"><?= $ic('trash') ?><span>Erase all data</span></button>
        </div>
    </div>
    <div class="drawer-foot">
        <button class="btn" id="btn-cancel" type="button">Cancel</button>
        <button class="btn btn-primary" id="btn-save" type="button">Save settings</button>
    </div>
</aside>

<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Image viewer">
    <div class="lb-bar">
        <button class="btn btn-icon" id="lb-out" type="button" aria-label="Zoom out"><?= $ic('zoom-out') ?></button>
        <span id="lb-pct">100%</span>
        <button class="btn btn-icon" id="lb-in" type="button" aria-label="Zoom in"><?= $ic('zoom-in') ?></button>
        <button class="btn" id="lb-reset" type="button">Reset</button>
        <span class="spacer"></span>
        <a class="btn btn-primary" id="lb-dl" href="#" download><?= $ic('download') ?><span>Download</span></a>
        <button class="btn btn-icon" id="lb-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="lb-stage" id="lb-stage"><img id="lb-img" alt="" draggable="false"></div>
</div>

<div class="fs-preview" id="fs-preview" hidden role="dialog" aria-modal="true" aria-label="Full-screen preview">
    <div class="fs-bar">
        <strong>Live preview</strong><span class="fs-note">sandboxed</span>
        <span class="spacer"></span>
        <button class="btn" id="fs-reload" type="button"><?= $ic('refresh') ?><span>Reload</span></button>
        <button class="btn" id="fs-close" type="button">&times; <span>Close</span></button>
    </div>
    <div class="pv-banner" id="fs-banner" hidden></div>
    <div class="fs-body" id="fs-body"></div>
</div>

<div class="modal-backdrop" id="zip-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="zip-title">
        <div class="modal-head"><h2 id="zip-title">Choose files</h2><button class="btn btn-icon" id="zip-x" type="button" aria-label="Close">&times;</button></div>
        <div class="modal-tools"><button class="link-btn" id="zip-all" type="button">Select all</button><button class="link-btn" id="zip-none" type="button">Select none</button><span class="spacer"></span><span id="zip-summary" class="est"></span></div>
        <div class="zip-tree" id="zip-tree"></div>
        <div class="modal-foot"><button class="btn" id="zip-cancel" type="button">Cancel</button><button class="btn btn-primary" id="zip-ok" type="button">Add selected</button></div>
    </div>
</div>

<div class="modal-backdrop" id="tag-modal" hidden>
    <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="tag-title">
        <div class="modal-head"><h2 id="tag-title">Tags</h2><button class="btn btn-icon" id="tag-x" type="button" aria-label="Close">&times;</button></div>
        <div class="modal-pad">
            <p class="note tag-name" id="tag-session"></p>
            <input id="tag-input" type="text" autocomplete="off" spellcheck="false" placeholder="work, bug-fix, client-x" aria-label="Tags, comma separated">
            <div class="tag-suggest" id="tag-suggest"></div>
        </div>
        <div class="modal-foot"><button class="btn" id="tag-cancel" type="button">Cancel</button><button class="btn btn-primary" id="tag-save" type="button">Save tags</button></div>
    </div>
</div>

<div class="toast" id="toast" hidden role="status"></div>

<input type="file" id="pick-files" multiple hidden>
<input type="file" id="pick-folder" webkitdirectory hidden>
<input type="file" id="pick-import" accept="application/json,.json" hidden>
<input type="file" id="pick-config" accept="application/json,.json" hidden>

<noscript><p class="lc-noscript">LenChat needs JavaScript to run.</p></noscript>

<script src="<?= $e(lc_v('assets/js/storage.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/reader.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/highlight.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/canvas.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/vision.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/imagegen.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/docs.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/speech.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/provider.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/engine.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/history.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/updater.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/starters.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/brand.js')) ?>"></script>
<script src="<?= $e(lc_v('assets/js/app.js')) ?>"></script>
    
    <script>
document.addEventListener("DOMContentLoaded", function() {
    var searchInput = document.getElementById('hist-q');
    if (searchInput) {
        searchInput.setAttribute('autocomplete', 'new-password');
        searchInput.addEventListener('focus', function() {
            if (this.getAttribute('autocomplete') === 'new-password') {
                this.setAttribute('autocomplete', 'off');
            }
        });
    }
});
</script>
</body>
</html>

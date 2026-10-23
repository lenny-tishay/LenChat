<?php
/**
 * LenChat - api/update.php  
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 */
declare(strict_types=1);

$cfg = require dirname(__DIR__) . '/config.php';
$upd = array_merge(['repo' => 'lenny-tishay/LenChat', 'auto_enabled' => false, 'token' => '', 'max_bytes' => 25 * 1024 * 1024], (array) ($cfg['update'] ?? []));
$root = dirname(__DIR__);

function lcu_fail($status, $message)
{
    if (!headers_sent()) {
        http_response_code((int) $status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode(['ok' => false, 'error' => ['message' => $message]]);
    exit;
}

header('X-Content-Type-Options: nosniff');

if (empty($upd['auto_enabled']) || (string) $upd['token'] === '') {
    lcu_fail(403, 'One-click update is disabled. Set update.auto_enabled and update.token in config.php, or update by uploading the release zip.');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    lcu_fail(405, 'POST only.');
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $oh = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $th = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($oh !== $th) {
        lcu_fail(403, 'Cross-origin requests are not allowed.');
    }
}
if (!function_exists('curl_init') || !class_exists('ZipArchive')) {
    lcu_fail(500, 'The PHP cURL and Zip extensions are required for one-click updates.');
}

$in = json_decode((string) file_get_contents('php://input', false, null, 0, 4096), true);
if (!is_array($in)) {
    lcu_fail(400, 'Malformed request.');
}
if (!hash_equals((string) $upd['token'], (string) ($in['t'] ?? ''))) {
    usleep(400000);
    lcu_fail(401, 'Wrong update token.');
}
$tag = (string) ($in['tag'] ?? '');
if (!preg_match('/^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/', $tag)) {
    lcu_fail(400, 'Invalid version tag.');
}
$repo = (string) $upd['repo'];
if (!preg_match('#^[\w.-]+/[\w.-]+$#', $repo)) {
    lcu_fail(500, 'update.repo in config.php is not owner/name.');
}
if (!is_writable($root)) {
    lcu_fail(500, 'The install folder is not writable by PHP.');
}

@set_time_limit(120);

$tmp = tempnam(sys_get_temp_dir(), 'lcu');
$fh  = fopen($tmp, 'wb');
$ch  = curl_init("https://codeload.github.com/{$repo}/zip/refs/tags/" . rawurlencode($tag));
curl_setopt_array($ch, [
    CURLOPT_FILE           => $fh,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT        => 90,
    CURLOPT_MAXFILESIZE    => (int) $upd['max_bytes'],
    CURLOPT_USERAGENT      => 'LenChat-Updater',
]);
$ok     = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err    = curl_error($ch);
curl_close($ch);
fclose($fh);
if (!$ok || $status !== 200 || filesize($tmp) < 1024) {
    @unlink($tmp);
    lcu_fail(502, $status === 404 ? "GitHub has no release tagged {$tag}." : 'Download failed: ' . ($err ?: "HTTP {$status}"));
}

$zip = new ZipArchive();
if ($zip->open($tmp) !== true) {
    @unlink($tmp);
    lcu_fail(502, 'The downloaded archive is not a valid zip.');
}
$prefix = '';
if ($zip->numFiles > 0) {
    $first = (string) $zip->getNameIndex(0);
    $pos   = strpos($first, '/');
    $prefix = $pos === false ? '' : substr($first, 0, $pos + 1);
}
$allowTop  = ['index.php', 'preview.php', 'README.md', 'CHANGELOG.md', 'UPDATING.md', 'LICENSE', 'NOTICE.md'];
$allowDirs = ['api/', 'assets/'];
$skip      = ['config.php'];

$plan = [];
for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = (string) $zip->getNameIndex($i);
    if ($prefix !== '' && strpos($name, $prefix) !== 0) { continue; }
    $rel = substr($name, strlen($prefix));
    if ($rel === '' || substr($rel, -1) === '/') { continue; }
    if (strpos($rel, '..') !== false || $rel[0] === '/' || strpos($rel, "\0") !== false || strpos($rel, '\\') !== false) { continue; }
    if (in_array($rel, $skip, true)) { continue; }
    $allowed = in_array($rel, $allowTop, true);
    foreach ($allowDirs as $d) { if (strpos($rel, $d) === 0) { $allowed = true; } }
    if (!$allowed) { continue; }
    $plan[$i] = $rel;
}
if (!in_array('index.php', $plan, true)) {
    $zip->close(); @unlink($tmp);
    lcu_fail(502, 'The archive does not look like a LenChat release (no index.php).');
}

$stamp  = gmdate('Ymd-His');
$backup = $root . '/.lenchat-backup/' . $stamp;
@mkdir($root . '/.lenchat-backup', 0755, true);
@file_put_contents($root . '/.lenchat-backup/.htaccess', "Require all denied\nDeny from all\n");
@file_put_contents($root . '/.lenchat-backup/index.html', '');

$written = 0;
foreach ($plan as $idx => $rel) {
    $data = $zip->getFromIndex($idx);
    if ($data === false) { continue; }
    $dest = $root . '/' . $rel;
    if (is_file($dest)) {
        $b = $backup . '/' . $rel;
        @mkdir(dirname($b), 0755, true);
        @copy($dest, $b);
    }
    @mkdir(dirname($dest), 0755, true);
    $part = $dest . '.lcu';
    if (file_put_contents($part, $data) === false || !@rename($part, $dest)) {
        @unlink($part);
        $zip->close(); @unlink($tmp);
        lcu_fail(500, "Could not write {$rel}. Files written so far are backed up in .lenchat-backup/{$stamp}/.");
    }
    $written++;
}
$zip->close();
@unlink($tmp);
if (function_exists('opcache_reset')) { @opcache_reset(); }

echo json_encode([
    'ok'      => true,
    'version' => ltrim($tag, 'vV'),
    'files'   => $written,
    'backup'  => ".lenchat-backup/{$stamp}",
    'message' => 'Updated. config.php was left as it was. Reload the page (Ctrl/Cmd+Shift+R) to load the new scripts.',
]);

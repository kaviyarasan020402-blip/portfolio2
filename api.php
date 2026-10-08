<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');

const DATA_FILE = __DIR__ . '/data/portfolio.json';
const IMG_DIR   = __DIR__ . '/uploads/img/';
const VID_DIR   = __DIR__ . '/uploads/videos/';

const IMG_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
const VID_TYPES = ['video/mp4' => 'mp4', 'video/x-m4v' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov'];

function out(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }

function loadData(): array {
    $d = is_file(DATA_FILE) ? json_decode((string)file_get_contents(DATA_FILE), true) : [];
    if (!is_array($d)) $d = [];
    return [
        'photo'  => is_string($d['photo'] ?? null) ? $d['photo'] : null,
        'work'   => array_values(is_array($d['work'] ?? null) ? $d['work'] : []),
        'videos' => array_values(is_array($d['videos'] ?? null) ? $d['videos'] : []),
    ];
}
function saveData(array $d): void {
    $dir = dirname(DATA_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $json = json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (@file_put_contents(DATA_FILE, $json, LOCK_EX) === false) {
        fail('Could not save data. Make the /data folder writable (permission 755 or 775).', 500);
    }
}
function clean($v, int $max): string {
    $v = is_string($v) ? trim($v) : '';
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}
function uploadError(int $code): string {
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
        return 'File is bigger than this server allows (upload_max_filesize = ' . ini_get('upload_max_filesize') . '). Compress it or use a link.';
    }
    if ($code === UPLOAD_ERR_PARTIAL) return 'Upload was interrupted. Try again.';
    if ($code === UPLOAD_ERR_NO_TMP_DIR || $code === UPLOAD_ERR_CANT_WRITE) return 'Server could not store the upload.';
    return 'Upload failed (code ' . $code . ').';
}
/** Validates + stores an uploaded file. Returns web path like "uploads/img/x.jpg", or null if no file sent. */
function saveUpload(string $field, array $allowed, string $dir, string $webDir, string $prefix, int $maxMb): ?string {
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) return null;
    $f = $_FILES[$field];
    if ($f['error'] !== UPLOAD_ERR_OK) fail(uploadError((int)$f['error']));
    if ($f['size'] > $maxMb * 1048576) fail('File is too large (max ' . $maxMb . ' MB).');
    if (class_exists('finfo')) {
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!isset($allowed[$mime])) fail('Unsupported file type (' . $mime . ').');
        $ext = $allowed[$mime];
    } else {
        $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, array_values($allowed), true)) fail('Unsupported file type.');
    }
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $name = $prefix . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], $dir . $name)) fail('Could not save the file. Make the /uploads folders writable.', 500);
    return $webDir . $name;
}
function removeFile(?string $path): void {
    if (!$path || !str_starts_with($path, 'uploads/')) return;
    $full = realpath(__DIR__ . '/' . $path);
    $base = realpath(__DIR__ . '/uploads');
    if ($full && $base && str_starts_with($full, $base . DIRECTORY_SEPARATOR) && is_file($full)) @unlink($full);
}

const TMP_DIR = __DIR__ . '/data/tmp/';
const VID_PATH_RE = '#^uploads/videos/reel-[a-f0-9]{12}\.(mp4|webm|mov)$#';

function rrmdir(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $f) {
        if ($f === '.' || $f === '..') continue;
        $p = $dir . '/' . $f;
        is_dir($p) ? rrmdir($p) : @unlink($p);
    }
    @rmdir($dir);
}
function cleanStaleChunks(): void {
    if (!is_dir(TMP_DIR)) return;
    foreach (scandir(TMP_DIR) ?: [] as $f) {
        if ($f === '.' || $f === '..') continue;
        $p = TMP_DIR . $f;
        if (is_dir($p) && filemtime($p) < time() - 86400) rrmdir($p);
    }
}
function newId(string $p): string { return $p . bin2hex(random_bytes(4)); }

// ---------- session ----------
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));

$action = (string)($_GET['action'] ?? 'list');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

// POST bigger than post_max_size arrives empty — give a useful message
if ($isPost && empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0
    && stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== false) {
    fail('Upload is bigger than this server allows (post_max_size = ' . ini_get('post_max_size') . '). Compress it or use a link.', 413);
}

// ---------- public ----------
if ($action === 'list') {
    $d = loadData();
    out(['ok' => true, 'photo' => $d['photo'], 'work' => $d['work'], 'videos' => $d['videos']]);
}
if ($action === 'me') {
    out(['ok' => true, 'admin' => !empty($_SESSION['admin']), 'csrf' => $_SESSION['csrf'],
         'configured' => ADMIN_PASSWORD !== 'change-me-now' && ADMIN_PASSWORD !== '']);
}
if ($action === 'login') {
    if (!$isPost) fail('POST required', 405);
    if (ADMIN_PASSWORD === 'change-me-now' || ADMIN_PASSWORD === '') fail('Set your own password in config.php first.', 403);
    $pw = (string)($_POST['password'] ?? '');
    if (!hash_equals(ADMIN_PASSWORD, $pw)) { usleep(900000); fail('Wrong password.', 401); }
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

// ---------- admin only ----------
if (empty($_SESSION['admin'])) fail('Please log in.', 401);
if (!$isPost) fail('POST required', 405);
$tok = $_POST['csrf'] ?? '';
if (!is_string($tok) || !hash_equals((string)$_SESSION['csrf'], $tok)) fail('Session expired. Reload the page and log in again.', 403);

$d = loadData();

switch ($action) {
    case 'add_work': {
        $title = clean($_POST['title'] ?? '', 120);
        if ($title === '') fail('Title is required.');
        $image = saveUpload('image', IMG_TYPES, IMG_DIR, 'uploads/img/', 'work', MAX_IMAGE_MB);
        if (!$image) fail('Please choose an image.');
        array_unshift($d['work'], [
            'id' => newId('w_'), 'title' => $title,
            'category' => clean($_POST['category'] ?? '', 60) ?: 'Posters',
            'description' => clean($_POST['description'] ?? '', 300),
            'image' => $image,
        ]);
        saveData($d);
        out(['ok' => true]);
    }
    case 'delete_work': {
        $id = (string)($_POST['id'] ?? '');
        foreach ($d['work'] as $i => $w) {
            if (($w['id'] ?? '') === $id) { removeFile($w['image'] ?? null); array_splice($d['work'], $i, 1); saveData($d); out(['ok' => true]); }
        }
        fail('Item not found.', 404);
    }
    case 'chunk': {
        // Receives one piece of a big video. Last piece assembles the file.
        $id    = (string)($_POST['upload_id'] ?? '');
        $index = (int)($_POST['index'] ?? -1);
        $total = (int)($_POST['total'] ?? 0);
        if (!preg_match('/^[a-f0-9]{16,32}$/', $id)) fail('Bad upload id.');
        if ($total < 1 || $total > 2000 || $index < 0 || $index >= $total) fail('Bad chunk numbers.');
        if (!isset($_FILES['chunk']) || !is_array($_FILES['chunk'])) fail('No chunk received.');
        $f = $_FILES['chunk'];
        if ($f['error'] !== UPLOAD_ERR_OK) fail(uploadError((int)$f['error']));
        if ($f['size'] > 16 * 1048576) fail('Chunk too large.');
        if (!is_dir(TMP_DIR)) @mkdir(TMP_DIR, 0755, true);
        if ($index === 0) cleanStaleChunks();
        $dir = TMP_DIR . $id . '/';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('Could not create temp folder. Make /data writable.', 500);
        if (!move_uploaded_file($f['tmp_name'], $dir . $index . '.part')) fail('Could not store chunk.', 500);
        if ($index < $total - 1) out(['ok' => true, 'done' => false]);

        // last chunk: all parts must exist
        for ($i = 0; $i < $total; $i++) {
            if (!is_file($dir . $i . '.part')) fail('Chunk ' . $i . ' is missing. Please upload again.');
        }
        if (!is_dir(VID_DIR)) @mkdir(VID_DIR, 0755, true);
        $tmpOut = VID_DIR . 'tmp-' . $id . '.bin';
        $o = @fopen($tmpOut, 'wb');
        if (!$o) { rrmdir($dir); fail('Could not write the video. Make /uploads/videos writable.', 500); }
        $size = 0;
        for ($i = 0; $i < $total; $i++) {
            $in = fopen($dir . $i . '.part', 'rb');
            $size += (int)stream_copy_to_stream($in, $o);
            fclose($in);
        }
        fclose($o);
        rrmdir($dir);
        if ($size > MAX_VIDEO_MB * 1048576) { @unlink($tmpOut); fail('Video is too large (max ' . MAX_VIDEO_MB . ' MB).'); }
        if (class_exists('finfo')) {
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmpOut);
            if (!isset(VID_TYPES[$mime])) { @unlink($tmpOut); fail('Unsupported video type (' . $mime . '). Use MP4, MOV or WEBM.'); }
            $ext = VID_TYPES[$mime];
        } else {
            $ext = strtolower(pathinfo((string)($_POST['filename'] ?? ''), PATHINFO_EXTENSION));
            if (!in_array($ext, array_values(VID_TYPES), true)) { @unlink($tmpOut); fail('Unsupported video type.'); }
        }
        $name = 'reel-' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (!@rename($tmpOut, VID_DIR . $name)) { @unlink($tmpOut); fail('Could not save the video.', 500); }
        out(['ok' => true, 'done' => true, 'path' => 'uploads/videos/' . $name]);
    }
    case 'add_video': {
        $title = clean($_POST['title'] ?? '', 120);
        if ($title === '') fail('Title is required.');
        $link = clean($_POST['video_link'] ?? '', 500);
        $file = saveUpload('video_file', VID_TYPES, VID_DIR, 'uploads/videos/', 'reel', MAX_VIDEO_MB);
        $chunked = (string)($_POST['video_path'] ?? '');
        if (!$file && $chunked !== '') {
            if (!preg_match(VID_PATH_RE, $chunked) || !is_file(__DIR__ . '/' . $chunked)) fail('Uploaded video not found. Please upload again.');
            $file = $chunked;
        }
        $poster = saveUpload('poster', IMG_TYPES, IMG_DIR, 'uploads/img/', 'poster', MAX_IMAGE_MB);
        if (!$file && $link === '') { removeFile($poster); fail('Upload a video file or paste a link.'); }
        if (!$file && !preg_match('#^https?://#i', $link)) { removeFile($poster); fail('The link must start with http:// or https://'); }
        array_unshift($d['videos'], [
            'id' => newId('v_'), 'title' => $title,
            'category' => clean($_POST['category'] ?? '', 60) ?: 'Reel',
            'description' => clean($_POST['description'] ?? '', 300),
            'video_url' => $file ?: $link,
            'poster_url' => $poster ?: '',
        ]);
        saveData($d);
        out(['ok' => true]);
    }
    case 'delete_video': {
        $id = (string)($_POST['id'] ?? '');
        foreach ($d['videos'] as $i => $v) {
            if (($v['id'] ?? '') === $id) {
                removeFile($v['video_url'] ?? null); removeFile($v['poster_url'] ?? null);
                array_splice($d['videos'], $i, 1); saveData($d); out(['ok' => true]);
            }
        }
        fail('Item not found.', 404);
    }
    case 'set_photo': {
        $p = saveUpload('photo', IMG_TYPES, IMG_DIR, 'uploads/img/', 'profile', MAX_IMAGE_MB);
        if (!$p) fail('Please choose a photo.');
        removeFile($d['photo']);
        $d['photo'] = $p; saveData($d);
        out(['ok' => true]);
    }
    case 'reset_photo': {
        removeFile($d['photo']); $d['photo'] = null; saveData($d);
        out(['ok' => true]);
    }
    default:
        fail('Unknown action.', 404);
}

# Updating LenChat

Your API keys, chats and settings live in the browser (localStorage), not on the server, so an update cannot lose them.
The only server file you may have edited is `config.php`.

## By hand (works everywhere)
1. Optional: Settings -> Export configuration, and Export sessions.
2. Download the release zip from GitHub and unzip it.
3. Upload everything to your host, replacing existing files. **Do not overwrite your `config.php`.**
4. Hard-reload the page (Ctrl/Cmd + Shift + R).

New options added to `config.php` in later versions fall back to defaults, so an older `config.php` keeps working.

## One click (optional)
In `config.php` set
```php
'update' => ['repo' => 'lenny-tishay/LenChat', 'branch' => 'main', 'auto_enabled' => true, 'token' => 'a-long-random-secret'],
```
then Settings -> Updates -> Check -> enter the token -> Update now. Needs PHP cURL + Zip and a writable folder. Replaced files are backed up in `.lenchat-backup/`. Keep this off on public installs.

# scan_programs.ps1
# Scans installed programs from the Windows Registry and Start Menu shortcuts.
# Outputs: Scanner/programs.json

$ErrorActionPreference = "SilentlyContinue"
$programs = @{}

# ── Helper: add a program entry (deduplicates by exe path) ──────────────────
function Add-Program {
    param([string]$Name, [string]$Command)

    if (-not $Name -or -not $Command) { return }
    $name = $Name.Trim()
    $cmd  = $Command.Trim()
    if (-not $name -or -not $cmd) { return }

    # Use lowercased command as dedup key
    $key = $cmd.ToLower()
    if (-not $programs.ContainsKey($key)) {
        $programs[$key] = [PSCustomObject]@{
            name    = $name
            command = $cmd
        }
    }
}

# ── Helper: resolve a .lnk shortcut target ──────────────────────────────────
function Resolve-Shortcut {
    param([string]$LnkPath)
    try {
        $shell  = New-Object -ComObject WScript.Shell
        $lnk    = $shell.CreateShortcut($LnkPath)
        return $lnk.TargetPath
    } catch { return $null }
}

# ── 1. Registry ──────────────────────────────────────────────────────────────
$regPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

foreach ($path in $regPaths) {
    $entries = Get-ItemProperty $path
    foreach ($entry in $entries) {
        $name = $entry.DisplayName
        if (-not $name) { continue }

        # Prefer DisplayIcon (usually points to the exe) over InstallLocation
        $exe = $null

        if ($entry.DisplayIcon) {
            # DisplayIcon can be "C:\path\to\app.exe,0" — strip the index
            $raw = ($entry.DisplayIcon -split ",")[0].Trim('"')
            if ($raw -match "\.exe$" -and (Test-Path $raw)) {
                $exe = $raw
            }
        }

        if (-not $exe -and $entry.InstallLocation) {
            # Walk the install dir and grab the first exe matching the product name
            $dir = $entry.InstallLocation.Trim('"')
            if (Test-Path $dir) {
                $candidate = Get-ChildItem -Path $dir -Filter "*.exe" -Depth 1 |
                    Where-Object { $_.BaseName -notmatch "unins|setup|update|crash|helper|report" } |
                    Select-Object -First 1
                if ($candidate) { $exe = $candidate.FullName }
            }
        }

        if ($exe) { Add-Program -Name $name -Command $exe }
    }
}

Write-Host "Registry: $($programs.Count) programs found."

# ── 2. Start Menu shortcuts (.lnk) ──────────────────────────────────────────
$startMenuDirs = @(
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
)

foreach ($dir in $startMenuDirs) {
    if (-not (Test-Path $dir)) { continue }

    Get-ChildItem -Path $dir -Filter "*.lnk" -Recurse | ForEach-Object {
        $target = Resolve-Shortcut -LnkPath $_.FullName
        if ($target -and $target -match "\.exe$" -and (Test-Path $target)) {
            # Use the shortcut filename (without .lnk) as the display name
            $name = $_.BaseName
            Add-Program -Name $name -Command $target
        }
    }
}

Write-Host "After Start Menu: $($programs.Count) programs total."

# ── Filter parasites ─────────────────────────────────────────────────────────

# Exe filename patterns to exclude
$exeBlacklist = "^(unins|uninst|uninstall|setup|install|installer|update|updater|crash|helper|report|patcher|redist|vcredist|runtime|prerequisit|7z|gengal|oemdrv|jabswitch|nvconta|nvfvsd|writer|node|python|pythonw|powershell|cmd|msiexec|soffice)$"

# Path fragment patterns to exclude
$pathBlacklist = "\\Package Cache\\|\\system32\\|\\syswow64\\|\\SysWOW64\\|\\WINDOWS\\|\\Windows\\System|NvContainer|FrameViewSDK|WebView2|system_tray|\\CEF\\|NvContainer|\\bin64\\7z|CIM\\BIN"

# Name patterns to exclude
$nameBlacklist = "uninstall|désinstaller|install|setup|redistributable|runtime|visual c\+\+|\.net |directx|\bsdk\b|driver|chipset|\bhal\b|vanguard|rockstar.*sdk|wd.*p40|wd_black|verbatim|\bene \b|nvidia container|nvidia frame|edge webview|launcher prerequisites|windows desktop runtime|windows software development kit|windows app cert kit|visual studio installer|java.*se development kit|install additional tools|mode sans échec|safe mode|keyz rubidium|dropbox redeem|launch4j|\bidle\b.*python|libreoffice base|libreoffice draw|libreoffice impress|libreoffice math|libreoffice writer|libreoffice calc|libreoffice 25|writer\.exe|rawaccel|msi center|mumble \(client\)|logitech.*system.tray|overwolf$|git (cmd|gui|bash)|roblox.*for |roblox studio|microsoft visual studio code|node\.js|python 3\.|windows media player|copilot|onedrive|windows powersh|windows fax|technitium|ollama version|docker desktop"

$list = $programs.Values | Where-Object {
    $exe  = $_.command
    $name = $_.name

    $exeName = [System.IO.Path]::GetFileNameWithoutExtension($exe)
    if ($exeName -imatch $exeBlacklist)  { return $false }
    if ($exe   -imatch $pathBlacklist)   { return $false }
    if ($name  -imatch $nameBlacklist)   { return $false }

    return $true
} | Sort-Object name

# Deduplicate by product name — keep only the entry with the shortest path
# (handles cases like two "Microsoft Edge" or two "Logitech G HUB")
$list = $list | Group-Object name | ForEach-Object {
    $_.Group | Sort-Object { $_.command.Length } | Select-Object -First 1
} | Sort-Object name

# ── Output ───────────────────────────────────────────────────────────────────
$outputPath = Join-Path $PSScriptRoot "programs.json"

$list | ConvertTo-Json -Depth 3 | Out-File -FilePath $outputPath -Encoding utf8

Write-Host "Saved $($list.Count) programs to: $outputPath"

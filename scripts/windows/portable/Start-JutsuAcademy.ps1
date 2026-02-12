Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log([string]$message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
    Write-Host $line
    try {
        Add-Content -Path (Join-Path $PSScriptRoot "launcher.log") -Value $line
    } catch {
        # ignore logging errors
    }
}

function Load-DotEnv([string]$path) {
    $envMap = @{}
    if (-not (Test-Path $path)) {
        return $envMap
    }
    foreach ($line in Get-Content -Path $path) {
        $trim = $line.Trim()
        if (-not $trim -or $trim.StartsWith("#")) {
            continue
        }
        $idx = $trim.IndexOf("=")
        if ($idx -lt 1) {
            continue
        }
        $key = $trim.Substring(0, $idx).Trim()
        $val = $trim.Substring($idx + 1).Trim().Trim("'`"")
        $envMap[$key] = $val
    }
    return $envMap
}

function Parse-Version([string]$v) {
    $parts = $v -split '[^0-9]+' | Where-Object { $_ -ne "" }
    $nums = @()
    foreach ($p in $parts) {
        $nums += [int]$p
    }
    while ($nums.Count -lt 3) {
        $nums += 0
    }
    return ,$nums
}

function Compare-Version([string]$a, [string]$b) {
    $va = Parse-Version $a
    $vb = Parse-Version $b
    for ($i = 0; $i -lt 3; $i++) {
        if ($va[$i] -gt $vb[$i]) { return 1 }
        if ($va[$i] -lt $vb[$i]) { return -1 }
    }
    return 0
}

function Get-CurrentVersion([string]$versionPath) {
    if (-not (Test-Path $versionPath)) {
        return "0.0.0"
    }
    return (Get-Content -Path $versionPath -Raw).Trim()
}

function Get-RemoteVersionConfig([string]$supabaseUrl, [string]$anonKey) {
    $base = $supabaseUrl.TrimEnd("/")
    $query = "/rest/v1/app_config?type=eq.version&is_active=eq.true&order=priority.desc,created_at.desc&limit=1"
    $uri = "$base$query"
    $headers = @{
        "apikey" = $anonKey
        "Authorization" = "Bearer $anonKey"
    }
    try {
        $resp = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers -TimeoutSec 15
        if ($resp -is [System.Array] -and $resp.Count -gt 0) {
            return $resp[0]
        }
    } catch {
        Write-Log "[WARN] Version check failed: $($_.Exception.Message)"
    }
    return $null
}

function Resolve-AppPayloadRoot([string]$expandedDir) {
    $appDirect = Join-Path $expandedDir "app"
    if (Test-Path (Join-Path $appDirect "JutsuAcademy.exe")) {
        return $appDirect
    }

    $children = Get-ChildItem -Path $expandedDir -Directory -ErrorAction SilentlyContinue
    foreach ($d in $children) {
        if (Test-Path (Join-Path $d.FullName "app\JutsuAcademy.exe")) {
            return (Join-Path $d.FullName "app")
        }
        if (Test-Path (Join-Path $d.FullName "JutsuAcademy.exe")) {
            return $d.FullName
        }
    }

    if (Test-Path (Join-Path $expandedDir "JutsuAcademy.exe")) {
        return $expandedDir
    }
    return $null
}

function Install-PortableUpdate(
    [string]$downloadUrl,
    [string]$remoteVersion,
    [string]$targetRoot,
    [string]$versionPath,
    [string]$checksum
) {
    Write-Log "Update available -> $remoteVersion"
    $tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jutsu_upd_" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $tmpRoot "update.zip"
    $expandDir = Join-Path $tmpRoot "expanded"
    New-Item -ItemType Directory -Path $tmpRoot | Out-Null
    New-Item -ItemType Directory -Path $expandDir | Out-Null

    try {
        Write-Log "Downloading update package..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -TimeoutSec 300

        if ($checksum) {
            $fileHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
            if ($fileHash -ne $checksum.ToLower()) {
                throw "Checksum mismatch. Expected $checksum, got $fileHash"
            }
        }

        Write-Log "Extracting update package..."
        Expand-Archive -Path $zipPath -DestinationPath $expandDir -Force
        $newAppSource = Resolve-AppPayloadRoot -expandedDir $expandDir
        if (-not $newAppSource) {
            throw "Could not locate app payload in update zip."
        }

        $appDir = Join-Path $targetRoot "app"
        $backupDir = Join-Path $targetRoot "app_backup"

        if (Test-Path $backupDir) {
            Remove-Item $backupDir -Recurse -Force
        }
        if (Test-Path $appDir) {
            Move-Item -Path $appDir -Destination $backupDir
        }

        Copy-Item -Path $newAppSource -Destination $appDir -Recurse -Force
        Set-Content -Path $versionPath -Value $remoteVersion -NoNewline

        if (Test-Path $backupDir) {
            Remove-Item $backupDir -Recurse -Force
        }

        Write-Log "Update installed successfully."
        return $true
    } catch {
        Write-Log "[ERROR] Update installation failed: $($_.Exception.Message)"
        $appDir = Join-Path $targetRoot "app"
        $backupDir = Join-Path $targetRoot "app_backup"
        if ((-not (Test-Path $appDir)) -and (Test-Path $backupDir)) {
            Move-Item -Path $backupDir -Destination $appDir
            Write-Log "Rollback complete."
        }
        return $false
    } finally {
        if (Test-Path $tmpRoot) {
            Remove-Item $tmpRoot -Recurse -Force
        }
    }
}

$targetRoot = $PSScriptRoot
$appDir = Join-Path $targetRoot "app"
$exePath = Join-Path $appDir "JutsuAcademy.exe"
$versionPath = Join-Path $targetRoot "version.txt"

if (-not (Test-Path $exePath)) {
    Write-Log "[ERROR] Missing app executable: $exePath"
    exit 1
}

$localVersion = Get-CurrentVersion -versionPath $versionPath
Write-Log "Local version: $localVersion"

$envPath = Join-Path $targetRoot ".env"
$envMap = Load-DotEnv -path $envPath
$supabaseUrl = if ($envMap.ContainsKey("SUPABASE_URL")) { $envMap["SUPABASE_URL"] } else { $envMap["NEXT_PUBLIC_SUPABASE_URL"] }
$anonKey = ""
if ($envMap.ContainsKey("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    $anonKey = $envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
} elseif ($envMap.ContainsKey("SUPABASE_ANON_KEY")) {
    $anonKey = $envMap["SUPABASE_ANON_KEY"]
}

if (-not $supabaseUrl) {
    $supabaseUrl = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { $env:NEXT_PUBLIC_SUPABASE_URL }
}
if (-not $anonKey) {
    if ($env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        $anonKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
    } elseif ($env:SUPABASE_ANON_KEY) {
        $anonKey = $env:SUPABASE_ANON_KEY
    }
}

if ($supabaseUrl -and $anonKey) {
    $remoteCfg = Get-RemoteVersionConfig -supabaseUrl $supabaseUrl -anonKey $anonKey
    if ($remoteCfg) {
        $remoteVersion = [string]$remoteCfg.version
        $downloadUrl = [string]$remoteCfg.url
        $checksum = [string]$remoteCfg.checksum
        if ($downloadUrl -and (Compare-Version $remoteVersion $localVersion) -gt 0) {
            $ok = Install-PortableUpdate `
                -downloadUrl $downloadUrl `
                -remoteVersion $remoteVersion `
                -targetRoot $targetRoot `
                -versionPath $versionPath `
                -checksum $checksum
            if ($ok) {
                $localVersion = $remoteVersion
            }
        }
    }
} else {
    Write-Log "[WARN] Missing SUPABASE_URL or anon key in .env; update check skipped."
}

if (-not (Test-Path $exePath)) {
    Write-Log "[ERROR] Executable missing after update attempt: $exePath"
    exit 2
}

Write-Log "Launching JutsuAcademy.exe"
Start-Process -FilePath $exePath -WorkingDirectory $appDir

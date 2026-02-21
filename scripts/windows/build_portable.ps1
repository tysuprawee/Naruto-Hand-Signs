param(
    [string]$AppName = "JutsuAcademy",
    [switch]$SkipBuild,
    [switch]$SkipDeps,
    [switch]$AllowDefaultEnv
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $scriptDir = if ($PSScriptRoot) {
        $PSScriptRoot
    } elseif ($PSCommandPath) {
        Split-Path -Parent $PSCommandPath
    } else {
        throw "Could not determine script directory."
    }
    return (Resolve-Path (Join-Path $scriptDir "..\..")).Path
}

function Get-AppVersion([string]$repoRoot) {
    $sharedPath = Join-Path $repoRoot "src\jutsu_academy\main_pygame_shared.py"
    $content = Get-Content -Path $sharedPath -Raw
    $m = [regex]::Match($content, 'APP_VERSION\s*=\s*"([^"]+)"')
    if (-not $m.Success) {
        throw "Could not parse APP_VERSION from $sharedPath"
    }
    return $m.Groups[1].Value
}

function Assert-NoServiceRoleKey([string]$envFilePath) {
    if (-not (Test-Path $envFilePath)) {
        return
    }
    $matches = Select-String -Path $envFilePath -Pattern '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' -SimpleMatch:$false
    if ($matches) {
        throw "Refusing to package $envFilePath because it contains SUPABASE_SERVICE_ROLE_KEY."
    }
}

function Assert-ReleaseEnvReady([string]$repoRoot, [bool]$allowDefaultEnv) {
    $releaseEnv = Join-Path $repoRoot ".env.release"
    $defaultEnv = Join-Path $repoRoot ".env"

    if (Test-Path $releaseEnv) {
        Assert-NoServiceRoleKey -envFilePath $releaseEnv
        return
    }

    if ((Test-Path $defaultEnv) -and $allowDefaultEnv) {
        Assert-NoServiceRoleKey -envFilePath $defaultEnv
        return
    }

    throw "No .env.release found. Create .env.release (from .env.release.example) before building portable release artifacts."
}

function Copy-ReleaseEnv([string]$repoRoot, [string]$targetDir, [bool]$allowDefaultEnv) {
    $releaseEnv = Join-Path $repoRoot ".env.release"
    $defaultEnv = Join-Path $repoRoot ".env"
    if (Test-Path $releaseEnv) {
        Assert-NoServiceRoleKey -envFilePath $releaseEnv
        Copy-Item $releaseEnv (Join-Path $targetDir ".env") -Force
        Write-Host "Copied .env.release -> $targetDir\\.env"
        return
    }

    if ((Test-Path $defaultEnv) -and $allowDefaultEnv) {
        Assert-NoServiceRoleKey -envFilePath $defaultEnv
        Copy-Item $defaultEnv (Join-Path $targetDir ".env") -Force
        Write-Warning "Copied .env to portable package because -AllowDefaultEnv was set. Use for local testing only."
        return
    }

    throw "No .env.release found. Create .env.release (from .env.release.example) before building portable release artifacts."
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
Assert-ReleaseEnvReady -repoRoot $repoRoot -allowDefaultEnv $AllowDefaultEnv.IsPresent

$appVersion = Get-AppVersion -repoRoot $repoRoot
$distDir = Join-Path $repoRoot ("dist\" + $AppName)

if (-not $SkipBuild) {
    Write-Host "Building app folder first..."
    $buildScript = Join-Path $repoRoot "scripts\windows\build_windows.ps1"
    $args = @("-ExecutionPolicy","Bypass","-File",$buildScript,"-AppName",$AppName)
    if ($SkipDeps) { $args += "-SkipDeps" }
    if ($AllowDefaultEnv) { $args += "-AllowDefaultEnv" }
    powershell @args
}

if (-not (Test-Path $distDir)) {
    throw "Build output missing: $distDir"
}

$portableRoot = Join-Path $repoRoot "dist_portable"
$portableName = "JutsuAcademy-Portable-v$appVersion"
$portableDir = Join-Path $portableRoot $portableName

if (Test-Path $portableDir) {
    Remove-Item $portableDir -Recurse -Force
}
New-Item -ItemType Directory -Path $portableDir | Out-Null

Write-Host "Staging portable package: $portableDir"
Copy-Item -Path $distDir -Destination (Join-Path $portableDir "app") -Recurse -Force
Copy-Item -Path (Join-Path $repoRoot "scripts\windows\portable\Start-JutsuAcademy.ps1") -Destination (Join-Path $portableDir "Start-JutsuAcademy.ps1") -Force
Copy-Item -Path (Join-Path $repoRoot "scripts\windows\portable\Start-JutsuAcademy.bat") -Destination (Join-Path $portableDir "Start-JutsuAcademy.bat") -Force
Set-Content -Path (Join-Path $portableDir "version.txt") -Value $appVersion -NoNewline

Copy-ReleaseEnv -repoRoot $repoRoot -targetDir $portableDir -allowDefaultEnv $AllowDefaultEnv.IsPresent

$zipPath = Join-Path $portableRoot ($portableName + ".zip")
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path $portableDir -DestinationPath $zipPath -CompressionLevel Optimal -Force
$hash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()

Write-Host ""
Write-Host "Portable package ready:"
Write-Host "  Folder: $portableDir"
Write-Host "  Zip:    $zipPath"
Write-Host "  SHA256: $hash"
Write-Host ""
Write-Host "Publish zip to a public URL, then update app_config version row:"
Write-Host "  type='version', version='$appVersion', url='<zip_url>', checksum='$hash', is_active=true"

param(
    [string]$AppName = "JutsuAcademy",
    [string]$AppVersion = "",
    [string]$IsccPath = ""
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

function Resolve-Iscc([string]$explicitPath) {
    if ($explicitPath -and (Test-Path $explicitPath)) {
        return (Resolve-Path $explicitPath).Path
    }

    try {
        return (Get-Command iscc -ErrorAction Stop).Source
    } catch {
        $fallbacks = @(
            "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
            "C:\Program Files\Inno Setup 6\ISCC.exe",
            (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
        )
        foreach ($fallback in $fallbacks) {
            if ($fallback -and (Test-Path $fallback)) {
                return $fallback
            }
        }
    }

    throw "Inno Setup compiler (ISCC.exe) not found. Install Inno Setup 6 or pass -IsccPath."
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($AppVersion)) {
    $AppVersion = Get-AppVersion -repoRoot $repoRoot
}

$distDir = Join-Path $repoRoot ("dist\" + $AppName)
if (-not (Test-Path $distDir)) {
    throw "Dist folder not found: $distDir (run build_windows.ps1 first)"
}

$issPath = Join-Path $repoRoot "scripts\windows\JutsuAcademy.iss"
if (-not (Test-Path $issPath)) {
    throw "Installer script not found: $issPath"
}

$iscc = Resolve-Iscc -explicitPath $IsccPath
Write-Host "Using ISCC: $iscc"
Write-Host "Creating installer for $AppName v$AppVersion"

& $iscc `
    "/DMyAppVersion=$AppVersion" `
    "/DMyAppExeName=$AppName.exe" `
    "/DMySourceDir=$distDir" `
    $issPath

$outDir = Join-Path $repoRoot "dist_installer"
Write-Host ""
Write-Host "Installer output:"
Write-Host "  $outDir"


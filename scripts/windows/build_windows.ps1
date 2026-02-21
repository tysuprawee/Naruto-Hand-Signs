param(
    [string]$VenvDir = ".venv-build",
    [string]$AppName = "JutsuAcademy",
    [switch]$SkipDeps,
    [switch]$NoClean,
    [switch]$MakeInstaller,
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
    if (-not (Test-Path $sharedPath)) {
        throw "Cannot find app version source file: $sharedPath"
    }
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

    throw "No .env.release found. Create .env.release (from .env.release.example) before building release artifacts."
}

function Copy-ReleaseEnv([string]$repoRoot, [string]$targetDir, [bool]$allowDefaultEnv, [string]$pythonExe) {
    $releaseEnv = Join-Path $repoRoot ".env.release"
    $defaultEnv = Join-Path $repoRoot ".env"
    $obfuscator = Join-Path $repoRoot "src\jutsu_academy\config_obfuscator.py"
    $configDat = Join-Path $targetDir ".config.dat"

    # Determine which env file to use
    $envFile = $null
    if (Test-Path $releaseEnv) {
        Assert-NoServiceRoleKey -envFilePath $releaseEnv
        $envFile = $releaseEnv
    } elseif ((Test-Path $defaultEnv) -and $allowDefaultEnv) {
        Assert-NoServiceRoleKey -envFilePath $defaultEnv
        $envFile = $defaultEnv
        Write-Warning "Using .env (not .env.release) because -AllowDefaultEnv was set."
    } else {
        throw "No .env.release found. Create .env.release (from .env.release.example) before building release artifacts."
    }

    # Encode to obfuscated .config.dat (hides credentials from casual snooping)
    if (Test-Path $obfuscator) {
        Write-Host "Encoding config to obfuscated .config.dat..."
        & $pythonExe $obfuscator encode $envFile $configDat
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Encoded $envFile -> $configDat (credentials hidden)"
            $plainEnv = Join-Path $targetDir ".env"
            if (Test-Path $plainEnv) { Remove-Item $plainEnv -Force }
            return
        }
        Write-Warning "Obfuscation failed, falling back to plain .env copy."
    }

    # Fallback: plain copy (dev/testing only)
    Copy-Item $envFile (Join-Path $targetDir ".env") -Force
    Write-Host "Copied $envFile -> $targetDir\.env (plain text fallback)"
}



$repoRoot = Get-RepoRoot
Set-Location $repoRoot
Assert-ReleaseEnvReady -repoRoot $repoRoot -allowDefaultEnv $AllowDefaultEnv.IsPresent

if (-not (Test-Path "src\jutsu_academy\main_pygame.py")) {
    throw "Entry point missing: src\jutsu_academy\main_pygame.py"
}

$appVersion = Get-AppVersion -repoRoot $repoRoot
Write-Host "Building $AppName v$appVersion from $repoRoot"

if (-not (Test-Path $VenvDir)) {
    Write-Host "Creating virtual environment: $VenvDir"
    py -3.10 -m venv $VenvDir
}

$pythonExe = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found in venv: $pythonExe"
}

if (-not $SkipDeps) {
    Write-Host "Installing dependencies..."
    & $pythonExe -m pip install --upgrade pip wheel
    & $pythonExe -m pip install -r requirements.txt
    & $pythonExe -m pip install pyinstaller
}

if (-not $NoClean) {
    if (Test-Path "build") { Remove-Item "build" -Recurse -Force }
    if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
}

Write-Host "Running PyInstaller..."
& $pythonExe -m PyInstaller `
    --noconfirm `
    --clean `
    --windowed `
    --name $AppName `
    --add-data "src;src" `
    --add-data "models;models" `
    --add-data "yolo_config;yolo_config" `
    --add-data "yolov8n.pt;." `
    --collect-all mediapipe `
    src/jutsu_academy/main_pygame.py

$distDir = Join-Path $repoRoot ("dist\" + $AppName)
if (-not (Test-Path $distDir)) {
    throw "Build output missing: $distDir"
}

Copy-ReleaseEnv -repoRoot $repoRoot -targetDir $distDir -allowDefaultEnv $AllowDefaultEnv.IsPresent -pythonExe $pythonExe

Write-Host ""
Write-Host "Build completed:"
Write-Host "  $distDir"

if ($MakeInstaller) {
    Write-Host "Building installer..."
    & (Join-Path $repoRoot "scripts\windows\make_installer.ps1") -AppName $AppName -AppVersion $appVersion
}

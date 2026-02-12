Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [string]$VenvDir = ".venv-build",
    [string]$AppName = "JutsuAcademy",
    [switch]$SkipDeps,
    [switch]$NoClean,
    [switch]$MakeInstaller,
    [switch]$AllowDefaultEnv
)

function Get-RepoRoot {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
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
        Write-Warning "Copied .env to build output because -AllowDefaultEnv was set. Use for local testing only."
        return
    }

    Write-Warning "No environment file copied. Add .env.release for release builds."
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

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
    src/jutsu_academy/main_pygame.py

$distDir = Join-Path $repoRoot ("dist\" + $AppName)
if (-not (Test-Path $distDir)) {
    throw "Build output missing: $distDir"
}

Copy-ReleaseEnv -repoRoot $repoRoot -targetDir $distDir -allowDefaultEnv $AllowDefaultEnv.IsPresent

Write-Host ""
Write-Host "Build completed:"
Write-Host "  $distDir"

if ($MakeInstaller) {
    Write-Host "Building installer..."
    & (Join-Path $repoRoot "scripts\windows\make_installer.ps1") -AppName $AppName -AppVersion $appVersion
}

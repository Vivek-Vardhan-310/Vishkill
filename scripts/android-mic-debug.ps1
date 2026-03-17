param(
    [switch]$Build,
    [switch]$Install,
    [switch]$Logs,
    [string]$DeviceId
)

$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
    $candidates = @()

    if ($env:LOCALAPPDATA) {
        $candidates += Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    }
    if ($env:USERPROFILE) {
        $candidates += Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk\platform-tools\adb.exe"
    }
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
    }
    if ($env:ANDROID_HOME) {
        $candidates += Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    }

    $candidates = $candidates | Where-Object { $_ -and (Test-Path $_) }

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if ($adb) {
        return $adb.Source
    }

    throw "adb.exe was not found. Install Android platform-tools or add adb to PATH."
}

function Get-AdbArgs {
    param([string]$DeviceId)

    if ([string]::IsNullOrWhiteSpace($DeviceId)) {
        return @()
    }

    return @("-s", $DeviceId)
}

function Require-Apk {
    $apkPath = Join-Path $PSScriptRoot "..\android\app\build\outputs\apk\debug\app-debug.apk"
    $resolved = [System.IO.Path]::GetFullPath($apkPath)

    if (-not (Test-Path $resolved)) {
        throw "Debug APK not found at $resolved. Run with -Build first."
    }

    return $resolved
}

if (-not ($Build -or $Install -or $Logs)) {
    $Build = $true
    $Install = $true
    $Logs = $true
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$adbPath = Resolve-AdbPath
$adbArgs = Get-AdbArgs -DeviceId $DeviceId

Write-Host "Using adb at $adbPath"

if ($Build) {
    Write-Host "Building Android debug APK..."
    $env:GRADLE_USER_HOME = Join-Path $repoRoot ".gradle"
    Push-Location (Join-Path $repoRoot "android")
    try {
        & "cmd.exe" "/c" "gradlew.bat assembleDebug"
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

if ($Install) {
    $apk = Require-Apk
    Write-Host "Checking connected devices..."
    & $adbPath @adbArgs devices
    if ($LASTEXITCODE -ne 0) {
        throw "adb devices failed with exit code $LASTEXITCODE"
    }

    Write-Host "Installing $apk..."
    & $adbPath @adbArgs install -r $apk
    if ($LASTEXITCODE -ne 0) {
        throw "APK install failed with exit code $LASTEXITCODE"
    }
}

if ($Logs) {
    Write-Host "Clearing existing logs..."
    & $adbPath @adbArgs logcat -c
    Write-Host "Tailing VishKill microphone logs. Press Ctrl+C to stop."
    & $adbPath @adbArgs logcat `
        "VoiceMonitorService:D" `
        "ScamMonitorPlugin:D" `
        "ActivityManager:I" `
        "*:S"
}

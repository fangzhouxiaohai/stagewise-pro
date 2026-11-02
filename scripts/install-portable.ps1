param(
  [string]$Source = "$PSScriptRoot\..\apps\browser\out\release\stagewise-pro-win32-x64",
  [string]$Target = 'E:\softs\stagewise-pro',
  [switch]$SkipShortcuts
)

$ErrorActionPreference = 'Stop'

$resolvedTarget = [System.IO.Path]::GetFullPath($Target)
$resolvedSource = [System.IO.Path]::GetFullPath($Source)

# 仅允许安装到 E:\softs 下，避免误写系统盘。
if (-not $resolvedTarget.StartsWith('E:\softs\', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "目标目录必须位于 E:\softs 下：$resolvedTarget"
}

$sourceExe = Join-Path $resolvedSource 'stagewise-pro.exe'
if (-not (Test-Path $sourceExe)) {
  throw "未找到打包产物 stagewise-pro.exe：$resolvedSource"
}

Write-Output "源目录：$resolvedSource"
Write-Output "目标目录：$resolvedTarget"

# 停止从目标目录运行的旧实例。
Get-Process -Name 'stagewise-pro' -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    if ($_.Path -and $_.Path.StartsWith($resolvedTarget, [System.StringComparison]::OrdinalIgnoreCase)) {
      Stop-Process -Id $_.Id -Force
    }
  } catch {
    # 进程可能已退出或 Path 不可读，忽略。
  }
}

if (Test-Path $resolvedTarget) {
  Remove-Item -Recurse -Force $resolvedTarget
}
New-Item -ItemType Directory -Path $resolvedTarget -Force | Out-Null

Copy-Item -Path (Join-Path $resolvedSource '*') -Destination $resolvedTarget -Recurse -Force

$targetExe = Join-Path $resolvedTarget 'stagewise-pro.exe'
if (-not (Test-Path $targetExe)) {
  throw "复制后未找到可执行文件：$targetExe"
}

if (-not $SkipShortcuts) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcutPaths = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\stagewise pro.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'stagewise pro.lnk')
  )
  foreach ($shortcutPath in $shortcutPaths) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetExe
    $shortcut.WorkingDirectory = $resolvedTarget
    $shortcut.IconLocation = "$targetExe,0"
    $shortcut.Description = 'stagewise pro'
    $shortcut.Save()
    Write-Output "已创建快捷方式：$shortcutPath"
  }
}

Write-Output "安装完成：$targetExe"

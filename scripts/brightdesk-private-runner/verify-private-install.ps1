param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectDir
)

$ErrorActionPreference = 'Stop'
$releaseDir = Join-Path $ProjectDir 'release'
$package = Get-Content -Raw (Join-Path $ProjectDir 'package.json') | ConvertFrom-Json
$installerPath = Join-Path $releaseDir "Brightdesk-Setup-$($package.version)-x64.exe"
$installDir = Join-Path $env:RUNNER_TEMP 'brightdesk-install-smoke'

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
  throw 'The expected Windows NSIS installer was not found.'
}

try {
  if (Test-Path -LiteralPath $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }

  Write-Output 'Brightdesk Windows smoke test stage: installer execution.'
  $install = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "The Windows installer exited with code $($install.ExitCode)."
  }

  $appPath = Join-Path $installDir 'Brightdesk.exe'
  if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw 'The Windows installer did not install Brightdesk.exe.'
  }

  Write-Output 'Brightdesk Windows smoke test stage: application launch.'
  $appProcess = Start-Process -FilePath $appPath -PassThru
  Start-Sleep -Seconds 5
  $appProcess.Refresh()
  if ($appProcess.HasExited) {
    if ($appProcess.ExitCode -ne 0) {
      throw 'The installed Windows application did not launch its version check.'
    }
  } else {
    taskkill.exe /PID $appProcess.Id /T /F | Out-Null
    Wait-Process -Id $appProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
  }

  $uninstaller = Join-Path $installDir 'Uninstall Brightdesk.exe'
  if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
    throw 'The Windows installer did not create its uninstaller.'
  }

  Write-Output 'Brightdesk Windows smoke test stage: uninstaller execution.'
  $remove = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
  if ($remove.ExitCode -ne 0) {
    throw "The Windows uninstaller exited with code $($remove.ExitCode)."
  }
}
finally {
  if (Test-Path -LiteralPath $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }
}

Write-Output 'Brightdesk Windows install, launch and uninstall smoke test passed.'

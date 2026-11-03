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

  $install = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "The Windows installer exited with code $($install.ExitCode)."
  }

  $appPath = Join-Path $installDir 'Brightdesk.exe'
  if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw 'The Windows installer did not install Brightdesk.exe.'
  }

  & $appPath --version
  if ($LASTEXITCODE -ne 0) {
    throw 'The installed Windows application did not launch its version check.'
  }

  $uninstaller = Join-Path $installDir 'Uninstall Brightdesk.exe'
  if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
    throw 'The Windows installer did not create its uninstaller.'
  }

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

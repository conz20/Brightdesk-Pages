param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectDir
)

$ErrorActionPreference = 'Stop'
$releaseDir = Join-Path $ProjectDir 'release'
$package = Get-Content -Raw (Join-Path $ProjectDir 'package.json') | ConvertFrom-Json
$productName = [string]$package.build.productName
$artifactTemplate = [string]$package.build.win.artifactName
if ([string]::IsNullOrWhiteSpace($productName) -or [string]::IsNullOrWhiteSpace($artifactTemplate)) {
  throw 'The product manifest must define build.productName and build.win.artifactName.'
}

$installerName = $artifactTemplate.Replace('${version}', [string]$package.version).Replace('${arch}', 'x64').Replace('${ext}', 'exe').Replace('${productName}', $productName)
if ($installerName -match '\$\{[^}]+\}') {
  throw 'The Windows installer filename contains an unsupported unresolved template value.'
}
$installerPath = Join-Path $releaseDir $installerName

$executableName = [string]$package.build.win.executableName
if ([string]::IsNullOrWhiteSpace($executableName)) {
  $executableName = [string]$package.build.executableName
}
if ([string]::IsNullOrWhiteSpace($executableName)) {
  $executableName = $productName
}

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  [System.IO.Path]::GetTempPath()
} else {
  $env:RUNNER_TEMP
}
$installDir = Join-Path $tempRoot ("brightdesk-install-smoke-" + [guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $installDir) {
  throw 'The unique Windows installer smoke-test directory unexpectedly already exists.'
}
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
  throw 'The expected Windows NSIS installer was not found.'
}

New-Item -ItemType Directory -Path $installDir | Out-Null
try {
  Write-Output 'Brightdesk Windows smoke test stage: installer execution.'
  $install = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "The Windows installer exited with code $($install.ExitCode)."
  }

  $appPath = Join-Path $installDir "$executableName.exe"
  if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
    throw 'The Windows installer did not install the product executable.'
  }
  $nativeAddonPath = Join-Path $installDir 'resources\app.asar.unpacked\native\brightdesk_engine.node'
  if (-not (Test-Path -LiteralPath $nativeAddonPath -PathType Leaf)) {
    throw 'The Windows installer did not include the unpacked Rust native addon.'
  }

  Write-Output 'Brightdesk Windows smoke test stage: application launch.'
  $previousSmokeTestSetting = $env:BRIGHTDESK_STARTUP_SMOKE_TEST
  $previousNativeRequirement = $env:BRIGHTDESK_REQUIRE_NATIVE_ENGINE
  $previousTestUserDataDir = $env:BRIGHTDESK_TEST_USER_DATA_DIR
  $smokeUserDataDir = Join-Path $tempRoot ("brightdesk-startup-smoke-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $smokeUserDataDir | Out-Null
  try {
    & node (Join-Path $ProjectDir 'scripts/brightdesk-private-runner/prepare-smoke-user-data.js') (Join-Path $ProjectDir 'TERMS_AND_CONDITIONS.txt') (Join-Path $ProjectDir 'package.json') $smokeUserDataDir
    if ($LASTEXITCODE -ne 0) {
      throw 'Could not prepare an isolated terms-accepted smoke-test profile.'
    }
    $env:BRIGHTDESK_TEST_USER_DATA_DIR = $smokeUserDataDir
    $env:BRIGHTDESK_STARTUP_SMOKE_TEST = '1'
    $env:BRIGHTDESK_REQUIRE_NATIVE_ENGINE = '1'
    $appProcess = Start-Process -FilePath $appPath -PassThru
    if (-not $appProcess.WaitForExit(20000)) {
      taskkill.exe /PID $appProcess.Id /T /F | Out-Null
      Wait-Process -Id $appProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
      throw 'The installed Windows application did not complete its renderer startup check.'
    }
    if ($appProcess.ExitCode -ne 0) {
      throw 'The installed Windows application did not complete its renderer startup check.'
    }
  }
  finally {
    if ($null -eq $previousSmokeTestSetting) {
      Remove-Item Env:BRIGHTDESK_STARTUP_SMOKE_TEST -ErrorAction SilentlyContinue
    } else {
      $env:BRIGHTDESK_STARTUP_SMOKE_TEST = $previousSmokeTestSetting
    }
    if ($null -eq $previousNativeRequirement) {
      Remove-Item Env:BRIGHTDESK_REQUIRE_NATIVE_ENGINE -ErrorAction SilentlyContinue
    } else {
      $env:BRIGHTDESK_REQUIRE_NATIVE_ENGINE = $previousNativeRequirement
    }
    if ($null -eq $previousTestUserDataDir) {
      Remove-Item Env:BRIGHTDESK_TEST_USER_DATA_DIR -ErrorAction SilentlyContinue
    } else {
      $env:BRIGHTDESK_TEST_USER_DATA_DIR = $previousTestUserDataDir
    }
    if (Test-Path -LiteralPath $smokeUserDataDir) {
      Remove-Item -LiteralPath $smokeUserDataDir -Recurse -Force
    }
  }

  $uninstallers = @(Get-ChildItem -LiteralPath $installDir -File -Filter 'Uninstall*.exe')
  if ($uninstallers.Count -ne 1) {
    throw 'The Windows installer did not create exactly one uninstaller.'
  }
  $uninstaller = $uninstallers[0].FullName

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

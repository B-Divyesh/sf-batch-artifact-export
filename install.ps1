$ErrorActionPreference = "Stop"
$Repository = "B-Divyesh/sf-batch-artifact-export"
$Base = "https://github.com/$Repository/releases/latest/download"
$Asset = "batch-artifact-export-windows-x86_64.zip"
$Work = Join-Path ([System.IO.Path]::GetTempPath()) ("batch-artifact-export-" + [guid]::NewGuid())

try {
  New-Item -ItemType Directory -Path $Work | Out-Null
  Write-Host "Downloading $Asset"
  Invoke-WebRequest "$Base/$Asset" -OutFile (Join-Path $Work $Asset)
  Invoke-WebRequest "$Base/SHA256SUMS" -OutFile (Join-Path $Work "SHA256SUMS")
  $Line = Get-Content (Join-Path $Work "SHA256SUMS") | Where-Object { $_ -match "\s+$([regex]::Escape($Asset))$" } | Select-Object -First 1
  if (-not $Line) { throw "No checksum published for $Asset" }
  $Expected = ($Line -split "\s+")[0].ToLowerInvariant()
  $Actual = (Get-FileHash (Join-Path $Work $Asset) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne $Expected) { throw "SHA-256 verification failed" }
  Write-Host "Verified SHA-256: $Actual"

  Expand-Archive (Join-Path $Work $Asset) -DestinationPath $Work
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\batch-artifact-export"
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item (Join-Path $Work "batch-artifact-export.exe") (Join-Path $InstallDir "batch-artifact-export.exe") -Force

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($UserPath -split ";") -notcontains $InstallDir) {
    $NewPath = if ($UserPath) { "$UserPath;$InstallDir" } else { $InstallDir }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path += ";$InstallDir"
    Write-Host "Added $InstallDir to your user PATH (open a new terminal to inherit it)."
  }
  Write-Host "Installed batch-artifact-export.exe to $InstallDir"
  & (Join-Path $InstallDir "batch-artifact-export.exe") --version
} finally {
  if (Test-Path $Work) { Remove-Item -Recurse -Force $Work }
}

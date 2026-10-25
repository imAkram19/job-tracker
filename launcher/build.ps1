param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$ProjectRoot\AkramJobTracker.exe" "$PSScriptRoot\AkramJobTracker.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed. Close the existing EXE and retry.' }

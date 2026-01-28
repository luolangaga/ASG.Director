<#
Generate a self-signed PFX certificate for development/testing.
Usage: in project root PowerShell:
	.\scripts\generate-cert.ps1

If the environment variable MSIX_PFX_PASSWORD is set, it will be used as the export password (non-interactive).
Exported PFX path: build\cert.pfx
Warning: do not commit the PFX to source control.
#>

$certPath = Join-Path (Get-Location) 'build'
if (-Not (Test-Path $certPath)) { New-Item -ItemType Directory -Path $certPath | Out-Null }

$subject = 'CN=ASG'
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $subject -CertStoreLocation 'Cert:\CurrentUser\My' -KeyExportPolicy Exportable -KeySpec Signature -NotAfter (Get-Date).AddYears(5)

if ($env:MSIX_PFX_PASSWORD) {
		Write-Host 'Using MSIX_PFX_PASSWORD environment variable for non-interactive export.'
		$pwd = ConvertTo-SecureString $env:MSIX_PFX_PASSWORD -AsPlainText -Force
} else {
		Write-Host 'Please enter export password for the PFX (input will be hidden)'
		$pwd = Read-Host -Prompt 'PFX export password' -AsSecureString
}

$pfxPath = Join-Path $certPath 'cert.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd

Write-Host 'PFX exported to:' $pfxPath
Write-Host 'Remember to set MSIX_CERT_PASSWORD or use setx to persist the password.'
# Run this in an Administrator PowerShell when the phone cannot reach `npm run phone`.
# It forwards a Windows LAN port to the HTTPS proxy running inside WSL.
# Re-run it after a WSL restart, because the WSL address can change.
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$port = if ($env:HTTPS_PORT) { [int]$env:HTTPS_PORT } else { 3443 }

$winIp = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|Loopback|WSL"
  } |
  Select-Object -First 1 -ExpandProperty IPAddress
if (-not $winIp) { throw "No Windows Wi-Fi/Ethernet address found. Connect to the same network as the phone first." }

$wslIp = ((& wsl.exe hostname -I) -split "\s+")[0]
if (-not $wslIp) { throw "Could not read the WSL address. Start WSL and the app first." }

# Remove old rules for this port so a changed WSL address does not leave a dead forward.
netsh interface portproxy delete v4tov4 listenaddress=$winIp listenport=$port 2>$null | Out-Null
netsh interface portproxy delete v4tov4 listenaddress="0.0.0.0" listenport=$port 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenaddress=$winIp listenport=$port connectaddress=$wslIp connectport=$port | Out-Null

$ruleName = "Warehouse Copilot (port $port)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Any | Out-Null
}

Write-Host ""
Write-Host "Windows ${winIp}:${port}  ->  WSL ${wslIp}:${port}"
Write-Host "Open this on the phone:  https://${winIp}:${port}"
Write-Host ""
Write-Host "The phone must be on the same Wi-Fi as this PC. Accept the self-signed certificate warning once."

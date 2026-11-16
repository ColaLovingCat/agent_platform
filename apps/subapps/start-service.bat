@echo off
cd /d D:\APP\agents\wwwroot\apps\services\docfilter
set PORT=8701
set SSL_PFX=..\szhmeais002.apac.bosch.com.pfx
set SSL_PASSPHRASE=13145640076
"C:\Program Files\nodejs\node.exe" --experimental-sqlite server.cjs
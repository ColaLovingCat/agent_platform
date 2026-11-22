@echo off
setlocal

set "identity=IIS AppPool\agents"

echo Setting IIS application pool permissions...

icacls "D:\APP\agents\wwwroot\_versions" /grant "%identity%:(OI)(CI)M" /T
if errorlevel 1 (
    echo [ERROR] Failed to set permissions for _versions.
    pause
    exit /b 1
)

icacls "D:\APP\agents\wwwroot\apps" /grant "%identity%:(OI)(CI)M" /T
if errorlevel 1 (
    echo [ERROR] Failed to set permissions for apps.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Permissions have been configured successfully.
pause
endlocal
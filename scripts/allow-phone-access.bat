@echo off
REM ---------------------------------------------------------------------------
REM  Lets your phone open the dev server on this PC over your home Wi-Fi.
REM
REM  RIGHT-CLICK this file and choose "Run as administrator".
REM  Double-clicking it will NOT work - adding a firewall rule needs elevation.
REM
REM  Scoped to TCP port 3000 on the "private" profile only, so it does nothing
REM  when you are on public Wi-Fi at a cafe or airport.
REM ---------------------------------------------------------------------------

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo   NOT RUNNING AS ADMINISTRATOR.
    echo   Close this window, right-click allow-phone-access.bat,
    echo   and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo Removing any previous rule...
netsh advfirewall firewall delete rule name="Basil Gallery dev (3000)" >nul 2>&1

echo Adding the rule...
netsh advfirewall firewall add rule name="Basil Gallery dev (3000)" dir=in action=allow protocol=TCP localport=3000 profile=private

echo.
echo ---------------------------------------------------------------------------
echo  Done. On your phone, open:
echo.
echo      http://192.168.0.100:3000
echo.
echo  To undo this later, run as administrator:
echo      netsh advfirewall firewall delete rule name="Basil Gallery dev (3000)"
echo ---------------------------------------------------------------------------
echo.
pause

@echo off
REM Double-click to start the Expo dev server for Snap.
REM A QR code appears in this window — scan it with the Camera app (iOS)
REM or the Expo Go app (Android). Keep this window open while you use the app.
REM Phone and PC must be on the same Wi-Fi.
cd /d "%~dp0"
call npm start
pause

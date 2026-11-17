@echo off
title BunkerMuz Server (Port 5000)
cd /d "%~dp0"
echo Starting BunkerMuz Django server on http://127.0.0.1:5000/ ...
python projects/manage.py runserver 5000
pause

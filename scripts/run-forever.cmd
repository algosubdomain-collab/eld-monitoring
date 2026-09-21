@echo off
rem Windows'da serverni doimiy ishlatish: yiqilsa 10 soniyadan keyin qayta turadi.
rem Task Scheduler (tizimga kirishda) shu faylni ishga tushiradi — README'ga qarang.
rem Chiqish logs\server.log ga yoziladi.

cd /d "%~dp0.."
set "PATH=%ProgramFiles%\nodejs;%PATH%"
if not exist logs mkdir logs

rem Log 10 MB dan oshsa eskisini chetga olamiz.
for %%F in (logs\server.log) do if %%~zF GTR 10485760 move /y logs\server.log logs\server.old.log > nul

echo [%date% %time%] build >> logs\server.log
call npm run build >> logs\server.log 2>&1

:loop
echo [%date% %time%] server ishga tushdi >> logs\server.log
node --env-file-if-exists=.env src\server.js >> logs\server.log 2>&1
echo [%date% %time%] server to'xtadi (kod %errorlevel%), 10 soniyadan keyin qayta >> logs\server.log
rem timeout yashirin oynada ishlamaydi — ping bilan kutamiz.
ping -n 11 127.0.0.1 > nul
goto loop

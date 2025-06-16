@echo off
setlocal enabledelayedexpansion

set SRC=%cd%
set DEST=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\adobe-animate-record-to-lib

echo 正在复制文件从 %SRC% 到 %DEST%，排除 .git 文件夹...

rem 创建目标目录（如果不存在）
if not exist "%DEST%" (
    mkdir "%DEST%"
)

rem 复制所有文件和文件夹，排除 .git 文件夹
for /d %%D in ("%SRC%\*") do (
    if /i not "%%~nxD"==".git" (
        xcopy "%%D" "%DEST%\%%~nxD" /E /I /Y
    )
)

rem 复制当前目录下的所有文件（非文件夹）
for %%F in ("%SRC%\*") do (
    if not "%%~nxF"==".git" (
        if not exist "%%F\" (
            copy /Y "%%F" "%DEST%"
        )
    )
)

echo 复制完成！
pause

@echo off
setlocal enabledelayedexpansion

set SRC=%cd%
set DEST=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\adobe-animate-record-to-lib

echo ���ڸ����ļ��� %SRC% �� %DEST%���ų� .git �ļ���...

rem ����Ŀ��Ŀ¼����������ڣ�
if not exist "%DEST%" (
    mkdir "%DEST%"
)

rem ���������ļ����ļ��У��ų� .git �ļ���
for /d %%D in ("%SRC%\*") do (
    if /i not "%%~nxD"==".git" (
        xcopy "%%D" "%DEST%\%%~nxD" /E /I /Y
    )
)

rem ���Ƶ�ǰĿ¼�µ������ļ������ļ��У�
for %%F in ("%SRC%\*") do (
    if not "%%~nxF"==".git" (
        if not exist "%%F\" (
            copy /Y "%%F" "%DEST%"
        )
    )
)

echo ������ɣ�
pause

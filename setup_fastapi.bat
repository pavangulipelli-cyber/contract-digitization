@echo off
REM Setup script to create symbolic links for shared data between Express and FastAPI backends
REM Run this as Administrator

echo Setting up shared data folder for FastAPI backend...

cd /d "%~dp0fastapi_server"

REM Create symbolic link to data folder
if exist data (
    echo Data folder already exists, skipping...
) else (
    mklink /D data ..\express_server\data
    if %ERRORLEVEL% == 0 (
        echo ✅ Created symbolic link: fastapi_server\data -^> express_server\data
    ) else (
        echo ❌ Failed to create symbolic link. Run as Administrator.
        pause
        exit /b 1
    )
)

echo.
echo ✅ Setup complete!
echo.
echo To run the FastAPI server:
echo   cd fastapi_server
echo   pip install -r requirements.txt
echo   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
echo.
pause

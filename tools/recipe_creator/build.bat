@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    py -m venv .venv
)

.venv\Scripts\python.exe -m pip install -r requirements.txt

REM Build as a single-file EXE so python313.dll and PyQt6 dependencies
REM are bundled inside the executable.
.venv\Scripts\python.exe -m PyInstaller ^
    --noconfirm ^
    --clean ^
    --onefile ^
    --windowed ^
    --name "TritleKitchenRecipeCreator" ^
    --icon "assets\tritlekitchenlogo.ico" ^
    recipe_creator.py

echo.
echo Build complete.
echo EXE: %~dp0dist\TritleKitchenRecipeCreator.exe
echo.
pause

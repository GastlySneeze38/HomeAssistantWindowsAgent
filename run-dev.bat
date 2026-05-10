@echo off
REM Lancer l'API Rust et le serveur Vite en parallèle

echo Demarrage des services...
echo.

REM Lancer l'API Rust dans une nouvelle fenetre
start "Rust API" cmd /k "cd Backend && cargo watch -x run -w src"

REM Lancer le serveur Vite dans une nouvelle fenetre
start "Vite Server" cmd /k "cd Frontend && npm run dev"

echo.
echo Les deux services ont ete lances dans des fenetres separees.
pause

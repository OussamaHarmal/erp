# Sage Auto Import intégré au backend

J'ai intégré ton ancien script `sage import.py` dans le backend FastAPI.
Tu n'as plus besoin de lancer le script séparément si le backend tourne sur le PC Windows où Sage est installé.

## 1) Installer les dépendances Windows Sage

Dans le dossier `backend` :

```bash
pip install -r requirements.txt
pip install -r requirements-windows-sage.txt
```

> Important : `pywin32` et `pywinauto` doivent être installés seulement sur Windows. Ne les installe pas dans Docker/Linux.

## 2) Ajouter ces variables dans `backend/.env`

```env
SAGE_AUTO_IMPORT_ENABLED=true
SAGE_AUTO_IMPORT_FOLDER=C:\SAGE_AUTO_IMPORT\pending
SAGE_IMPORTED_FOLDER=C:\SAGE_AUTO_IMPORT\imported
SAGE_ERROR_FOLDER=C:\SAGE_AUTO_IMPORT\errors
SAGE_IMPORT_LOG_FILE=C:\SAGE_AUTO_IMPORT\logs\import.log

SAGE_EXE_PATH=C:\Program Files (x86)\Sage\iComptabilité\Maestria.exe
SAGE_PROCESS_NAME=Maestria.exe
SAGE_MAE_FILE=C:\Users\dell\Downloads\import vente us.ema
SAGE_STARTUP_WAIT=15
SAGE_SCAN_INTERVAL=5
```

## 3) Démarrer seulement ton backend

```bash
cd backend
uvicorn app.main:app --reload
```

Au démarrage, FastAPI lance automatiquement le watcher Sage en arrière-plan.
Quand tu cliques sur l'export Sage dans l'application, le TXT est déposé dans :

```text
C:\SAGE_AUTO_IMPORT\pending
```

Le watcher détecte le fichier, ouvre Sage, lance l'import paramétrable, puis déplace le fichier vers :

```text
C:\SAGE_AUTO_IMPORT\imported
```

En cas d'erreur, il va dans :

```text
C:\SAGE_AUTO_IMPORT\errors
```

## 4) Vérifier l'état depuis l'API

Endpoint ajouté :

```text
GET /api/v1/erp/sage/auto-import/status
```

Il retourne si le watcher est actif, le dernier fichier traité et la dernière erreur.

## Notes importantes

- L'import automatique Sage par interface graphique fonctionne uniquement sur une session Windows ouverte.
- Si tu lances le backend dans Docker, l'export TXT fonctionne, mais Sage desktop ne peut pas être contrôlé automatiquement.
- Le fichier `.MAE` doit exister exactement dans le chemin défini par `SAGE_MAE_FILE`.

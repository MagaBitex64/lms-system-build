# Phenomenon School LMS

Modern LMS for a single educational organization with FastAPI backend and Next.js frontend.

## Features
- JWT authentication
- Guest / Student / Teacher / Administrator roles
- Course catalog, course detail, lessons, quizzes, homework
- Enrollment approval workflow
- Gradebook and automatic progress calculation
- File uploads and downloads
- Localization support: Russian + Kazakh
- Dockerized backend, frontend, and PostgreSQL

## Local development

### Backend setup

1. Copy environment variables:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2. Create `.env` from `.env.example` and update secrets:

```powershell
Copy-Item ..\.env.example ..\.env
```

3. Set local environment values in `backend/.env` if needed:

```powershell
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/lms'
JWT_SECRET='change_this_in_production'
UPLOAD_DIR='D:\lms-system-build\backend\uploads'
```

4. Initialize database:

```powershell
python -m scripts.init_db
```

4. Seed demo data (optional):

```powershell
python -m scripts.seed
```

5. Run backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and expects the backend at `http://localhost:8000`.

## Docker development

From repository root:

```powershell
docker compose up --build
```

This starts:
- backend on port `8000`
- frontend on port `3000`
- postgres database

## Production notes

- Change `JWT_SECRET` to a strong secret.
- Use a real database password and secure PostgreSQL settings.
- Mount backend uploads to a durable volume.
- Configure `NEXT_PUBLIC_API_BASE_URL` for the hosted backend endpoint.

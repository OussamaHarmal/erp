"""
Smart Client & Contract Management System
FastAPI Application Entry Point
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import engine, Base
from .services.sage_auto_importer import start_sage_auto_importer_if_enabled

# Import all routes
from .routes import auth, clients, contracts, invoices, documents, analytics, erp, chatbot, renewal_requests, notifications

# Create all tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Professional Client & Contract Management API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(clients.router, prefix=API_PREFIX)
app.include_router(contracts.router, prefix=API_PREFIX)
app.include_router(invoices.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(erp.router, prefix=API_PREFIX)
app.include_router(chatbot.router, prefix=API_PREFIX)
app.include_router(renewal_requests.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)

# ─── Static files for uploads ─────────────────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": "1.0.0"}


@app.on_event("startup")
async def startup_event():
    """Seed initial directeur account if not exists"""
    from .database import SessionLocal
    from .models import User, ClientProfile, UserRole
    from .demo_seed import seed_demo_data
    from .utils.auth import hash_password

    db = SessionLocal()
    try:
        directeur = db.query(User).filter(User.email == "admin@smartcms.ma").first()
        if not directeur:
            admin = User(
                email="admin@smartcms.ma",
                hashed_password=hash_password("Admin@2024!"),
                role=UserRole.DIRECTEUR,
            )
            db.add(admin)
            db.flush()
            profile = ClientProfile(
                user_id=admin.id,
                first_name="Directeur",
                last_name="Général",
            )
            db.add(profile)
            db.commit()
            print("✅ Default admin created: admin@smartcms.ma / Admin@2024!")
        # Local demo data for testing dashboard and ERP screens.
        # Disable with SEED_DEMO_DATA=false in production.
        if os.getenv("SEED_DEMO_DATA", "true").lower() in {"1", "true", "yes", "on"}:
            result = seed_demo_data(db)
            print(f"✅ Demo seed: {result}")

        # Start Sage desktop auto-import watcher in background when enabled.
        # Enable on the Windows machine that has Sage installed:
        # SAGE_AUTO_IMPORT_ENABLED=true
        start_sage_auto_importer_if_enabled()
    finally:
        db.close()

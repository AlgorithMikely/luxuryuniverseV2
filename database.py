import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import settings

DATABASE_URL = os.getenv("TEST_DATABASE_URL", str(settings.SQLALCHEMY_DATABASE_URI))

# Special configuration for in-memory SQLite testing
if "sqlite:///:memory:" in DATABASE_URL:
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

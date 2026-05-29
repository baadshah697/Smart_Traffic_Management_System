import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Shared client for API endpoints (single-threaded FastAPI request handling)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def create_supabase_client() -> Client:
    """Factory: Creates a NEW Supabase client for background threads.
    The default 'supabase' client is NOT thread-safe (httpx sockets conflict).
    Each AI worker / background task should call this once and reuse its own client."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as stencil_router

app = FastAPI(title="Stencil Generator API")

# Loosen this before production deploy - fine for local dev against the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    # Content-Disposition isn't CORS-safelisted by default, so the frontend
    # can't read the generated filename off the /generate response without this.
    expose_headers=["Content-Disposition"],
)

app.include_router(stencil_router)


@app.get("/health")
def health():
    return {"status": "ok"}

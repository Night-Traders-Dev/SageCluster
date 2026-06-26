import os, uuid, time, shutil, tarfile, zipfile, hashlib, secrets
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse

ROOT = "/mnt/storage"
tokens = {}  # token -> expiry

def check_auth(token: str):
    if token not in tokens or tokens[token] < time.time():
        raise HTTPException(401, "Unauthorized or token expired")

def safe_path(user_path: str) -> str:
    p = os.path.normpath(os.path.join(ROOT, user_path.lstrip("/")))
    if not p.startswith(ROOT):
        raise HTTPException(403, "Access denied")
    return p

router = APIRouter(prefix="/api/files")

@router.post("/login")
async def login(data: dict):
    password = data.get("password", "")
    stgs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
    try:
        with open(stgs_path) as f:
            import json
            stgs = json.load(f)
    except:
        stgs = {}
    expected = stgs.get("file_manager", {}).get("password", "sagecluster")
    if password != expected:
        raise HTTPException(403, "Invalid password")
    token = secrets.token_hex(32)
    tokens[token] = time.time() + 86400  # 24h expiry
    return {"token": token, "expires_in": 86400}

@router.post("/list")
async def list_dir(data: dict):
    check_auth(data.get("token", ""))
    target = safe_path(data.get("path", ""))
    if not os.path.isdir(target):
        raise HTTPException(404, "Directory not found")
    entries = []
    for name in sorted(os.listdir(target)):
        fp = os.path.join(target, name)
        st = os.stat(fp)
        is_dir = os.path.isdir(fp)
        entries.append({
            "name": name,
            "is_dir": is_dir,
            "size": st.st_size if not is_dir else 0,
            "modified": int(st.st_mtime),
            "ext": os.path.splitext(name)[1].lower() if not is_dir else "",
        })
    return {"path": data.get("path", ""), "entries": entries}

@router.post("/mkdir")
async def mkdir(data: dict):
    check_auth(data.get("token", ""))
    target = safe_path(data.get("path", ""))
    name = data.get("name", "")
    if not name:
        raise HTTPException(400, "Name required")
    os.makedirs(os.path.join(target, name), exist_ok=True)
    return {"status": "ok"}

@router.post("/rename")
async def rename(data: dict):
    check_auth(data.get("token", ""))
    pp = safe_path(data.get("path", ""))
    old = data.get("old_name", "")
    new = data.get("new_name", "")
    if not old or not new:
        raise HTTPException(400, "old_name and new_name required")
    os.rename(os.path.join(pp, old), os.path.join(pp, new))
    return {"status": "ok"}

@router.post("/delete")
async def delete(data: dict):
    check_auth(data.get("token", ""))
    pp = safe_path(data.get("path", ""))
    names = data.get("names", [])
    if not names:
        raise HTTPException(400, "names required")
    for name in names:
        fp = os.path.join(pp, name)
        if os.path.isdir(fp):
            shutil.rmtree(fp)
        else:
            os.remove(fp)
    return {"status": "ok"}

@router.post("/upload")
async def upload(token: str = Form(""), path: str = Form(""), files: list[UploadFile] = File(...)):
    check_auth(data.get("token", ""))
    target = safe_path(data.get("path", ""))
    target = safe_path(path)
    saved = []
    for f in files:
        fp = os.path.join(target, f.filename)
        with open(fp, "wb") as out:
            content = await f.read()
            out.write(content)
        saved.append(f.filename)
    return {"status": "ok", "files": saved}

@router.get("/download")
async def download(path: str = "", token: str = "", file: str = ""):
    check_auth(data.get("token", ""))
    target = safe_path(data.get("path", ""))
    pp = safe_path(path)
    fp = os.path.join(pp, file)
    if not os.path.isfile(fp):
        raise HTTPException(404, "File not found")
    return FileResponse(fp, filename=file, media_type="application/octet-stream")

@router.post("/compress")
async def compress(data: dict):
    check_auth(data.get("token", ""))
    pp = safe_path(data.get("path", ""))
    names = data.get("names", [])
    fmt = data.get("format", "tar.gz")  # tar.gz, tar.xz, zip
    archive_name = data.get("archive_name", "archive." + fmt)
    if not names:
        raise HTTPException(400, "names required")
    archive_path = os.path.join(pp, archive_name)
    base_dir = pp
    if fmt == "zip":
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for name in names:
                fp = os.path.join(pp, name)
                if os.path.isdir(fp):
                    for dirpath, dirnames, filenames in os.walk(fp):
                        arc_dir = os.path.relpath(dirpath, base_dir)
                        if arc_dir != ".":
                            zf.write(dirpath, arc_dir)
                        for fn in filenames:
                            zf.write(os.path.join(dirpath, fn), os.path.join(arc_dir, fn))
                else:
                    zf.write(fp, os.path.relpath(fp, base_dir))
    else:
        mode = "w:gz" if fmt == "tar.gz" else "w:xz"
        with tarfile.open(archive_path, mode) as tf:
            for name in names:
                fp = os.path.join(pp, name)
                tf.add(fp, arcname=os.path.relpath(fp, base_dir))
    return {"status": "ok", "archive": archive_name}

@router.post("/extract")
async def extract(data: dict):
    check_auth(data.get("token", ""))
    pp = safe_path(data.get("path", ""))
    archive = data.get("archive", "")
    if not archive:
        raise HTTPException(400, "archive required")
    fp = os.path.join(pp, archive)
    if not os.path.isfile(fp):
        raise HTTPException(404, "Archive not found")
    ext = os.path.splitext(archive)[1].lower()
    if ext == ".zip":
        with zipfile.ZipFile(fp, "r") as zf:
            zf.extractall(pp)
    elif archive.endswith(".tar.gz") or archive.endswith(".tgz"):
        with tarfile.open(fp, "r:gz") as tf:
            tf.extractall(pp)
    elif archive.endswith(".tar.xz"):
        with tarfile.open(fp, "r:xz") as tf:
            tf.extractall(pp)
    elif archive.endswith(".tar"):
        with tarfile.open(fp, "r:") as tf:
            tf.extractall(pp)
    else:
        raise HTTPException(400, "Unsupported archive format")
    return {"status": "ok"}

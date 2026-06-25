from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import time

from config import NODES
from collector import collect_all

app = FastAPI(title="SageCluster")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/status")
async def status():
    o, p4, p2 = collect_all()

    total_cpu = int(o.get("cpus", 0))
    for n in (p4, p2):
        if "cpus" in n:
            total_cpu += int(n["cpus"])

    total_mem = used_mem = 0
    swap_used = 0
    for node in [o, p4, p2]:
        mem = node.get("mem")
        if mem:
            try:
                t, u = map(int, mem.split(","))
                total_mem += t
                used_mem += u
            except:
                pass
        sw = node.get("swap")
        if sw and sw != "0,0":
            try:
                swap_used += int(sw.split(",")[1])
            except:
                pass

    return JSONResponse({
        "cluster": {
            "total_cpu": total_cpu,
            "total_mem_mb": total_mem,
            "used_mem_mb": used_mem,
            "swap_used_mb": swap_used,
        },
        "nodes": {
            "orangepi": o,
            "pi4": p4,
            "pi2": p2,
        },
        "timestamp": time.time(),
    })

import subprocess, os, time
from concurrent.futures import ThreadPoolExecutor

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "collect_stats.sh")

def run(cmd, timeout=10):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, timeout=timeout).strip()
    except Exception:
        return "offline"

def parse_stats_output(out):
    if out == "offline":
        return {"status": "offline"}
    data = {"status": "online"}
    for line in out.splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        if key == "ARCH": data["arch"] = val
        elif key == "CPUS": data["cpus"] = val
        elif key == "MEM": data["mem"] = val
        elif key == "KERNEL": data["kernel"] = val
        elif key == "OS": data["os"] = val
        elif key == "UPTIME": data["uptime"] = val
        elif key == "LOAD": data["load"] = val
        elif key == "CPU_MODEL": data["cpu_model"] = val
        elif key == "CPU_TEMP": data["cpu_temp"] = val
        elif key == "SWAP": data["swap"] = val
        elif key == "PROCS": data["procs"] = val
        elif key == "NET": data["net"] = val
        elif key == "DISK_IO": data["disk_io"] = val
        elif key == "STORAGE":
            parts = val.split()
            if len(parts) >= 4:
                data["storage"] = {"size": parts[0], "used": parts[1], "avail": parts[2], "use_pct": parts[3]}
    return data

def get_local_cpu_usage():
    try:
        with open('/proc/stat') as f:
            parts = f.readline().split()
        idle1 = int(parts[4])
        total1 = sum(int(v) for v in parts[1:])
        time.sleep(0.3)
        with open('/proc/stat') as f:
            parts = f.readline().split()
        idle2 = int(parts[4])
        total2 = sum(int(v) for v in parts[1:])
        d = total2 - total1
        return round((1 - (idle2 - idle1) / d) * 100, 1) if d else 0
    except Exception:
        return None

def collect_local():
    out = run(f"bash {SCRIPT}")
    data = parse_stats_output(out)
    data["name"] = "OrangePi"
    cpu = get_local_cpu_usage()
    if cpu is not None:
        data["cpu_usage"] = cpu
    return data

def collect_remote(user, host):
    out = run(f"cat {SCRIPT} | ssh -o ConnectTimeout=5 {user}@{host} 'bash -s'")
    return parse_stats_output(out)

def collect_all():
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_local = ex.submit(collect_local)
        f_p4 = ex.submit(collect_remote, "ubuntu", "10.42.0.141")
        f_p2 = ex.submit(collect_remote, "evelyn", "10.42.1.109")
        return f_local.result(), f_p4.result(), f_p2.result()

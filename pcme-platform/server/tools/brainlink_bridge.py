"""Loopback-only BrainLink Pro bridge. Run on the paired Windows lab PC.

Setup once: uv sync --extra eeg. Download the official Python-3.11 Windows
BrainLinkParser.pyd into tools/vendor/, then run:
  .venv\\Scripts\\python tools\\brainlink_bridge.py --port COM5
"""
from __future__ import annotations
import argparse, csv, json, queue, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    import serial
except ImportError as exc:
    raise SystemExit("Missing pyserial: run uv sync --extra eeg") from exc
vendor = Path(__file__).with_name("vendor")
if vendor.exists(): sys.path.insert(0, str(vendor))
try:
    from BrainLinkParser import BrainLinkParser
except ImportError as exc:
    raise SystemExit("Put official BrainLinkParser.pyd (Python 3.11) in tools/vendor/") from exc

ROOT = Path(__file__).resolve().parents[1]
def now_ms(): return time.time_ns() // 1_000_000

class Bridge:
    def __init__(self, port):
        self.port, self.serial, self.recording, self.error = port, None, None, None
        self.lock, self.rx, self.stop_event = threading.RLock(), queue.Queue(2048), threading.Event()
        self.parser = BrainLinkParser(self.eeg, self.extended, self.gyro, self.rr, self.raw)
    def connect(self):
        self.serial = serial.Serial(self.port, 115200, timeout=.2)
        threading.Thread(target=self.read, daemon=True).start(); threading.Thread(target=self.parse, daemon=True).start()
    def read(self):
        while not self.stop_event.is_set():
            try:
                b = self.serial.read(4096)
                if b: self.rx.put_nowait(b)
            except queue.Full:
                if self.recording: self.recording["dropped"] += len(b)
            except Exception as e: self.error = f"Serial read failed: {e}"; return
    def parse(self):
        while not self.stop_event.is_set():
            try: self.parser.parse(self.rx.get(timeout=.2))
            except queue.Empty: pass
            except Exception as e: self.error = f"Parser failed: {e}"
    def raw(self, value):
        with self.lock:
            if self.recording:
                self.recording["raw"].writerow([now_ms(), value]); self.recording["samples"] += 1
    def feature(self, source, values):
        with self.lock:
            if self.recording:
                self.recording["features"].writerow({"timestamp_ms": now_ms(), "source": source, **values})
                self.recording["feature_count"] += 1
    def eeg(self, d):
        self.feature("eeg", {k:getattr(d,k,None) for k in ("signal","attention","meditation","delta","theta","lowAlpha","highAlpha","lowBeta","highBeta","lowGamma","highGamma")})
    def extended(self, d): self.feature("extended", {k:getattr(d,k,None) for k in ("ap","battery","version","gnaw","temperature","heart")})
    def gyro(self, x,y,z): self.feature("gyro", {"gyro_x":x,"gyro_y":y,"gyro_z":z})
    def rr(self, a,b,c): self.feature("rr", {"rr1":a,"rr2":b,"rr3":c})
    def start(self, session_id, anchor):
        with self.lock:
            if self.recording: raise ValueError("EEG recording already active")
            folder = ROOT / "data" / "physio_data" / session_id / "eeg"; folder.mkdir(parents=True, exist_ok=True)
            rf = (folder / "brainlink_raw.csv").open("w", newline="", encoding="utf8")
            ff = (folder / "brainlink_features.csv").open("w", newline="", encoding="utf8")
            raw = csv.writer(rf); raw.writerow(["timestamp_ms","raw_eeg"])
            cols=["timestamp_ms","source","signal","attention","meditation","delta","theta","lowAlpha","highAlpha","lowBeta","highBeta","lowGamma","highGamma","ap","battery","version","gnaw","temperature","heart","gyro_x","gyro_y","gyro_z","rr1","rr2","rr3"]
            features=csv.DictWriter(ff, fieldnames=cols, extrasaction="ignore"); features.writeheader()
            self.recording={"id":session_id,"anchor":anchor,"raw":raw,"features":features,"raw_file":rf,"features_file":ff,"samples":0,"feature_count":0,"dropped":0}
            return self.status()
    def finish(self):
        with self.lock:
            if not self.recording: return self.status()
            r=self.recording; r["raw_file"].close(); r["features_file"].close(); self.recording=None
            return {"status":"stopped","session_id":r["id"],"sample_count":r["samples"],"feature_count":r["feature_count"],"dropped_bytes":r["dropped"]}
    def status(self):
        r=self.recording
        return {"status":"recording" if r else "ready","connected":bool(self.serial and self.serial.is_open),"port":self.port,"session_id":r["id"] if r else None,"sample_count":r["samples"] if r else 0,"error":self.error}

class Handler(BaseHTTPRequestHandler):
    bridge=None
    def reply(self, status, body):
        data=json.dumps(body).encode(); self.send_response(status); self.send_header("Content-Type","application/json"); self.send_header("Access-Control-Allow-Origin","http://localhost:5173"); self.end_headers(); self.wfile.write(data)
    def do_OPTIONS(self):
        self.send_response(204); self.send_header("Access-Control-Allow-Origin","http://localhost:5173"); self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers","Content-Type"); self.end_headers()
    def do_GET(self): self.reply(200, self.bridge.status()) if self.path=="/status" else self.reply(404,{"error":"not found"})
    def do_POST(self):
        try:
            body=json.loads(self.rfile.read(int(self.headers.get("Content-Length",0))) or b"{}")
            if self.path=="/recordings/start": self.reply(200,self.bridge.start(str(body["session_id"]),int(body["anchor_timestamp_ms"])))
            elif self.path=="/recordings/stop": self.reply(200,self.bridge.finish())
            else: self.reply(404,{"error":"not found"})
        except (KeyError, ValueError, TypeError) as e: self.reply(400,{"error":str(e)})
    def log_message(self,*args): pass

p=argparse.ArgumentParser(); p.add_argument("--port",required=True); p.add_argument("--listen-port",type=int,default=8765); args=p.parse_args()
Handler.bridge=Bridge(args.port); Handler.bridge.connect()
print(f"BrainLink bridge ready at http://127.0.0.1:{args.listen_port}")
ThreadingHTTPServer(("127.0.0.1",args.listen_port),Handler).serve_forever()

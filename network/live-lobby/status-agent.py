#!/usr/bin/env python3
"""Read-only Minecraft status agent. Firewall TCP 25572 to the website host only."""
import concurrent.futures,json,os,socket,struct,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

TARGETS={"velocity":("127.0.0.1",25565),"spacing-guild":("127.0.0.1",25571),"arrakis":None,"caladan":None,"giedi-prime":None,"kaitain":None,"sigma-draconis-iv":None}
TARGETS.update(json.loads(os.environ.get("WORLD_TARGETS_JSON","{}")))

def varint(n):
    out=bytearray()
    while True:
        part=n&127;n>>=7;out.append(part|(128 if n else 0))
        if not n:return bytes(out)

def read_varint(sock):
    n=0
    for i in range(5):
        data=sock.recv(1)
        if not data:raise ValueError("short response")
        n|=(data[0]&127)<<(7*i)
        if data[0]<128:return n
    raise ValueError("invalid packet")

def check(entry):
    name,target=entry
    if not target:return name,{"online":False,"configured":False}
    try:
        started=time.monotonic();host,port=target
        with socket.create_connection((host,port),1.5) as sock:
            sock.settimeout(1.5);address=host.encode();packet=b'\0'+varint(769)+varint(len(address))+address+struct.pack('>H',port)+b'\1'
            sock.sendall(varint(len(packet))+packet+b'\1\0')
            length=read_varint(sock)
            if length>65536 or read_varint(sock)!=0:raise ValueError("invalid status")
            size=read_varint(sock)
            if size>65536:raise ValueError("oversized status")
            data=b''
            while len(data)<size:
                part=sock.recv(size-len(data))
                if not part:raise ValueError("short status")
                data+=part
            status=json.loads(data)
            if not isinstance(status.get('version'),dict):raise ValueError("missing version")
            players=status.get('players',{}).get('online',0)
            return name,{"online":True,"configured":True,"players":players if isinstance(players,int) and players>=0 else 0,"latencyMs":round((time.monotonic()-started)*1000)}
    except (OSError,ValueError,KeyError,TypeError):return name,{"online":False,"configured":True}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path!='/status':self.send_error(404);return
        with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:worlds=dict(pool.map(check,TARGETS.items()))
        body=json.dumps({"checkedAt":int(time.time()*1000),"servers":worlds}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*args):pass

if __name__=='__main__':ThreadingHTTPServer(('0.0.0.0',25572),Handler).serve_forever()

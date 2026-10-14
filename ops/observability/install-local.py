#!/usr/bin/env python3
"""Install pinned OSS binaries on the existing Oracle ARM64 host. No cloud accounts."""
import hashlib
import os
from pathlib import Path
import platform
import secrets
import shutil
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = Path('/home/ubuntu/viordles-observability')
SOURCE = Path(__file__).resolve().parent
assert platform.machine() == 'aarch64', 'Installer targets Oracle ARM64'
assert os.getuid() != 0, 'Run as ubuntu, sudo is used only for systemd units'
for name in ['bin', 'downloads', 'config', 'data', 'data/prometheus', 'data/loki', 'data/alloy']:
    (ROOT / name).mkdir(parents=True, exist_ok=True)
shutil.copytree(SOURCE, ROOT / 'config', dirs_exist_ok=True)

def download(url, name, expected):
    path = ROOT / 'downloads' / name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        print('Downloading', name, flush=True)
        urllib.request.urlretrieve(url, path)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'Checksum mismatch: ' + name
    return path

packages = [
 ('prometheus/prometheus', 'v3.14.0', 'prometheus-3.14.0.linux-arm64.tar.gz', 'sha256sums.txt', 'prometheus'),
 ('grafana/loki', 'v3.7.7', 'loki-linux-arm64.zip', 'SHA256SUMS', 'loki'),
 ('grafana/alloy', 'v1.19.2', 'alloy-linux-arm64.zip', 'SHA256SUMS', 'alloy'),
]
for repo, version, filename, checksumfile, binary in packages:
    base = f'https://github.com/{repo}/releases/download/{version}/'
    checksums = urllib.request.urlopen(base + checksumfile, timeout=30).read().decode()
    expected = next(line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip('*') == filename)
    archive = download(base + filename, filename, expected)
    if filename.endswith('.zip'):
        with zipfile.ZipFile(archive) as z:
            data = z.read(binary + '-linux-arm64')
        (ROOT / 'bin' / binary).write_bytes(data)
    else:
        with tarfile.open(archive) as t:
            for name in ['prometheus', 'promtool']:
                member = next(m for m in t.getmembers() if m.name.endswith('/' + name))
                (ROOT / 'bin' / name).write_bytes(t.extractfile(member).read())
                (ROOT / 'bin' / name).chmod(0o755)
    (ROOT / 'bin' / binary).chmod(0o755)
filename = 'grafana_13.2.1_33191028959_linux_arm64.tar.gz'
archive = download('https://dl.grafana.com/grafana/release/13.2.1/' + filename, filename,
                   '5334fbd40f8b583437305b80d99527a758b0912c56f5b812aa897db321152236')
grafana = ROOT / 'grafana'
if not (grafana / 'bin/grafana').exists():
    grafana.mkdir(exist_ok=True)
    subprocess.run(['tar', '-xzf', str(archive), '--strip-components=1', '-C', str(grafana)], check=True)
secretfile = ROOT / 'admin.env'
if not secretfile.exists():
    secretfile.write_text('GF_SECURITY_ADMIN_PASSWORD=' + secrets.token_urlsafe(32) + '\n')
    secretfile.chmod(0o600)

subprocess.run([str(ROOT/'bin/promtool'), 'check', 'config', str(ROOT/'config/prometheus.yml')], check=True)
subprocess.run([str(ROOT/'bin/loki'), '-config.file='+str(ROOT/'config/loki.yml'), '-verify-config=true'], check=True)
subprocess.run([str(ROOT/'bin/alloy'), 'validate', str(ROOT/'config/config.alloy')], check=True)
commands = {
 'prometheus': (f'{ROOT}/bin/prometheus --config.file={ROOT}/config/prometheus.yml --storage.tsdb.path={ROOT}/data/prometheus --storage.tsdb.retention.time=14d --storage.tsdb.retention.size=2GB --web.listen-address=127.0.0.1:9090', '512M'),
 'loki': (f'{ROOT}/bin/loki -config.file={ROOT}/config/loki.yml', '512M'),
 'alloy': (f'{ROOT}/bin/alloy run --server.http.listen-addr=127.0.0.1:12345 --storage.path={ROOT}/data/alloy {ROOT}/config/config.alloy', '384M'),
 'grafana': (f'{ROOT}/grafana/bin/grafana server --homepath={ROOT}/grafana --config={ROOT}/config/grafana.ini', '512M'),
}
for name, (command, memory) in commands.items():
    unit = f'''[Unit]
Description=Viordles observability {name} (OSS local)
After=network.target
[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory={ROOT}
EnvironmentFile={secretfile}
ExecStart={command}
Restart=on-failure
RestartSec=10
MemoryMax={memory}
CPUQuota=50%
Nice=10
NoNewPrivileges=true
UMask=0077
[Install]
WantedBy=multi-user.target
'''
    path = ROOT / (name + '.service')
    path.write_text(unit)
    subprocess.run(['sudo', 'install', '-m', '644', str(path), '/etc/systemd/system/viordles-'+name+'.service'], check=True)
subprocess.run(['sudo','systemctl','daemon-reload'], check=True)
for name in commands:
    subprocess.run(['sudo','systemctl','enable','--now','viordles-'+name], check=True)
subprocess.run(['sudo', 'install', '-m', '644', str(SOURCE/'logrotate'), '/etc/logrotate.d/viordles'], check=True)
for suffix in ['service', 'timer']:
    subprocess.run(['sudo', 'install', '-m', '644', str(SOURCE/('logrotate.'+suffix)), '/etc/systemd/system/viordles-logrotate.'+suffix], check=True)
subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
subprocess.run(['sudo', 'systemctl', 'enable', '--now', 'viordles-logrotate.timer'], check=True)
print('Local OSS monitoring installed. Grafana: 127.0.0.1:3300 (SSH tunnel).')

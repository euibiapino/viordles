const { spawn } = require('node:child_process');
const { statSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

class ResolverWorker {
  constructor(binary, proxy, format) {
    Object.assign(this, { binary, proxy, format });
    this.child = null;
    this.pending = null;
    this.ready = null;
    this.retryAt = 0;
  }

  start() {
    const version = statSync(this.binary).mtimeMs;
    if (this.child && this.version !== version) this.stop();
    if (this.child) return this.ready;
    if (Date.now() < this.retryAt) return Promise.reject(new Error('worker cooling down'));
    this.version = version;
    const child = spawn(
      process.env.YTDLP_PYTHON || 'python3',
      [
        '-u',
        path.join(__dirname, '../../scripts/ytdlp-worker.py'),
        this.binary,
        this.proxy,
        this.format,
      ],
      { stdio: ['pipe', 'pipe', 'ignore'] },
    );
    this.child = child;
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(), 5000);
      const lines = readline.createInterface({ input: child.stdout });
      const fail = () => {
        clearTimeout(timer);
        lines.close();
        if (this.child !== child) return;
        this.child = null;
        this.retryAt = Date.now() + 30_000;
        child.kill('SIGKILL');
        reject(new Error('worker unavailable'));
        this.pending?.reject(new Error('worker unavailable'));
        this.pending = null;
      };
      this.abort = fail;
      child.on('error', fail);
      child.on('exit', fail);
      child.stdin.on('error', fail);
      lines.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          if (message.ready) {
            clearTimeout(timer);
            resolve();
          } else if (this.pending) {
            const pending = this.pending;
            this.pending = null;
            if (message.error) pending.reject(new Error('worker extraction failed'));
            else pending.resolve(message.info);
          }
        } catch {
          fail();
        }
      });
    });
    return this.ready;
  }

  async resolve(query) {
    await this.start();
    // Sem fila oculta: pedidos simultâneos podem usar o processo convencional.
    if (this.pending) throw new Error('worker busy');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(), 25_000);
      this.pending = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.child.stdin.write(JSON.stringify({ query }) + '\n');
    });
  }

  stop() {
    this.abort?.();
  }
}

module.exports = { ResolverWorker };

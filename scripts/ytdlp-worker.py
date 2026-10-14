"""Worker local: JSON por linha, sem URLs ou logs do extrator no stderr/stdout."""
import contextlib
import json
import sys

sys.path.insert(0, sys.argv[1])
import yt_dlp


class Quiet:
    def debug(self, *args): pass
    def info(self, *args): pass
    def warning(self, *args): pass
    def error(self, *args): pass


args = ['--no-warnings', '--no-playlist', '-f', sys.argv[3], '--dump-single-json']
if sys.argv[2]:
    args += ['--proxy', sys.argv[2]]
opts = yt_dlp.parse_options(args).ydl_opts
opts.update(logger=Quiet(), quiet=True, no_warnings=True, extract_flat=False,
            forcejson=False, dump_single_json=False)
protocol = sys.stdout
with yt_dlp.YoutubeDL(opts) as ydl:
    print('{"ready":true}', file=protocol, flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            query = request['query']
            target = query if query.startswith(('https://', 'http://')) else 'ytsearch1:' + query
            with contextlib.redirect_stdout(sys.stderr):
                data = ydl.extract_info(target, download=False)
            info = (data.get('entries') or [data])[0]
            # Só os campos utilizados pelo bot atravessam o protocolo.
            keys = ['url', 'title', 'uploader', 'channel', 'artist', 'track', 'creator',
                    'album', 'duration', 'thumbnail', 'webpage_url', 'original_url']
            result = {key: info.get(key) for key in keys}
            print(json.dumps({'info': result}), file=protocol, flush=True)
        except Exception:
            print('{"error":"extraction_failed"}', file=protocol, flush=True)

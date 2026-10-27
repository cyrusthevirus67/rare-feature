"""Local preview that serves /services as services.html, like GitHub Pages."""
import http.server, os, sys
root = sys.argv[1]
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8541
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=root, **k)
    def send_head(s):
        path = s.path.split('?')[0].split('#')[0]
        if path != '/' and '.' not in os.path.basename(path) and os.path.exists(os.path.join(root, path.lstrip('/') + '.html')):
            s.path = path + '.html' + (s.path[len(path):])
        return super().send_head()
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()

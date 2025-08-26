import http.server
import socketserver
import webbrowser
import threading
import os
import sys
import time

# --- Config ---
PORT = 8000
HOSTNAME = "localhost"
REQUIRED_FILES = ["index.html", "style.css", "script.js"]

def start_server():
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.log_message = lambda *args: None
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    print("Iniciando o lançador do WireWorld...")

    # 1. Verificando se existem todos os arquivos necessários
    for filename in REQUIRED_FILES:
        if not os.path.exists(filename):
            print(f"\nERRO: Arquivo '{filename}' não encontrado.")
            print("Certifique-se de que os 4 arquivos (run.py, index.html, style.css, script.js) estão na mesma pasta.")
            sys.exit(1)
    
    print("Todos os arquivos foram encontrados.")

    # 2. Inicia o servidor em uma thread separada
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    url = f"http://{HOSTNAME}:{PORT}/{REQUIRED_FILES[0]}"
    print(f"\nServidor iniciado em: {url}")
    
    # 3. Abre o navegador
    print("Abrindo o navegador...")
    time.sleep(1)
    webbrowser.open(url)
    
    print("\nO servidor está rodando. Para parar, feche esta janela ou pressione Ctrl+C.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor parado. Tchau!")
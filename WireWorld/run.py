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
FILES_DIR = os.path.dirname(os.path.abspath(__file__))
FILES_SUBDIR = FILES_DIR
SERVE_DIR = FILES_DIR

def start_server():
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.log_message = lambda *args: None
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    print("Iniciando o lançador do WireWorld...")

    # 1. Verificando se existem todos os arquivos necessários
    for filename in REQUIRED_FILES:
        file_path = os.path.join(FILES_DIR, filename)
        if not os.path.exists(file_path):
            print(f"\nERRO: Arquivo '{filename}' não encontrado na pasta '{FILES_DIR}'.")
            print("Certifique-se de que os arquivos (run.py, index.html, style.css, script.js) estão na pasta 'WireWorld/'.")
            sys.exit(1)
    
    print("Todos os arquivos foram encontrados.")

    # 2. Inicia o servidor em uma thread separada
    os.chdir(SERVE_DIR)
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
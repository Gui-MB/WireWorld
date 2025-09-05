# ⚡ WireWorld – Autômato Celular em JavaScript

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![GitHub top language](https://img.shields.io/github/languages/top/Gui-MB/wireworld)
![GitHub repo size](https://img.shields.io/github/repo-size/Gui-MB/wireworld)
![Status](https://img.shields.io/badge/status-active-success)

WireWorld é uma implementação interativa em **JavaScript** do famoso autômato celular inventado por Brian Silverman em 1987.  
Ele permite simular circuitos digitais utilizando regras simples aplicadas em uma grade bidimensional.


Este é um trabalho da Disciplina de Computação Cientifica executado por Dilson Freitas Simões Junior e Guilherme de Medeiros Burkert, ambos da Universidade Federal de Rio Grande (FURG)
---

## 🚀 Funcionalidades

- 🖥️ Interface gráfica em HTML5 + CSS3.
- 🎮 Controles interativos:
  - **Play / Pausar** a simulação.
  - **Step** (avanço manual por geração).
  - **Resetar** ou **Limpar** o tabuleiro.
- 💾 Salvar e carregar circuitos personalizados em arquivo `.txt`.
- ⚡ Controle de velocidade (1–60 gerações por segundo).
- 🔧 Painel lateral com **circuitos prontos (presets)**:
  - Diodo
  - Transistor
  - Porta XOR
  - Gerador de Clock
- 🖱️ Desenho direto no tabuleiro:
  - Clique esquerdo → Wire
  - Clique direito → Head
  - Clique do meio → Tail

---

## 📂 Estrutura do Projeto

wireworld/
<br>
├── index.html    - # Estrutura principal da aplicação<br>
├── style.css     - # Estilos da interface<br>
├── script.js     - # Lógica do WireWorld (simulação e interação)<br>
├── run.py        - # Lançador em Python (servidor local)<br>
├── LICENSE       - # Licença do projeto<br>
└── README.md     - # Este arquivo<br>

---

## 🎥 Demonstração

![ezgif-380d59e2c25bf3](https://github.com/user-attachments/assets/d44e93de-de27-4d41-b6c5-fe7aa0b07dff)

---

## 📜 Regras do WireWorld

1. **Vazio** → permanece vazio.  
2. **Head (cabeça de elétron)** → vira uma Tail.  
3. **Tail (cauda de elétron)** → vira um Wire.  
4. **Wire (condutor)** → vira uma Head se 1 ou 2 vizinhos forem Heads.  

---

## 🛠️ Como executar

### Opção 1 – Abrindo no navegador
Basta abrir o arquivo **`index.html`** no seu navegador favorito.

### Opção 2 – Usando o lançador em Python
O projeto já vem com um script (`run.py`) que cria um servidor local e abre automaticamente no navegador.

```bash
python run.py
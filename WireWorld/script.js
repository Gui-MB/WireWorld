document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
    const CELL_SIZE = 28;
    const DEFAULT_GRID_SIZE = 90; // mais colunas para grid horizontal
    const COLORS = {
        BACKGROUND: 'rgb(20, 20, 30)',
        GRID_LINES: 'rgb(40, 40, 50)',
        CONDUCTOR: 'rgb(255, 180, 0)',
        HEAD: 'rgb(0, 150, 255)',
        TAIL: 'rgb(255, 50, 50)',
    };
    const STATE_TO_COLOR = [COLORS.BACKGROUND, COLORS.CONDUCTOR, COLORS.HEAD, COLORS.TAIL];
    const CHAR_TO_STATE = { '.': 0, ' ': 0, 'w': 1, '#': 1, 'h': 2, 'H': 2, 't': 3, 'T': 3 };

    let automaton;
    let animationFrameId;
    let lastUpdateTime = 0;

    // --- ELEMENTOS DO DOM ---
    const screens = {
        menu: document.getElementById('menu-screen'),
        simulation: document.getElementById('simulation-screen'),
        instructions: document.getElementById('instructions-screen'),
    };
    const canvas = document.getElementById('wireworld-canvas');
    const ctx = canvas.getContext('2d');
    const circuitInput = document.getElementById('circuit-input');
    const saveCircuitButton = document.getElementById('save-circuit-button');
    const loadCircuitButton = document.getElementById('load-circuit-button');
    const fileInput = document.getElementById('file-input');

    // Botões
    const startButton = document.getElementById('start-button');
    const instructionsButton = document.getElementById('instructions-button');
    const backFromInstructionsButton = document.getElementById('back-from-instructions-button');
    const playPauseButton = document.getElementById('play-pause-button');
    const resetButton = document.getElementById('reset-button');
    const clearButton = document.getElementById('clear-button');
    const backToMenuButton = document.getElementById('back-to-menu-button');

    // UI da Simulação
    const speedSlider = document.getElementById('speed-slider');
    const speedValueSpan = document.getElementById('speed-value');
    const generationCountSpan = document.getElementById('generation-count');
    const statusTextSpan = document.getElementById('status-text');

    // --- LÓGICA DO AUTÔMATO (CLASSE WIREWORLD) ---
    class WireWorld {
        constructor() {
            this.grid = [];
            this.initialGrid = [];
            this.gridWidth = DEFAULT_GRID_SIZE;
            this.gridHeight = DEFAULT_GRID_SIZE;
            this.paused = true;
            this.generation = 0;
            // Não chama this.clear() aqui para evitar updateUI antes de automaton existir
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
        }

        loadFromString(str) {
            if (!str.trim()) {
                this.clear();
                return;
            }

            const lines = str.trim().split(/\r?\n/);
            
            const height = lines.length;
            const width = Math.max(0, ...lines.map(l => l.length));
            const padding = 4;
            this.gridWidth = width + padding * 2;
            this.gridHeight = height + padding * 2;
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            
            lines.forEach((line, r) => {
                for (let c = 0; c < line.length; c++) {
                    this.grid[r + padding][c + padding] = CHAR_TO_STATE[line[c]] || 0;
                }
            });
            
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
            this.generation = 0;
        }

        step() {
            if (this.paused) return false;
            const newGrid = JSON.parse(JSON.stringify(this.grid));
            
            for (let r = 0; r < this.gridHeight; r++) {
                for (let c = 0; c < this.gridWidth; c++) {
                    const state = this.grid[r][c];
                    if (state === 2) newGrid[r][c] = 3;
                    else if (state === 3) newGrid[r][c] = 1;
                    else if (state === 1) {
                        let headNeighbors = 0;
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                if (dr === 0 && dc === 0) continue;
                                const nr = r + dr, nc = c + dc;
                                if (nr >= 0 && nr < this.gridHeight && nc >= 0 && nc < this.gridWidth && this.grid[nr][nc] === 2) {
                                    headNeighbors++;
                                }
                            }
                        }
                        if (headNeighbors === 1 || headNeighbors === 2) newGrid[r][c] = 2;
                    }
                }
            }
            if (JSON.stringify(this.grid) !== JSON.stringify(newGrid)) {
                this.generation++;
                this.grid = newGrid;
                return true;
            }
            return false;
        }
        
        reset() {
            this.grid = JSON.parse(JSON.stringify(this.initialGrid));
            this.generation = 0;
            this.paused = true;
            // updateUI será chamado fora, após automaton estar definido
        }

        clear() {
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
            this.generation = 0;
            this.paused = true;
            // updateUI será chamado fora, após automaton estar definido
        }

        togglePause() {
            this.paused = !this.paused;
            updateUI();
        }
    }

    // --- FUNÇÕES DE CONTROLE DE TELA E UI ---
    function showScreen(screenId) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        screens[screenId].classList.add('active');
    }

    function resizeCanvasToFit() {
        // Calcula o tamanho máximo possível para o canvas, respeitando a janela
        const maxWidth = Math.floor(window.innerWidth * 0.98);
    const maxHeight = Math.floor(window.innerHeight * 0.60);
        let cellSize = CELL_SIZE;
        const MIN_CELL_SIZE = 18;
        if (automaton) {
            cellSize = Math.min(
                Math.floor(maxWidth / automaton.gridWidth),
                Math.floor(maxHeight / automaton.gridHeight),
                CELL_SIZE
            );
            cellSize = Math.max(Math.min(cellSize, CELL_SIZE), MIN_CELL_SIZE);
        }
        canvas.width = (automaton ? automaton.gridWidth : DEFAULT_GRID_SIZE) * cellSize;
        canvas.height = (automaton ? automaton.gridHeight : DEFAULT_GRID_SIZE) * cellSize;
        return cellSize;
    }

    let currentCellSize = CELL_SIZE;

    function startSimulation() {
        automaton = new WireWorld();
        automaton.loadFromString(circuitInput.value);
        currentCellSize = resizeCanvasToFit();
        showScreen('simulation');
        updateUI();
        if(animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    window.addEventListener('resize', () => {
        if (screens.simulation.classList.contains('active')) {
            currentCellSize = resizeCanvasToFit();
        }
    });
    
    function stopSimulation() {
        if(animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        showScreen('menu');
    }

    function updateUI() {
        playPauseButton.textContent = automaton.paused ? 'Play' : 'Pause';
        statusTextSpan.textContent = automaton.paused ? 'Pausado' : 'Executando';
        generationCountSpan.textContent = automaton.generation;
    }

    // --- LÓGICA DE DESENHO (CANVAS) ---
    function drawGrid() {
        ctx.strokeStyle = COLORS.GRID_LINES;
        for (let x = 0; x <= canvas.width; x += currentCellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += currentCellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function drawCells() {
        for (let r = 0; r < automaton.gridHeight; r++) {
            for (let c = 0; c < automaton.gridWidth; c++) {
                const state = automaton.grid[r][c];
                if (state !== 0) {
                    ctx.fillStyle = STATE_TO_COLOR[state];
                    ctx.fillRect(c * currentCellSize, r * currentCellSize, currentCellSize, currentCellSize);
                }
            }
        }
    }

    // --- LOOP PRINCIPAL DO JOGO ---
    function gameLoop(timestamp) {
        const delay = 1000 / speedSlider.value;
        if (timestamp - lastUpdateTime > delay) {
            if (automaton.step()) {
                updateUI();
            }
            lastUpdateTime = timestamp;
        }

        ctx.fillStyle = COLORS.BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawCells();
        drawGrid();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- EVENT LISTENERS ---
    startButton.addEventListener('click', startSimulation);
    instructionsButton.addEventListener('click', () => showScreen('instructions'));
    backFromInstructionsButton.addEventListener('click', () => showScreen('menu'));
    backToMenuButton.addEventListener('click', stopSimulation);
    
    playPauseButton.addEventListener('click', () => {
        automaton.togglePause();
        updateUI();
    });
    resetButton.addEventListener('click', () => {
        automaton.reset();
        updateUI();
    });
    clearButton.addEventListener('click', () => {
        automaton.clear();
        updateUI();
    });

    speedSlider.addEventListener('input', () => {
        speedValueSpan.textContent = speedSlider.value;
    });

    // Desenho com mouse no canvas
    let isDrawing = false;
    function handleDraw(event) {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const c = Math.floor(x / currentCellSize);
        const r = Math.floor(y / currentCellSize);

        if (r < 0 || r >= automaton.gridHeight || c < 0 || c >= automaton.gridWidth) return;

        if (event.buttons === 1) automaton.grid[r][c] = 1; // Esquerdo: Fio
        else if (event.buttons === 2) automaton.grid[r][c] = 0; // Direito: Apaga
        else if (event.buttons === 4) automaton.grid[r][c] = 3; // Meio: Cauda
    }
    // --- SALVAR E CARREGAR CIRCUITO ---
    saveCircuitButton.addEventListener('click', () => {
        const blob = new Blob([circuitInput.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuito_wireworld.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    });

    loadCircuitButton.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            circuitInput.value = e.target.result;
        };
        reader.readAsText(file);
    });
    canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleDraw(e); });
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mousemove', (e) => { if (isDrawing) handleDraw(e); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- INICIALIZAÇÃO ---
    showScreen('menu');
});
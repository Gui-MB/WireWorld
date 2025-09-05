    document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // --- CONSTANTES E VARIÁVEIS GLOBAIS ---
    // ===================================================================================

    const CELL_SIZE = 18; // Tamanho de cada célula em pixels
    const DEFAULT_GRID_WIDTH = 60; // Largura padrão da grade
    const DEFAULT_GRID_HEIGHT = 40; // Altura padrão da grade
    const COLORS = {
        BACKGROUND: 'rgb(20, 20, 30)',
        GRID_LINES: 'rgb(40, 40, 50)',
        CONDUCTOR: 'rgb(255, 180, 0)',
        HEAD: 'rgb(0, 150, 255)',
        TAIL: 'rgb(255, 50, 50)',
    };
    const STATE_TO_COLOR = [COLORS.BACKGROUND, COLORS.CONDUCTOR, COLORS.HEAD, COLORS.TAIL];
    const CHAR_TO_STATE = { '.': 0, ' ': 0, 'w': 1, '#': 1, 'h': 2, 'H': 2, 't': 3, 'T': 3 };

    let automaton; // Instância da classe WireWorld
    let animationFrameId; // ID do frame de animação para controle do loop
    let lastUpdateTime = 0; // Timestamp da última atualização
    let currentCellSize = CELL_SIZE; // Tamanho atual da célula (pode mudar com resize)
    let placementMode = {
        active: false,
        pattern: null,
        width: 0,
        height: 0,
        anchor: 'center' // 'center' | 'topleft'
    };
    let mousePosition = { r: -1, c: -1 };

    // ===================================================================================
    // --- ELEMENTOS DO DOM ---
    // ===================================================================================

    const canvas = document.getElementById('wireworld-canvas');
    const ctx = canvas.getContext('2d');
    const saveCircuitButton = document.getElementById('save-circuit-button');
    const loadCircuitButton = document.getElementById('load-circuit-button');
    const fileInput = document.getElementById('file-input');
    const playPauseButton = document.getElementById('play-pause-button');
    const stepButton = document.getElementById('step-button');
    const resetButton = document.getElementById('reset-button');
    const speedSlider = document.getElementById('speed-slider');
    const speedValueSpan = document.getElementById('speed-value');
    const generationCountSpan = document.getElementById('generation-count');
    const statusTextSpan = document.getElementById('status-text');
    const clearButton = document.getElementById('clear-button');
    const presetsPanel = document.getElementById('presets-panel');

    // ===================================================================================
    // --- PRESETS DE CIRCUITOS ---
    // ===================================================================================

    const PRESETS = {
        diode: `
.w.
www
.w.
`,
        transistor: `
..w..
.whw.
w.w.w
.whw.
..w..
`,
        xor: `
www......
...w.....
..wwww...
..w..wwww
..wwww...
...w.....
www......
`,
        clock: `
.wwth.
w....w
.wwww.
`.trim()
    };

    /**
     * Converte uma string de preset em uma matriz 2D de estados.
     * @param {string} str - A string do preset.
     * @returns {number[][]} - A matriz representando o padrão.
     */
    function parsePattern(str) {
        // Remove espaços extras e linhas vazias, e garanta matriz retangular
        const rawLines = str.trim().split(/\r?\n/);
        const lines = rawLines.filter(l => l.trim().length > 0);
        const width = lines.reduce((max, l) => Math.max(max, l.length), 0);
        const height = lines.length;
        const pattern = Array.from({ length: height }, (_, r) => {
            const line = lines[r] ?? '';
            const row = Array.from({ length: width }, (_, c) => {
                const ch = line[c] ?? '.';
                return CHAR_TO_STATE[ch] ?? 0;
            });
            return row;
        });
        return pattern;
    }

    // ===================================================================================
    // --- CLASSE WIREWORLD (LÓGICA DO AUTÔMATO) ---
    // ===================================================================================

    class WireWorld {
        constructor() {
            this.gridWidth = DEFAULT_GRID_WIDTH;
            this.gridHeight = DEFAULT_GRID_HEIGHT;
            this.paused = true;
            this.generation = 0;
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
        }

        /**
         * Carrega o estado da grade a partir de uma string.
         * @param {string} str - A string representando o circuito.
         */
        loadFromString(str) {
            if (!str.trim()) {
                this.clear();
                return;
            }

            const lines = str.trim().split(/\r?\n/);
            const height = lines.length;
            const width = Math.max(0, ...lines.map(l => l.length));
            
            this.gridWidth = width;
            this.gridHeight = height;
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            
            lines.forEach((line, r) => {
                for (let c = 0; c < line.length; c++) {
                    this.grid[r][c] = CHAR_TO_STATE[line[c]] || 0;
                }
            });
            
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
            this.generation = 0;
            this.paused = true;
            resizeCanvasToFit();
        }

        /**
         * Avança a simulação em um passo.
         * @returns {boolean} - Retorna true se a grade mudou, false caso contrário.
         */
        forceStep() {
            const newGrid = JSON.parse(JSON.stringify(this.grid));
            let changed = false;
            
            for (let r = 0; r < this.gridHeight; r++) {
                for (let c = 0; c < this.gridWidth; c++) {
                    const state = this.grid[r][c];
                    if (state === 2) { // Cabeça -> Cauda
                        newGrid[r][c] = 3;
                        changed = true;
                    } else if (state === 3) { // Cauda -> Condutor
                        newGrid[r][c] = 1;
                        changed = true;
                    } else if (state === 1) { // Condutor -> Cabeça
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
                        if (headNeighbors === 1 || headNeighbors === 2) {
                            newGrid[r][c] = 2;
                            changed = true;
                        }
                    }
                }
            }

            if (changed) {
                this.generation++;
                this.grid = newGrid;
            }
            return changed;
        }

        step() {
            if (this.paused) return false;
            return this.forceStep();
        }
        
        /** Reseta a grade para o estado inicial salvo. */
        reset() {
            this.grid = JSON.parse(JSON.stringify(this.initialGrid));
            this.generation = 0;
            this.paused = true;
        }

        /** Limpa a grade completamente. */
        clear() {
            this.grid = Array(this.gridHeight).fill(0).map(() => Array(this.gridWidth).fill(0));
            this.initialGrid = JSON.parse(JSON.stringify(this.grid));
            this.generation = 0;
            this.paused = true;
        }

        /** Alterna o estado de pausa da simulação. */
        togglePause() {
            this.paused = !this.paused;
        }
    }

    // ===================================================================================
    // --- FUNÇÕES DE UI E CONTROLE ---
    // ===================================================================================

    /**
     * Redimensiona o canvas para se ajustar à janela, mantendo a proporção.
     */
    function resizeCanvasToFit() {
        const simulationWrapper = document.getElementById('simulation-wrapper');
        const maxWidth = Math.floor(simulationWrapper.clientWidth * 0.98);
        const maxHeight = Math.floor(window.innerHeight * 0.60);
        
        let newCellSize = Math.min(
            Math.floor(maxWidth / automaton.gridWidth),
            Math.floor(maxHeight / automaton.gridHeight)
        );
        
        currentCellSize = Math.max(1, newCellSize); // Garante que o tamanho da célula não seja zero
        
        canvas.width = automaton.gridWidth * currentCellSize;
        canvas.height = automaton.gridHeight * currentCellSize;
    }

    /**
     * Atualiza os elementos da UI com as informações atuais da simulação.
     */
    function updateUI() {
        playPauseButton.textContent = automaton.paused ? 'Play' : 'Pause';
        statusTextSpan.textContent = automaton.paused ? 'Pausado' : 'Executando';
        generationCountSpan.textContent = automaton.generation;
        draw(); // Redesenha a grade
    }

    // ===================================================================================
    // --- LÓGICA DE DESENHO (CANVAS) ---
    // ===================================================================================

    /**
     * Desenha a grade e as células no canvas.
     */
    function draw() {
        ctx.fillStyle = COLORS.BACKGROUND;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenha as células
        for (let r = 0; r < automaton.gridHeight; r++) {
            for (let c = 0; c < automaton.gridWidth; c++) {
                const state = automaton.grid[r][c];
                if (state !== 0) {
                    ctx.fillStyle = STATE_TO_COLOR[state];
                    ctx.fillRect(c * currentCellSize, r * currentCellSize, currentCellSize, currentCellSize);
                }
            }
        }

        // Desenha as linhas da grade
        ctx.strokeStyle = COLORS.GRID_LINES;
        ctx.lineWidth = 1;
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

        // Desenha a pré-visualização do preset se estiver no modo de colocação
        if (placementMode.active && mousePosition.r !== -1) {
            drawPlacementPreview();
        }
    }

    /**
     * Desenha a pré-visualização do preset no canvas.
     */
    function drawPlacementPreview() {
        const { pattern, width, height, anchor } = placementMode;
        // Calcular início conforme ancoragem
        const rOffset = anchor === 'center' ? Math.floor(height / 2) : 0;
        const cOffset = anchor === 'center' ? Math.floor(width / 2) : 0;
        const startR = mousePosition.r - rOffset;
        const startC = mousePosition.c - cOffset;

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const state = pattern[r][c];
                if (state !== 0) {
                    const gridR = startR + r;
                    const gridC = startC + c;
                    if (gridR >= 0 && gridR < automaton.gridHeight && gridC >= 0 && gridC < automaton.gridWidth) {
                        ctx.fillStyle = STATE_TO_COLOR[state];
                        ctx.globalAlpha = 0.5; // Define a transparência
                        ctx.fillRect(gridC * currentCellSize, gridR * currentCellSize, currentCellSize, currentCellSize);
                        ctx.globalAlpha = 1.0; // Restaura a opacidade
                    }
                }
            }
        }
    }

    // ===================================================================================
    // --- LOOP PRINCIPAL DA SIMULAÇÃO ---
    // ===================================================================================

    function gameLoop(timestamp) {
        const delay = 1000 / speedSlider.value;
        if (timestamp - lastUpdateTime > delay) {
            if (automaton.step()) {
                updateUI();
            }
            lastUpdateTime = timestamp;
        }
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // ===================================================================================
    // --- EVENT LISTENERS ---
    // ===================================================================================

    playPauseButton.addEventListener('click', () => {
        automaton.togglePause();
        updateUI();
    });

    stepButton.addEventListener('click', () => {
        automaton.paused = true;
        automaton.forceStep();
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

    // --- Lógica de Desenho com o Mouse ---
    let isDrawing = false;
    let lastCell = { r: -1, c: -1 };

    /**
     * Coloca um padrão na grade na posição especificada.
     * @param {number} startR - Linha inicial.
     * @param {number} startC - Coluna inicial.
     */
    function placePattern(targetR, targetC) {
        const { pattern, width, height, anchor } = placementMode;
        // Calcular início conforme ancoragem
        const rOffset = anchor === 'center' ? Math.floor(height / 2) : 0;
        const cOffset = anchor === 'center' ? Math.floor(width / 2) : 0;
        const startR = targetR - rOffset;
        const startC = targetC - cOffset;

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const gridR = startR + r;
                const gridC = startC + c;
                if (gridR >= 0 && gridR < automaton.gridHeight && gridC >= 0 && gridC < automaton.gridWidth) {
                    if (pattern[r][c] !== 0) { // Só sobrescreve células não vazias do padrão
                        automaton.grid[gridR][gridC] = pattern[r][c];
                    }
                }
            }
        }
        automaton.initialGrid = JSON.parse(JSON.stringify(automaton.grid));
        updateUI();
    }

    function applyDrawing(r, c, buttons) {
        if (r < 0 || r >= automaton.gridHeight || c < 0 || c >= automaton.gridWidth) return false;

        // On a drag, don't re-apply to the same cell
        if (isDrawing && r === lastCell.r && c === lastCell.c) return false;
        lastCell = { r, c };

        const currentState = automaton.grid[r][c];
        let newState = currentState;

        if (buttons === 1) { // Left button
            newState = (currentState === 1) ? 0 : 1;
        } else if (buttons === 2) { // Right button
            newState = (currentState === 2) ? 0 : 2;
        } else if (buttons === 4) { // Middle button
            newState = (currentState === 3) ? 0 : 3;
        }
        
        if (newState !== currentState) {
            automaton.grid[r][c] = newState;
            automaton.initialGrid[r][c] = newState;
            return true;
        }
        return false;
    }

    function getMouseCell(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const c = Math.floor(x / currentCellSize);
        const r = Math.floor(y / currentCellSize);
        return { r, c };
    }

    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const { r, c } = getMouseCell(e);

        if (placementMode.active) {
            if (e.button === 0) { // Left click to place (keep mode active for multiple stamps)
                if (r >= 0 && r < automaton.gridHeight && c >= 0 && c < automaton.gridWidth) {
                    placePattern(r, c);
                }
            } else if (e.button === 2) { // Right click to cancel
                deactivatePlacementMode();
            }
            return;
        }

        // If not in placement mode, start drawing
        isDrawing = true;
        lastCell = { r: -1, c: -1 }; // Reset last cell to allow single click draw
        if (applyDrawing(r, c, e.buttons)) {
            updateUI();
        }
    });

    canvas.addEventListener('mouseup', () => { 
        isDrawing = false; 
    });

    canvas.addEventListener('mousemove', (e) => {
        e.preventDefault();
        const { r, c } = getMouseCell(e);

        // Always update mouse position for the preview
        mousePosition = { r, c };

        if (!isDrawing || placementMode.active) {
            return;
        }

        if (applyDrawing(r, c, e.buttons)) {
            updateUI();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
        mousePosition = { r: -1, c: -1 };
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Lógica para Salvar e Carregar ---
    saveCircuitButton.addEventListener('click', () => {
        let txt = '';
        for (let r = 0; r < automaton.gridHeight; r++) {
            let line = '';
            for (let c = 0; c < automaton.gridWidth; c++) {
                let v = automaton.grid[r][c];
                if (v === 1) line += 'w';
                else if (v === 2) line += 'h';
                else if (v === 3) line += 't';
                else line += '.';
            }
            txt += line + (r < automaton.gridHeight - 1 ? '\n' : '');
        }
        const blob = new Blob([txt], { type: 'text/plain' });
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
            try {
                automaton.loadFromString(e.target.result);
                updateUI();
            } catch (err) {
                console.error("Erro ao carregar o arquivo:", err);
                alert('Arquivo inválido ou corrompido!');
            }
        };
        reader.readAsText(file);
    });

    // --- Lógica dos Presets ---
    function deactivatePlacementMode() {
        placementMode.active = false;
        document.querySelectorAll('.preset-item.active').forEach(item => item.classList.remove('active'));
        canvas.style.cursor = 'default';
    }

    presetsPanel.addEventListener('click', (event) => {
        const presetItem = event.target.closest('.preset-item');
        if (!presetItem) return;

        // Desativa se o mesmo preset for clicado novamente
        if (presetItem.classList.contains('active')) {
            deactivatePlacementMode();
            return;
        }

        deactivatePlacementMode(); // Desativa qualquer outro preset ativo

        const presetName = presetItem.dataset.preset;
        if (PRESETS[presetName]) {
            const pattern = parsePattern(PRESETS[presetName]);
            placementMode.active = true;
            placementMode.pattern = pattern;
            placementMode.height = pattern.length;
            placementMode.width = pattern[0].length;
            
            presetItem.classList.add('active');
            canvas.style.cursor = 'copy';
        }
    });

    // Teclas de atalho: Space para Step; Escape para sair do modo de carimbo
    window.addEventListener('keydown', (e) => {
        // Space: dá um passo único (pausando antes)
        if (e.code === 'Space') {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.isComposing;
            if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                automaton.paused = true;
                automaton.forceStep();
                updateUI();
                return;
            }
        }

        // Escape: cancela modo de colocação
        if (e.key === 'Escape' && placementMode.active) {
            deactivatePlacementMode();
        }
    });

    // ===================================================================================
    // --- INICIALIZAÇÃO ---
    // ===================================================================================

    function initialize() {
        automaton = new WireWorld();
        resizeCanvasToFit();
        updateUI();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    initialize();
});
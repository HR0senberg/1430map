class SchoolMapApp {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDarkTheme = false;
        
        // Map data
        this.nodes = new Map();
        this.connections = [];
        this.currentPath = [];
        this.currentLocation = null;
        
        // Interaction state
        this.mode = 'pan';
        this.nodeType = 'room';
        this.selectedNode = null;
        this.connectingNodes = [];
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // View state
        this.camera = { x: 0, y: 0, scale: 1 };
        this.lastPinchDistance = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        
        // Voice navigation
        this.voiceInstructions = [];
        this.currentInstructionIndex = 0;
        this.isVoiceNavigating = false;
        
        // QR Scanner
        this.qrScanner = null;
        
        this.nodeTypes = {
            room: { color: '#3498db', size: 60, shape: 'rectangle', name: 'Комната' },
            stair: { color: '#2ecc71', size: 50, shape: 'triangle', name: 'Лестница' },
            door: { color: '#e67e22', size: 30, shape: 'circle', name: 'Дверь' }
        };
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.initializeExampleNodes();
        this.render();
        window.addEventListener('resize', () => this.setupCanvas());
    }

    setupCanvas() {
        const container = document.getElementById('canvasContainer');
        const rect = container.getBoundingClientRect();
        
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvasRect = { width: rect.width, height: rect.height };
    }

    setupEventListeners() {
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                this.selectedNode = null;
                this.connectingNodes = [];
                this.render();
            });
        });

        // Node type buttons
        document.querySelectorAll('.node-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.node-type-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.node-type-btn').classList.add('active');
                this.nodeType = e.target.closest('.node-type-btn').dataset.type;
            });
        });

        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        document.getElementById('floatingZoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('floatingZoomOut').addEventListener('click', () => this.zoom(0.8));

        // QR Scanner
        document.getElementById('scanQR').addEventListener('click', () => this.startQRScanner());
        document.getElementById('closeQR').addEventListener('click', () => this.stopQRScanner());

        // Route planning
        document.getElementById('buildRoute').addEventListener('click', () => this.buildRoute());
        document.getElementById('clearRoute').addEventListener('click', () => this.clearRoute());

        // Voice navigation
        document.getElementById('startVoiceNav').addEventListener('click', () => this.startVoiceNavigation());
        document.getElementById('stopVoiceNav').addEventListener('click', () => this.stopVoiceNavigation());
        document.getElementById('prevStep').addEventListener('click', () => this.previousInstruction());
        document.getElementById('nextStep').addEventListener('click', () => this.nextInstruction());

        // Map management
        document.getElementById('saveMap').addEventListener('click', () => this.saveMap());
        document.getElementById('loadMap').addEventListener('click', () => document.getElementById('loadMapInput').click());
        document.getElementById('loadMapInput').addEventListener('change', (e) => this.loadMap(e));
        document.getElementById('clearAll').addEventListener('click', () => this.clearAll());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Mobile menu
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());

        // Node editor modal
        document.getElementById('closeNodeModal').addEventListener('click', () => this.closeNodeEditor());
        document.getElementById('cancelNodeEdit').addEventListener('click', () => this.closeNodeEditor());
        document.getElementById('nodeForm').addEventListener('submit', (e) => this.saveNodeEdit(e));

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    initializeExampleNodes() {
        const exampleNodes = [
            { id: 'room101', type: 'room', name: 'Кабинет 101', info: 'Математика', x: 150, y: 100, qrCode: 'room101' },
            { id: 'door1', type: 'door', name: 'Дверь 1', info: 'Вход в коридор', x: 250, y: 100, qrCode: 'door1' },
            { id: 'stairs1', type: 'stair', name: 'Лестница 1', info: 'На 2 этаж', x: 350, y: 100, qrCode: 'stairs1' },
            { id: 'room201', type: 'room', name: 'Кабинет 201', info: 'Русский язык', x: 450, y: 100, qrCode: 'room201' }
        ];

        exampleNodes.forEach(node => {
            this.nodes.set(node.id, node);
        });

        // Add some connections
        this.connections = [
            { from: 'room101', to: 'door1' },
            { from: 'door1', to: 'stairs1' },
            { from: 'stairs1', to: 'room201' }
        ];

        this.updateNodeSelects();
    }

    updateNodeSelects() {
        const startSelect = document.getElementById('startPoint');
        const endSelect = document.getElementById('endPoint');
        
        startSelect.innerHTML = '<option value="">Выберите начальную точку</option>';
        endSelect.innerHTML = '<option value="">Выберите конечную точку</option>';
        
        this.nodes.forEach((node, id) => {
            const option1 = new Option(node.name, id);
            const option2 = new Option(node.name, id);
            startSelect.add(option1);
            endSelect.add(option2);
        });
    }

    // Canvas interaction methods
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.camera.x) / this.camera.scale,
            y: (e.clientY - rect.top - this.camera.y) / this.camera.scale
        };
    }

    getTouchPos(touch) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left - this.camera.x) / this.camera.scale,
            y: (touch.clientY - rect.top - this.camera.y) / this.camera.scale
        };
    }

    findNodeAtPosition(pos) {
        for (const [id, node] of this.nodes) {
            const distance = Math.sqrt((pos.x - node.x) ** 2 + (pos.y - node.y) ** 2);
            const nodeSize = this.nodeTypes[node.type].size;
            if (distance <= nodeSize / 2) {
                return { id, node };
            }
        }
        return null;
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const foundNode = this.findNodeAtPosition(pos);

        if (this.mode === 'pan') {
            if (foundNode) {
                this.isDragging = true;
                this.selectedNode = foundNode.id;
                this.dragOffset = {
                    x: pos.x - foundNode.node.x,
                    y: pos.y - foundNode.node.y
                };
            } else {
                this.isPanning = true;
                this.panStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
            }
        } else if (this.mode === 'add') {
            if (!foundNode) {
                this.addNode(pos);
            }
        } else if (this.mode === 'edit') {
            if (foundNode) {
                this.openNodeEditor(foundNode.id);
            }
        } else if (this.mode === 'connect') {
            if (foundNode) {
                this.handleNodeConnection(foundNode.id);
            }
        } else if (this.mode === 'delete') {
            if (foundNode) {
                this.deleteNode(foundNode.id);
            }
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.isDragging && this.selectedNode) {
            const node = this.nodes.get(this.selectedNode);
            node.x = pos.x - this.dragOffset.x;
            node.y = pos.y - this.dragOffset.y;
            this.render();
        } else if (this.isPanning) {
            this.camera.x = e.clientX - this.panStart.x;
            this.camera.y = e.clientY - this.panStart.y;
            this.render();
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.isPanning = false;
        this.selectedNode = null;
    }

    handleWheel(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomAt(pos, zoomFactor);
    }

    // Touch event handlers
    handleTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const pos = this.getTouchPos(touch);
            const foundNode = this.findNodeAtPosition(pos);

            if (this.mode === 'pan') {
                if (foundNode) {
                    this.isDragging = true;
                    this.selectedNode = foundNode.id;
                    this.dragOffset = {
                        x: pos.x - foundNode.node.x,
                        y: pos.y - foundNode.node.y
                    };
                } else {
                    this.isPanning = true;
                    this.panStart = { x: touch.clientX - this.camera.x, y: touch.clientY - this.camera.y };
                }
            } else if (this.mode === 'add' && !foundNode) {
                this.addNode(pos);
            } else if (this.mode === 'edit' && foundNode) {
                this.openNodeEditor(foundNode.id);
            } else if (this.mode === 'connect' && foundNode) {
                this.handleNodeConnection(foundNode.id);
            } else if (this.mode === 'delete' && foundNode) {
                this.deleteNode(foundNode.id);
            }
        } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            this.lastPinchDistance = Math.sqrt(
                (touch2.clientX - touch1.clientX) ** 2 + (touch2.clientY - touch1.clientY) ** 2
            );
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && (this.isDragging || this.isPanning)) {
            const touch = e.touches[0];
            const pos = this.getTouchPos(touch);

            if (this.isDragging && this.selectedNode) {
                const node = this.nodes.get(this.selectedNode);
                node.x = pos.x - this.dragOffset.x;
                node.y = pos.y - this.dragOffset.y;
                this.render();
            } else if (this.isPanning) {
                this.camera.x = touch.clientX - this.panStart.x;
                this.camera.y = touch.clientY - this.panStart.y;
                this.render();
            }
        } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const pinchDistance = Math.sqrt(
                (touch2.clientX - touch1.clientX) ** 2 + (touch2.clientY - touch1.clientY) ** 2
            );
            
            if (this.lastPinchDistance > 0) {
                const zoomFactor = pinchDistance / this.lastPinchDistance;
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                const pos = this.getMousePos({ clientX: centerX, clientY: centerY });
                this.zoomAt(pos, zoomFactor);
            }
            
            this.lastPinchDistance = pinchDistance;
        }
    }

    handleTouchEnd(e) {
        this.isDragging = false;
        this.isPanning = false;
        this.selectedNode = null;
        this.lastPinchDistance = 0;
    }

    // Node operations
    addNode(pos) {
        const id = `node_${Date.now()}`;
        const typeConfig = this.nodeTypes[this.nodeType];
        const node = {
            id,
            type: this.nodeType,
            name: `${typeConfig.name} ${this.nodes.size + 1}`,
            info: '',
            x: pos.x,
            y: pos.y,
            qrCode: id
        };
        
        this.nodes.set(id, node);
        this.updateNodeSelects();
        this.render();
        this.showNotification(`Добавлен узел: ${node.name}`, 'success');
    }

    deleteNode(nodeId) {
        this.nodes.delete(nodeId);
        this.connections = this.connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId);
        this.updateNodeSelects();
        this.render();
        this.showNotification('Узел удален', 'success');
    }

    handleNodeConnection(nodeId) {
        if (this.connectingNodes.length === 0) {
            this.connectingNodes.push(nodeId);
            this.showNotification('Выберите второй узел для соединения', 'info');
        } else if (this.connectingNodes.length === 1) {
            if (this.connectingNodes[0] !== nodeId) {
                this.connections.push({
                    from: this.connectingNodes[0],
                    to: nodeId
                });
                this.showNotification('Узлы соединены', 'success');
            } else {
                this.showNotification('Нельзя соединить узел с самим собой', 'warning');
            }
            this.connectingNodes = [];
        }
        this.render();
    }

    openNodeEditor(nodeId) {
        const node = this.nodes.get(nodeId);
        document.getElementById('nodeName').value = node.name;
        document.getElementById('nodeInfo').value = node.info || '';
        document.getElementById('nodeQR').value = node.qrCode || node.id;
        document.getElementById('nodeModal').classList.add('show');
        document.getElementById('nodeModal').dataset.nodeId = nodeId;
    }

    closeNodeEditor() {
        document.getElementById('nodeModal').classList.remove('show');
    }

    saveNodeEdit(e) {
        e.preventDefault();
        const nodeId = document.getElementById('nodeModal').dataset.nodeId;
        const node = this.nodes.get(nodeId);
        
        node.name = document.getElementById('nodeName').value;
        node.info = document.getElementById('nodeInfo').value;
        node.qrCode = document.getElementById('nodeQR').value;
        
        this.updateNodeSelects();
        this.closeNodeEditor();
        this.render();
        this.showNotification('Узел обновлен', 'success');
    }

    // Camera and zoom methods
    zoom(factor) {
        const centerX = this.canvasRect.width / 2;
        const centerY = this.canvasRect.height / 2;
        const pos = {
            x: (centerX - this.camera.x) / this.camera.scale,
            y: (centerY - this.camera.y) / this.camera.scale
        };
        this.zoomAt(pos, factor);
    }

    zoomAt(pos, factor) {
        const newScale = Math.max(0.1, Math.min(3, this.camera.scale * factor));
        
        this.camera.x -= (pos.x * (newScale - this.camera.scale));
        this.camera.y -= (pos.y * (newScale - this.camera.scale));
        this.camera.scale = newScale;
        
        this.render();
    }

    resetView() {
        this.camera = { x: 0, y: 0, scale: 1 };
        this.render();
    }

    // QR Scanner methods
    async startQRScanner() {
        try {
            const modal = document.getElementById('qrModal');
            modal.classList.add('show');
            
            this.qrScanner = new Html5Qrcode('qr-reader');
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                facingMode: 'environment'
            };
            
            await this.qrScanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText, decodedResult) => {
                    this.handleQRResult(decodedText);
                },
                (errorMessage) => {
                    // Handle scan failure, usually better to ignore
                }
            );
        } catch (err) {
            this.showNotification('Не удалось запустить камеру', 'error');
            console.error(err);
        }
    }

    async stopQRScanner() {
        if (this.qrScanner) {
            try {
                await this.qrScanner.stop();
                this.qrScanner = null;
            } catch (err) {
                console.error('Error stopping QR scanner:', err);
            }
        }
        document.getElementById('qrModal').classList.remove('show');
    }

    handleQRResult(qrText) {
        // Find node by QR code
        let foundNode = null;
        for (const [id, node] of this.nodes) {
            if (node.qrCode === qrText || id === qrText) {
                foundNode = { id, node };
                break;
            }
        }
        
        if (foundNode) {
            this.currentLocation = foundNode.id;
            document.getElementById('currentLocation').style.display = 'block';
            document.getElementById('locationText').textContent = foundNode.node.name;
            document.getElementById('startPoint').value = foundNode.id;
            this.showNotification(`Местоположение определено: ${foundNode.node.name}`, 'success');
        } else {
            this.showNotification('QR-код не распознан', 'warning');
        }
        
        this.stopQRScanner();
        this.render();
    }

    // Route building
    buildRoute() {
        const startId = document.getElementById('startPoint').value;
        const endId = document.getElementById('endPoint').value;
        
        if (!startId || !endId) {
            this.showNotification('Выберите начальную и конечную точку', 'warning');
            return;
        }
        
        if (startId === endId) {
            this.showNotification('Начальная и конечная точка не могут совпадать', 'warning');
            return;
        }
        
        const path = this.findPath(startId, endId);
        
        if (path.length > 0) {
            this.currentPath = path;
            this.generateVoiceInstructions(path);
            document.getElementById('voiceNavGroup').style.display = 'block';
            this.render();
            this.showNotification('Маршрут построен', 'success');
        } else {
            this.showNotification('Маршрут не найден', 'error');
        }
    }

    clearRoute() {
        this.currentPath = [];
        this.voiceInstructions = [];
        this.currentInstructionIndex = 0;
        document.getElementById('voiceNavGroup').style.display = 'none';
        this.render();
        this.showNotification('Маршрут очищен', 'info');
    }

    findPath(startId, endId) {
        // Simple BFS pathfinding
        const queue = [[startId]];
        const visited = new Set([startId]);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current === endId) {
                return path;
            }
            
            // Find connected nodes
            for (const conn of this.connections) {
                let next = null;
                if (conn.from === current && !visited.has(conn.to)) {
                    next = conn.to;
                } else if (conn.to === current && !visited.has(conn.from)) {
                    next = conn.from;
                }
                
                if (next) {
                    visited.add(next);
                    queue.push([...path, next]);
                }
            }
        }
        
        return [];
    }

    // Voice navigation
    generateVoiceInstructions(path) {
        this.voiceInstructions = [];
        
        for (let i = 0; i < path.length; i++) {
            const currentNode = this.nodes.get(path[i]);
            
            if (i === 0) {
                this.voiceInstructions.push(`Начинаем движение от ${currentNode.name}`);
            } else if (i === path.length - 1) {
                this.voiceInstructions.push(`Вы прибыли в ${currentNode.name}`);
            } else {
                const nextNode = this.nodes.get(path[i + 1]);
                let instruction = '';
                
                switch (currentNode.type) {
                    case 'door':
                        instruction = `Пройдите через ${currentNode.name}`;
                        break;
                    case 'stair':
                        instruction = `Используйте ${currentNode.name}`;
                        break;
                    default:
                        instruction = `Проследуйте через ${currentNode.name}`;
                }
                
                if (nextNode) {
                    instruction += ` в направлении ${nextNode.name}`;
                }
                
                this.voiceInstructions.push(instruction);
            }
        }
        
        this.currentInstructionIndex = 0;
        this.updateCurrentInstruction();
    }

    startVoiceNavigation() {
        if (this.voiceInstructions.length === 0) {
            this.showNotification('Сначала постройте маршрут', 'warning');
            return;
        }
        
        this.isVoiceNavigating = true;
        this.currentInstructionIndex = 0;
        document.getElementById('startVoiceNav').style.display = 'none';
        document.getElementById('stopVoiceNav').style.display = 'inline-flex';
        document.getElementById('voiceStepControls').style.display = 'flex';
        
        this.speakCurrentInstruction();
        this.showNotification('Голосовая навигация запущена', 'success');
    }

    stopVoiceNavigation() {
        this.isVoiceNavigating = false;
        window.speechSynthesis.cancel();
        document.getElementById('startVoiceNav').style.display = 'inline-flex';
        document.getElementById('stopVoiceNav').style.display = 'none';
        document.getElementById('voiceStepControls').style.display = 'none';
        this.showNotification('Голосовая навигация остановлена', 'info');
    }

    previousInstruction() {
        if (this.currentInstructionIndex > 0) {
            this.currentInstructionIndex--;
            this.updateCurrentInstruction();
            this.speakCurrentInstruction();
        }
    }

    nextInstruction() {
        if (this.currentInstructionIndex < this.voiceInstructions.length - 1) {
            this.currentInstructionIndex++;
            this.updateCurrentInstruction();
            this.speakCurrentInstruction();
        } else {
            this.stopVoiceNavigation();
            this.showNotification('Навигация завершена', 'success');
        }
    }

    updateCurrentInstruction() {
        const instructionEl = document.getElementById('currentInstruction');
        if (this.voiceInstructions.length > 0) {
            instructionEl.textContent = `${this.currentInstructionIndex + 1}/${this.voiceInstructions.length}: ${this.voiceInstructions[this.currentInstructionIndex]}`;
        } else {
            instructionEl.textContent = '';
        }
    }

    speakCurrentInstruction() {
        if (this.voiceInstructions.length > 0 && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(this.voiceInstructions[this.currentInstructionIndex]);
            utterance.lang = 'ru-RU';
            utterance.rate = 0.8;
            
            utterance.onend = () => {
                if (this.isVoiceNavigating && this.currentInstructionIndex < this.voiceInstructions.length - 1) {
                    setTimeout(() => {
                        if (this.isVoiceNavigating) {
                            this.nextInstruction();
                        }
                    }, 2000);
                } else if (this.currentInstructionIndex === this.voiceInstructions.length - 1) {
                    this.stopVoiceNavigation();
                }
            };
            
            window.speechSynthesis.speak(utterance);
        }
    }

    // Map management
    saveMap() {
        const mapData = {
            nodes: Array.from(this.nodes.entries()),
            connections: this.connections,
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(mapData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `school-map-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Карта сохранена', 'success');
    }

    loadMap(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const mapData = JSON.parse(event.target.result);
                
                this.nodes.clear();
                this.connections = [];
                
                if (mapData.nodes) {
                    mapData.nodes.forEach(([id, node]) => {
                        this.nodes.set(id, node);
                    });
                }
                
                if (mapData.connections) {
                    this.connections = mapData.connections;
                }
                
                this.updateNodeSelects();
                this.render();
                this.showNotification('Карта загружена', 'success');
            } catch (error) {
                this.showNotification('Ошибка загрузки карты', 'error');
                console.error(error);
            }
        };
        
        reader.readAsText(file);
    }

    clearAll() {
        if (confirm('Вы уверены, что хотите очистить всю карту?')) {
            this.nodes.clear();
            this.connections = [];
            this.currentPath = [];
            this.currentLocation = null;
            this.voiceInstructions = [];
            
            document.getElementById('currentLocation').style.display = 'none';
            document.getElementById('voiceNavGroup').style.display = 'none';
            
            this.updateNodeSelects();
            this.render();
            this.showNotification('Карта очищена', 'info');
        }
    }

    // Theme management
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.setAttribute('data-color-scheme', this.isDarkTheme ? 'dark' : 'light');
        
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.isDarkTheme ? '🌙' : '☀️';
        
        this.render();
    }

    // Mobile sidebar
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
    }

    // Notification system
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Rendering
    render() {
        this.ctx.clearRect(0, 0, this.canvasRect.width, this.canvasRect.height);
        
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.scale, this.camera.scale);
        
        // Draw connections
        this.drawConnections();
        
        // Draw current path
        this.drawPath();
        
        // Draw nodes
        this.drawNodes();
        
        // Draw current location indicator
        this.drawCurrentLocation();
        
        this.ctx.restore();
    }

    drawConnections() {
        this.ctx.strokeStyle = this.isDarkTheme ? '#4a5568' : '#a0aec0';
        this.ctx.lineWidth = 2;
        
        for (const conn of this.connections) {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            
            if (fromNode && toNode) {
                this.ctx.beginPath();
                this.ctx.moveTo(fromNode.x, fromNode.y);
                this.ctx.lineTo(toNode.x, toNode.y);
                this.ctx.stroke();
            }
        }
    }

    drawPath() {
        if (this.currentPath.length < 2) return;
        
        this.ctx.strokeStyle = '#e53e3e';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        
        this.ctx.beginPath();
        
        for (let i = 0; i < this.currentPath.length; i++) {
            const node = this.nodes.get(this.currentPath[i]);
            if (node) {
                if (i === 0) {
                    this.ctx.moveTo(node.x, node.y);
                } else {
                    this.ctx.lineTo(node.x, node.y);
                }
            }
        }
        
        this.ctx.stroke();
        
        // Highlight current instruction step
        if (this.isVoiceNavigating && this.currentInstructionIndex < this.currentPath.length) {
            const currentNode = this.nodes.get(this.currentPath[this.currentInstructionIndex]);
            if (currentNode) {
                this.ctx.strokeStyle = '#38a169';
                this.ctx.lineWidth = 6;
                this.ctx.beginPath();
                this.ctx.arc(currentNode.x, currentNode.y, 40, 0, 2 * Math.PI);
                this.ctx.stroke();
            }
        }
    }

    drawNodes() {
        for (const [id, node] of this.nodes) {
            const typeConfig = this.nodeTypes[node.type];
            const isSelected = this.connectingNodes.includes(id);
            
            this.ctx.fillStyle = isSelected ? '#ffd700' : typeConfig.color;
            this.ctx.strokeStyle = this.isDarkTheme ? '#2d3748' : '#1a202c';
            this.ctx.lineWidth = 2;
            
            const size = typeConfig.size;
            
            this.ctx.beginPath();
            
            switch (typeConfig.shape) {
                case 'rectangle':
                    this.ctx.fillRect(node.x - size/2, node.y - size/2, size, size);
                    this.ctx.strokeRect(node.x - size/2, node.y - size/2, size, size);
                    break;
                case 'circle':
                    this.ctx.arc(node.x, node.y, size/2, 0, 2 * Math.PI);
                    this.ctx.fill();
                    this.ctx.stroke();
                    break;
                case 'triangle':
                    this.ctx.moveTo(node.x, node.y - size/2);
                    this.ctx.lineTo(node.x - size/2, node.y + size/2);
                    this.ctx.lineTo(node.x + size/2, node.y + size/2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
                    break;
            }
            
            // Draw node label
            this.ctx.fillStyle = this.isDarkTheme ? '#f7fafc' : '#1a202c';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.name, node.x, node.y + size/2 + 15);
        }
    }

    drawCurrentLocation() {
        if (!this.currentLocation) return;
        
        const node = this.nodes.get(this.currentLocation);
        if (!node) return;
        
        // Draw pulsing location indicator
        const time = Date.now() / 1000;
        const pulse = (Math.sin(time * 3) + 1) / 2;
        const radius = 25 + pulse * 15;
        
        this.ctx.strokeStyle = '#3182ce';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.globalAlpha = 0.7;
        
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;
    }
}

// Initialize the application
const app = new SchoolMapApp();

// Animation loop for smooth animations
function animate() {
    app.render();
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
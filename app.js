class SchoolMapApp {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDarkTheme = false;
        this.floorToDelete = null;
        
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
            room: { color: '#0066B3', size: 60, shape: 'rectangle', name: 'Комната' },
            stair: { color: '#2ecc71', size: 50, shape: 'triangle', name: 'Лестница' },
            corridor: { color: '#9b59b6', width: 80, height: 40, shape: 'rectangle_long', name: 'Коридор' },
            exit: { color: '#e74c3c', size: 50, shape: 'pentagon', name: 'Выход' }
        };
        
        // Floor management
        this.currentFloor = 1;
        this.floors = new Map();
        this.maxFloors = 3;
        
        this.init();
        // Update delete buttons visibility on initialization
        setTimeout(() => this.updateFloorDeleteButtons(), 100);
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
        
        // Floor controls
        document.querySelectorAll('.floor-btn').forEach(btn => {
            if (!btn.classList.contains('add-floor')) {
                btn.addEventListener('click', (e) => {
                    const floor = parseInt(e.target.dataset.floor);
                    this.switchFloor(floor);
                });
            }
        });
        
        document.getElementById('addFloor').addEventListener('click', () => this.addFloor());
        
        // Floor delete buttons
        document.querySelectorAll('.floor-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const floor = parseInt(e.target.dataset.floor);
                this.showDeleteFloorConfirmation(floor);
            });
        });
        
        // Delete floor modal
        document.getElementById('closeDeleteFloorModal').addEventListener('click', () => this.closeDeleteFloorModal());
        document.getElementById('cancelDeleteFloor').addEventListener('click', () => this.closeDeleteFloorModal());
        document.getElementById('confirmDeleteFloor').addEventListener('click', () => this.confirmDeleteFloor());

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
        // Floor 1 nodes with corridors and exit
        const floor1Nodes = [
            { id: 'exit1', type: 'exit', name: 'Главный выход', info: 'Выход на ул. Угличская', floor: 1, x: 100, y: 200, qrCode: 'exit1' },
            { id: 'corridor1_1', type: 'corridor', name: 'Коридор главный', info: '1 этаж', floor: 1, x: 250, y: 200, qrCode: 'corridor1_1' },
            { id: 'room101', type: 'room', name: 'Кабинет 101', info: 'Математика', floor: 1, x: 400, y: 150, qrCode: 'room101' },
            { id: 'room102', type: 'room', name: 'Кабинет 102', info: 'Физика', floor: 1, x: 400, y: 250, qrCode: 'room102' },
            { id: 'stairs1_f1', type: 'stair', name: 'Лестница 1', info: 'На 2 этаж', floor: 1, connectsToFloor: 2, x: 550, y: 200, qrCode: 'stairs1_f1' }
        ];
        
        // Floor 2 nodes with corridors
        const floor2Nodes = [
            { id: 'corridor2_1', type: 'corridor', name: 'Коридор центральный', info: '2 этаж', floor: 2, x: 250, y: 200, qrCode: 'corridor2_1' },
            { id: 'room201', type: 'room', name: 'Кабинет 201', info: 'Русский язык', floor: 2, x: 400, y: 150, qrCode: 'room201' },
            { id: 'room202', type: 'room', name: 'Кабинет 202', info: 'Литература', floor: 2, x: 400, y: 250, qrCode: 'room202' },
            { id: 'stairs1_f2', type: 'stair', name: 'Лестница 1', info: 'На 1 и 3 этаж', floor: 2, connectsToFloors: [1, 3], x: 550, y: 200, qrCode: 'stairs1_f2' },
            { id: 'stairs2_f2', type: 'stair', name: 'Лестница 2', info: 'На 3 этаж', floor: 2, connectsToFloor: 3, x: 100, y: 200, qrCode: 'stairs2_f2' }
        ];
        
        // Floor 3 nodes with corridors
        const floor3Nodes = [
            { id: 'corridor3_1', type: 'corridor', name: 'Коридор верхний', info: '3 этаж', floor: 3, x: 250, y: 200, qrCode: 'corridor3_1' },
            { id: 'room301', type: 'room', name: 'Кабинет 301', info: 'Информатика', floor: 3, x: 400, y: 150, qrCode: 'room301' },
            { id: 'room302', type: 'room', name: 'Кабинет 302', info: 'Английский язык', floor: 3, x: 400, y: 250, qrCode: 'room302' },
            { id: 'stairs2_f3', type: 'stair', name: 'Лестница 2', info: 'На 2 этаж', floor: 3, connectsToFloor: 2, x: 100, y: 200, qrCode: 'stairs2_f3' }
        ];

        // Add all nodes
        [...floor1Nodes, ...floor2Nodes, ...floor3Nodes].forEach(node => {
            this.nodes.set(node.id, node);
        });

        // Add connections with new node layout
        this.connections = [
            // Floor 1 connections
            { from: 'exit1', to: 'corridor1_1' },
            { from: 'corridor1_1', to: 'room101' },
            { from: 'corridor1_1', to: 'room102' },
            { from: 'corridor1_1', to: 'stairs1_f1' },
            
            // Floor 2 connections
            { from: 'stairs1_f2', to: 'corridor2_1' },
            { from: 'stairs2_f2', to: 'corridor2_1' },
            { from: 'corridor2_1', to: 'room201' },
            { from: 'corridor2_1', to: 'room202' },
            
            // Floor 3 connections
            { from: 'stairs2_f3', to: 'corridor3_1' },
            { from: 'corridor3_1', to: 'room301' },
            { from: 'corridor3_1', to: 'room302' },
            
            // Between floors connections
            { from: 'stairs1_f1', to: 'stairs1_f2' },
            { from: 'stairs2_f2', to: 'stairs2_f3' }
        ];

        this.updateNodeSelects();
    }

    updateNodeSelects() {
        const startSelect = document.getElementById('startPoint');
        const endSelect = document.getElementById('endPoint');
        
        startSelect.innerHTML = '<option value="">Выберите начальную точку</option>';
        endSelect.innerHTML = '<option value="">Выберите конечную точку</option>';
        
        // Group nodes by floor for better organization
        const nodesByFloor = {};
        this.nodes.forEach((node, id) => {
            if (!nodesByFloor[node.floor]) {
                nodesByFloor[node.floor] = [];
            }
            nodesByFloor[node.floor].push({ id, node });
        });
        
        // Add options grouped by floor
        Object.keys(nodesByFloor).sort((a, b) => a - b).forEach(floor => {
            const floorGroup1 = document.createElement('optgroup');
            const floorGroup2 = document.createElement('optgroup');
            floorGroup1.label = `Этаж ${floor}`;
            floorGroup2.label = `Этаж ${floor}`;
            
            nodesByFloor[floor].forEach(({ id, node }) => {
                const option1 = new Option(node.name, id);
                const option2 = new Option(node.name, id);
                floorGroup1.appendChild(option1);
                floorGroup2.appendChild(option2);
            });
            
            startSelect.appendChild(floorGroup1);
            endSelect.appendChild(floorGroup2);
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
            const typeConfig = this.nodeTypes[node.type];
            let isInside = false;
            
            if (typeConfig.shape === 'rectangle_long') {
                // Corridor - rectangular shape
                const halfWidth = typeConfig.width / 2;
                const halfHeight = typeConfig.height / 2;
                isInside = pos.x >= node.x - halfWidth && pos.x <= node.x + halfWidth &&
                          pos.y >= node.y - halfHeight && pos.y <= node.y + halfHeight;
            } else {
                // Other nodes - circular hit detection
                const distance = Math.sqrt((pos.x - node.x) ** 2 + (pos.y - node.y) ** 2);
                const nodeSize = typeConfig.size || 50;
                isInside = distance <= nodeSize / 2;
            }
            
            if (isInside) {
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
        
        // Count nodes of this type on current floor for naming
        const nodesOnFloor = this.getNodesOnFloor(this.currentFloor);
        const sameTypeCount = Array.from(nodesOnFloor.values()).filter(n => n.type === this.nodeType).length;
        
        const node = {
            id,
            type: this.nodeType,
            name: `${typeConfig.name} ${this.currentFloor}${String(sameTypeCount + 1).padStart(2, '0')}`,
            info: '',
            floor: this.currentFloor,
            x: pos.x,
            y: pos.y,
            qrCode: id
        };
        
        // If it's a stair, ask which floor it connects to
        if (this.nodeType === 'stair') {
            this.promptStairConnection(node);
        } else {
            this.nodes.set(id, node);
            this.updateNodeSelects();
            this.render();
            const typeName = this.nodeTypes[this.nodeType].name;
            this.showNotification(`Добавлен ${typeName.toLowerCase()}: ${node.name} (этаж ${this.currentFloor})`, 'success');
        }
    }
    
    promptStairConnection(stairNode) {
        const availableFloors = [];
        for (let i = 1; i <= this.maxFloors; i++) {
            if (i !== this.currentFloor) {
                availableFloors.push(i);
            }
        }
        
        if (availableFloors.length === 0) {
            this.showNotification('Нет доступных этажей для соединения', 'warning');
            return;
        }
        
        let connectsTo;
        if (availableFloors.length === 1) {
            connectsTo = availableFloors[0];
        } else {
            const floorList = availableFloors.join(', ');
            const input = prompt(`Лестница на ${this.currentFloor} этаже. На какой этаж она ведет? (Доступны: ${floorList})`);
            connectsTo = parseInt(input);
            
            if (!availableFloors.includes(connectsTo)) {
                this.showNotification('Неверный этаж', 'error');
                return;
            }
        }
        
        stairNode.connectsToFloor = connectsTo;
        stairNode.info = `На ${connectsTo} этаж`;
        
        this.nodes.set(stairNode.id, stairNode);
        this.updateNodeSelects();
        this.render();
        this.showNotification(`Добавлена лестница: с ${this.currentFloor} на ${connectsTo} этаж`, 'success');
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
        let currentFloorInPath = null;
        
        for (let i = 0; i < path.length; i++) {
            const currentNode = this.nodes.get(path[i]);
            const nextNode = i < path.length - 1 ? this.nodes.get(path[i + 1]) : null;
            
            if (i === 0) {
                currentFloorInPath = currentNode.floor;
                this.voiceInstructions.push({
                    text: `Начинаем движение от ${currentNode.name}. Вы находитесь на ${currentNode.floor} этаже`,
                    floor: currentNode.floor,
                    nodeId: currentNode.id
                });
            } else if (i === path.length - 1) {
                this.voiceInstructions.push({
                    text: `Вы прибыли в ${currentNode.name}`,
                    floor: currentNode.floor,
                    nodeId: currentNode.id
                });
            } else {
                let instruction = '';
                
                // Handle floor transitions
                if (currentNode.type === 'stair' && nextNode && currentNode.floor !== nextNode.floor) {
                    const direction = nextNode.floor > currentNode.floor ? 'Поднимитесь' : 'Спуститесь';
                    instruction = `${direction} по лестнице на ${nextNode.floor} этаж`;
                    currentFloorInPath = nextNode.floor;
                } else {
                    switch (currentNode.type) {
                        case 'stair':
                            if (nextNode) {
                                instruction = `От лестницы направляйтесь к ${nextNode.name}`;
                            } else {
                                instruction = `Используйте ${currentNode.name}`;
                            }
                            break;
                        default:
                            if (nextNode) {
                                instruction = `От ${currentNode.name} направляйтесь к ${nextNode.name}`;
                            } else {
                                instruction = `Проследуйте через ${currentNode.name}`;
                            }
                    }
                }
                
                this.voiceInstructions.push({
                    text: instruction,
                    floor: currentFloorInPath,
                    nodeId: currentNode.id,
                    switchToFloor: currentNode.type === 'stair' && nextNode && currentNode.floor !== nextNode.floor ? nextNode.floor : null
                });
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
    
    // Floor management methods
    switchFloor(floorNumber) {
        this.currentFloor = floorNumber;
        
        // Update floor buttons
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.floor) === floorNumber) {
                btn.classList.add('active');
            }
        });
        
        // Update current floor indicator
        document.getElementById('currentFloorText').textContent = `Этаж ${floorNumber}`;
        
        // Clear current selection and connections
        this.selectedNode = null;
        this.connectingNodes = [];
        
        // Update node selects to show only current floor nodes
        this.updateNodeSelects();
        
        this.render();
        this.showNotification(`Переключились на этаж ${floorNumber}`, 'info');
    }
    
    addFloor() {
        if (this.maxFloors >= 10) {
            this.showNotification('Максимальное количество этажей: 10', 'warning');
            return;
        }
        
        this.maxFloors++;
        const floorNumber = this.maxFloors;
        
        // Add new floor button with delete button
        const addBtn = document.getElementById('addFloor');
        const floorContainer = document.createElement('div');
        floorContainer.className = 'floor-with-delete';
        
        const newFloorBtn = document.createElement('button');
        newFloorBtn.className = 'floor-btn';
        newFloorBtn.dataset.floor = floorNumber;
        newFloorBtn.textContent = `Этаж ${floorNumber}`;
        newFloorBtn.addEventListener('click', () => this.switchFloor(floorNumber));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'floor-delete-btn';
        deleteBtn.dataset.floor = floorNumber;
        deleteBtn.title = 'Удалить этаж';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteFloorConfirmation(floorNumber);
        });
        
        floorContainer.appendChild(newFloorBtn);
        floorContainer.appendChild(deleteBtn);
        addBtn.parentNode.insertBefore(floorContainer, addBtn);
        
        this.updateFloorDeleteButtons();
        this.showNotification(`Добавлен этаж ${floorNumber}`, 'success');
    }
    
    showDeleteFloorConfirmation(floorNumber) {
        this.floorToDelete = floorNumber;
        const modal = document.getElementById('deleteFloorModal');
        const text = document.getElementById('deleteFloorText');
        text.textContent = `Вы уверены, что хотите удалить Этаж ${floorNumber}? Все узлы и связи на этом этаже будут удалены.`;
        modal.classList.add('show');
    }
    
    closeDeleteFloorModal() {
        document.getElementById('deleteFloorModal').classList.remove('show');
        this.floorToDelete = null;
    }
    
    confirmDeleteFloor() {
        if (!this.floorToDelete) return;
        
        const floorNumber = this.floorToDelete;
        
        // Count total floors
        const totalFloors = document.querySelectorAll('.floor-btn:not(.add-floor)').length;
        if (totalFloors <= 1) {
            this.showNotification('Нельзя удалить последний этаж', 'warning');
            this.closeDeleteFloorModal();
            return;
        }
        
        // Remove nodes on this floor
        const nodesToDelete = [];
        for (const [id, node] of this.nodes) {
            if (node.floor === floorNumber) {
                nodesToDelete.push(id);
            }
        }
        
        // Delete nodes and connections
        nodesToDelete.forEach(nodeId => {
            this.nodes.delete(nodeId);
            this.connections = this.connections.filter(conn => 
                conn.from !== nodeId && conn.to !== nodeId
            );
        });
        
        // Remove floor button
        const floorContainer = document.querySelector(`[data-floor="${floorNumber}"]`).closest('.floor-with-delete');
        if (floorContainer) {
            floorContainer.remove();
        }
        
        // Switch to first available floor if current floor was deleted
        if (this.currentFloor === floorNumber) {
            const firstFloorBtn = document.querySelector('.floor-btn:not(.add-floor)');
            if (firstFloorBtn) {
                const firstFloor = parseInt(firstFloorBtn.dataset.floor);
                this.switchFloor(firstFloor);
            }
        }
        
        this.updateNodeSelects();
        this.updateFloorDeleteButtons();
        this.render();
        this.closeDeleteFloorModal();
        this.showNotification(`Этаж ${floorNumber} удалён`, 'success');
    }
    
    updateFloorDeleteButtons() {
        const floorButtons = document.querySelectorAll('.floor-btn:not(.add-floor)');
        const deleteButtons = document.querySelectorAll('.floor-delete-btn');
        
        // Hide all delete buttons if only one floor remains
        if (floorButtons.length <= 1) {
            deleteButtons.forEach(btn => btn.style.display = 'none');
        } else {
            deleteButtons.forEach(btn => btn.style.display = 'flex');
        }
    }
    
    getNodesOnFloor(floorNumber) {
        const nodesOnFloor = new Map();
        for (const [id, node] of this.nodes) {
            if (node.floor === floorNumber || 
                (node.type === 'stair' && this.isStairOnFloor(node, floorNumber))) {
                nodesOnFloor.set(id, node);
            }
        }
        return nodesOnFloor;
    }
    
    isStairOnFloor(stairNode, floorNumber) {
        if (stairNode.floor === floorNumber) return true;
        if (stairNode.connectsToFloor === floorNumber) return true;
        if (stairNode.connectsToFloors && stairNode.connectsToFloors.includes(floorNumber)) return true;
        return false;
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
        
        const nodesOnCurrentFloor = this.getNodesOnFloor(this.currentFloor);
        
        for (const conn of this.connections) {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            
            // Only draw connections if both nodes are visible on current floor
            if (fromNode && toNode && 
                nodesOnCurrentFloor.has(conn.from) && 
                nodesOnCurrentFloor.has(conn.to)) {
                
                // Different style for inter-floor connections
                if (fromNode.floor !== toNode.floor) {
                    this.ctx.strokeStyle = this.isDarkTheme ? '#9f7aea' : '#805ad5';
                    this.ctx.setLineDash([5, 5]);
                } else {
                    this.ctx.strokeStyle = this.isDarkTheme ? '#4a5568' : '#a0aec0';
                    this.ctx.setLineDash([]);
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(fromNode.x, fromNode.y);
                this.ctx.lineTo(toNode.x, toNode.y);
                this.ctx.stroke();
            }
        }
        
        this.ctx.setLineDash([]);
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
        const nodesOnCurrentFloor = this.getNodesOnFloor(this.currentFloor);
        
        for (const [id, node] of nodesOnCurrentFloor) {
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
                case 'rectangle_long':
                    // Corridor - long rectangle
                    const halfWidth = typeConfig.width / 2;
                    const halfHeight = typeConfig.height / 2;
                    this.ctx.fillRect(node.x - halfWidth, node.y - halfHeight, typeConfig.width, typeConfig.height);
                    this.ctx.strokeRect(node.x - halfWidth, node.y - halfHeight, typeConfig.width, typeConfig.height);
                    break;
                case 'pentagon':
                    // Exit - pentagon (house shape)
                    const radius = size / 2;
                    this.ctx.moveTo(node.x, node.y - radius);
                    this.ctx.lineTo(node.x + radius * 0.6, node.y - radius * 0.2);
                    this.ctx.lineTo(node.x + radius * 0.4, node.y + radius);
                    this.ctx.lineTo(node.x - radius * 0.4, node.y + radius);
                    this.ctx.lineTo(node.x - radius * 0.6, node.y - radius * 0.2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
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
            
            // Draw floor indicator for stairs
            if (node.type === 'stair' && node.connectsToFloor) {
                this.ctx.fillStyle = this.isDarkTheme ? '#f7fafc' : '#1a202c';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`→${node.connectsToFloor}`, node.x, node.y - size/2 - 8);
            }
            
            // Draw node label
            this.ctx.fillStyle = this.isDarkTheme ? '#f7fafc' : '#1a202c';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.name, node.x, node.y + size/2 + 15);
            
            // Draw floor number for non-current floor stairs
            if (node.type === 'stair' && node.floor !== this.currentFloor) {
                this.ctx.fillStyle = this.isDarkTheme ? '#90cdf4' : '#3182ce';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(`(Этаж ${node.floor})`, node.x, node.y + size/2 + 28);
            }
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
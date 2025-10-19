class SchoolNavigationApp {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.currentFloor = 1;
    this.currentMode = 'view';
    this.currentNodeType = 'room';
    this.isAuthenticated = false;
    this.currentTheme = 'light';
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.selectedNode = null;
    this.connectingFromNode = null;
    this.currentRoute = [];
    this.currentRouteIndex = 0;
    this.isNavigating = false;
    this.currentLocation = null;
    this.speechSynthesis = null;
    this.currentVoice = null;
    this.qrStream = null;
    this.floors = [1, 2, 3];
    
    // Voice settings
    this.voiceSettings = {
      rate: 0.9,
      pitch: 1.0,
      volume: 1.0,
      showSubtitles: true
    };
    
    // QR Scanner settings
    this.qrRetryCount = 0;
    this.maxQrRetries = 3;
    this.html5QrcodeScanner = null;
    
    // Default school data
    this.nodes = new Map();
    this.connections = [];
    
    // Initialize the application
    this.init();
  }

  init() {
    this.setupCanvas();
    this.setupEventListeners();
    this.setupVoiceSynthesis();
    this.loadDefaultData();
    this.updateFloorSelectors();
    this.render();
    this.checkTheme();
    this.showNotification('Добро пожаловать в систему навигации Школы №1430!', 'info');
  }

  setupCanvas() {
    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set up high DPI canvas
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Handle resize
    window.addEventListener('resize', () => {
      setTimeout(() => this.setupCanvas(), 100);
    });
  }

  setupEventListeners() {
    // Floor buttons
    document.querySelectorAll('.floor-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const floor = parseInt(e.target.dataset.floor);
        this.switchFloor(floor);
      });
    });

    // Add floor button
    document.querySelector('.add-floor-btn').addEventListener('click', () => {
      this.authenticateAction(() => this.addFloor());
    });

    // Theme toggle
    document.querySelector('.theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Menu toggle (mobile)
    document.querySelector('.menu-toggle').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.setMode(mode);
      });
    });

    // Node type buttons
    document.querySelectorAll('.node-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        this.setNodeType(type);
      });
    });

    // Zoom controls
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleZoom(action);
      });
    });

    // QR Scanner
    document.querySelector('.qr-scanner-btn').addEventListener('click', () => {
      this.openQRScanner();
    });

    // Route planning
    document.getElementById('buildRoute').addEventListener('click', () => {
      this.buildRoute();
    });

    document.getElementById('clearRoute').addEventListener('click', () => {
      this.clearRoute();
    });

    // Voice navigation
    document.getElementById('startNavigation').addEventListener('click', () => {
      this.startNavigation();
    });

    document.getElementById('stopNavigation').addEventListener('click', () => {
      this.stopNavigation();
    });

    document.getElementById('prevInstruction').addEventListener('click', () => {
      this.previousInstruction();
    });

    document.getElementById('nextInstruction').addEventListener('click', () => {
      this.nextInstruction();
    });

    document.getElementById('repeatInstruction').addEventListener('click', () => {
      this.repeatInstruction();
    });

    // Map management
    document.getElementById('saveMap').addEventListener('click', () => {
      this.authenticateAction(() => this.saveMap());
    });

    document.getElementById('loadMap').addEventListener('click', () => {
      this.authenticateAction(() => document.getElementById('loadMapFile').click());
    });

    document.getElementById('loadMapFile').addEventListener('change', (e) => {
      this.loadMap(e.target.files[0]);
    });

    document.getElementById('clearAll').addEventListener('click', () => {
      this.authenticateAction(() => this.confirmAction('Очистить всю карту?', () => this.clearAll()));
    });

    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleCanvasTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleCanvasTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleCanvasTouchEnd(e));

    // Modal events
    this.setupModalEvents();
  }

  setupModalEvents() {
    // Close modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        this.closeModal(modal);
      });
    });

    // Modal backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // Password modal
    document.getElementById('submitPassword').addEventListener('click', () => {
      this.checkPassword();
    });

    document.getElementById('cancelPassword').addEventListener('click', () => {
      this.closeModal(document.getElementById('passwordModal'));
    });

    document.getElementById('passwordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.checkPassword();
      }
    });

    // Edit modal
    document.getElementById('saveEdit').addEventListener('click', () => {
      this.saveNodeEdit();
    });

    document.getElementById('cancelEdit').addEventListener('click', () => {
      this.closeModal(document.getElementById('editModal'));
    });

    // Confirmation modal
    document.getElementById('confirmAction').addEventListener('click', () => {
      if (this.confirmCallback) {
        this.confirmCallback();
        this.confirmCallback = null;
      }
      this.closeModal(document.getElementById('confirmModal'));
    });

    document.getElementById('cancelConfirm').addEventListener('click', () => {
      this.confirmCallback = null;
      this.closeModal(document.getElementById('confirmModal'));
    });

    // QR modal
    document.getElementById('stopQrScan').addEventListener('click', () => {
      this.stopQRScanner();
    });
    
    document.getElementById('retryQrScan').addEventListener('click', () => {
      this.retryQRScanner();
    });
    
    // Voice settings controls
    document.getElementById('voiceSelect').addEventListener('change', (e) => {
      this.selectVoice(e.target.value);
    });
    
    document.getElementById('rateSlider').addEventListener('input', (e) => {
      this.setVoiceRate(parseFloat(e.target.value));
    });
    
    document.getElementById('pitchSlider').addEventListener('input', (e) => {
      this.setVoicePitch(parseFloat(e.target.value));
    });
    
    document.getElementById('subtitleToggle').addEventListener('click', () => {
      this.toggleSubtitles();
    });
  }

  setupVoiceSynthesis() {
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
      
      // Wait for voices to load
      const loadVoices = () => {
        const voices = this.speechSynthesis.getVoices();
        this.currentVoice = voices.find(voice => 
          voice.lang.includes('ru') || voice.name.includes('Russian')
        ) || voices[0];
        
        // Populate voice selector
        this.populateVoiceSelector(voices);
      };
      
      if (this.speechSynthesis.getVoices().length === 0) {
        this.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      } else {
        loadVoices();
      }
    }
  }

  populateVoiceSelector(voices) {
    const voiceSelect = document.getElementById('voiceSelect');
    voiceSelect.innerHTML = '<option value="">Системный по умолчанию</option>';
    
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      if (voice === this.currentVoice) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  }

  loadDefaultData() {
    // Clear existing data
    this.nodes.clear();
    this.connections = [];

    // Floor 1 nodes
    const floor1Nodes = [
      { id: 'exit1', type: 'exit', name: 'Главный выход', info: 'Выход на ул. Угличская', floor: 1, x: 100, y: 200, qrCode: 'exit1' },
      { id: 'corridor1_1', type: 'corridor', name: 'Коридор главный', info: '1 этаж', floor: 1, x: 250, y: 200, qrCode: 'corridor1_1' },
      { id: 'room101', type: 'room', name: 'Кабинет 101', info: 'Математика', floor: 1, x: 400, y: 150, qrCode: 'room101' },
      { id: 'room102', type: 'room', name: 'Кабинет 102', info: 'Физика', floor: 1, x: 400, y: 250, qrCode: 'room102' },
      { id: 'stairs1_f1', type: 'stair', name: 'Лестница 1', info: 'На 2 этаж', floor: 1, connectsToFloor: 2, x: 550, y: 200, qrCode: 'stairs1_f1' }
    ];

    // Floor 2 nodes
    const floor2Nodes = [
      { id: 'corridor2_1', type: 'corridor', name: 'Коридор центральный', info: '2 этаж', floor: 2, x: 250, y: 200, qrCode: 'corridor2_1' },
      { id: 'room201', type: 'room', name: 'Кабинет 201', info: 'Русский язык', floor: 2, x: 400, y: 150, qrCode: 'room201' },
      { id: 'room202', type: 'room', name: 'Кабинет 202', info: 'Литература', floor: 2, x: 400, y: 250, qrCode: 'room202' },
      { id: 'stairs1_f2', type: 'stair', name: 'Лестница 1', info: 'На 1 и 3 этаж', floor: 2, connectsToFloors: [1, 3], x: 550, y: 200, qrCode: 'stairs1_f2' },
      { id: 'stairs2_f2', type: 'stair', name: 'Лестница 2', info: 'На 3 этаж', floor: 2, connectsToFloor: 3, x: 100, y: 200, qrCode: 'stairs2_f2' }
    ];

    // Floor 3 nodes
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

    // Default connections
    this.connections = [
      { from: 'exit1', to: 'corridor1_1' },
      { from: 'corridor1_1', to: 'room101' },
      { from: 'corridor1_1', to: 'room102' },
      { from: 'corridor1_1', to: 'stairs1_f1' },
      { from: 'stairs1_f2', to: 'corridor2_1' },
      { from: 'stairs2_f2', to: 'corridor2_1' },
      { from: 'corridor2_1', to: 'room201' },
      { from: 'corridor2_1', to: 'room202' },
      { from: 'stairs2_f3', to: 'corridor3_1' },
      { from: 'corridor3_1', to: 'room301' },
      { from: 'corridor3_1', to: 'room302' },
      { from: 'stairs1_f1', to: 'stairs1_f2' },
      { from: 'stairs2_f2', to: 'stairs2_f3' }
    ];

    this.updateRouteSelectors();
  }

  getCanvasCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.scale;
    const y = (clientY - rect.top - this.panY) / this.scale;
    return { x, y };
  }

  getNodeAt(x, y) {
    for (const [id, node] of this.nodes) {
      if (node.floor !== this.currentFloor) continue;
      
      const distance = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      const size = this.getNodeSize(node);
      
      if (distance <= size / 2) {
        return node;
      }
    }
    return null;
  }

  getNodeSize(node) {
    switch (node.type) {
      case 'room': return 60;
      case 'stair': return 50;
      case 'corridor': return Math.max(80, 40);
      case 'exit': return 50;
      default: return 40;
    }
  }

  getNodeColor(node) {
    switch (node.type) {
      case 'room': return '#0066B3';
      case 'stair': return '#2ecc71';
      case 'corridor': return '#9b59b6';
      case 'exit': return '#e74c3c';
      default: return '#666';
    }
  }

  handleCanvasMouseDown(e) {
    const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
    const clickedNode = this.getNodeAt(coords.x, coords.y);

    if (this.currentMode === 'view' || this.currentMode === 'pan') {
      if (clickedNode) {
        this.selectedNode = clickedNode;
        this.isDragging = false;
      } else {
        this.selectedNode = null;
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      }
    } else if (this.currentMode === 'add') {
      if (!clickedNode) {
        this.addNode(coords.x, coords.y);
      }
    } else if (this.currentMode === 'edit') {
      if (clickedNode) {
        this.editNode(clickedNode);
      }
    } else if (this.currentMode === 'connect') {
      if (clickedNode) {
        if (!this.connectingFromNode) {
          this.connectingFromNode = clickedNode;
          this.showNotification(`Выберите узел для соединения с "${clickedNode.name}"`, 'info');
        } else {
          this.connectNodes(this.connectingFromNode, clickedNode);
          this.connectingFromNode = null;
        }
      }
    } else if (this.currentMode === 'delete') {
      if (clickedNode) {
        this.confirmAction(`Удалить "${clickedNode.name}"?`, () => this.deleteNode(clickedNode));
      }
    } else if (this.currentMode === 'move') {
      if (clickedNode) {
        this.selectedNode = clickedNode;
        this.isDragging = false;
      }
    }
  }

  handleCanvasMouseMove(e) {
    if (this.isDragging && (this.currentMode === 'view' || this.currentMode === 'pan')) {
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
    } else if (this.selectedNode && this.currentMode === 'move') {
      const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
      this.selectedNode.x = coords.x;
      this.selectedNode.y = coords.y;
    }
  }

  handleCanvasMouseUp(e) {
    this.isDragging = false;
    if (this.currentMode === 'move') {
      this.selectedNode = null;
    }
  }

  handleCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    this.zoomAt(mouseX, mouseY, delta);
  }

  handleCanvasTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.handleCanvasMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }

  handleCanvasTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.handleCanvasMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }

  handleCanvasTouchEnd(e) {
    e.preventDefault();
    this.handleCanvasMouseUp(e);
  }

  zoomAt(x, y, factor) {
    const oldScale = this.scale;
    this.scale = Math.max(0.1, Math.min(3, this.scale * factor));
    
    if (this.scale !== oldScale) {
      this.panX = x - (x - this.panX) * (this.scale / oldScale);
      this.panY = y - (y - this.panY) * (this.scale / oldScale);
      this.updateZoomDisplay();
    }
  }

  handleZoom(action) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    switch (action) {
      case 'zoomIn':
        this.zoomAt(centerX, centerY, 1.2);
        break;
      case 'zoomOut':
        this.zoomAt(centerX, centerY, 0.8);
        break;
      case 'resetView':
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateZoomDisplay();
        break;
    }
  }

  updateZoomDisplay() {
    document.getElementById('zoomLevel').textContent = Math.round(this.scale * 100) + '%';
  }

  switchFloor(floor) {
    this.currentFloor = floor;
    
    // Update UI
    document.querySelectorAll('.floor-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.floor) === floor);
    });
    
    document.getElementById('currentFloor').textContent = `Этаж ${floor}`;
    
    // Clear selections
    this.selectedNode = null;
    this.connectingFromNode = null;
    
    this.updateRouteSelectors();
  }

  setMode(mode) {
    // Check authentication for protected modes
    const protectedModes = ['add', 'edit', 'connect', 'delete', 'move'];
    if (protectedModes.includes(mode) && !this.isAuthenticated) {
      this.authenticateAction(() => this.setMode(mode));
      return;
    }

    this.currentMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Show/hide node type selector
    const nodeTypeGroup = document.querySelector('.node-type-group');
    nodeTypeGroup.style.display = mode === 'add' ? 'block' : 'none';
    
    // Clear selections
    this.selectedNode = null;
    this.connectingFromNode = null;
    
    // Update cursor
    this.canvas.style.cursor = mode === 'pan' ? 'grab' : mode === 'add' ? 'crosshair' : 'default';
  }

  setNodeType(type) {
    this.currentNodeType = type;
    
    document.querySelectorAll('.node-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  }

  addNode(x, y) {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const node = {
      id,
      type: this.currentNodeType,
      name: this.getDefaultNodeName(this.currentNodeType),
      info: '',
      floor: this.currentFloor,
      x,
      y,
      qrCode: id
    };
    
    if (this.currentNodeType === 'stair') {
      node.connectsToFloor = this.currentFloor === 1 ? 2 : this.currentFloor - 1;
    }
    
    this.nodes.set(id, node);
    this.updateRouteSelectors();
    this.showNotification('Объект добавлен', 'success');
  }

  getDefaultNodeName(type) {
    const counts = { room: 0, stair: 0, corridor: 0, exit: 0 };
    
    for (const [id, node] of this.nodes) {
      if (node.floor === this.currentFloor && node.type === type) {
        counts[type]++;
      }
    }
    
    switch (type) {
      case 'room': return `Кабинет ${this.currentFloor}${String(counts.room + 1).padStart(2, '0')}`;
      case 'stair': return `Лестница ${counts.stair + 1}`;
      case 'corridor': return `Коридор ${counts.corridor + 1}`;
      case 'exit': return `Выход ${counts.exit + 1}`;
      default: return 'Новый объект';
    }
  }

  editNode(node) {
    this.selectedNode = node;
    
    // Fill form
    document.getElementById('editName').value = node.name || '';
    document.getElementById('editInfo').value = node.info || '';
    document.getElementById('editQrCode').value = node.qrCode || '';
    
    // Show/hide floor connection for stairs
    const floorGroup = document.getElementById('connectsToFloorGroup');
    const floorSelect = document.getElementById('connectsToFloor');
    
    if (node.type === 'stair') {
      floorGroup.style.display = 'block';
      
      // Populate floor options
      floorSelect.innerHTML = '<option value="">Не выбрано</option>';
      this.floors.forEach(floor => {
        if (floor !== node.floor) {
          const option = document.createElement('option');
          option.value = floor;
          option.textContent = `Этаж ${floor}`;
          if (node.connectsToFloor === floor || (node.connectsToFloors && node.connectsToFloors.includes(floor))) {
            option.selected = true;
          }
          floorSelect.appendChild(option);
        }
      });
    } else {
      floorGroup.style.display = 'none';
    }
    
    this.openModal(document.getElementById('editModal'));
  }

  saveNodeEdit() {
    if (!this.selectedNode) return;
    
    const name = document.getElementById('editName').value.trim();
    const info = document.getElementById('editInfo').value.trim();
    const qrCode = document.getElementById('editQrCode').value.trim();
    
    if (!name) {
      this.showNotification('Название не может быть пустым', 'error');
      return;
    }
    
    // Check for duplicate QR codes
    if (qrCode) {
      for (const [id, node] of this.nodes) {
        if (id !== this.selectedNode.id && node.qrCode === qrCode) {
          this.showNotification('QR-код уже используется', 'error');
          return;
        }
      }
    }
    
    this.selectedNode.name = name;
    this.selectedNode.info = info;
    this.selectedNode.qrCode = qrCode || this.selectedNode.id;
    
    if (this.selectedNode.type === 'stair') {
      const connectsToFloor = parseInt(document.getElementById('connectsToFloor').value);
      if (connectsToFloor) {
        this.selectedNode.connectsToFloor = connectsToFloor;
      }
    }
    
    this.updateRouteSelectors();
    this.closeModal(document.getElementById('editModal'));
    this.showNotification('Объект обновлен', 'success');
  }

  connectNodes(node1, node2) {
    if (node1.id === node2.id) {
      this.showNotification('Нельзя соединить узел с самим собой', 'error');
      return;
    }
    
    // Check if connection already exists
    const connectionExists = this.connections.some(conn => 
      (conn.from === node1.id && conn.to === node2.id) ||
      (conn.from === node2.id && conn.to === node1.id)
    );
    
    if (connectionExists) {
      this.showNotification('Соединение уже существует', 'warning');
      return;
    }
    
    this.connections.push({ from: node1.id, to: node2.id });
    this.showNotification(`Соединены "${node1.name}" и "${node2.name}"`, 'success');
  }

  deleteNode(node) {
    // Remove node
    this.nodes.delete(node.id);
    
    // Remove all connections to this node
    this.connections = this.connections.filter(conn => 
      conn.from !== node.id && conn.to !== node.id
    );
    
    this.updateRouteSelectors();
    this.showNotification('Объект удален', 'success');
  }

  addFloor() {
    const maxFloor = Math.max(...this.floors);
    const newFloor = maxFloor + 1;
    
    this.floors.push(newFloor);
    this.updateFloorSelectors();
    this.showNotification(`Добавлен ${newFloor} этаж`, 'success');
  }

  updateFloorSelectors() {
    const container = document.querySelector('.floor-controls');
    const addBtn = container.querySelector('.add-floor-btn');
    
    // Remove existing floor buttons
    container.querySelectorAll('.floor-btn').forEach(btn => btn.remove());
    
    // Add new floor buttons
    this.floors.forEach(floor => {
      const btn = document.createElement('button');
      btn.className = `floor-btn ${floor === this.currentFloor ? 'active' : ''}`;
      btn.dataset.floor = floor;
      btn.textContent = `Этаж ${floor}`;
      btn.addEventListener('click', (e) => {
        const floor = parseInt(e.target.dataset.floor);
        this.switchFloor(floor);
      });
      container.insertBefore(btn, addBtn);
    });
  }

  updateRouteSelectors() {
    const startSelect = document.getElementById('startPoint');
    const endSelect = document.getElementById('endPoint');
    
    // Store current selections
    const currentStart = startSelect.value;
    const currentEnd = endSelect.value;
    
    // Clear options
    startSelect.innerHTML = '<option value="">Выберите начальную точку</option>';
    endSelect.innerHTML = '<option value="">Выберите конечную точку</option>';
    
    // Add nodes as options
    for (const [id, node] of this.nodes) {
      const option1 = document.createElement('option');
      option1.value = id;
      option1.textContent = `${node.name} (Этаж ${node.floor})`;
      if (id === currentStart) option1.selected = true;
      startSelect.appendChild(option1);
      
      const option2 = document.createElement('option');
      option2.value = id;
      option2.textContent = `${node.name} (Этаж ${node.floor})`;
      if (id === currentEnd) option2.selected = true;
      endSelect.appendChild(option2);
    }
  }

  buildRoute() {
    const startId = document.getElementById('startPoint').value;
    const endId = document.getElementById('endPoint').value;
    
    if (!startId || !endId) {
      this.showNotification('Выберите начальную и конечную точки', 'warning');
      return;
    }
    
    if (startId === endId) {
      this.showNotification('Начальная и конечная точки не могут совпадать', 'error');
      return;
    }
    
    const route = this.findRoute(startId, endId);
    if (route.length > 0) {
      this.currentRoute = route;
      this.currentRouteIndex = 0;
      this.showNotification(`Маршрут построен (${route.length} точек)`, 'success');
    } else {
      this.showNotification('Маршрут не найден', 'error');
    }
  }

  clearRoute() {
    this.currentRoute = [];
    this.currentRouteIndex = 0;
    this.isNavigating = false;
    document.getElementById('currentInstruction').textContent = '';
    this.showNotification('Маршрут очищен', 'info');
  }

  findRoute(startId, endId) {
    // Simple Dijkstra's algorithm implementation
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();
    
    // Initialize
    for (const [id] of this.nodes) {
      distances.set(id, Infinity);
      previous.set(id, null);
      unvisited.add(id);
    }
    distances.set(startId, 0);
    
    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let current = null;
      let minDistance = Infinity;
      
      for (const id of unvisited) {
        if (distances.get(id) < minDistance) {
          minDistance = distances.get(id);
          current = id;
        }
      }
      
      if (current === null) break;
      
      unvisited.delete(current);
      
      if (current === endId) break;
      
      // Check neighbors
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (unvisited.has(neighbor)) {
          const alt = distances.get(current) + 1; // All edges have weight 1
          if (alt < distances.get(neighbor)) {
            distances.set(neighbor, alt);
            previous.set(neighbor, current);
          }
        }
      }
    }
    
    // Reconstruct path
    const path = [];
    let current = endId;
    
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current);
    }
    
    return path[0] === startId ? path : [];
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    
    for (const conn of this.connections) {
      if (conn.from === nodeId) {
        neighbors.push(conn.to);
      } else if (conn.to === nodeId) {
        neighbors.push(conn.from);
      }
    }
    
    return neighbors;
  }

  generateVoiceInstructions() {
    if (this.currentRoute.length < 2) return [];
    
    const instructions = [];
    
    // Start instruction
    const startNode = this.nodes.get(this.currentRoute[0]);
    instructions.push(`Начинаем движение от ${startNode.name}`);
    
    for (let i = 0; i < this.currentRoute.length - 1; i++) {
      const currentNode = this.nodes.get(this.currentRoute[i]);
      const nextNode = this.nodes.get(this.currentRoute[i + 1]);
      
      if (i > 0) { // Skip first instruction as it's the start
        if (currentNode.floor !== nextNode.floor) {
          // Floor change via stairs
          if (currentNode.type === 'stair' || nextNode.type === 'stair') {
            const stairNode = currentNode.type === 'stair' ? currentNode : nextNode;
            if (nextNode.floor > currentNode.floor) {
              instructions.push(`Поднимитесь по ${stairNode.name} на ${nextNode.floor} этаж`);
            } else {
              instructions.push(`Спуститесь по ${stairNode.name} на ${nextNode.floor} этаж`);
            }
          }
        } else {
          // Same floor movement - contextual instructions
          if (currentNode.type === 'corridor') {
            instructions.push(`Двигайтесь по коридору до ${nextNode.name}`);
          } else if (nextNode.type === 'corridor') {
            instructions.push(`Пройдите мимо ${currentNode.name}, направляйтесь к ${nextNode.name}`);
          } else if (nextNode.type === 'exit') {
            instructions.push(`Направляйтесь к ${nextNode.name}`);
          } else {
            instructions.push(`Пройдите мимо ${currentNode.name}, направляйтесь к ${nextNode.name}`);
          }
        }
      }
    }
    
    // End instruction
    const endNode = this.nodes.get(this.currentRoute[this.currentRoute.length - 1]);
    instructions.push(`Вы прибыли в пункт назначения: ${endNode.name}`);
    
    return instructions;
  }

  startNavigation() {
    if (this.currentRoute.length === 0) {
      this.showNotification('Сначала постройте маршрут', 'warning');
      return;
    }
    
    this.isNavigating = true;
    this.currentRouteIndex = 0;
    
    const instructions = this.generateVoiceInstructions();
    if (instructions.length > 0) {
      this.currentInstruction = instructions[0];
      this.displayInstruction(this.currentInstruction);
      this.speakCurrentInstruction();
      
      // Auto-advance through instructions
      this.startAutoNavigation(instructions);
    }
    
    this.showNotification('Навигация запущена', 'success');
  }

  startAutoNavigation(instructions) {
    if (this.navigationTimer) {
      clearInterval(this.navigationTimer);
    }
    
    this.navigationTimer = setInterval(() => {
      if (!this.isNavigating) {
        clearInterval(this.navigationTimer);
        return;
      }
      
      this.currentRouteIndex++;
      if (this.currentRouteIndex >= instructions.length) {
        this.completeNavigation();
        return;
      }
      
      this.currentInstruction = instructions[this.currentRouteIndex];
      this.displayInstruction(this.currentInstruction);
      this.speakCurrentInstruction();
    }, 5000); // 5 seconds between instructions
  }

  completeNavigation() {
    this.isNavigating = false;
    clearInterval(this.navigationTimer);
    this.showNotification('Навигация завершена! Вы прибыли в пункт назначения.', 'success');
  }

  stopNavigation() {
    this.isNavigating = false;
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
    if (this.navigationTimer) {
      clearInterval(this.navigationTimer);
    }
    document.getElementById('currentInstruction').textContent = '';
    this.showNotification('Навигация остановлена', 'info');
  }

  previousInstruction() {
    if (!this.isNavigating || this.currentRouteIndex === 0) return;
    
    this.currentRouteIndex--;
    const instructions = this.generateVoiceInstructions();
    this.currentInstruction = instructions[this.currentRouteIndex];
    this.displayInstruction(this.currentInstruction);
    this.speakCurrentInstruction();
  }

  nextInstruction() {
    if (!this.isNavigating) return;
    
    const instructions = this.generateVoiceInstructions();
    if (this.currentRouteIndex < instructions.length - 1) {
      this.currentRouteIndex++;
      this.currentInstruction = instructions[this.currentRouteIndex];
      this.displayInstruction(this.currentInstruction);
      this.speakCurrentInstruction();
    }
  }

  repeatInstruction() {
    if (!this.isNavigating || !this.currentInstruction) return;
    
    this.speakCurrentInstruction();
  }

  displayInstruction(text) {
    document.getElementById('currentInstruction').textContent = text;
  }

  speakCurrentInstruction() {
    if (!this.speechSynthesis || !this.currentInstruction) return;
    
    this.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(this.currentInstruction);
    utterance.voice = this.currentVoice;
    utterance.rate = this.voiceSettings.rate;
    utterance.pitch = this.voiceSettings.pitch;
    utterance.volume = this.voiceSettings.volume;
    utterance.lang = 'ru-RU';
    
    this.speechSynthesis.speak(utterance);
  }

  // Voice settings methods
  selectVoice(voiceIndex) {
    if (voiceIndex === '') {
      this.currentVoice = null;
      return;
    }
    
    const voices = this.speechSynthesis.getVoices();
    this.currentVoice = voices[parseInt(voiceIndex)];
    this.showNotification(`Выбран голос: ${this.currentVoice.name}`, 'info');
  }

  setVoiceRate(rate) {
    this.voiceSettings.rate = Math.max(0.5, Math.min(2.0, rate));
    document.getElementById('rateValue').textContent = this.voiceSettings.rate.toFixed(1);
  }

  setVoicePitch(pitch) {
    this.voiceSettings.pitch = Math.max(0.5, Math.min(2.0, pitch));
    document.getElementById('pitchValue').textContent = this.voiceSettings.pitch.toFixed(1);
  }

  toggleSubtitles() {
    this.voiceSettings.showSubtitles = !this.voiceSettings.showSubtitles;
    const statusElement = document.getElementById('subtitleStatus');
    statusElement.textContent = this.voiceSettings.showSubtitles ? 'Вкл' : 'Выкл';
    this.showNotification(
      `Субтитры ${this.voiceSettings.showSubtitles ? 'включены' : 'выключены'}`, 
      'info'
    );
  }

  openQRScanner() {
    // Check if library is loaded
    if (typeof Html5Qrcode === 'undefined') {
      this.showQRError('Библиотека QR-сканера не загружена. Попробуйте перезагрузить страницу.');
      return;
    }
    
    this.qrRetryCount = 0;
    this.openModal(document.getElementById('qrModal'));
    this.startQRScanner();
  }

  startQRScanner() {
    const statusElement = document.getElementById('qrStatus');
    const errorElement = document.getElementById('qrError');
    const retryButton = document.getElementById('retryQrScan');
    
    statusElement.textContent = 'Инициализация камеры...';
    statusElement.style.display = 'block';
    errorElement.classList.remove('show');
    retryButton.style.display = 'none';
    
    this.html5QrcodeScanner = new Html5Qrcode('qrReader');
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };
    
    this.html5QrcodeScanner.start(
      { facingMode: 'environment' },
      config,
      (decodedText, decodedResult) => {
        this.handleQRDetection(decodedText);
        statusElement.style.display = 'none';
      },
      (errorMessage) => {
        // Ignore frequent scan errors
      }
    ).then(() => {
      statusElement.textContent = 'Наведите камеру на QR-код';
    }).catch(err => {
      console.error('QR Scanner error:', err);
      this.handleQRScannerError(err);
    });
  }

  handleQRScannerError(error) {
    const statusElement = document.getElementById('qrStatus');
    const retryButton = document.getElementById('retryQrScan');
    
    statusElement.style.display = 'none';
    
    let errorMessage = 'Произошла ошибка при доступе к камере.';
    let canRetry = true;
    
    if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
      errorMessage = 'Доступ к камере запрещён. Разрешите доступ в настройках браузера.';
      canRetry = false;
    } else if (error.name === 'NotFoundError' || error.message.includes('No camera found')) {
      errorMessage = 'Камера не найдена на этом устройстве';
      canRetry = false;
    } else if (error.name === 'TrackStartError' || error.message.includes('camera already in use')) {
      errorMessage = 'Камера уже используется другим приложением';
      canRetry = true;
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Камера не поддерживает требуемые параметры';
      canRetry = false;
    } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      errorMessage = 'Доступ к камере возможен только через HTTPS. Попробуйте открыть страницу локально.';
      canRetry = false;
    }
    
    this.showQRError(errorMessage);
    
    if (canRetry && this.qrRetryCount < this.maxQrRetries) {
      retryButton.style.display = 'inline-flex';
    }
  }

  showQRError(message) {
    const errorElement = document.getElementById('qrError');
    errorElement.textContent = message;
    errorElement.classList.add('show');
  }

  retryQRScanner() {
    this.qrRetryCount++;
    
    if (this.qrRetryCount >= this.maxQrRetries) {
      this.showQRError('Превышено максимальное количество попыток. Проверьте настройки камеры.');
      document.getElementById('retryQrScan').style.display = 'none';
      return;
    }
    
    // Clean up previous scanner
    if (this.html5QrcodeScanner) {
      this.html5QrcodeScanner.stop().catch(console.error);
    }
    
    // Wait a bit before retrying
    setTimeout(() => {
      this.startQRScanner();
    }, 1000);
  }

  startQRDetection() {
    // This is a simplified QR detection
    // In a real implementation, you'd use a library like jsQR
    setTimeout(() => {
      // Simulate QR code detection
      const qrCodes = Array.from(this.nodes.values())
        .filter(node => node.qrCode)
        .map(node => node.qrCode);
      
      if (qrCodes.length > 0) {
        const randomQR = qrCodes[Math.floor(Math.random() * qrCodes.length)];
        this.handleQRDetection(randomQR);
      }
    }, 3000); // Simulate detection after 3 seconds
  }

  handleQRDetection(qrCode) {
    const node = Array.from(this.nodes.values()).find(n => n.qrCode === qrCode);
    
    if (node) {
      this.currentLocation = node;
      this.switchFloor(node.floor);
      
      // Set as start point in route planning
      document.getElementById('startPoint').value = node.id;
      
      const resultDiv = document.getElementById('qrResult');
      resultDiv.textContent = `Обнаружен QR-код: ${node.name} (Этаж ${node.floor})`;
      resultDiv.classList.add('show');
      
      this.showNotification(`Местоположение: ${node.name}`, 'success');
    } else {
      const resultDiv = document.getElementById('qrResult');
      resultDiv.textContent = `Неизвестный QR-код: ${qrCode}`;
      resultDiv.classList.add('show');
    }
  }

  stopQRScanner() {
    if (this.html5QrcodeScanner) {
      this.html5QrcodeScanner.stop().then(() => {
        console.log('QR Scanner stopped successfully');
      }).catch(err => {
        console.error('Error stopping QR scanner:', err);
      });
      this.html5QrcodeScanner = null;
    }
    
    // Reset UI elements
    document.getElementById('qrResult').classList.remove('show');
    document.getElementById('qrError').classList.remove('show');
    document.getElementById('qrStatus').style.display = 'none';
    document.getElementById('retryQrScan').style.display = 'none';
    
    this.closeModal(document.getElementById('qrModal'));
  }

  saveMap() {
    const mapData = {
      nodes: Array.from(this.nodes.entries()),
      connections: this.connections,
      floors: this.floors,
      version: '1.0',
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(mapData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `school1430_map_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    this.showNotification('Карта сохранена', 'success');
  }

  loadMap(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const mapData = JSON.parse(e.target.result);
        
        // Clear current data
        this.nodes.clear();
        this.connections = [];
        
        // Load nodes
        if (mapData.nodes && Array.isArray(mapData.nodes)) {
          mapData.nodes.forEach(([id, node]) => {
            this.nodes.set(id, node);
          });
        }
        
        // Load connections
        if (mapData.connections && Array.isArray(mapData.connections)) {
          this.connections = mapData.connections;
        }
        
        // Load floors
        if (mapData.floors && Array.isArray(mapData.floors)) {
          this.floors = mapData.floors;
          this.updateFloorSelectors();
        }
        
        this.updateRouteSelectors();
        this.showNotification('Карта загружена', 'success');
        
      } catch (error) {
        this.showNotification('Ошибка при загрузке карты', 'error');
      }
    };
    
    reader.readAsText(file);
  }

  clearAll() {
    this.nodes.clear();
    this.connections = [];
    this.currentRoute = [];
    this.currentRouteIndex = 0;
    this.isNavigating = false;
    this.currentLocation = null;
    
    this.updateRouteSelectors();
    document.getElementById('currentInstruction').textContent = '';
    this.showNotification('Карта очищена', 'info');
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
    
    this.showNotification(`Тема: ${this.currentTheme === 'light' ? 'Светлая' : 'Темная'}`, 'info');
  }

  checkTheme() {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.currentTheme = 'dark';
    } else {
      this.currentTheme = 'light';
    }
    
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
  }

  authenticateAction(callback) {
    if (this.isAuthenticated) {
      callback();
      return;
    }
    
    this.pendingAction = callback;
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordError').classList.remove('show');
    this.openModal(document.getElementById('passwordModal'));
  }

  checkPassword() {
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (password === '1430') {
      this.isAuthenticated = true;
      this.closeModal(document.getElementById('passwordModal'));
      
      if (this.pendingAction) {
        this.pendingAction();
        this.pendingAction = null;
      }
      
      this.showNotification('Вход выполнен успешно', 'success');
    } else {
      errorDiv.textContent = 'Неверный пароль';
      errorDiv.classList.add('show');
      document.getElementById('passwordInput').focus();
    }
  }

  confirmAction(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    this.confirmCallback = callback;
    this.openModal(document.getElementById('confirmModal'));
  }

  openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  drawNode(node) {
    this.ctx.save();
    
    const size = this.getNodeSize(node);
    const color = this.getNodeColor(node);
    
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    
    // Highlight selected or current location
    if (this.selectedNode === node) {
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 10;
    } else if (this.currentLocation === node) {
      this.ctx.shadowColor = '#27ae60';
      this.ctx.shadowBlur = 15;
    }
    
    // Draw shape based on node type
    switch (node.type) {
      case 'room':
        this.ctx.fillRect(node.x - size/2, node.y - size/2, size, size);
        this.ctx.strokeRect(node.x - size/2, node.y - size/2, size, size);
        break;
        
      case 'stair':
        this.ctx.beginPath();
        this.ctx.moveTo(node.x, node.y - size/2);
        this.ctx.lineTo(node.x - size/2, node.y + size/2);
        this.ctx.lineTo(node.x + size/2, node.y + size/2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        break;
        
      case 'corridor':
        const width = 80;
        const height = 40;
        this.ctx.fillRect(node.x - width/2, node.y - height/2, width, height);
        this.ctx.strokeRect(node.x - width/2, node.y - height/2, width, height);
        break;
        
      case 'exit':
        // Pentagon
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const x = node.x + Math.cos(angle) * size / 2;
          const y = node.y + Math.sin(angle) * size / 2;
          if (i === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        break;
    }
    
    // Draw label
    this.ctx.fillStyle = '#000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(node.name, node.x, node.y + size/2 + 15);
    
    this.ctx.restore();
  }

  drawConnection(conn) {
    const fromNode = this.nodes.get(conn.from);
    const toNode = this.nodes.get(conn.to);
    
    if (!fromNode || !toNode) return;
    
    // Only draw connections on current floor or between floors via stairs
    const shouldDraw = (fromNode.floor === this.currentFloor && toNode.floor === this.currentFloor) ||
                      (fromNode.type === 'stair' && (fromNode.floor === this.currentFloor || toNode.floor === this.currentFloor)) ||
                      (toNode.type === 'stair' && (fromNode.floor === this.currentFloor || toNode.floor === this.currentFloor));
    
    if (!shouldDraw) return;
    
    this.ctx.save();
    this.ctx.strokeStyle = '#666';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(fromNode.x, fromNode.y);
    this.ctx.lineTo(toNode.x, toNode.y);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  drawRoute() {
    if (this.currentRoute.length < 2) return;
    
    this.ctx.save();
    this.ctx.strokeStyle = '#f39c12';
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.setLineDash([10, 5]);
    
    for (let i = 0; i < this.currentRoute.length - 1; i++) {
      const currentNode = this.nodes.get(this.currentRoute[i]);
      const nextNode = this.nodes.get(this.currentRoute[i + 1]);
      
      if (currentNode && nextNode && currentNode.floor === this.currentFloor) {
        this.ctx.beginPath();
        this.ctx.moveTo(currentNode.x, currentNode.y);
        
        if (nextNode.floor === this.currentFloor) {
          this.ctx.lineTo(nextNode.x, nextNode.y);
        }
        
        this.ctx.stroke();
      }
    }
    
    // Highlight current position during navigation
    if (this.isNavigating && this.currentRouteIndex < this.currentRoute.length) {
      const currentNode = this.nodes.get(this.currentRoute[this.currentRouteIndex]);
      if (currentNode && currentNode.floor === this.currentFloor) {
        this.ctx.fillStyle = '#27ae60';
        this.ctx.beginPath();
        this.ctx.arc(currentNode.x, currentNode.y, 20, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Pulsing effect
        const time = Date.now() / 500;
        this.ctx.fillStyle = `rgba(39, 174, 96, ${0.3 + 0.3 * Math.sin(time)})`;
        this.ctx.beginPath();
        this.ctx.arc(currentNode.x, currentNode.y, 30, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
    
    this.ctx.restore();
  }

  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    
    // Apply transformations
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.scale, this.scale);
    
    // Draw connections first
    this.connections.forEach(conn => this.drawConnection(conn));
    
    // Draw route
    this.drawRoute();
    
    // Draw nodes on current floor
    for (const [id, node] of this.nodes) {
      if (node.floor === this.currentFloor) {
        this.drawNode(node);
      }
    }
    
    // Highlight connecting node
    if (this.connectingFromNode && this.connectingFromNode.floor === this.currentFloor) {
      this.ctx.strokeStyle = '#f39c12';
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([5, 5]);
      
      const size = this.getNodeSize(this.connectingFromNode) + 10;
      this.ctx.strokeRect(
        this.connectingFromNode.x - size/2,
        this.connectingFromNode.y - size/2,
        size,
        size
      );
    }
    
    this.ctx.restore();
    
    // Request next frame
    requestAnimationFrame(() => this.render());
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const app = new SchoolNavigationApp();
  
  // Export app to global scope for debugging
  window.app = app;
  
  console.log('School Navigation App initialized successfully');
});
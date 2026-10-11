// @ts-nocheck
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { 
  Palette, MousePointer, Hand, Pencil, Type, Square, Circle as CircleIcon, 
  Star, Triangle, Plus, ArrowRight, Compass, Shield, Sun, ImagePlus, Lock, 
  FileDown, Maximize, ZoomOut, ZoomIn, Layers, X, 
  Image as ImageIcon, EyeOff, Eye, Unlock, Trash2, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, ArrowDown, RotateCw, AlertTriangle, QrCode, Grid3X3,
  List, ListOrdered, Copy, Crop, FlipHorizontal, FlipVertical, LayoutGrid, ChevronDown
} from 'lucide-react';

export type DesignEditorExport = { file: Blob; designState: Record<string, unknown> };

const PPI = 96;
// An uploaded image's temporary link is not stored; the saved layer points at the source instead.
const SOURCE_PLACEHOLDER = '__source__';
// Layers are saved with the design; the backend accepts up to 15MB for them.
const MAX_DESIGN_STATE_BYTES = 12 * 1024 * 1024;
const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Playfair Display', 
  'Dancing Script', 'Bebas Neue', 'Cinzel', 'Courier Prime', 'Caveat',
];

const generateId = () => Math.random().toString(36).substr(2, 9);
const pxToInches = (px) => (px / PPI).toFixed(2);

export default function App(props) {
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  const [dragAction, setDragAction] = useState(null); 
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [activeTool, setActiveTool] = useState('select'); 
  const [drawSettings, setDrawSettings] = useState({ color: '#111827', width: 5, opacity: 1 });

  const [isEditingArtboard, setIsEditingArtboard] = useState(false);
  const [artboardInput, setArtboardInput] = useState({ w: 8, h: 6 });

  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileLayersOpen, setIsMobileLayersOpen] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrInputValue, setQrInputValue] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const [menuState, setMenuState] = useState({ tools: true, add: true, props: true });
  const toggleMenu = (key) => setMenuState(prev => ({ ...prev, [key]: !prev[key] }));

  const fileInputRef = useRef(null);
  const templateInputRef = useRef(null);
  const customPatternInputRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const activePointers = useRef(new Map());
  const touchRef = useRef(null);

  useEffect(() => {
    const loadScript = (src) => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      }
    };
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const linkId = 'google-fonts-link';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;700&family=Cinzel:wght@400;700&family=Courier+Prime:wght@400;700&family=Dancing+Script:wght@400;700&family=Inter:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap';
      document.head.appendChild(link);
    }

      exImgTemplate(props.source, props.sourceSize.width, props.sourceSize.height);

      // Reopening a saved design: put back its layers (the guide above is rebuilt from the source).
      const saved = props.initialDesignState;
      if (saved && Array.isArray(saved.elements)) {
        const hasUploadBase = saved.elements.some(el => el.src === SOURCE_PLACEHOLDER);
        const restored = saved.elements.map(el => (el.src === SOURCE_PLACEHOLDER ? { ...el, src: props.source } : el));
        // Safe to run twice (React dev mode re-runs mount effects): drop anything already restored first.
        const restoredIds = new Set(restored.map(el => el.id));
        setElements(prev => [...restored, ...prev.filter(el => !restoredIds.has(el.id) && !(hasUploadBase && !el.isTemplate && el.src === props.source))]);
        if (saved.backgroundColor) setBackgroundColor(saved.backgroundColor);
      }
  }, []);

  const handleArtboardSubmit = (e) => {
    e.preventDefault();
    setCanvasSize({ width: artboardInput.w * PPI, height: artboardInput.h * PPI });
    setIsEditingArtboard(false);
    handleFitToScreen();
  };


  // TEMPORARY FUNCTION FOR EXISTING TEMPLATE 
  const exImgTemplate = (src, width, height) => {
    const isUpload = src.startsWith('blob:');
    setCanvasSize({ width, height });
      if (containerRef.current) {
        const containerW = Math.max(100, containerRef.current.clientWidth - 80);
        const containerH = Math.max(100, containerRef.current.clientHeight - 80);
        const scaleX = containerW / width;
        const scaleY = containerH / height;
        setZoomLevel(Math.max(0.05, Math.min(scaleX, scaleY, 1.5)));
        setPanOffset({ x: 0, y: 0 }); 
      }
      const templateElement = {
        id: generateId(), type: 'image', name: 'Locked Template',
        src: src, origImgWidth: width, origImgHeight: height,
        x: 0, y: 0, width: width, height: height, rotation: 0,
        locked: !isUpload, hidden: false, opacity: 1, isTemplate: !isUpload, flipX: false, flipY: false 
      };
      // A blank canvas (data: URL) is only a size; it has no guide to draw over the artwork.
      if (!src.startsWith('data:')) setElements(prev => [...prev.filter(el => !el.isTemplate), templateElement]);
      setShowTemplate(true); 
      setActiveTool('select');
      if(window.innerWidth < 768) setIsMobileToolsOpen(false);
  }

  // THIS IS FOR TESTING ONLY THIS SHOULD NOT BE IN FINAL FILE
  const handleExportPDF = async (saveToFlow = false) => {
    if (!canvasRef.current || !window.html2canvas) return;
    
    const prevSelected = [...selectedIds];
    const prevZoom = zoomLevel;
    const prevPan = { ...panOffset };
    const prevGrid = showGrid;
    const prevTemplate = showTemplate;
    
    setSelectedIds([]); 
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setShowGrid(false);
    setShowTemplate(false);
    setIsExporting(true);

    const maxDim = Math.max(canvasSize.width, canvasSize.height);
    const exportScale = maxDim > 4000 ? 1 : 2;

    setTimeout(async () => {
      try {
        const canvas = await window.html2canvas(canvasRef.current, { 
          scale: exportScale, 
          useCORS: true, 
          backgroundColor: backgroundColor,
          width: canvasSize.width,   
          height: canvasSize.height, 
          windowWidth: canvasSize.width,
          windowHeight: canvasSize.height,
          x: 0,
          y: 0,
          onclone: (documentClone) => {
            const clonedCanvas = documentClone.getElementById('design-artboard');
            if (clonedCanvas) {
              clonedCanvas.style.position = 'fixed';
              clonedCanvas.style.top = '0px';
              clonedCanvas.style.left = '0px';
              clonedCanvas.style.transform = 'none';
              clonedCanvas.style.boxShadow = 'none';
              documentClone.body.appendChild(clonedCanvas);
              
              Array.from(documentClone.body.children).forEach(child => {
                if (child.id !== 'design-artboard') child.style.display = 'none';
              });
            }
          }
        });
        
        if (saveToFlow === true) {
          const file = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export the design.'))), 'image/png'));
          const layers = elements.filter(el => !el.isTemplate).map(el => (el.src === props.source ? { ...el, src: SOURCE_PLACEHOLDER } : el));
          let designState = { elements: layers, backgroundColor };
          // Too large to store (e.g. many big photos): still save the design, just without reopenable layers.
          if (JSON.stringify(designState).length > MAX_DESIGN_STATE_BYTES) designState = {};
          await props.onExport({ file, designState });
        } else if (window.jspdf) {
          const imgData = canvas.toDataURL('image/jpeg', 0.95); 
          const pdf = new window.jspdf.jsPDF({
            orientation: canvasSize.width > canvasSize.height ? 'landscape' : 'portrait',
            unit: 'in',
            format: [canvasSize.width / PPI, canvasSize.height / PPI]
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, canvasSize.width / PPI, canvasSize.height / PPI);
          pdf.save('design-export.pdf');
        }
      } catch (err) { console.error("Export failed:", err); }
      finally {
        setSelectedIds(prevSelected);
        setZoomLevel(prevZoom);
        setPanOffset(prevPan);
        setShowGrid(prevGrid);
        setShowTemplate(prevTemplate);
        setIsExporting(false);
      }
    }, 800);
  };

  const insertElementUnderTemplates = (newElement) => {
    setElements(prev => {
      const templates = prev.filter(el => el.isTemplate);
      const others = prev.filter(el => !el.isTemplate);
      return [...others, newElement, ...templates];
    });
  };

  const calculateInitialSize = (scaleFactor) => Math.max(150, Math.min(canvasSize.width, canvasSize.height) * scaleFactor);

  const addShape = (shapeType) => {
    const size = calculateInitialSize(0.15);
    const newElement = {
      id: generateId(), type: 'shape', shapeType: shapeType,
      name: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Shape`,
      x: canvasSize.width / 2 - size / 2, y: canvasSize.height / 2 - size / 2,
      width: size, height: size, fill: '#3b82f6', rotation: 0, locked: false, hidden: false, isTemplate: false,
      flipX: false, flipY: false, opacity: 1
    };
    insertElementUnderTemplates(newElement);
    setSelectedIds([newElement.id]);
    setShowShapeMenu(false);
    setActiveTool('select');
    if(window.innerWidth < 768) setIsMobileToolsOpen(false);
    if (!menuState.props) toggleMenu('props');
  };

  const addElement = (type) => {
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    let newElement = { 
      id: generateId(), locked: false, hidden: false, rotation: 0, isTemplate: false, opacity: 1, flipX: false, flipY: false,
      name: `Text ${elements.length + 1}`
    };

    if (type === 'text') {
      const fontSize = Math.max(32, Math.round(canvasSize.height * 0.04));
      const width = Math.max(300, canvasSize.width * 0.4);
      const height = fontSize * 1.5;

      newElement = { 
        ...newElement, type: 'text', text: 'Double click to edit text',
        fontSize: fontSize, width: width, height: height, fill: '#111827', fontFamily: 'Inter',
        textAlign: 'center', vertical: false, strokePosition: 'outside',
        strokeColor: '#000000', strokeWidth: 0, shadowColor: '#000000', shadowBlur: 0, shadowX: 0, shadowY: 0,
        listType: 'none', lineHeight: 1.2, letterSpacing: 0,
        x: centerX - width / 2, y: centerY - height / 2 
      };
    }
    insertElementUnderTemplates(newElement);
    setSelectedIds([newElement.id]);
    setActiveTool('select');
    if(window.innerWidth < 768) setIsMobileToolsOpen(false);
    if (!menuState.props) toggleMenu('props');
  };

  const handleAddQR = () => {
    if (!qrInputValue.trim()) return;
    const size = calculateInitialSize(0.2);
    const newElement = {
      id: generateId(), type: 'qr', name: `QR Code`,
      qrData: qrInputValue, qrColor: '#000000', qrBgColor: '#ffffff',
      strokeColor: '#000000', strokeWidth: 0, cornerRadius: 0,
      x: canvasSize.width / 2 - size / 2, y: canvasSize.height / 2 - size / 2,
      width: size, height: size, rotation: 0, locked: false, hidden: false, opacity: 1, isTemplate: false,
      flipX: false, flipY: false
    };
    insertElementUnderTemplates(newElement);
    setSelectedIds([newElement.id]);
    setIsQRModalOpen(false);
    setQrInputValue('');
    setActiveTool('select');
    if(window.innerWidth < 768) setIsMobileToolsOpen(false);
  };
  // this is for image and pattern upload
  const handleFileUpload = (e, isCustomPattern = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const processFileContent = (src, width, height, defaultName) => {
      if (isCustomPattern) {
        const canvasMinDim = Math.min(canvasSize.width, canvasSize.height);
        const basePatternSize = Math.max(100, canvasMinDim * 0.15);

        const newElement = {
          id: generateId(), type: 'pattern', patternType: 'custom',
          name: `Custom Pattern`, src: src, origImgWidth: width, origImgHeight: height,
          x: 0, y: 0, width: canvasSize.width, height: canvasSize.height, 
          fill: '#ffffff', rotation: 0, locked: false, hidden: false, isTemplate: false,
          flipX: false, flipY: false, opacity: 1, patternSize: basePatternSize, patternScale: 1
        };
        insertElementUnderTemplates(newElement);
        setSelectedIds([newElement.id]);
      } else {
        const renderW = Math.min(width, canvasSize.width * 0.8);
        const renderH = (renderW / width) * height;
        const newElement = {
          id: generateId(), type: 'image', name: `${defaultName} ${elements.length + 1}`,
          src: src, origImgWidth: width, origImgHeight: height,
          x: (canvasSize.width - renderW) / 2, y: (canvasSize.height - renderH) / 2,
          width: renderW, height: renderH, rotation: 0, locked: false, hidden: false, opacity: 1, isTemplate: false,
          flipX: false, flipY: false
        };
        insertElementUnderTemplates(newElement);
        setSelectedIds([newElement.id]);
        if (!menuState.props) toggleMenu('props');
      }
      setActiveTool('select');
      if(window.innerWidth < 768) setIsMobileToolsOpen(false);
    };

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const svgText = event.target.result;
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
          const svgEl = svgDoc.querySelector('svg');
          if (!svgEl) throw new Error("Invalid SVG");

          if (!svgEl.getAttribute('xmlns')) svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          
          const parseDimension = (val) => {
            if (!val) return null;
            const str = String(val).toLowerCase();
            const num = parseFloat(str);
            if (isNaN(num)) return null;
            if (str.includes('in')) return num * 96;
            if (str.includes('cm')) return num * (96 / 2.54);
            if (str.includes('mm')) return num * (96 / 25.4);
            if (str.includes('pt')) return num * (96 / 72);
            return num * (96 / 72);
          };

          let width = null; let height = null;
          const wAttr = parseDimension(svgEl.getAttribute('width'));
          const hAttr = parseDimension(svgEl.getAttribute('height'));
          
          if (wAttr && hAttr) {
            width = wAttr; height = hAttr;
          } else {
            const viewBox = svgEl.getAttribute('viewBox');
            if (viewBox) {
              const parts = viewBox.split(/[\s,]+/).map(Number);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) { 
                width = parts[2] * (96 / 72); 
                height = parts[3] * (96 / 72); 
              }
            }
          }
          if (!width || !height) { width = 800; height = 600; }

          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgDoc);
          const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
          processFileContent(dataUrl, width, height, 'SVG Graphic');
        } catch (err) { console.error("Failed to parse SVG:", err); }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          processFileContent(event.target.result, img.width, img.height, isCustomPattern ? 'Pattern' : 'Photo');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // THIS IS FOR TESTING ONLY THIS SHOULD NOT BE IN FINAL FILE
  const handleTemplateUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const processTemplateContent = (src, width, height) => {
      setCanvasSize({ width, height });
      if (containerRef.current) {
        const containerW = Math.max(100, containerRef.current.clientWidth - 80);
        const containerH = Math.max(100, containerRef.current.clientHeight - 80);
        const scaleX = containerW / width;
        const scaleY = containerH / height;
        setZoomLevel(Math.max(0.05, Math.min(scaleX, scaleY, 1.5)));
        setPanOffset({ x: 0, y: 0 }); 
      }
      const templateElement = {
        id: generateId(), type: 'image', name: 'Locked Template',
        src: src, origImgWidth: width, origImgHeight: height,
        x: 0, y: 0, width: width, height: height, rotation: 0,
        locked: true, hidden: false, opacity: 1, isTemplate: true, flipX: false, flipY: false 
      };
      setElements(prev => [...prev.filter(el => !el.isTemplate), templateElement]);
      setShowTemplate(true); 
      setActiveTool('select');
      if(window.innerWidth < 768) setIsMobileToolsOpen(false);
    };

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const svgText = event.target.result;
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
          const svgEl = svgDoc.querySelector('svg');
          if (!svgEl) throw new Error("Invalid SVG");

          if (!svgEl.getAttribute('xmlns')) svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          
          const parseDimension = (val) => {
            if (!val) return null;
            const str = String(val).toLowerCase();
            const num = parseFloat(str);
            if (isNaN(num)) return null;
            if (str.includes('in')) return num * 96;
            if (str.includes('cm')) return num * (96 / 2.54);
            if (str.includes('mm')) return num * (96 / 25.4);
            if (str.includes('pt')) return num * (96 / 72);
            return num * (96 / 72);
          };

          let width = null; let height = null;
          const wAttr = parseDimension(svgEl.getAttribute('width'));
          const hAttr = parseDimension(svgEl.getAttribute('height'));
          
          if (wAttr && hAttr) {
            width = wAttr; height = hAttr;
          } else {
            const viewBox = svgEl.getAttribute('viewBox');
            if (viewBox) {
              const parts = viewBox.split(/[\s,]+/).map(Number);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) { 
                width = parts[2] * (96 / 72); 
                height = parts[3] * (96 / 72); 
              }
            }
          }
          if (!width || !height) { width = 800; height = 600; }

          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgDoc);
          const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
          processTemplateContent(dataUrl, width, height);
        } catch (err) { console.error("Failed to parse Template SVG:", err); }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          processTemplateContent(event.target.result, img.width, img.height);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleLayerDragStart = (e, id) => { setDraggedLayerId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleLayerDragOver = (e, targetId) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === targetId) return;
    const currentElements = [...elements];
    const draggedIdx = currentElements.findIndex(el => el.id === draggedLayerId);
    const targetIdx = currentElements.findIndex(el => el.id === targetId);
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = currentElements.splice(draggedIdx, 1);
      currentElements.splice(targetIdx, 0, removed);
      setElements(currentElements);
    }
  };
  const handleLayerDragEnd = () => setDraggedLayerId(null);

  const toggleLayerProperty = (id, property) => setElements(elements.map(el => el.id === id ? { ...el, [property]: !el[property] } : el));
  const updateElements = (ids, newProps) => setElements(elements.map((el) => (ids.includes(el.id) ? { ...el, ...newProps } : el)));
  
  const deleteSelected = () => {
    setElements(elements.filter((el) => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  };

  const duplicateElement = (id) => {
    const elToCopy = elements.find(el => el.id === id);
    if (!elToCopy) return;
    const offset = Math.max(20, canvasSize.width * 0.02);
    const newElement = {
      ...elToCopy, id: generateId(), name: `${elToCopy.name} (Copy)`,
      x: elToCopy.x + offset, y: elToCopy.y + offset
    };
    insertElementUnderTemplates(newElement);
    setSelectedIds([newElement.id]);
  };

  const handlePointerDown = (e, id, type = 'move', direction = null) => {
    if (activeTool === 'pan' || activeTool === 'draw' || activePointers.current.size > 1) return;
    e.stopPropagation();
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    
    const clickedEl = elements.find(el => el.id === id);
    if (clickedEl?.locked || clickedEl?.isTemplate) {
      setSelectedIds([]);
      return;
    }
    
    let targetIds = selectedIds.includes(id) ? selectedIds : [id];
    if (e.shiftKey) {
      targetIds = selectedIds.includes(id) ? selectedIds.filter(sid => sid !== id) : [...selectedIds, id];
    }
    setSelectedIds(targetIds);
    if (!menuState.props) toggleMenu('props');
    
    const origPositions = {};
    elements.forEach(el => {
      if (targetIds.includes(el.id)) {
        origPositions[el.id] = { x: el.x, y: el.y, w: el.width, h: el.height, rot: el.rotation || 0, fontSize: el.fontSize || 32 };
      }
    });

    setDragAction({ type, direction, startX: e.clientX, startY: e.clientY, origPositions, pointerId: e.pointerId, target: e.target });
  };

  const handleContainerPointerDown = (e) => {
    setActiveTooltip(null);
    if (activePointers.current.size > 1) return;

    if (activeTool === 'pan' || (e.button === 1) || e.altKey || (e.pointerType === 'touch' && activeTool === 'select')) { 
      e.preventDefault();
      setDragAction({ type: 'pan', startX: e.clientX, startY: e.clientY, origPanX: panOffset.x, origPanY: panOffset.y });
      return;
    } else if (activeTool === 'draw') {
      e.preventDefault();
      setSelectedIds([]);
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;
      setDragAction({ type: 'drawing', points: [{x, y}] });
      return;
    } else if (activeTool === 'select' && !e.shiftKey) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      setSelectedIds([]);
    }
    setShowShapeMenu(false);
  };

  const handlePointerMove = (e) => {
    if (selectionBox) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;
      setSelectionBox(prev => ({ ...prev, endX: x, endY: y }));
      
      const minX = Math.min(selectionBox.startX, x);
      const maxX = Math.max(selectionBox.startX, x);
      const minY = Math.min(selectionBox.startY, y);
      const maxY = Math.max(selectionBox.startY, y);
      
      const newSelected = elements.filter(el => {
          if (el.locked || el.isTemplate || el.hidden) return false;
          return (el.x < maxX && el.x + el.width > minX && el.y < maxY && el.y + el.height > minY);
      }).map(el => el.id);
      
      setSelectedIds(newSelected);
      return;
    }

    if (!dragAction) return;

    if (dragAction.type === 'pan') {
      setPanOffset({ x: dragAction.origPanX + (e.clientX - dragAction.startX), y: dragAction.origPanY + (e.clientY - dragAction.startY) });
      return;
    }

    if (dragAction.type === 'drawing') {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;
      setDragAction(prev => ({ ...prev, points: [...prev.points, {x, y}] }));
      return;
    }

    if (selectedIds.length === 0) return;
    
    const dx = (e.clientX - dragAction.startX) / zoomLevel;
    const dy = (e.clientY - dragAction.startY) / zoomLevel;
    
    setElements(elements.map(el => {
      if (dragAction.origPositions && dragAction.origPositions[el.id]) {
        const orig = dragAction.origPositions[el.id];
        
        if (dragAction.type === 'move') {
          return { ...el, x: orig.x + dx, y: orig.y + dy };
        } else if (dragAction.type === 'resize' && selectedIds.length === 1) {
          let newW = orig.w; let newH = orig.h;
          let newX = orig.x; let newY = orig.y;
          
          if (dragAction.direction.includes('e')) newW += dx;
          if (dragAction.direction.includes('w')) { newW -= dx; newX += dx; }
          if (dragAction.direction.includes('s')) newH += dy;
          if (dragAction.direction.includes('n')) { newH -= dy; newY += dy; }
          
          if (newW < 20) { newW = 20; if (dragAction.direction.includes('w')) newX = orig.x + orig.w - 20; }
          if (newH < 20) { newH = 20; if (dragAction.direction.includes('n')) newY = orig.y + orig.h - 20; }

          if (el.type === 'text') {
            const isCorner = ['nw', 'ne', 'sw', 'se'].includes(dragAction.direction);
            if (isCorner) {
              const ratio = newH / orig.h;
              return { ...el, fontSize: Math.max(4, Math.round(orig.fontSize * ratio)), width: newW, height: newH, x: newX, y: newY };
            }
          }
          return { ...el, width: newW, height: newH, x: newX, y: newY };
        } else if (dragAction.type === 'rotate' && selectedIds.length === 1) {
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const centerXScreen = rect.left + (orig.x + orig.w / 2) * zoomLevel;
            const centerYScreen = rect.top + (orig.y + orig.h / 2) * zoomLevel;
            const radians = Math.atan2(e.clientY - centerYScreen, e.clientX - centerXScreen);
            const angle = Math.round(radians * (180 / Math.PI) + 90);
            return { ...el, rotation: (angle + 360) % 360 };
          }
        }
      }
      return el;
    }));
  };

  const handlePointerUp = () => {
    if (selectionBox) setSelectionBox(null);

    if (dragAction?.type === 'drawing') {
      const points = dragAction.points;
      if (points.length > 1) {
        const xs = points.map(p => p.x); const ys = points.map(p => p.y);
        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);
        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxY - minY, 1);
        const relPoints = points.map(p => ({ x: p.x - minX, y: p.y - minY }));

        const newElement = {
          id: generateId(), type: 'drawing', points: relPoints,
          stroke: drawSettings.color, strokeWidth: drawSettings.width, opacity: drawSettings.opacity,
          x: minX, y: minY, width, height, origWidth: width, origHeight: height,
          rotation: 0, locked: false, hidden: false, isTemplate: false,
          name: `Drawing ${elements.length + 1}`, flipX: false, flipY: false
        };
        insertElementUnderTemplates(newElement);
      }
    }

    if (dragAction?.target && dragAction?.pointerId) {
      try { dragAction.target.releasePointerCapture(dragAction.pointerId); } catch (err) {}
    }
    setDragAction(null);
  };

  const handleWheel = (e) => setPanOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));

  const handleFitToScreen = () => {
    if (containerRef.current) {
      const containerW = Math.max(100, containerRef.current.clientWidth - 80);
      const containerH = Math.max(100, containerRef.current.clientHeight - 80);
      const scaleX = containerW / canvasSize.width;
      const scaleY = containerH / canvasSize.height;
      setZoomLevel(Math.max(0.05, Math.min(scaleX, scaleY, 1.5)));
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const renderShapeSvg = (shapeType, fill) => {
    switch (shapeType) {
      case 'rect': return <div className="w-full h-full" style={{ backgroundColor: fill }} />;
      case 'circle': return <div className="w-full h-full rounded-full" style={{ backgroundColor: fill }} />;
      case 'star': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
      case 'triangle': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><polygon points="12 2 22 21 2 21" /></svg>;
      case 'cross': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><path d="M19 10h-5V5h-4v5H5v4h5v5h4v-5h5v-4z" /></svg>;
      case 'arrow': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><path d="M5 13h11.586l-5.293 5.293 1.414 1.414L20.414 12l-7.707-7.707-1.414 1.414L16.586 11H5v2z" /></svg>;
      case 'rhombus': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><polygon points="12 2 22 12 12 22 2 12" /></svg>;
      case 'octagon': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><polygon points="7.86 2 h8.28 l5.86 5.86 v8.28 l-5.86 5.86 H7.86 L2 16.14 V7.86 Z" /></svg>;
      case 'sun': return <svg viewBox="0 0 24 24" fill={fill} className="w-full h-full preserve-3d"><circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" stroke={fill} strokeWidth="2" strokeLinecap="round" /></svg>;
      default: return <div className="w-full h-full" style={{ backgroundColor: fill }} />;
    }
  };

  const selectedElement = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : null;

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-800 overflow-hidden touch-none">

      {(isMobileToolsOpen || isMobileLayersOpen) && (
        <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => {setIsMobileToolsOpen(false); setIsMobileLayersOpen(false);}} />
      )}

      {/* QR Code Modal Overlay */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><QrCode size={18}/> Generate QR Code</h3>
              <button onClick={() => setIsQRModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Enter a website URL or text to generate a scannable QR code.</p>
            <input 
              type="text" placeholder="https://example.com" value={qrInputValue} onChange={(e) => setQrInputValue(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button onClick={handleAddQR} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors">
              Add QR to Canvas
            </button>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR: Tools and Properties */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-[85vw] max-w-[300px] md:w-72 bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-sm z-50 transform transition-transform duration-300 ease-in-out ${isMobileToolsOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <img src="/rps-logo.png" alt="Logo"
              width={160} height={40} className="rounded-lg object-contain"
              style={{ width: "auto", height: "40px" }}
            />
          <button className="md:hidden p-1.5 text-slate-400 bg-white rounded-md border shadow-sm" onClick={() => setIsMobileToolsOpen(false)}><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          
          {/* Workspace Tools Accordion */}
          <div className="border-b border-slate-200 bg-white">
            <button onClick={() => toggleMenu('tools')} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
               <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><MousePointer size={14} className="text-slate-400"/> Workspace Tools</h2>
               <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuState.tools ? 'rotate-180' : ''}`} />
            </button>
            {menuState.tools && (
              <div className="p-3 pt-0">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button onClick={() => setActiveTool('select')} className={`flex-1 flex justify-center items-center gap-2 p-1.5 rounded transition-colors ${activeTool === 'select' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-200'}`} title="Select/Move">
                    <MousePointer size={14} /> <span className="text-[11px]">Select</span>
                  </button>
                  <button onClick={() => setActiveTool('pan')} className={`flex-1 flex justify-center items-center gap-2 p-1.5 rounded transition-colors ${activeTool === 'pan' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-500 hover:bg-slate-200'}`} title="Pan Canvas">
                    <Hand size={14} /> <span className="text-[11px]">Pan</span>
                  </button>
                  <button onClick={() => setActiveTool('draw')} className={`flex-1 flex justify-center items-center gap-2 p-1.5 rounded transition-colors ${activeTool === 'draw' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-200'}`} title="Free Draw">
                    <Pencil size={14} /> <span className="text-[11px]">Draw</span>
                  </button>
                </div>
                {activeTool === 'draw' && (
                  <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Color</span>
                      <input type="color" value={drawSettings.color} onChange={(e) => setDrawSettings({...drawSettings, color: e.target.value})} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Stroke Width ({drawSettings.width}px)</span>
                      <input type="range" min="1" max="50" value={drawSettings.width} onChange={(e) => setDrawSettings({...drawSettings, width: parseInt(e.target.value)})} className="w-full" />
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-500 font-medium">Artboard Background</span>
                  <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded overflow-hidden cursor-pointer shadow-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Add Elements Section */}
          <div className="border-b border-slate-200 bg-white">
            <button onClick={() => toggleMenu('add')} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
               <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Plus size={14} className="text-slate-400"/> Add Elements</h2>
               <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuState.add ? 'rotate-180' : ''}`} />
            </button>
            {menuState.add && (
              <div className="p-3 pt-0 grid grid-cols-2 gap-2">
                <button onClick={() => addElement('text')} className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors">
                  <Type size={18} className="text-slate-600 mb-1" />
                  <span className="text-[10px] font-medium">Text</span>
                </button>

                <div className="relative">
                  <button onClick={() => setShowShapeMenu(!showShapeMenu)} className="w-full h-full flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors bg-white">
                    <Square size={18} className="text-slate-600 mb-1" />
                    <span className="text-[10px] font-medium">Shapes</span>
                  </button>
                </div>

                {showShapeMenu && (
                  <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 grid grid-cols-3 gap-1.5 animate-fadeIn">
                    <div className="col-span-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-1">Select Shape</div>
                    <button onClick={() => addShape('rect')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Square size={16} className="text-blue-600" /> Rect</button>
                    <button onClick={() => addShape('circle')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><CircleIcon size={16} className="text-blue-600" /> Circle</button>
                    <button onClick={() => addShape('star')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Star size={16} className="text-amber-500" /> Star</button>
                    <button onClick={() => addShape('triangle')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Triangle size={16} className="text-indigo-600" /> Tri</button>
                    <button onClick={() => addShape('cross')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Plus size={16} className="text-red-500" /> Cross</button>
                    <button onClick={() => addShape('arrow')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><ArrowRight size={16} className="text-emerald-600" /> Arrow</button>
                    <button onClick={() => addShape('rhombus')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Compass size={16} className="text-purple-600" /> Rhomb</button>
                    <button onClick={() => addShape('octagon')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Shield size={16} className="text-cyan-600" /> Octagon</button>
                    <button onClick={() => addShape('sun')} className="flex flex-col items-center justify-center gap-1 p-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-[10px] font-medium transition-colors"><Sun size={16} className="text-orange-500" /> Sun</button>
                  </div>
                )}

                <button onClick={() => customPatternInputRef.current?.click()} className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors">
                  <LayoutGrid size={18} className="text-indigo-600 mb-1" />
                  <span className="text-[10px] font-medium">Pattern</span>
                  <input type="file" ref={customPatternInputRef} onChange={(e) => handleFileUpload(e, true)} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                </button>

                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors">
                  <ImagePlus size={18} className="text-slate-600 mb-1" />
                  <span className="text-[10px] font-medium">Photo</span>
                  <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, false)} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                </button>
                
                <button onClick={() => setIsQRModalOpen(true)} className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-colors">
                  <QrCode size={18} className="text-slate-600 mb-1" />
                  <span className="text-[10px] font-medium">QR Code</span>
                </button>

                <div className="col-span-2 mt-1">
                  <button onClick={() => templateInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-indigo-50/50 border border-indigo-200 hover:bg-indigo-100 p-2.5 rounded-lg transition-colors">
                    <Lock size={14} className="text-indigo-600" />
                    <span className="text-[11px] font-semibold text-indigo-700">Add Locked Template</span>
                  </button>
                  <input type="file" ref={templateInputRef} onChange={handleTemplateUpload} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                </div>
              </div>
            )}
          </div>

          {selectedIds.length > 1 && (
            <div className="p-4 bg-slate-50">
               <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Batch Actions</h2>
               <div className="text-[11px] font-medium text-slate-600 mb-3 bg-white p-3 rounded-lg border border-slate-200 text-center shadow-sm">
                  {selectedIds.length} Elements Selected
               </div>
               <button onClick={deleteSelected} className="w-full py-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 text-xs font-semibold flex justify-center items-center gap-2 transition-colors">
                   <Trash2 size={14} /> Delete Group
               </button>
            </div>
          )}

          {selectedElement && selectedIds.length === 1 && activeTool !== 'draw' && (
            <div className="bg-white">
              <button onClick={() => toggleMenu('props')} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-200">
                 <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    Properties <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] capitalize">{selectedElement.type}</span>
                 </h2>
                 <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuState.props ? 'rotate-180' : ''}`} />
              </button>
              
              {menuState.props && (
                <div className="p-4 space-y-4">
                  {selectedElement.type !== 'image' && (selectedElement.type !== 'pattern' || selectedElement.patternType !== 'custom') && selectedElement.type !== 'qr' && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Color / Fill</span>
                      <div className="flex items-center gap-2">
                        <input type="color" value={selectedElement.fill || (selectedElement.type === 'drawing' ? selectedElement.stroke : '#3b82f6')} onChange={(e) => updateElements(selectedIds, selectedElement.type === 'drawing' ? {stroke: e.target.value} : { fill: e.target.value })} className="w-7 h-7 p-0 border-0 rounded cursor-pointer shadow-sm" />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-500 font-medium">Rotation</span>
                      <span className="text-[10px] font-mono">{selectedElement.rotation || 0}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="range" min="0" max="360" value={selectedElement.rotation || 0} onChange={(e) => updateElements(selectedIds, { rotation: parseInt(e.target.value) })} className="w-full" />
                      <button onClick={() => updateElements(selectedIds, { rotation: ((selectedElement.rotation || 0) + 90) % 360 })} className="p-1.5 border rounded hover:bg-slate-50 text-slate-500" title="Rotate 90deg"><RotateCw size={14} /></button>
                    </div>
                  </div>

                  {selectedElement.type === 'qr' && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">QR Code Settings</span>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">URL / Data</span>
                        <input type="text" value={selectedElement.qrData || ''} onChange={(e) => updateElements(selectedIds, { qrData: e.target.value })} className="w-full text-[11px] p-1.5 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500">QR Color</span>
                          <input type="color" value={selectedElement.qrColor || '#000000'} onChange={(e) => updateElements(selectedIds, { qrColor: e.target.value })} className="w-5 h-5 p-0 border-0 rounded cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500">Background</span>
                          <input type="color" value={selectedElement.qrBgColor || '#ffffff'} onChange={(e) => updateElements(selectedIds, { qrBgColor: e.target.value })} className="w-5 h-5 p-0 border-0 rounded cursor-pointer" />
                        </div>
                      </div>
                      <div className="space-y-2 pt-1 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Border Stroke Color</span>
                          <input type="color" value={selectedElement.strokeColor || '#000000'} onChange={(e) => updateElements(selectedIds, { strokeColor: e.target.value })} className="w-5 h-5 p-0 border-0 rounded cursor-pointer" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Border Width</span>
                            <span className="text-[10px] font-mono">{selectedElement.strokeWidth || 0}px</span>
                          </div>
                          <input type="range" min="0" max="30" value={selectedElement.strokeWidth || 0} onChange={(e) => updateElements(selectedIds, { strokeWidth: parseInt(e.target.value) })} className="w-full" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Corner Radius</span>
                            <span className="text-[10px] font-mono">{selectedElement.cornerRadius || 0}px</span>
                          </div>
                          <input type="range" min="0" max="50" value={selectedElement.cornerRadius || 0} onChange={(e) => updateElements(selectedIds, { cornerRadius: parseInt(e.target.value) })} className="w-full" />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'text' && (
                    <>
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block mb-1">Text Content</span>
                        <textarea value={selectedElement.text} onChange={(e) => updateElements(selectedIds, { text: e.target.value })} className="w-full text-[11px] p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={3} />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <span className="text-[11px] text-slate-500 font-medium block mb-1">Font</span>
                          <select value={selectedElement.fontFamily || 'Inter'} onChange={(e) => updateElements(selectedIds, { fontFamily: e.target.value })} className="w-full text-[11px] p-1.5 border border-slate-300 rounded bg-white">
                            {GOOGLE_FONTS.map(font => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
                          </select>
                        </div>
                        <div className="w-16">
                          <span className="text-[11px] text-slate-500 font-medium block mb-1">Size(pt)</span>
                          <input type="number" min="4" max="500" value={selectedElement.fontSize || 32} onChange={(e) => updateElements(selectedIds, { fontSize: parseInt(e.target.value) || 4 })} className="w-full text-[11px] p-1.5 border border-slate-300 rounded bg-white text-center" />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Typography & Layout</span>
                        
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1 bg-white p-1 rounded border border-slate-200 flex">
                            {['left', 'center', 'right', 'justify'].map(align => (
                              <button key={align} onClick={() => updateElements(selectedIds, { textAlign: align })} className={`flex-1 flex justify-center p-1 rounded transition-colors ${selectedElement.textAlign === align ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`} title={align}>
                                {align === 'left' && <AlignLeft size={12} />}
                                {align === 'center' && <AlignCenter size={12} />}
                                {align === 'right' && <AlignRight size={12} />}
                                {align === 'justify' && <AlignJustify size={12} />}
                              </button>
                            ))}
                          </div>
                          <div className="flex bg-white p-1 rounded border border-slate-200">
                            <button onClick={() => updateElements(selectedIds, { listType: 'none' })} className={`px-2 flex justify-center p-1 rounded transition-colors ${!selectedElement.listType || selectedElement.listType === 'none' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="No List"><AlignLeft size={12} /></button>
                            <button onClick={() => updateElements(selectedIds, { listType: 'bullet' })} className={`px-2 flex justify-center p-1 rounded transition-colors ${selectedElement.listType === 'bullet' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Bullet List"><List size={12} /></button>
                            <button onClick={() => updateElements(selectedIds, { listType: 'number' })} className={`px-2 flex justify-center p-1 rounded transition-colors ${selectedElement.listType === 'number' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Numbered List"><ListOrdered size={12} /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-1">Line Height</span>
                            <input type="range" min="0.5" max="3" step="0.1" value={selectedElement.lineHeight || 1.2} onChange={(e) => updateElements(selectedIds, { lineHeight: parseFloat(e.target.value) })} className="w-full" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-1">Letter Spac</span>
                            <input type="range" min="-10" max="50" step="1" value={selectedElement.letterSpacing || 0} onChange={(e) => updateElements(selectedIds, { letterSpacing: parseInt(e.target.value) })} className="w-full" />
                          </div>
                        </div>
                        
                        <button onClick={() => updateElements(selectedIds, { vertical: !selectedElement.vertical })} className={`w-full mt-2 flex items-center justify-center gap-2 p-1.5 rounded border text-[10px] font-medium transition-colors ${selectedElement.vertical ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                          <ArrowDown size={12} /> {selectedElement.vertical ? 'Vertical Text ON' : 'Vertical Text OFF'}
                        </button>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Text Stroke Outline</span>
                         <div className="flex items-center gap-2 mb-2">
                           <input type="color" value={selectedElement.strokeColor || '#000000'} onChange={(e) => updateElements(selectedIds, { strokeColor: e.target.value })} className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0" />
                           <input type="range" min="0" max="50" step="0.5" value={selectedElement.strokeWidth || 0} onChange={(e) => updateElements(selectedIds, { strokeWidth: parseFloat(e.target.value) })} className="w-full" />
                           <span className="text-[10px] font-mono w-8 text-right">{selectedElement.strokeWidth || 0}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] text-slate-500 w-12">Position:</span>
                           <select value={selectedElement.strokePosition || 'outside'} onChange={(e) => updateElements(selectedIds, { strokePosition: e.target.value })} className="flex-1 text-[11px] p-1 border border-slate-300 rounded bg-white">
                             <option value="outside">Outside</option><option value="center">Center</option><option value="inside">Inside</option>
                           </select>
                         </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Drop Shadow</span>
                         <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 w-6">Col</span>
                             <input type="color" value={selectedElement.shadowColor || '#000000'} onChange={(e) => updateElements(selectedIds, { shadowColor: e.target.value })} className="flex-1 h-5 p-0 border-0 rounded cursor-pointer" />
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 w-6">Blur</span>
                             <input type="range" min="0" max="30" value={selectedElement.shadowBlur || 0} onChange={(e) => updateElements(selectedIds, { shadowBlur: parseInt(e.target.value) })} className="w-full" />
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 w-6">X</span>
                             <input type="range" min="-30" max="30" value={selectedElement.shadowX || 0} onChange={(e) => updateElements(selectedIds, { shadowX: parseInt(e.target.value) })} className="w-full" />
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 w-6">Y</span>
                             <input type="range" min="-30" max="30" value={selectedElement.shadowY || 0} onChange={(e) => updateElements(selectedIds, { shadowY: parseInt(e.target.value) })} className="w-full" />
                           </div>
                         </div>
                      </div>
                    </>
                  )}

                  {selectedElement.type === 'pattern' && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Pattern Density (1x - 20x)</span>
                      <div className="flex items-center gap-2">
                        <input type="range" min="0.5" max="20" step="0.5" value={selectedElement.patternScale || 1} onChange={(e) => updateElements(selectedIds, { patternScale: parseFloat(e.target.value) })} className="w-full" />
                        <span className="text-[10px] font-mono w-8 text-right">{(selectedElement.patternScale || 1).toFixed(1)}x</span>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'image' && !selectedElement.isTemplate && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Crop size={12}/> Crop Image</span>
                      {['Top', 'Right', 'Bottom', 'Left'].map(side => {
                        const propName = `crop${side.charAt(0)}`;
                        return (
                          <div key={side} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 w-10">{side}</span>
                            <input type="range" min="0" max="90" value={selectedElement[propName] || 0} onChange={(e) => updateElements(selectedIds, { [propName]: parseInt(e.target.value) })} className="w-full" />
                            <span className="text-[10px] font-mono w-6 text-right">{selectedElement[propName] || 0}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium block mb-2">Flip Content</span>
                    <div className="flex bg-slate-100 p-1 rounded border border-slate-200 mb-4">
                      <button onClick={() => updateElements(selectedIds, { flipX: !selectedElement.flipX })} className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${selectedElement.flipX ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`} title="Flip Horizontal">
                        <FlipHorizontal size={16} />
                      </button>
                      <button onClick={() => updateElements(selectedIds, { flipY: !selectedElement.flipY })} className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${selectedElement.flipY ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`} title="Flip Vertical">
                        <FlipVertical size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-500 font-medium">Transparency</span>
                      <span className="text-[10px] font-mono">{Math.round((selectedElement.opacity !== undefined ? selectedElement.opacity : 1) * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={selectedElement.opacity !== undefined ? selectedElement.opacity : 1} onChange={(e) => updateElements(selectedIds, { opacity: parseFloat(e.target.value) })} className="w-full" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main 
        className="flex-1 flex flex-col h-full relative pb-14 md:pb-0" 
        onPointerDownCapture={(e) => {
          activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.current.size === 2) {
            const pts = Array.from(activePointers.current.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            touchRef.current = { type: 'pinch', initialDist: dist, initialZoom: zoomLevel };
            setDragAction(null);
            setSelectionBox(null);
          }
        }}
        onPointerMoveCapture={(e) => {
          if (activePointers.current.has(e.pointerId)) {
            activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }
          if (activePointers.current.size === 2 && touchRef.current?.type === 'pinch') {
            e.stopPropagation();
            e.preventDefault();
            const pts = Array.from(activePointers.current.values());
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const newZoom = Math.max(0.05, Math.min(5, touchRef.current.initialZoom * (dist / touchRef.current.initialDist)));
            setZoomLevel(newZoom);
          }
        }}
        onPointerUpCapture={(e) => {
          activePointers.current.delete(e.pointerId);
          if (activePointers.current.size < 2) touchRef.current = null;
        }}
        onPointerCancelCapture={(e) => {
          activePointers.current.delete(e.pointerId);
          if (activePointers.current.size < 2) touchRef.current = null;
        }}
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp}
      >
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 text-[11px] font-semibold text-slate-500">
            {isEditingArtboard ? (
              <form onSubmit={handleArtboardSubmit} className="hidden md:flex items-center gap-1 bg-white border border-blue-400 rounded px-2 py-0.5 shadow-sm">
                <input type="number" step="0.1" value={artboardInput.w} onChange={(e) => setArtboardInput({...artboardInput, w: parseFloat(e.target.value) || 0})} className="w-12 text-center outline-none text-blue-700 font-bold bg-transparent" />
                <span className="text-slate-400">"</span>
                <span className="mx-1">x</span>
                <input type="number" step="0.1" value={artboardInput.h} onChange={(e) => setArtboardInput({...artboardInput, h: parseFloat(e.target.value) || 0})} className="w-12 text-center outline-none text-blue-700 font-bold bg-transparent" />
                <span className="text-slate-400">"</span>
                <button type="submit" className="ml-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">OK</button>
              </form>
            ) : (
              <span onClick={() => { setArtboardInput({ w: parseFloat(pxToInches(canvasSize.width)), h: parseFloat(pxToInches(canvasSize.height)) }); setIsEditingArtboard(true); }} className="hidden md:inline cursor-pointer hover:text-blue-600 transition-colors" title="Click to manually edit artboard size">
                 Artboard: <span className="text-slate-800 font-bold border-b border-dashed border-slate-400 hover:border-blue-600 pb-0.5">{pxToInches(canvasSize.width)}" x {pxToInches(canvasSize.height)}"</span>
              </span>
            )}
            
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              <button onClick={() => setShowTemplate(!showTemplate)} className={`px-2 py-1 hover:bg-white rounded flex items-center gap-1 ${showTemplate ? 'text-blue-600 font-medium' : 'text-slate-400'}`} title="Toggle Guides Visibility">
                {showTemplate ? <Eye size={12} /> : <EyeOff size={12} />} <span className="hidden md:inline">Guides</span>
              </button>
              <div className="w-px h-3 bg-slate-300 mx-1"></div>
              <button onClick={() => setShowGrid(!showGrid)} className={`px-2 py-1 hover:bg-white rounded flex items-center gap-1 ${showGrid ? 'text-indigo-600 font-medium' : 'text-slate-400'}`} title="Toggle Grid">
                <Grid3X3 size={12} /> <span className="hidden md:inline">Grid</span>
              </button>
            </div>
            
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              <button onClick={handleFitToScreen} className="px-2 py-1 hover:bg-white rounded text-slate-500" title="Fit to Screen"><Maximize size={12} /></button>
              <button onClick={() => setZoomLevel(Math.max(0.05, zoomLevel / 1.25))} className="px-2 py-1 hover:bg-white rounded" title="Zoom Out"><ZoomOut size={12} /></button>
              <span className="px-1 font-mono text-[10px] w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(Math.min(5, zoomLevel * 1.25))} className="px-2 py-1 hover:bg-white rounded" title="Zoom In"><ZoomIn size={12} /></button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={props.onBack} className="flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded border border-slate-200 shadow-sm transition-colors">Back</button>
            <button onClick={() => handleExportPDF(true)} disabled={isExporting} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-semibold rounded shadow-sm transition-colors">{isExporting ? 'Saving…' : 'Save & Next'}</button>
            <button onClick={() => handleExportPDF()} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded shadow-sm transition-colors"><FileDown size={14} /> <span>Export PDF</span></button>
          </div>
        </header>

        {/* Canvas Engine */}
        <div ref={containerRef} className="flex-1 overflow-hidden bg-[#f1f2f2] relative select-none" onPointerDown={handleContainerPointerDown} onWheel={handleWheel}>
          {/* Covers the canvas area only (editor stays visible) while the export uses a temporary 100% zoom */}
          {isExporting && (
            <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-[#f1f2f2]">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              <p className="text-sm font-medium text-slate-600">Preparing your design…</p>
            </div>
          )}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px))` }}>
            
            <div style={{ position: 'relative', width: canvasSize.width * zoomLevel, height: canvasSize.height * zoomLevel }}>
              
              {/* Dimension Lines */}
              <div style={{ position: 'absolute', top: -30, left: 0, width: '100%', height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
                <div style={{ position: 'absolute', left: 0, height: 10, width: 1, backgroundColor: '#64748b' }} />
                <div style={{ width: '100%', height: 1, backgroundColor: '#64748b' }} />
                <div style={{ position: 'absolute', right: 0, height: 10, width: 1, backgroundColor: '#64748b' }} />
                <div style={{ position: 'absolute', backgroundColor: '#e2e8f0', padding: '0 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>{pxToInches(canvasSize.width)}"</div>
              </div>
              <div style={{ position: 'absolute', top: 0, left: -30, height: '100%', width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10 }}>
                <div style={{ position: 'absolute', top: 0, width: 10, height: 1, backgroundColor: '#64748b' }} />
                <div style={{ height: '100%', width: 1, backgroundColor: '#64748b' }} />
                <div style={{ position: 'absolute', bottom: 0, width: 10, height: 1, backgroundColor: '#64748b' }} />
                <div style={{ position: 'absolute', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#475569', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{pxToInches(canvasSize.height)}"</div>
              </div>

              {/* Artboard Container */}
              <div id="design-artboard" ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: backgroundColor, overflow: 'hidden'}}>
                
                {showGrid && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                    backgroundSize: `${PPI * zoomLevel}px ${PPI * zoomLevel}px`, zIndex: 5
                  }} />
                )}

                {elements.map((el) => {
                  if (el.hidden) return null;
                  if (el.isTemplate && (!showTemplate || isExporting)) return null;

                  const isSelected = selectedIds.includes(el.id) && activeTool !== 'draw';
                  const isOutOfBounds = el.type === 'text' && (el.x < 0 || el.y < 0 || el.x + el.width > canvasSize.width || el.y + el.height > canvasSize.height);
                  
                  const baseStyle = {
                    position: 'absolute', left: el.isTemplate ? 0 : el.x * zoomLevel, top: el.isTemplate ? 0 : el.y * zoomLevel, 
                    width: (el.isTemplate ? canvasSize.width : el.width) * zoomLevel, height: (el.isTemplate ? canvasSize.height : el.height) * zoomLevel,
                    transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: 'center center',
                    outline: 'none',
                    pointerEvents: (el.locked && activeTool !== 'pan') || activeTool === 'draw' || el.isTemplate ? 'none' : 'auto',
                    opacity: el.opacity !== undefined ? el.opacity : 1,
                    zIndex: isSelected ? 1000 : (el.isTemplate ? 5000 : 10)
                  };

                  const contentWrapperStyle = {
                    width: '100%', height: '100%',
                    transform: `scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
                    transformOrigin: 'center center'
                  };

                  let elementContent = null;

                  if (el.type === 'shape') {
                    elementContent = (
                      <div key={el.id} style={baseStyle} onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}>
                        <div style={contentWrapperStyle}>{renderShapeSvg(el.shapeType, el.fill)}</div>
                      </div>
                    );
                  } else if (el.type === 'qr') {
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(el.qrData || 'https://example.com')}&color=${(el.qrColor || '#000000').replace('#','')}&bgcolor=${(el.qrBgColor || '#ffffff').replace('#','')}`;
                    const canvasScaleFactor = Math.max(canvasSize.width, canvasSize.height) / 800;
                    const computedStrokeWidth = (el.strokeWidth || 0) * canvasScaleFactor * zoomLevel;
                    const computedCornerRadius = (el.cornerRadius || 0) * canvasScaleFactor * zoomLevel;

                    elementContent = (
                      <div key={el.id} style={baseStyle} onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}>
                        <div 
                          style={{
                            ...contentWrapperStyle,
                            border: computedStrokeWidth > 0 ? `${computedStrokeWidth}px solid ${el.strokeColor || '#000000'}` : 'none',
                            borderRadius: `${computedCornerRadius}px`,
                            overflow: 'hidden',
                            backgroundColor: el.qrBgColor || '#ffffff'
                          }}
                        >
                          <img src={qrImgUrl} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
                        </div>
                      </div>
                    );
                  } else if (el.type === 'text') {
                    const canvasScaleFactor = Math.max(canvasSize.width, canvasSize.height) / 800;
                    const computedStrokeWidth = (el.strokeWidth || 0) * canvasScaleFactor * zoomLevel;
                    const computedShadowBlur = (el.shadowBlur || 0) * canvasScaleFactor * zoomLevel;
                    const computedShadowX = (el.shadowX || 0) * canvasScaleFactor * zoomLevel;
                    const computedShadowY = (el.shadowY || 0) * canvasScaleFactor * zoomLevel;

                    const textStyle = {
                      color: el.fill, fontSize: `${el.fontSize * zoomLevel}px`, fontFamily: el.fontFamily, 
                      lineHeight: el.lineHeight || 1.2, letterSpacing: `${(el.letterSpacing || 0) * zoomLevel}px`,
                      textAlign: el.textAlign || 'left', writingMode: el.vertical ? 'vertical-rl' : 'horizontal-tb', 
                      textOrientation: el.vertical ? 'upright' : 'mixed', whiteSpace: 'pre-wrap', overflow: 'hidden'
                    };
                    
                    if (computedStrokeWidth > 0 && el.strokeColor) {
                      textStyle.WebkitTextStroke = `${computedStrokeWidth}px ${el.strokeColor}`;
                      if (!el.strokePosition || el.strokePosition === 'outside') textStyle.paintOrder = 'stroke fill';
                    }
                    if (el.shadowColor && (el.shadowBlur !== undefined || el.shadowX !== undefined || el.shadowY !== undefined) && el.shadowColor !== '') {
                      textStyle.textShadow = `${computedShadowX}px ${computedShadowY}px ${computedShadowBlur}px ${el.shadowColor}`;
                    }

                    const isEditing = editingTextId === el.id;

                    elementContent = (
                      <React.Fragment key={el.id}>
                        <div 
                          style={baseStyle} 
                          onPointerDown={(e) => {
                            if (isEditing) {
                              e.stopPropagation(); // Allow selecting text while typing
                            } else {
                              handlePointerDown(e, el.id, 'move');
                            }
                          }}
                          onDoubleClick={() => {
                            if (el.locked || el.isTemplate || activeTool === 'draw') return;
                            setEditingTextId(el.id);
                          }}
                          title={isEditing ? "" : "Double-click to edit text"}
                        >
                          {isEditing ? (
                            <textarea
                              autoFocus
                              value={el.text}
                              onChange={(e) => updateElements([el.id], { text: e.target.value })}
                              onBlur={() => setEditingTextId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setEditingTextId(null);
                                e.stopPropagation();
                              }}
                              style={{
                                ...textStyle,
                                ...contentWrapperStyle,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                width: '100%',
                                height: '100%',
                                padding: 0,
                                margin: 0,
                                WebkitTextStroke: 'none', // Removed while typing for visual clarity
                                textShadow: 'none', // Removed while typing for visual clarity
                                overflow: 'hidden'
                              }}
                            />
                          ) : (
                            <div style={{...textStyle, ...contentWrapperStyle}}>
                              {el.listType === 'number' ? (
                                <ol style={{ margin: 0, paddingLeft: '1.2em', listStyleType: 'decimal' }}>
                                  {el.text.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                                </ol>
                              ) : el.listType === 'bullet' ? (
                                <ul style={{ margin: 0, paddingLeft: '1.2em', listStyleType: 'disc' }}>
                                  {el.text.split('\n').map((line, i) => <li key={i}>{line}</li>)}
                                </ul>
                              ) : ( el.text )}
                            </div>
                          )}
                        </div>
                        
                        {isOutOfBounds && !el.locked && !el.isTemplate && !isExporting && (
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: Math.max(10, Math.min((el.x + el.width) * zoomLevel - 15, canvasSize.width * zoomLevel - 30)), 
                              top: Math.max(10, Math.min(el.y * zoomLevel - 15, canvasSize.height * zoomLevel - 30)), 
                              zIndex: 9999 
                            }} 
                            className="group pointer-events-auto cursor-help"
                            onPointerDown={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === el.id ? null : el.id); }}
                          >
                            <AlertTriangle size={20} className="text-red-500 bg-white rounded-full p-0.5 shadow-md border border-red-200" />
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg transition-opacity pointer-events-none text-center ${activeTooltip === el.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              The text is outside of the design canvas and will be cut during printing.
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  } else if (el.type === 'image') {
                    const isLowRes = el.origImgWidth && (el.origImgWidth / (el.width / PPI)) < 100;

                    elementContent = (
                      <React.Fragment key={el.id}>
                        <div style={baseStyle} onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}>
                          <img 
                            src={el.src} alt={el.name} 
                            style={{ 
                              ...contentWrapperStyle, objectFit: el.isTemplate ? 'fill' : 'cover', pointerEvents: 'none',
                              clipPath: (el.cropT || el.cropR || el.cropB || el.cropL) ? `inset(${el.cropT || 0}% ${el.cropR || 0}% ${el.cropB || 0}% ${el.cropL || 0}%)` : 'none'
                            }} draggable={false} 
                          />
                        </div>

                        {isLowRes && !el.locked && !el.isTemplate && !isExporting && (
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: (el.x + el.width / 2) * zoomLevel, 
                              top: (el.y + el.height / 2) * zoomLevel, 
                              transform: 'translate(-50%, -50%)',
                              zIndex: 9999 
                            }} 
                            className="group pointer-events-auto cursor-help"
                            onPointerDown={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === el.id ? null : el.id); }}
                          >
                            <div className="bg-white rounded-full p-1.5 shadow-lg border-2 border-red-500 flex items-center justify-center">
                              <AlertTriangle size={24} className="text-red-600" />
                            </div>
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] font-medium rounded shadow-lg transition-opacity pointer-events-none text-center ${activeTooltip === el.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              Your image has low resolution and might look blurry when printed.
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  } else if (el.type === 'drawing') {
                    elementContent = (
                      <div key={el.id} style={baseStyle} onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}>
                        <div style={contentWrapperStyle}>
                          <svg viewBox={`0 0 ${el.origWidth || el.width} ${el.origHeight || el.height}`} preserveAspectRatio="none" style={{width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
                            <polyline points={el.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={el.stroke} strokeWidth={el.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    );
                  } else if (el.type === 'pattern') {
                    const baseSize = el.patternSize || 150;
                    const scaledPatternSize = baseSize * (el.patternScale || 1) * zoomLevel;
                    elementContent = (
                      <div key={el.id} style={baseStyle} onPointerDown={(e) => handlePointerDown(e, el.id, 'move')}>
                        <div style={{ ...contentWrapperStyle, backgroundImage: `url("${el.src}")`, backgroundRepeat: 'repeat', backgroundSize: `${scaledPatternSize}px ${scaledPatternSize}px` }} />
                      </div>
                    );
                  }
                  return elementContent;
                })}

                {/* Real-time Drawing Overlay */}
                {dragAction?.type === 'drawing' && dragAction.points?.length > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
                    <svg viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} style={{width: '100%', height: '100%', overflow: 'visible'}}>
                      <polyline
                        points={dragAction.points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={drawSettings.color}
                        strokeWidth={drawSettings.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={drawSettings.opacity}
                      />
                    </svg>
                  </div>
                )}
              </div> {/* End of #design-artboard. Canvas clipping happens here! */}

              {/* OVERLAY: Selection Handles & Marquee (Moved OUTSIDE #design-artboard) 
                  This ensures bounding boxes and handles are fully visible and 
                  interactive even when the element's actual shape is clipped out-of-bounds. */}
              {!isExporting && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 9999 }}>
                  
                  {elements.map((el) => {
                    if (el.hidden || el.isTemplate || el.locked) return null;
                    const isSelected = selectedIds.includes(el.id) && activeTool !== 'draw';
                    if (!isSelected) return null;

                    const isMobileUI = typeof window !== 'undefined' && window.innerWidth < 768;
                    const grabThickness = isMobileUI ? 28 : 12;
                    const grabOffset = -grabThickness / 2;
                    const handleSize = isMobileUI ? 22 : 10;

                    return (
                      <div key={`overlay-${el.id}`} style={{
                        position: 'absolute', left: el.x * zoomLevel, top: el.y * zoomLevel,
                        width: el.width * zoomLevel, height: el.height * zoomLevel,
                        transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: 'center center',
                        outline: '2px solid #3b82f6',
                        pointerEvents: 'none'
                      }}>
                        {selectedIds.length === 1 && (
                          <>
                            {/* Invisible Clickable Frame: Allows users to drag elements back onto the canvas by clicking the blue outline */}
                            <div onPointerDown={(e) => handlePointerDown(e, el.id, 'move')} style={{ position: 'absolute', top: grabOffset, left: grabOffset, right: grabOffset, height: grabThickness, cursor: 'move', pointerEvents: 'auto' }} title="Drag outline to move" />
                            <div onPointerDown={(e) => handlePointerDown(e, el.id, 'move')} style={{ position: 'absolute', bottom: grabOffset, left: grabOffset, right: grabOffset, height: grabThickness, cursor: 'move', pointerEvents: 'auto' }} title="Drag outline to move" />
                            <div onPointerDown={(e) => handlePointerDown(e, el.id, 'move')} style={{ position: 'absolute', top: grabOffset, bottom: grabOffset, left: grabOffset, width: grabThickness, cursor: 'move', pointerEvents: 'auto' }} title="Drag outline to move" />
                            <div onPointerDown={(e) => handlePointerDown(e, el.id, 'move')} style={{ position: 'absolute', top: grabOffset, bottom: grabOffset, right: grabOffset, width: grabThickness, cursor: 'move', pointerEvents: 'auto' }} title="Drag outline to move" />

                            {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(pos => {
                              const style = {
                                position: 'absolute', width: handleSize, height: handleSize, backgroundColor: '#fff',
                                border: '2px solid #3b82f6', borderRadius: pos.length === 1 ? '0%' : '50%', cursor: `${pos}-resize`, zIndex: 20,
                                pointerEvents: 'auto'
                              };
                              if (pos.includes('n')) style.top = -handleSize / 2;
                              if (pos.includes('s')) style.bottom = -handleSize / 2;
                              if (!pos.includes('n') && !pos.includes('s')) { style.top = '50%'; style.marginTop = -handleSize / 2; }
                              if (pos.includes('w')) style.left = -handleSize / 2;
                              if (pos.includes('e')) style.right = -handleSize / 2;
                              if (!pos.includes('w') && !pos.includes('e')) { style.left = '50%'; style.marginLeft = -handleSize / 2; }
                              return <div key={pos} onPointerDown={(e) => handlePointerDown(e, el.id, 'resize', pos)} style={style} />;
                            })}
                            
                            {/* Rotate Handle Connection Line */}
                            <div style={{ position: 'absolute', top: isMobileUI ? -40 : -23, left: '50%', marginLeft: -0.5, width: 1, height: isMobileUI ? 40 : 23, backgroundColor: '#3b82f6', pointerEvents: 'none', zIndex: 19 }} />
                            
                            {/* Rotate Handle */}
                            <div
                              onPointerDown={(e) => handlePointerDown(e, el.id, 'rotate')}
                              style={{ 
                                position: 'absolute', top: isMobileUI ? -64 : -35, left: '50%', marginLeft: isMobileUI ? -16 : -12, 
                                width: isMobileUI ? 32 : 24, height: isMobileUI ? 32 : 24, backgroundColor: '#ffffff', border: '2px solid #3b82f6', 
                                borderRadius: '50%', cursor: 'grab', zIndex: 20, pointerEvents: 'auto', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                boxShadow: '0 2px 4px rgba(0,0,0,0.15)', color: '#3b82f6' 
                              }}
                            >
                              <RotateCw size={isMobileUI ? 18 : 14} strokeWidth={2.5} />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {selectionBox && (
                    <div style={{
                        position: 'absolute', border: '1px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        left: Math.min(selectionBox.startX, selectionBox.endX) * zoomLevel, top: Math.min(selectionBox.startY, selectionBox.endY) * zoomLevel,
                        width: Math.abs(selectionBox.endX - selectionBox.startX) * zoomLevel, height: Math.abs(selectionBox.endY - selectionBox.startY) * zoomLevel,
                        pointerEvents: 'none'
                    }} />
                  )}
                </div>
              )}

            </div> {/* End of scaling wrapper */}
          </div> {/* End of panOffset wrapper */}
        </div> {/* End of viewport container */}
      </main>

      {/* RIGHT SIDEBAR: Layers */}
      <aside className={`fixed md:relative inset-y-0 right-0 w-[85vw] max-w-[300px] md:w-64 bg-white border-l border-slate-200 flex flex-col shadow-2xl md:shadow-sm z-50 transform transition-transform duration-300 ease-in-out ${isMobileLayersOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="text-slate-500" size={16} />
            <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Layers</h2>
          </div>
          <button className="md:hidden p-1.5 text-slate-400 bg-white rounded-md border shadow-sm" onClick={() => setIsMobileLayersOpen(false)}><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {[...elements].reverse().filter(el => !el.isTemplate).map((el) => (
            <div 
              key={el.id} draggable={true} onDragStart={(e) => handleLayerDragStart(e, el.id)} onDragOver={(e) => handleLayerDragOver(e, el.id)} onDragEnd={handleLayerDragEnd} 
              onClick={(e) => { 
                if (!el.locked && activeTool !== 'draw') {
                  if (e.shiftKey) setSelectedIds(prev => prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]);
                  else setSelectedIds([el.id]); 
                }
                if(window.innerWidth < 768) setIsMobileLayersOpen(false); 
              }}
              className={`flex flex-col gap-2 p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${selectedIds.includes(el.id) ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'} ${el.locked ? 'opacity-70 bg-slate-50 border-dashed' : ''}`}
            >
              <div className="flex items-center gap-2 overflow-hidden px-1">
                {el.type === 'image' ? <ImageIcon size={14} className="text-slate-400 shrink-0" /> : el.type === 'text' ? <Type size={14} className="text-slate-400 shrink-0" /> : el.type === 'qr' ? <QrCode size={14} className="text-slate-400 shrink-0" /> : el.type === 'drawing' ? <Pencil size={14} className="text-slate-400 shrink-0" /> : el.type === 'pattern' ? <LayoutGrid size={14} className="text-slate-400 shrink-0" /> : <Square size={14} className="text-slate-400 shrink-0" />}
                <span className="text-[11px] font-medium truncate cursor-default select-none text-slate-700">{el.name}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-100/50 p-1 rounded border border-slate-200/50">
                <button onClick={(e) => { e.stopPropagation(); toggleLayerProperty(el.id, 'hidden'); }} className={`p-1.5 rounded transition-colors ${el.hidden ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:bg-blue-100'}`}>
                  {el.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerProperty(el.id, 'locked'); if (!el.locked && selectedIds.includes(el.id)) setSelectedIds(selectedIds.filter(id => id !== el.id)); }} className={`p-1.5 rounded transition-colors ${el.locked ? 'text-orange-500 hover:bg-orange-50' : 'text-slate-400 hover:bg-white'}`}>
                    {el.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateElement(el.id); }} className="p-1.5 rounded transition-colors text-slate-400 hover:text-emerald-600 hover:bg-white" title="Duplicate Layer">
                    <Copy size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setElements(elements.filter(current => current.id !== el.id)); setSelectedIds(selectedIds.filter(id => id !== el.id)); }} className="p-1.5 rounded transition-colors text-slate-400 hover:text-red-600 hover:bg-white">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {elements.filter(el => !el.isTemplate).length === 0 && (
            <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg mt-4">
              <Layers className="mx-auto text-slate-300 mb-2" size={20} />
              <p className="text-[10px] text-slate-400 font-medium">Your layers will appear here</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Footer */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-14 bg-white border-t border-slate-200 flex items-center justify-around z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-safe">
        <button onClick={() => {setIsMobileToolsOpen(!isMobileToolsOpen); setIsMobileLayersOpen(false);}} className={`flex flex-col items-center p-2 w-20 rounded-lg transition-colors ${isMobileToolsOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Palette size={20} />
          <span className="text-[9px] mt-1 font-bold tracking-wider uppercase">Tools</span>
        </button>
        <button onClick={() => {setIsMobileLayersOpen(!isMobileLayersOpen); setIsMobileToolsOpen(false);}} className={`flex flex-col items-center p-2 w-20 rounded-lg transition-colors ${isMobileLayersOpen ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Layers size={20} />
          <span className="text-[9px] mt-1 font-bold tracking-wider uppercase">Layers</span>
        </button>
      </div>

    </div>
  );
}
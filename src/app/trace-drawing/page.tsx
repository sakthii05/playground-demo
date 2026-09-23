"use client";
// Note: The assets are stored in the `/public/image/trace-images/` directory.
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import html2canvas from "html2canvas-pro";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LuRedo, LuUndo } from "react-icons/lu";
import { MdOutlineFiberNew } from "react-icons/md";
import { FiDownload, FiUpload } from "react-icons/fi";
import { HiMiniMinus, HiMiniPlus } from "react-icons/hi2";
import Image from "next/image";
import { IoMdImages } from "react-icons/io";

interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DefaultImage {
  id: string;
  src: string;
  label: string;
}

const DEFAULT_IMAGES = [
  "/image/trace-images/1.webp",
  "/image/trace-images/2.webp",
  "/image/trace-images/3.webp",
];

const HANDLE_SIZE = 40;
const MIN_STROKE = 1;
const MAX_STROKE = 20;
const DEFAULT_STROKE = 2;
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB

const smoothPoint = (
  prev: Point,
  current: Point,
  smoothingFactor = 0.35,
): Point => ({
  x: prev.x + (current.x - prev.x) * smoothingFactor,
  y: prev.y + (current.y - prev.y) * smoothingFactor,
  pressure: current.pressure,
  timestamp: current.timestamp,
});

const PaperTrace = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceContainerRef = useRef<HTMLDivElement>(null);
  const paperContainerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragArea, setIsDragArea] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnappedOnTarget, setIsSnappedOnTarget] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Drawing state
  const [selectedColor, setSelectedColor] = useState("#111827");
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE);
  const [history, setHistory] = useState<Stroke[]>([]);
  const [redoHistory, setRedoHistory] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const historyRef = useRef<Stroke[]>([]);
  const lastSmoothedPointRef = useRef<Point | null>(null);
  // Image state
  const [traceImage, setTraceImage] = useState<string>(DEFAULT_IMAGES[2]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Draw a single smooth stroke
  const drawSmoothStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      const { points, color, width } = stroke;
      if (points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.min(width * 0.4, 3);

      ctx.beginPath();

      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
        return;
      }

      if (points.length === 2) {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      const last = points[points.length - 1];
      const secondLast = points[points.length - 2];
      ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);

      ctx.stroke();
      ctx.restore();
    },
    [],
  );

  const redrawCanvas = useCallback(
    (strokesList: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokesList.forEach((stroke) => drawSmoothStroke(ctx, stroke));
    },
    [drawSmoothStroke],
  );

  useEffect(() => {
    const initCanvas = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        redrawCanvas(historyRef.current);
      }
    };
    initCanvas();
    window.addEventListener("resize", initCanvas);
    return () => window.removeEventListener("resize", initCanvas);
  }, [redrawCanvas]);

  // Drawing handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure,
      timestamp: Date.now(),
    };

    setIsDrawing(true);
    currentStrokeRef.current = [point];
    lastSmoothedPointRef.current = point;

    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.save();
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = selectedColor;
      ctx.shadowBlur = Math.min(strokeWidth * 0.4, 3);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.restore();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastSmoothedPointRef.current = null;
    canvasRef.current?.getContext("2d")?.beginPath();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();

    const rawPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure,
      timestamp: Date.now(),
    };

    const prev = lastSmoothedPointRef.current || rawPoint;
    const smoothed = smoothPoint(prev, rawPoint, 0.35);
    lastSmoothedPointRef.current = smoothed;
    currentStrokeRef.current.push(smoothed);

    const pts = currentStrokeRef.current;
    const len = pts.length;

    ctx.save();
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = selectedColor;
    ctx.shadowBlur = Math.min(strokeWidth * 0.4, 3);

    if (len >= 3) {
      const p0 = pts[len - 3];
      const p1 = pts[len - 2];
      const p2 = pts[len - 1];

      const mid1X = (p0.x + p1.x) / 2;
      const mid1Y = (p0.y + p1.y) / 2;
      const mid2X = (p1.x + p2.x) / 2;
      const mid2Y = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(mid1X, mid1Y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
      ctx.stroke();
    } else if (len === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const dragControls = useDragControls();

  const isOnDragHandle = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    return (
      x <= HANDLE_SIZE ||
      x >= width - HANDLE_SIZE ||
      y <= HANDLE_SIZE ||
      y >= height - HANDLE_SIZE
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = e.currentTarget;

    if (isOnDragHandle(e)) {
      canvas.releasePointerCapture?.(e.pointerId);
      setIsDrawing(false);
      activePointerIdRef.current = null;
      setIsDragArea(true);
      dragControls.start(e);
      return;
    }

    activePointerIdRef.current = e.pointerId;
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId);
    setIsDragArea(false);
    startDrawing(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    checkOverlapAndSnap();
    if (!isDrawing) {
      setIsDragArea(isOnDragHandle(e));
      return;
    }
    draw(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    requestAnimationFrame(() => {
      checkOverlapAndSnap();
    });

    if (activePointerIdRef.current === e.pointerId) {
      setIsDrawing(false);
      activePointerIdRef.current = null;

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (currentStrokeRef.current.length > 0) {
        const newStroke: Stroke = {
          points: [...currentStrokeRef.current],
          color: selectedColor,
          width: strokeWidth,
        };
        const newHistory = [...history, newStroke];
        setHistory(newHistory);
        setRedoHistory([]);
        currentStrokeRef.current = [];
        redrawCanvas(newHistory);
      }

      stopDrawing();
    }
  };

  const xVal = useMotionValue(150);
  const yVal = useMotionValue(10);

  const executeSnapToTarget = () => {
    if (!paperContainerRef.current || !traceContainerRef.current) return;
    const paper = paperContainerRef.current.getBoundingClientRect();
    const target = traceContainerRef.current.getBoundingClientRect();
    const dx = target.left - paper.left;
    const dy = target.top - paper.top;

    animate(xVal, xVal.get() + dx, {
      type: "spring",
      stiffness: 500,
      damping: 35,
    });
    animate(yVal, yVal.get() + dy, {
      type: "spring",
      stiffness: 500,
      damping: 35,
    });
    setIsSnappedOnTarget(true);
  };

  const checkOverlapAndSnap = () => {
    if (!paperContainerRef.current || !traceContainerRef.current) return;
    const r1 = paperContainerRef.current.getBoundingClientRect();
    const r2 = traceContainerRef.current.getBoundingClientRect();
    const overlapW = Math.max(
      0,
      Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left),
    );
    const overlapH = Math.max(
      0,
      Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top),
    );
    const overlapArea = overlapW * overlapH;
    const targetArea = r2.width * r2.height;

    if (targetArea > 0 && overlapArea / targetArea >= 0.85 && !isDragging) {
      executeSnapToTarget();
    } else {
      setIsSnappedOnTarget(false);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    const lastStroke = history[history.length - 1];
    setHistory(newHistory);
    setRedoHistory((prev) => [lastStroke, ...prev]);
    redrawCanvas(newHistory);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const strokeToRestore = redoHistory[0];
    const newRedoHistory = redoHistory.slice(1);
    const newHistory = [...history, strokeToRestore];
    setHistory(newHistory);
    setRedoHistory(newRedoHistory);
    redrawCanvas(newHistory);
  };

  const handleNewPaper = () => {
    setHistory([]);
    setRedoHistory([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadError("File size must be under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setTraceImage(result);
      handleNewPaper();
    };
    reader.onerror = () => {
      setUploadError("Failed to read file. Please try again.");
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  // Export
  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const exportCanvas = await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `paper-trace-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const ToolBarBtn = (props: {
    label: ReactNode;
    onBtnClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    title?: string;
    active?: boolean;
  }) => {
    const { label, onBtnClick, disabled, title, active } = props;
    return (
      <button
        onClick={onBtnClick}
        disabled={disabled}
        title={title}
        className={`px-2 py-1 text-xs rounded-lg ${
          disabled
            ? "cursor-not-allowed opacity-30"
            : "cursor-pointer active:translate-y-0.5"
        } ${
          active ? "ring-2 ring-indigo-500 bg-indigo-50 " : "bg-black/5"
        } inset-shadow-sm inset-shadow-black/20 transition-all duration-75`}
      >
        {label}
      </button>
    );
  };

  const Toolbar = () => {
    return (
      <div className="w-full flex flex-wrap gap-3 justify-center md:justify-between items-center px-2 ">
        <div className="flex gap-2 items-center">
          <ToolBarBtn
            label="Lay the Paper"
            onBtnClick={() => executeSnapToTarget()}
            disabled={isSnappedOnTarget}
            title="Snap paper to target"
          />
          <ToolBarBtn
            label={<IoMdImages className="size-5" />}
            onBtnClick={() => {
              setUploadError(null);
              setTraceImage((current) => {
                const index = DEFAULT_IMAGES.indexOf(current);
                return DEFAULT_IMAGES[(index + 1) % DEFAULT_IMAGES.length];
              });
            }}
            title="Change Image"
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <ToolBarBtn
            label={<FiUpload className="size-4" />}
            onBtnClick={() => fileInputRef.current?.click()}
            title="Upload Image"
          />
        </div>

        <div className="flex gap-3 items-center">
          {/* Color Picker */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/5 border border-neutral-200  shadow-inner">
            <div className="relative">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Pick stroke color"
              />
              <div
                className="size-6 rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: selectedColor }}
              />
            </div>
          </div>

          {/* Stroke Width Control */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5  border border-neutral-200  shadow-inner">
            <button
              onClick={() => setStrokeWidth((w) => Math.max(MIN_STROKE, w - 1))}
              disabled={strokeWidth <= MIN_STROKE}
              className={`p-0.5 rounded transition-all ${
                strokeWidth <= MIN_STROKE
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:bg-neutral-200  active:scale-90"
              }`}
              title="Decrease stroke width"
            >
              <HiMiniMinus className="size-3" />
            </button>

            <input
              type="range"
              min={MIN_STROKE}
              max={MAX_STROKE}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-5 sm:w-10 h-1 accent-indigo-500 cursor-pointer"
              title={`Stroke width: ${strokeWidth}px`}
            />

            <button
              onClick={() => setStrokeWidth((w) => Math.min(MAX_STROKE, w + 1))}
              disabled={strokeWidth >= MAX_STROKE}
              className={`p-0.5 rounded transition-all ${
                strokeWidth >= MAX_STROKE
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:bg-neutral-200 active:scale-90"
              }`}
              title="Increase stroke width"
            >
              <HiMiniPlus className="size-3" />
            </button>

            <span className="text-[10px] font-mono text-neutral-500 w-5 text-center">
              {strokeWidth}
            </span>
          </div>

          <ToolBarBtn
            label={<LuUndo className="size-5" />}
            onBtnClick={() => handleUndo()}
            disabled={history.length === 0}
            title="Undo"
          />
          <ToolBarBtn
            label={<LuRedo className="size-5" />}
            onBtnClick={() => handleRedo()}
            disabled={redoHistory.length === 0}
            title="Redo"
          />
          <ToolBarBtn
            label={<MdOutlineFiberNew className="size-5" />}
            onBtnClick={() => handleNewPaper()}
            title="New Paper"
          />
          <ToolBarBtn
            label={
              isExporting ? (
                <span className="size-5 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <FiDownload className="size-5" />
              )
            }
            onBtnClick={() => handleExport()}
            disabled={isExporting || history.length === 0}
            title="Export as PNG"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-5 h-dvh overflow-hidden">
      <h2 className="text-center font-semibold text-3xl font-mono  md:pb-5">
        Trace Drawing
      </h2>
      <p className="text-neutral-400 text-sm">
        Note: Grab the Edges to Move the paper
      </p>
      {/* Toolbar */}
      <div className="block">
        <Toolbar />
      </div>
      {/* <div className="absolute bottom-0 z-50 p-3 bg-white shadow-lg w-full md:hidden">
        <Toolbar />
      </div> */}
      {uploadError && (
        <p className="my-5 text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
          {uploadError}
        </p>
      )}

      {/* Main drawing area */}
      <div className="relative ">
        {/* Trace target with image */}
        <div ref={traceContainerRef} className="relative w-fit h-fit">
          <Image
            src={traceImage}
            alt="trace-image"
            width={550}
            height={450}
            loading="eager"
            className="h-auto"
            unoptimized={traceImage.startsWith("data:")}
          />
          {/* Draggable paper with canvas */}
          <motion.div
            ref={paperContainerRef}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            style={{ x: xVal, y: yVal }}
            className={`absolute inset-0 z-10 ${
              isDragging && "shadow-lg"
            } bg-gray-100/50 border border-neutral-200`}
          >
            <div className="pointer-events-none absolute transition-all duration-75 left-0 top-0 z-20 h-5 w-full border-t-2 border-transparent px-2 py-1 text-sm font-prime font-medium">
              Paper - {isSnappedOnTarget ? "Ready To Trace" : "Loose"}
            </div>
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 block w-full h-full rounded-sm shadow-inner touch-none ${
                isDragArea
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-crosshair"
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </motion.div>
        </div>
      </div>

      {/* Export capture zone (hidden off-screen) */}
      <div
        ref={exportRef}
        className="fixed left-[-9999px] top-0 bg-white"
        style={{ width: 600 }}
      >
        <div className="p-5 flex justify-center items-center">
          {/* Canvas snapshot */}
          <ExportCanvasSnapshot
            history={history}
            drawSmoothStroke={drawSmoothStroke}
            canvasRef={canvasRef}
          />
        </div>

        {/* section below canvas */}
        <div className="px-6 pb-5 border-neutral-200 font-prime">
          <p className="text-base font-semibold text-neutral-800 mb-1">
            Paper Trace Drawing
          </p>
          <p className="text-sm text-neutral-600 whitespace-pre-wrap">
            To create visit https://playground-demo-dun.vercel.app/trace-drawing
          </p>
          <div className="mt-3 text-SM text-neutral-500 pt-2 border-t border-neutral-100 flex justify-between items-center">
            <span>
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span>Paper Trace</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Static canvas clone for export
const ExportCanvasSnapshot = ({
  history,
  drawSmoothStroke,
  canvasRef,
}: {
  history: Stroke[];
  drawSmoothStroke: (ctx: CanvasRenderingContext2D, stroke: Stroke) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) => {
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sourceCanvas = canvasRef.current;
    const exportCanvas = exportCanvasRef.current;
    if (!sourceCanvas || !exportCanvas) return;

    const sourceRect = sourceCanvas.getBoundingClientRect();
    const exportWidth = 600;
    const aspectRatio = sourceRect.height / sourceRect.width;
    const exportHeight = exportWidth * aspectRatio;

    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    // Scale strokes to fit export dimensions
    const scaleX = exportWidth / sourceCanvas.width;
    const scaleY = exportHeight / sourceCanvas.height;

    history.forEach((stroke) => {
      const scaledStroke: Stroke = {
        color: stroke.color,
        width: stroke.width * ((scaleX + scaleY) / 2),
        points: stroke.points.map((p) => ({
          ...p,
          x: p.x * scaleX,
          y: p.y * scaleY,
        })),
      };
      drawSmoothStroke(ctx, scaledStroke);
    });
  }, [history, drawSmoothStroke, canvasRef]);

  return (
    <canvas
      ref={exportCanvasRef}
      style={{ width: 550, display: "block" }}
      className="border border-neutral-400"
    />
  );
};

export default PaperTrace;


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Video, 
  Camera, 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  StepForward, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  Activity,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { FrameDetection, SampleVideoInfoResponse } from '../../types/api';
import { triggerSingleBeep, playTactileClick } from '../../utils/audio';

export const LivePerceptionSentinel: React.FC = () => {
  const [sourceMode, setSourceMode] = useState<'sample' | 'webcam' | 'upload'>('sample');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.55);
  
  // Sample Video Stream State
  const [sampleInfo, setSampleInfo] = useState<SampleVideoInfoResponse | null>(null);
  const [currentFrameImg, setCurrentFrameImg] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [currentDetections, setCurrentDetections] = useState<FrameDetection[]>([]);
  const [isBreached, setIsBreached] = useState<boolean>(false);
  const [inferenceLatency, setInferenceLatency] = useState<number>(13.5);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  // Webcam Stream Refs
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const webcamIntervalRef = useRef<any>(null);

  // Fetch Sample Video Information on Mount
  useEffect(() => {
    api.getSampleVideoInfo()
      .then(info => {
        setSampleInfo(info);
        setTotalFrames(info.total_frames);
      })
      .catch(err => console.warn('Sample video info fetch error:', err));
  }, []);

  // Step Sample Video Frame
  const stepVideo = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await api.stepSampleVideo();
      setCurrentFrameImg(res.image_data);
      setFrameIndex(res.frame_index);
      setTotalFrames(res.total_frames);
      setCurrentDetections(res.detections);
      setIsBreached(res.is_breach);
      setInferenceLatency(res.latency_ms);

      if (res.is_breach) {
        triggerSingleBeep(2400, 100);
      }
    } catch (err) {
      console.error('Step video error:', err);
      setIsPlaying(false);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  // Sample Video Playback Loop
  useEffect(() => {
    let timer: any = null;
    if (sourceMode === 'sample' && isPlaying) {
      timer = setInterval(() => {
        stepVideo();
      }, 100); // 10 FPS streaming
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sourceMode, isPlaying, stepVideo]);

  // Reset Sample Video
  const handleResetVideo = async () => {
    setIsPlaying(false);
    try {
      await api.resetSampleVideo();
      setFrameIndex(0);
      setIsBreached(false);
      setCurrentDetections([]);
      // Step once to load first frame
      stepVideo();
    } catch (err) {
      console.error('Reset video error:', err);
    }
  };

  // Webcam Lifecycle Management
  useEffect(() => {
    if (sourceMode !== 'webcam') {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
        webcamStreamRef.current = null;
      }
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current);
        webcamIntervalRef.current = null;
      }
      return;
    }

    // Start Webcam
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play();
        }

        // Periodic Frame Inference (~5 FPS)
        webcamIntervalRef.current = setInterval(async () => {
          if (!webcamVideoRef.current || !webcamCanvasRef.current) return;
          const video = webcamVideoRef.current;
          const canvas = webcamCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx || video.videoWidth === 0) return;

          canvas.width = 640;
          canvas.height = 480;
          ctx.drawImage(video, 0, 0, 640, 480);

          try {
            const base64Data = canvas.toDataURL('image/jpeg', 0.7);
            const res = await api.inferFrame(base64Data, 'webcam', confidenceThreshold);
            setCurrentDetections(res.detections);
            setInferenceLatency(res.latency_ms);
            const breachFound = res.detections.some(d => d.inside_zone);
            setIsBreached(breachFound);
            if (breachFound) {
              triggerSingleBeep(2400, 100);
            }
          } catch (err) {
            console.warn('Webcam infer frame error:', err);
          }
        }, 200);
      })
      .catch(err => {
        console.error('Webcam access error:', err);
      });

    return () => {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current);
      }
    };
  }, [sourceMode, confidenceThreshold]);

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    try {
      await api.uploadVideo(file);
      setSourceMode('upload');
    } catch (err) {
      console.error('Upload video error:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-4">
      
      {/* Top Header & Feed Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-400" />
            Live AI Vision Sentinel (PipeGen YOLOv8 Perception)
          </h2>
          <p className="text-xs text-slate-400">
            Real-time inference using pre-trained YOLOv8n foundation model with foot-point ground contact tracking.
          </p>
        </div>

        {/* Source Toggle Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => {
              setIsPlaying(false);
              setSourceMode('sample');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceMode === 'sample' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Factory CCTV Clip</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setSourceMode('webcam');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceMode === 'webcam' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Laptop Webcam</span>
          </button>

          <label className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            sourceMode === 'upload' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}>
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadFileName ? uploadFileName.slice(0, 10) + '...' : 'Upload Video'}</span>
            <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative w-full aspect-video max-h-[520px] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        
        {/* Sample Video Mode: Renders real annotated frame from OpenCV / YOLO */}
        {sourceMode === 'sample' && (
          currentFrameImg ? (
            <img 
              src={currentFrameImg} 
              alt="Live Annotated CCTV Feed" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center p-8 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <Video className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-white">Sample Factory CCTV Video Ready</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Contains industrial stamping and robotic arm work cell with operator foot incursion.
              </p>
              <button
                onClick={stepVideo}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30"
              >
                Start AI Analysis
              </button>
            </div>
          )
        )}

        {/* Webcam Mode */}
        {sourceMode === 'webcam' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={webcamVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-contain"
            />
            {/* Hidden canvas for taking snapshot */}
            <canvas ref={webcamCanvasRef} className="hidden" />

            {/* Incursion Warning Text Overlay */}
            {isBreached && (
              <div className="absolute top-4 inset-x-4 bg-red-600/90 text-white font-bold text-center py-2 rounded-lg text-sm tracking-wider uppercase shadow-xl animate-pulse">
                EMERGENCY: EXCLUSION ZONE BREACH DETECTED!
              </div>
            )}
          </div>
        )}

        {/* Upload Video Mode */}
        {sourceMode === 'upload' && (
          <div className="text-center p-8 space-y-3">
            <div className="text-sm font-bold text-white">Custom Video Uploaded: {uploadFileName}</div>
            <p className="text-xs text-slate-400">
              Video stored in data/uploads/ and queued for PipeGen edge ingestion.
            </p>
          </div>
        )}

        {/* CCTV Camera On-Screen Display (OSD) Overlay */}
        <div className="absolute top-2.5 left-3 font-mono text-[10px] text-emerald-400 bg-black/75 px-2.5 py-1 rounded border border-emerald-900/60 shadow-sm flex items-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-bold text-white">CAM-01 [CELL_02_PRESS_SHOP]</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-300">● REC 30.0 FPS</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">YOLOv8n-TRT ({inferenceLatency}ms)</span>
        </div>

        {/* Top-Right OSD Timestamp & Status */}
        <div className="absolute top-2.5 right-3 font-mono text-[10px] bg-black/75 px-2.5 py-1 rounded border border-slate-800 shadow-sm flex items-center gap-2 select-none">
          <span className="text-slate-400">FRAME {frameIndex} / {totalFrames}</span>
          <span className="text-slate-600">|</span>
          <span className={isBreached ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
            {isBreached ? '🚨 EXCLUSION BREACH' : 'ENVELOPE SECURE'}
          </span>
        </div>

        {/* Bottom Playback Controls Bar */}
        {sourceMode === 'sample' && (
          <div className="absolute bottom-2.5 inset-x-3 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-950/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  playTactileClick();
                  setIsPlaying(!isPlaying);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs ${
                  isPlaying 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Feed'}</span>
              </button>

              <button
                onClick={() => {
                  playTactileClick();
                  stepVideo();
                }}
                disabled={isPlaying || isProcessing}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 flex items-center gap-1 transition-colors border border-slate-700 text-xs"
              >
                <StepForward className="w-3.5 h-3.5" />
                <span>Step</span>
              </button>

              <button
                onClick={() => {
                  playTactileClick();
                  handleResetVideo();
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Rewind to Frame 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Frame Scrubber */}
              <div className="flex items-center gap-2 flex-1 sm:w-48 ml-2">
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, totalFrames)}
                  value={frameIndex}
                  onChange={(e) => {
                    // Visual scrubbing slider
                  }}
                  className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
              <span>Detections: <strong className="text-white">{currentDetections.length}</strong></span>
              <span>•</span>
              <span>Persistence: <strong className="text-cyan-400">&ge;3 Frames</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Detection Target Inspector Table */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            Live Frame Target Detections (YOLOv8 Edge Perception Egress)
          </span>
          <span>Inference: {inferenceLatency}ms</span>
        </div>

        {currentDetections.length > 0 ? (
          <div className="divide-y divide-slate-800/60">
            {currentDetections.map((det, idx) => (
              <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">#{idx + 1} PERSON</span>
                  <span className="text-slate-400">Conf: <strong className="text-emerald-400">{Math.round(det.confidence * 100)}%</strong></span>
                  <span className="text-slate-400">Foot: <strong className="text-cyan-400">({Math.round(det.foot_point[0])}, {Math.round(det.foot_point[1])})</strong></span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  det.inside_zone 
                    ? 'bg-red-950 border-red-700 text-red-300 animate-pulse' 
                    : 'bg-emerald-950 border-emerald-800 text-emerald-300'
                }`}>
                  {det.inside_zone ? `BREACH: ${det.zone_id || 'HAZARD ZONE'}` : 'SAFE (Corridor)'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic py-1">
            No active bounding box incursions in current frame. Surveillance nominal.
          </div>
        )}
      </div>

      {/* Technical Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
        {/* Spatial Foot Math Specification */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 uppercase">Ground Contact Equation</div>
          <div className="font-bold text-slate-200 mt-1">
            P = ((x1+x2)/2, y2)
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Eliminates bounding box overlap false alarms
          </div>
        </div>

        {/* Output Protocol Schema */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 uppercase">Schema Egress</div>
          <div className="font-bold text-purple-400 mt-1">
            Protocol Schema v1.0 JSON
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Directly ingested into ESP32 ring buffer
          </div>
        </div>
      </div>

    </div>
  );
};

export default LivePerceptionSentinel;

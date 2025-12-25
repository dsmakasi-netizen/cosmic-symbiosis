import React, { useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, Landmark } from '../types';

interface GestureHandlerProps {
  onGestureChange: (gesture: GestureType, data: { x: number; y: number; z: number }, landmarks: Landmark[]) => void;
  videoEnabled: boolean;
}

export const GestureHandler: React.FC<GestureHandlerProps> = ({ onGestureChange, videoEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!videoEnabled) return;

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        startCamera();
      } catch (e) {
        console.error("Failed to load MediaPipe:", e);
      }
    };

    initMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [videoEnabled]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('loadeddata', predictWebcam);
    } catch (err) {
      console.warn("Camera access denied or unavailable");
    }
  };

  const predictWebcam = () => {
    if (!landmarkerRef.current || !videoRef.current) return;

    let startTimeMs = performance.now();
    if (videoRef.current.currentTime > 0) {
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0]; // Array of {x,y,z}
        const gesture = recognizeGesture(landmarks);
        
        // Calculate palm center (approximate by wrist or avg of knuckles)
        // Using Wrist (0) and Middle Finger MCP (9) average for stability
        const palmX = (landmarks[0].x + landmarks[9].x) / 2;
        const palmY = (landmarks[0].y + landmarks[9].y) / 2;
        const palmZ = landmarks[0].z; // Relative depth

        onGestureChange(gesture, { x: palmX, y: palmY, z: palmZ }, landmarks);
      } else {
        onGestureChange(GestureType.NONE, { x: 0, y: 0, z: 0 }, []);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // Improved Heuristic Gesture Recognizer (Rotation Invariant with 3D distance)
  const recognizeGesture = (landmarks: any[]): GestureType => {
    // Landmarks: 0: Wrist
    // Tips: 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
    // PIP Joints (Knuckles for curling check): 6, 10, 14, 18
    
    const wrist = landmarks[0];

    // Helper: Calculate 3D distance to handle rotation better
    const dist = (p1: any, p2: any) => {
      return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) + 
        Math.pow(p1.y - p2.y, 2) + 
        Math.pow((p1.z || 0) - (p2.z || 0), 2)
      );
    };

    // Helper: Is finger curled?
    // A finger is curled if the Tip is closer to the Wrist than the PIP joint is.
    const isCurled = (tipIdx: number, pipIdx: number) => {
      return dist(landmarks[tipIdx], wrist) < dist(landmarks[pipIdx], wrist);
    };

    // Check main fingers
    const indexCurled = isCurled(8, 6);
    const middleCurled = isCurled(12, 10);
    const ringCurled = isCurled(16, 14);
    const pinkyCurled = isCurled(20, 18);
    
    const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;

    // CLOSED FIST: 4 fingers curled
    if (curledCount === 4) {
      return GestureType.CLOSED_FIST;
    }

    // PINCH Check (Thumb Tip close to Index Tip)
    const pinchGap = dist(landmarks[4], landmarks[8]);
    if (pinchGap < 0.08) {
      return GestureType.PINCH;
    }

    // POINTING: Index NOT curled, others curled
    if (!indexCurled && middleCurled && ringCurled && pinkyCurled) {
      return GestureType.POINTING;
    }

    // OPEN PALM: 0 fingers curled
    if (curledCount === 0) {
      return GestureType.OPEN_PALM;
    }

    return GestureType.NONE;
  };

  return (
    <div className={`absolute top-4 right-4 z-50 pointer-events-none transition-opacity duration-500 ${videoEnabled ? 'opacity-75' : 'opacity-0'}`}>
      <div className="relative">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-32 h-24 rounded-lg border border-white/20 transform scale-x-[-1] object-cover shadow-lg shadow-blue-900/20" 
        />
        <div className="absolute bottom-1 right-1 text-[8px] text-white/50 font-mono bg-black/50 px-1 rounded">
          SENSOR ACTIVE
        </div>
      </div>
    </div>
  );
};
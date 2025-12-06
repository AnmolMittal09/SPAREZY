
import React from 'react';

const TharLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px]">
      {/* Inline Styles for specific animations not in Tailwind */}
      <style>{`
        @keyframes wheelSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes bodyBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes roadMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-20px); }
        }
        .thar-wheel {
          transform-origin: center;
          animation: wheelSpin 0.6s linear infinite;
        }
        .thar-body {
          animation: bodyBounce 0.8s ease-in-out infinite;
        }
        .thar-road {
          animation: roadMove 0.4s linear infinite;
        }
      `}</style>

      <div className="relative w-48 h-32">
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          {/* Road Lines */}
          <g className="thar-road">
            <line x1="-50" y1="110" x2="250" y2="110" stroke="#e5e7eb" strokeWidth="4" strokeDasharray="20 15" />
          </g>

          {/* Car Body Group */}
          <g className="thar-body">
            {/* Main Chassis */}
            <path 
              d="M20 60 L20 45 L50 45 L65 25 L130 25 L130 60 L145 60 L145 85 L130 85 L130 90 L110 90 L110 85 L50 85 L50 90 L30 90 L30 85 L10 85 L10 60 Z" 
              fill="#b91c1c" /* Mahindra Red */
              stroke="#7f1d1d" 
              strokeWidth="2"
            />
            
            {/* Roof / Top (Black Hardtop) */}
            <path 
              d="M65 25 L130 25 L130 45 L60 45 Z" 
              fill="#1f2937" 
            />

            {/* Window */}
            <path 
              d="M70 30 L100 30 L100 45 L63 45 Z" 
              fill="#9ca3af" 
              opacity="0.5"
            />
             <path 
              d="M105 30 L125 30 L125 45 L105 45 Z" 
              fill="#9ca3af" 
              opacity="0.5"
            />

            {/* Spare Wheel on Back */}
            <rect x="145" y="50" width="8" height="30" rx="2" fill="#1f2937" />
            
            {/* Headlight */}
            <circle cx="20" cy="55" r="4" fill="#fbbf24" className="animate-pulse" />

            {/* Fender Flares */}
            <path d="M25 85 Q 40 65 55 85" fill="none" stroke="#1f2937" strokeWidth="4" />
            <path d="M105 85 Q 120 65 135 85" fill="none" stroke="#1f2937" strokeWidth="4" />

            {/* Bumper */}
            <rect x="5" y="80" width="10" height="8" fill="#111827" />
          </g>

          {/* Wheels */}
          <g className="thar-wheel" style={{ transformBox: 'fill-box' }}>
            <circle cx="40" cy="90" r="14" fill="#111827" stroke="#374151" strokeWidth="2" />
            <circle cx="40" cy="90" r="6" fill="#9ca3af" />
            <line x1="40" y1="80" x2="40" y2="100" stroke="#4b5563" strokeWidth="2" />
            <line x1="30" y1="90" x2="50" y2="90" stroke="#4b5563" strokeWidth="2" />
          </g>

          <g className="thar-wheel" style={{ transformBox: 'fill-box' }}>
            <circle cx="120" cy="90" r="14" fill="#111827" stroke="#374151" strokeWidth="2" />
            <circle cx="120" cy="90" r="6" fill="#9ca3af" />
            <line x1="120" y1="80" x2="120" y2="100" stroke="#4b5563" strokeWidth="2" />
            <line x1="110" y1="90" x2="130" y2="90" stroke="#4b5563" strokeWidth="2" />
          </g>
        </svg>
      </div>
      
      <p className="mt-4 text-xs font-bold text-gray-400 tracking-widest uppercase animate-pulse">
        SPAREZY SYSTEM LOADING...
      </p>
    </div>
  );
};

export default TharLoader;

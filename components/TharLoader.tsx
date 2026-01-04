import React from 'react';

const TharLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px]">
      <style>{`
        @keyframes wheelSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); } 
        }
        @keyframes bodyBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes roadMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-30px); }
        }
        .thar-wheel {
          transform-origin: center;
          animation: wheelSpin 0.5s linear infinite;
        }
        .thar-body {
          animation: bodyBounce 0.7s ease-in-out infinite;
        }
        .thar-road {
          animation: roadMove 0.3s linear infinite;
        }
      `}</style>

      <div className="relative w-56 h-36">
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          {/* road */}
          <g className="thar-road">
            <line x1="-50" y1="110" x2="250" y2="110" stroke="#CBD5E1" strokeWidth="3" strokeDasharray="18 12" />
          </g>

          {/* Car */}
          <g transform="translate(180, 0) scale(-1, 1)">
              <g className="thar-body">
                {/* Main Chassis */}
                <path 
                  d="M20 60 L20 45 L50 45 L65 25 L130 25 L130 60 L145 60 L145 85 L130 85 L130 90 L110 90 L110 85 L50 85 L50 90 L30 90 L30 85 L10 85 L10 60 Z" 
                  fill="#991b1b" /* Mahindra Red - Deepened for premium feel */
                  stroke="#450a0a" 
                  strokeWidth="2"
                />
                
                {/* Roof */}
                <path 
                  d="M65 25 L130 25 L130 45 L60 45 Z" 
                  fill="#0F172A" 
                />

                {/* Window */}
                <path d="M70 30 L100 30 L100 44 L64 44 Z" fill="#94A3B8" opacity="0.3" />
                <path d="M105 30 L125 30 L125 44 L105 44 Z" fill="#94A3B8" opacity="0.3" />

                <rect x="145" y="50" width="8" height="30" rx="2" fill="#0F172A" />
                <circle cx="20" cy="55" r="3.5" fill="#FBBF24" className="animate-pulse" />

                <path d="M25 85 Q 40 68 55 85" fill="none" stroke="#0F172A" strokeWidth="4" />
                <path d="M105 85 Q 120 68 135 85" fill="none" stroke="#0F172A" strokeWidth="4" />
                <rect x="5" y="80" width="10" height="8" fill="#0F172A" />
              </g>

              {/* Wheels */}
              <g className="thar-wheel" style={{ transformBox: 'fill-box' }}>
                <circle cx="40" cy="90" r="14" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
                <circle cx="40" cy="90" r="6" fill="#64748B" />
                <line x1="40" y1="80" x2="40" y2="100" stroke="#334155" strokeWidth="1.5" />
                <line x1="30" y1="90" x2="50" y2="90" stroke="#334155" strokeWidth="1.5" />
              </g>

              <g className="thar-wheel" style={{ transformBox: 'fill-box' }}>
                <circle cx="120" cy="90" r="14" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
                <circle cx="120" cy="90" r="6" fill="#64748B" />
                <line x1="120" y1="80" x2="120" y2="100" stroke="#334155" strokeWidth="1.5" />
                <line x1="110" y1="90" x2="130" y2="90" stroke="#334155" strokeWidth="1.5" />
              </g>
          </g>
        </svg>
      </div>
      
      <p className="mt-8 text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase animate-pulse">
        System Initializing
      </p>
    </div>
  );
};

export default TharLoader;
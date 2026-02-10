/**
 * LingoMascot – The friendly parrot mascot for LingoAgent.
 * A bright, vibrant character with multiple expressions that matches the app's green palette.
 */
import React from 'react';

export type MascotMood = 'happy' | 'speaking' | 'listening' | 'thinking' | 'celebrating' | 'waving';

interface LingoMascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
  /** Show a subtle bounce animation */
  animate?: boolean;
}

export const LingoMascot: React.FC<LingoMascotProps> = ({
  mood = 'happy',
  size = 120,
  className = '',
  animate = false,
}) => {
  // Eye pupil offsets per mood
  const pupilOffset = {
    happy: { x: 0, y: 0 },
    speaking: { x: 0, y: 0 },
    listening: { x: 2, y: -1 },
    thinking: { x: -1, y: -3 },
    celebrating: { x: 0, y: 0 },
    waving: { x: 2, y: 0 },
  }[mood];

  const isBlinking = mood === 'thinking';
  const isMouthOpen = mood === 'speaking' || mood === 'celebrating';
  const isWingsUp = mood === 'celebrating' || mood === 'waving';

  const animClass = animate
    ? mood === 'celebrating'
      ? 'animate-bounce'
      : mood === 'speaking'
        ? 'animate-pulse'
        : 'animate-[wiggle_2s_ease-in-out_infinite]'
    : '';

  return (
    <div
      className={`inline-flex items-center justify-center ${animClass} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
      >
        {/* === BODY === */}
        {/* Shadow */}
        <ellipse cx="60" cy="108" rx="28" ry="6" fill="#00000010" />

        {/* Tail feathers */}
        <ellipse cx="42" cy="88" rx="8" ry="16" transform="rotate(20 42 88)" fill="#46A302" />
        <ellipse cx="50" cy="90" rx="6" ry="14" transform="rotate(10 50 90)" fill="#4DB804" />

        {/* Main body */}
        <ellipse cx="60" cy="62" rx="32" ry="38" fill="#58CC02" />

        {/* Belly */}
        <ellipse cx="60" cy="72" rx="22" ry="24" fill="#7ED957" />
        <ellipse cx="60" cy="76" rx="16" ry="18" fill="#A8E86C" opacity="0.5" />

        {/* === WINGS === */}
        {/* Left wing */}
        <g transform={isWingsUp ? 'rotate(-30 38 55)' : 'rotate(-5 38 55)'}>
          <ellipse cx="32" cy="58" rx="14" ry="22" fill="#46A302" />
          <ellipse cx="30" cy="58" rx="10" ry="18" fill="#4DB804" />
        </g>

        {/* Right wing */}
        <g transform={isWingsUp ? 'rotate(30 82 55)' : 'rotate(5 82 55)'}>
          <ellipse cx="88" cy="58" rx="14" ry="22" fill="#46A302" />
          <ellipse cx="90" cy="58" rx="10" ry="18" fill="#4DB804" />
        </g>

        {/* === HEAD CREST === */}
        <ellipse cx="52" cy="24" rx="4" ry="10" transform="rotate(-15 52 24)" fill="#FFB020" />
        <ellipse cx="58" cy="22" rx="3.5" ry="11" transform="rotate(-5 58 22)" fill="#FFCA28" />
        <ellipse cx="64" cy="24" rx="3" ry="9" transform="rotate(10 64 24)" fill="#FFD54F" />

        {/* === EYES === */}
        {/* Left eye */}
        <g>
          <ellipse cx="48" cy="48" rx="10" ry={isBlinking ? 1.5 : 11} fill="white" />
          {!isBlinking && (
            <>
              <circle cx={48 + pupilOffset.x} cy={48 + pupilOffset.y} r="5.5" fill="#1A1A2E" />
              <circle cx={46 + pupilOffset.x} cy={45 + pupilOffset.y} r="2" fill="white" />
            </>
          )}
        </g>

        {/* Right eye */}
        <g>
          <ellipse cx="72" cy="48" rx="10" ry={isBlinking ? 1.5 : 11} fill="white" />
          {!isBlinking && (
            <>
              <circle cx={72 + pupilOffset.x} cy={48 + pupilOffset.y} r="5.5" fill="#1A1A2E" />
              <circle cx={70 + pupilOffset.x} cy={45 + pupilOffset.y} r="2" fill="white" />
            </>
          )}
        </g>

        {/* Eyebrows for mood */}
        {mood === 'listening' && (
          <>
            <line x1="40" y1="34" x2="52" y2="32" stroke="#2D7A00" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="68" y1="32" x2="80" y2="34" stroke="#2D7A00" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {mood === 'celebrating' && (
          <>
            <path d="M39 34 Q45 30 53 33" stroke="#2D7A00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M67 33 Q75 30 81 34" stroke="#2D7A00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* === BEAK === */}
        {isMouthOpen ? (
          <g>
            {/* Upper beak */}
            <path d="M53 58 L60 54 L67 58 Z" fill="#FF9500" />
            {/* Lower beak (open) */}
            <path d="M54 59 L60 65 L66 59 Z" fill="#E07800" />
          </g>
        ) : (
          <path d="M53 57 L60 63 L67 57" fill="#FF9500" stroke="#E07800" strokeWidth="1" strokeLinejoin="round" />
        )}

        {/* === BLUSH CHEEKS === */}
        <circle cx="38" cy="56" r="5" fill="#FF6B8A" opacity="0.25" />
        <circle cx="82" cy="56" r="5" fill="#FF6B8A" opacity="0.25" />

        {/* === FEET === */}
        <g>
          <ellipse cx="50" cy="98" rx="6" ry="3" fill="#FF9500" />
          <ellipse cx="70" cy="98" rx="6" ry="3" fill="#FF9500" />
          <circle cx="45" cy="99" r="2" fill="#E07800" />
          <circle cx="50" cy="100" r="2" fill="#E07800" />
          <circle cx="55" cy="99" r="2" fill="#E07800" />
          <circle cx="65" cy="99" r="2" fill="#E07800" />
          <circle cx="70" cy="100" r="2" fill="#E07800" />
          <circle cx="75" cy="99" r="2" fill="#E07800" />
        </g>

        {/* === MOOD-SPECIFIC DECORATIONS === */}

        {/* Speaking: sound waves */}
        {mood === 'speaking' && (
          <g opacity="0.5">
            <path d="M82 52 Q88 48 88 56" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M88 49 Q96 44 96 58" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Listening: ear indicators */}
        {mood === 'listening' && (
          <g opacity="0.4">
            <path d="M28 40 Q22 44 24 52" stroke="#58CC02" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M24 38 Q16 43 19 54" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Thinking: dots */}
        {mood === 'thinking' && (
          <g opacity="0.4">
            <circle cx="80" cy="28" r="3" fill="#58CC02" />
            <circle cx="88" cy="20" r="4" fill="#58CC02" />
            <circle cx="98" cy="10" r="5" fill="#58CC02" />
          </g>
        )}

        {/* Celebrating: sparkles */}
        {mood === 'celebrating' && (
          <g>
            <text x="16" y="22" fontSize="14" opacity="0.8">✨</text>
            <text x="92" y="18" fontSize="12" opacity="0.8">⭐</text>
            <text x="8" y="70" fontSize="10" opacity="0.6">🎉</text>
            <text x="100" y="74" fontSize="10" opacity="0.6">🎊</text>
          </g>
        )}

        {/* Waving: motion lines on right wing */}
        {mood === 'waving' && (
          <g opacity="0.3">
            <line x1="100" y1="36" x2="108" y2="32" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" />
            <line x1="102" y1="42" x2="112" y2="40" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="48" x2="108" y2="48" stroke="#58CC02" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
};

/** Mini version — just the head, for tight spaces like badges and indicators */
export const LingoMascotMini: React.FC<{
  mood?: MascotMood;
  size?: number;
  className?: string;
}> = ({ mood = 'happy', size = 40, className = '' }) => {
  const isMouthOpen = mood === 'speaking' || mood === 'celebrating';
  const isBlinking = mood === 'thinking';
  const pupilOffset = {
    happy: { x: 0, y: 0 },
    speaking: { x: 0, y: 0 },
    listening: { x: 1, y: -1 },
    thinking: { x: -1, y: -2 },
    celebrating: { x: 0, y: 0 },
    waving: { x: 1, y: 0 },
  }[mood];

  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        {/* Head/body */}
        <circle cx="30" cy="32" r="22" fill="#58CC02" />
        <ellipse cx="30" cy="36" rx="15" ry="14" fill="#7ED957" />

        {/* Crest */}
        <ellipse cx="25" cy="12" rx="2.5" ry="6" transform="rotate(-10 25 12)" fill="#FFB020" />
        <ellipse cx="30" cy="10" rx="2" ry="7" fill="#FFCA28" />
        <ellipse cx="35" cy="12" rx="2" ry="5.5" transform="rotate(10 35 12)" fill="#FFD54F" />

        {/* Eyes */}
        <ellipse cx="22" cy="28" rx="6" ry={isBlinking ? 1 : 6.5} fill="white" />
        {!isBlinking && (
          <>
            <circle cx={22 + pupilOffset.x} cy={28 + pupilOffset.y} r="3.2" fill="#1A1A2E" />
            <circle cx={21 + pupilOffset.x} cy={26.5 + pupilOffset.y} r="1.2" fill="white" />
          </>
        )}
        <ellipse cx="38" cy="28" rx="6" ry={isBlinking ? 1 : 6.5} fill="white" />
        {!isBlinking && (
          <>
            <circle cx={38 + pupilOffset.x} cy={28 + pupilOffset.y} r="3.2" fill="#1A1A2E" />
            <circle cx={37 + pupilOffset.x} cy={26.5 + pupilOffset.y} r="1.2" fill="white" />
          </>
        )}

        {/* Beak */}
        {isMouthOpen ? (
          <g>
            <path d="M26 35 L30 32 L34 35 Z" fill="#FF9500" />
            <path d="M27 36 L30 40 L33 36 Z" fill="#E07800" />
          </g>
        ) : (
          <path d="M26 34 L30 38 L34 34" fill="#FF9500" stroke="#E07800" strokeWidth="0.6" strokeLinejoin="round" />
        )}

        {/* Cheeks */}
        <circle cx="16" cy="33" r="3" fill="#FF6B8A" opacity="0.2" />
        <circle cx="44" cy="33" r="3" fill="#FF6B8A" opacity="0.2" />

        {/* Speaking waves */}
        {mood === 'speaking' && (
          <g opacity="0.4">
            <path d="M46 26 Q50 24 50 30" stroke="#46A302" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <path d="M49 24 Q54 21 54 32" stroke="#46A302" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Celebrating sparkles */}
        {mood === 'celebrating' && (
          <g>
            <text x="2" y="14" fontSize="8">✨</text>
            <text x="48" y="12" fontSize="7">⭐</text>
          </g>
        )}
      </svg>
    </div>
  );
};

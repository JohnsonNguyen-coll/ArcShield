'use client'

interface ProtectionSliderProps {
  value: 0 | 1 | 2
  onChange: (value: 0 | 1 | 2) => void
  disabled?: boolean
}

export default function ProtectionSlider({
  value,
  onChange,
  disabled = false,
}: ProtectionSliderProps) {
  const levels = [
    { label: 'Low', color: 'bg-success-500' },
    { label: 'Medium', color: 'bg-warning-500' },
    { label: 'High', color: 'bg-danger-500' },
  ]

  return (
    <div className="relative">
      {/* Slider Track */}
      <div className="h-3 bg-slate-200 rounded-full relative">
        {/* Active Segment */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${
            value === 0
              ? 'w-1/3 bg-success-500'
              : value === 1
              ? 'w-2/3 bg-warning-500'
              : 'w-full bg-danger-500'
          }`}
        />

        {/* Slider Handle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-primary-500 cursor-pointer transition-all duration-300 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
          }`}
          style={{
            left: `calc(${(value / 2) * 100}% - 12px)`,
          }}
          onClick={() => {
            if (!disabled) {
              const nextValue = ((value + 1) % 3) as 0 | 1 | 2
              onChange(nextValue)
            }
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2">
        {levels.map((level, index) => (
          <button
            key={index}
            onClick={() => {
              if (!disabled) onChange(index as 0 | 1 | 2)
            }}
            disabled={disabled}
            className={`text-xs font-medium transition-colors ${
              value === index
                ? 'text-slate-900'
                : 'text-slate-400 hover:text-slate-600'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  )
}


import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#facc15',
            transform: 'skewX(-12deg)',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  )
}

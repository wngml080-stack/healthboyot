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
            fontSize: 44,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#facc15',
            transform: 'skewX(-12deg)',
            textShadow: '2px 0 0 #facc15, -2px 0 0 #facc15, 1px 1px 0 #facc15, -1px -1px 0 #facc15',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  )
}

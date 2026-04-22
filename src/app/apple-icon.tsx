import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#facc15',
            transform: 'skewX(-12deg)',
            marginTop: -4,
            textShadow: '3px 0 0 #facc15, -3px 0 0 #facc15, 1px 1px 0 #facc15, -1px -1px 0 #facc15',
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size },
  )
}

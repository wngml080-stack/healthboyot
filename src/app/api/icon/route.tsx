import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const size = Number(searchParams.get('size') || '192')

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          borderRadius: size * 0.2,
        }}
      >
        <span
          style={{
            fontSize: size * 0.65,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#facc15',
            transform: 'skewX(-12deg)',
            marginTop: -size * 0.02,
            textShadow: '3px 0 0 #facc15, -3px 0 0 #facc15, 1px 1px 0 #facc15, -1px -1px 0 #facc15',
          }}
        >
          H
        </span>
      </div>
    ),
    { width: size, height: size }
  )
}

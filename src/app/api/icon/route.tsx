import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const size = Number(searchParams.get('size') || '192')
  const maskable = searchParams.get('maskable') === '1'

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: maskable ? '#1a1a1a' : 'transparent',
        }}
      >
        <div
          style={{
            width: maskable ? size * 0.7 : size,
            height: maskable ? size * 0.7 : size,
            borderRadius: '50%',
            background: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: maskable ? size * 0.42 : size * 0.6,
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#facc15',
              transform: 'skewX(-12deg)',
              marginTop: -size * 0.02,
            }}
          >
            H
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}

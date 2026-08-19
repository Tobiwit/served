import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * The app mark: a dotted aperture on the fog ground, the same instrument motif the
 * interface uses. Generated rather than shipped as a binary so it stays in sync.
 */
export default function Icon() {
  return new ImageResponse(<Mark size={180} />, { ...size });
}

export function Mark({ size: s }: { size: number }) {
  const dots = 22;
  const r = s * 0.3;
  return (
    <div
      style={{
        width: s,
        height: s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(150deg, #ffd0aa 0%, #d9f265 46%, #2b7a49 100%)',
        position: 'relative',
      }}
    >
      {Array.from({ length: dots }).map((_, i) => {
        const a = (i / dots) * Math.PI * 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: s * 0.052,
              height: s * 0.052,
              borderRadius: s,
              background: 'rgba(255,255,255,0.95)',
              left: s / 2 + r * Math.cos(a) - s * 0.026,
              top: s / 2 + r * Math.sin(a) - s * 0.026,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          width: s * 0.115,
          height: s * 0.115,
          borderRadius: s,
          background: '#ffffff',
          left: s / 2 - s * 0.0575,
          top: s / 2 - s * 0.0575,
        }}
      />
    </div>
  );
}

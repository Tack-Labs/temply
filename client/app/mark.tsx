/**
 * The brand mark as an image response draws it: the same three bars on the
 * same indigo as public/brand/icon.svg, in boxes rather than paths, because
 * the icon routes render JSX to PNG with satori and satori draws boxes.
 * Every measure is a share of the edge so one drawing serves every size.
 */
export const MARK_INDIGO = '#4F46E5';

export function Mark({ size }: { size: number }) {
  const bar = (left: number, top: number, width: number) => (
    <div
      style={{
        position: 'absolute',
        left: size * left,
        top: size * top,
        width: size * width,
        height: size * 0.1425,
        borderRadius: size * 0.0525,
        background: '#FFFFFF',
      }}
    />
  );
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        position: 'relative',
        background: MARK_INDIGO,
        borderRadius: size * 0.23,
      }}
    >
      {bar(0.23, 0.245, 0.54)}
      {bar(0.335, 0.4475, 0.33)}
      {bar(0.425, 0.65, 0.15)}
    </div>
  );
}

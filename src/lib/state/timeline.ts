export const DAY = 86400000;
export function advance(
  time: number,
  elapsed: number,
  speed: number,
  direction: number,
  start: number,
  end: number,
) {
  return Math.min(
    end,
    Math.max(start, time + elapsed * speed * DAY * direction),
  );
}

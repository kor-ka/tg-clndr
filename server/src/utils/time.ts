import { Duration } from "tinyduration";

export const durationToMilliseconds = (duration: Duration) => {
  let sum = 0;
  sum += (duration.days ?? 0) * 24 * 60 * 60 * 1000;
  sum += (duration.hours ?? 0) * 60 * 60 * 1000;
  sum += (duration.minutes ?? 0) * 60 * 1000;
  sum += (duration.seconds ?? 0) * 1000;
  return sum;
};

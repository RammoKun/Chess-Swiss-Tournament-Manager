export function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  K = 32,
) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return {
    newRatingA: Math.round(ratingA + K * (scoreA - expectedA)),
    newRatingB: Math.round(ratingB + K * (1 - scoreA - (1 - expectedA))),
  };
}

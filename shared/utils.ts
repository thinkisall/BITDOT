export function formatLastUpdated(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes === 0) return `${seconds}초 전 업데이트`;
  if (minutes < 60) return `${minutes}분 전 업데이트`;

  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전 업데이트`;
}

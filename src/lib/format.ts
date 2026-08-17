export function formatDate(value: string) {
  if (!value) return "Unpublished";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatViews(value: number) {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}K reads`;
  }

  return `${value.toLocaleString("en-US")} reads`;
}

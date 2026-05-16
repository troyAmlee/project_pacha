export function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatMiles(value) {
  const distance = Number(value);

  if (Number.isNaN(distance)) {
    return "0 mi";
  }

  return `${distance % 1 === 0 ? distance.toFixed(0) : distance.toFixed(1)} mi`;
}

export function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function toTitleCase(value) {
  if (!value) {
    return "";
  }

  return value[0].toUpperCase() + value.slice(1);
}

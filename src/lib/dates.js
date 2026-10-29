// Both use UTC (toISOString), matching how dates have always been stored.

// "YYYY-MM"
export const currentMonth = () => new Date().toISOString().slice(0, 7);

// "YYYY-MM-DD"
export const today = () => new Date().toISOString().split("T")[0];

export type CalendarViewMode = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM or empty
  endTime: string; // HH:MM or empty
  notes?: string;
  color?: string; // key from utils/colors (e.g. "blue", "purple")
};

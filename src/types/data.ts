export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  color?: string; // key from utils/colors
};

export type Reminder = {
  id: string;
  text: string;
  dueAt: number; // epoch ms
  createdAt: number;
  notified: boolean;
};

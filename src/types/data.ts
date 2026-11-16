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
};

export type Reminder = {
  id: string;
  text: string;
  dueAt: number; // epoch ms
  createdAt: number;
  notified: boolean;
};

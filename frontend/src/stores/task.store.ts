import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@/types';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;

  fetchTasks: (filters?: Record<string, string>) => Promise<void>;
  createTask: (dto: CreateTaskDto) => Promise<Task>;
  updateTask: (id: string, dto: UpdateTaskDto) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskProgress: (taskId: string, status: string, progress: number) => void;
  replaceTask: (task: Task) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async (filters) => {
    const cached = await getCached<Task[]>('tasks');
    if (cached && !filters) set({ tasks: cached.data });

    set({ isLoading: !cached });
    try {
      const res = await api.getTasks(1, 100, filters);
      const tasks = res.data ?? [];
      set({ tasks, isLoading: false });
      if (!filters) await setCache('tasks', tasks);
    } catch {
      set({ isLoading: false });
    }
  },

  createTask: async (dto) => {
    const res = await api.createTask(dto);
    const task = res.data!;
    const tasks = [task, ...get().tasks];
    set({ tasks });
    await setCache('tasks', tasks);
    return task;
  },

  updateTask: async (id, dto) => {
    const res = await api.updateTask(id, dto);
    const updated = res.data!;
    const tasks = get().tasks.map((t) => (t.id === id ? updated : t));
    set({ tasks });
    await setCache('tasks', tasks);
  },

  deleteTask: async (id) => {
    await api.deleteTask(id);
    const tasks = get().tasks.filter((t) => t.id !== id);
    set({ tasks });
    await setCache('tasks', tasks);
  },

  updateTaskProgress: (taskId, status, progress) => {
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, status: status as Task['status'], progress } : t,
    );
    set({ tasks });
    setCache('tasks', tasks);
  },

  replaceTask: (task) => {
    const exists = get().tasks.some((t) => t.id === task.id);
    const tasks = exists
      ? get().tasks.map((t) => (t.id === task.id ? task : t))
      : [task, ...get().tasks];
    set({ tasks });
    setCache('tasks', tasks);
  },
}));


import { supabase } from './supabase';
import { AppTask, TaskPriority } from '../types';

const TASK_STORAGE_KEY = 'sparezy_tasks_v1';

export const fetchTasks = async (): Promise<AppTask[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('app_tasks')
      .select('*')
      .order('deadline', { ascending: true });
    
    if (error) return [];
    return data.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      deadline: d.deadline,
      priority: d.priority as TaskPriority,
      isCompleted: d.is_completed,
      reminderSent: d.reminder_sent,
      createdBy: d.created_by,
      createdAt: d.created_at
    }));
  }

  const local = localStorage.getItem(TASK_STORAGE_KEY);
  return local ? JSON.parse(local) : [];
};

export const saveTask = async (task: Partial<AppTask>): Promise<{ success: boolean; message?: string }> => {
  const newTask = {
    title: task.title,
    description: task.description,
    deadline: task.deadline,
    priority: task.priority || TaskPriority.MEDIUM,
    is_completed: task.isCompleted || false,
    reminder_sent: task.reminderSent || false,
    created_by: task.createdBy || 'System'
  };

  if (supabase) {
    let res;
    if (task.id) {
      res = await supabase.from('app_tasks').update(newTask).eq('id', task.id);
    } else {
      res = await supabase.from('app_tasks').insert(newTask);
    }
    if (res.error) return { success: false, message: res.error.message };
    return { success: true };
  }

  const tasks = await fetchTasks();
  if (task.id) {
    const index = tasks.findIndex(t => t.id === task.id);
    if (index > -1) tasks[index] = { ...tasks[index], ...task } as AppTask;
  } else {
    tasks.push({
      ...task,
      id: Math.random().toString(36).substring(7),
      createdAt: new Date().toISOString(),
      isCompleted: false,
      reminderSent: false
    } as AppTask);
  }
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  return { success: true };
};

export const deleteTask = async (id: string): Promise<void> => {
  if (supabase) {
    await supabase.from('app_tasks').delete().eq('id', id);
    return;
  }
  const tasks = await fetchTasks();
  const filtered = tasks.filter(t => t.id !== id);
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(filtered));
};

export const markTaskReminderSent = async (id: string): Promise<void> => {
    if (supabase) {
        await supabase.from('app_tasks').update({ reminder_sent: true }).eq('id', id);
        return;
    }
    const tasks = await fetchTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index > -1) {
        tasks[index].reminderSent = true;
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
    }
};

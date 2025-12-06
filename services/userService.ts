
import { supabase } from './supabase';
import { Role, User } from '../types';

export const authenticate = async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password', password) // Note: In production, use hashed passwords (e.g. bcrypt) on server side or Supabase Auth
        .single();

      if (error || !data) {
        return { success: false, message: 'Invalid credentials' };
      }

      const user: User = {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role as Role
      };

      return { success: true, user };
    } catch (err) {
      console.error("Auth error:", err);
      // Fallthrough to mock if table doesn't exist yet
    }
  }

  // --- FALLBACK MOCK AUTH (If DB not connected or empty) ---
  if (username === 'admin' && password === 'admin') {
    return { success: true, user: { id: '1', username: 'admin', name: 'Mr. Owner (Fallback)', role: Role.OWNER } };
  } else if (username === 'manager' && password === 'manager') {
    return { success: true, user: { id: '2', username: 'manager', name: 'Manager (Fallback)', role: Role.MANAGER } };
  }

  return { success: false, message: 'Invalid credentials (Fallback)' };
};

export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('app_users')
    .select('id, username, name, role')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Fetch users error:", error);
    return [];
  }

  return data.map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role as Role
  }));
};

export const addUser = async (newUser: Omit<User, 'id'> & { password: string }): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };

  // Check if username exists
  const { data: existing } = await supabase.from('app_users').select('id').eq('username', newUser.username).single();
  if (existing) return { success: false, message: "Username already exists" };

  const { error } = await supabase.from('app_users').insert({
    username: newUser.username,
    password: newUser.password,
    name: newUser.name,
    role: newUser.role
  });

  if (error) return { success: false, message: error.message };
  return { success: true };
};

export const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
  if (!supabase) return { success: false, message: "Database not connected" };

  const { error } = await supabase.from('app_users').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true };
};


import React, { useEffect, useState } from 'react';
import { User, Role } from '../types';
import { getUsers, addUser, deleteUser } from '../services/userService';
import { Users, Plus, Trash2, Shield, Loader2, UserPlus, CheckCircle } from 'lucide-react';
import TharLoader from '../components/TharLoader';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.MANAGER);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);

    const res = await addUser({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole
    });

    if (res.success) {
      setMsg({ type: 'success', text: 'User created successfully.' });
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to create user.' });
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, username: string) => {
    if (username === 'admin') {
      alert("Cannot delete the main Admin user.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;

    await deleteUser(id);
    loadUsers();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
           <Users className="text-blue-600" /> User Management
        </h1>
        <p className="text-gray-500">Create and manage access for Owners and Managers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {/* LEFT: Create Form */}
         <div className="md:col-span-1">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 sticky top-4">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                 <UserPlus size={18} /> Add New User
               </h3>
               
               <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                     <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                     <input 
                       type="text" 
                       required
                       className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="e.g. John Doe"
                       value={newName}
                       onChange={e => setNewName(e.target.value)}
                     />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-gray-500 uppercase">Username</label>
                     <input 
                       type="text" 
                       required
                       className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="e.g. john_manager"
                       value={newUsername}
                       onChange={e => setNewUsername(e.target.value)}
                     />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                     <input 
                       type="password" 
                       required
                       className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="••••••"
                       value={newPassword}
                       onChange={e => setNewPassword(e.target.value)}
                     />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                     <select 
                       className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                       value={newRole}
                       onChange={e => setNewRole(e.target.value as Role)}
                     >
                        <option value={Role.MANAGER}>MANAGER</option>
                        <option value={Role.OWNER}>OWNER (Admin)</option>
                     </select>
                  </div>

                  <button 
                    type="submit" 
                    disabled={creating}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                     {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                     Create User
                  </button>

                  {msg && (
                    <div className={`text-xs p-2 rounded text-center ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                       {msg.text}
                    </div>
                  )}
               </form>
            </div>
         </div>

         {/* RIGHT: User List */}
         <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               {loading ? (
                  <div className="p-12 flex justify-center"><TharLoader /></div>
               ) : (
                  <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                        <tr>
                           <th className="px-6 py-4">User Details</th>
                           <th className="px-6 py-4">Role</th>
                           <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {users.length === 0 ? (
                           <tr><td colSpan={3} className="p-6 text-center text-gray-400">No users found.</td></tr>
                        ) : users.map(u => (
                           <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="font-bold text-gray-900">{u.name}</div>
                                 <div className="text-xs text-gray-500">@{u.username}</div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                    u.role === Role.OWNER ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                                 }`}>
                                    <Shield size={10} />
                                    {u.role}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 {u.username === 'admin' ? (
                                    <span className="text-xs text-gray-400 italic">System Admin</span>
                                 ) : (
                                    <button 
                                      onClick={() => handleDelete(u.id, u.username)}
                                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                      title="Delete User"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default UserManagement;

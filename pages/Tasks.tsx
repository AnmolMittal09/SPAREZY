
import React, { useState, useEffect } from 'react';
import { AppTask, TaskPriority, User } from '../types';
import { fetchTasks, saveTask, deleteTask, markTaskReminderSent } from '../services/taskService';
import { 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Loader2, 
  MoreVertical,
  X,
  ShieldAlert,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const fd = (n: number | string) => {
    const num = parseInt(n.toString()) || 0;
    return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

const Tasks: React.FC<Props> = ({ user }) => {
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    priority: TaskPriority.MEDIUM
  });

  useEffect(() => {
    loadTasks();
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    const data = await fetchTasks();
    setTasks(data);
    setLoading(false);
  };

  const handleRequestNotifications = async () => {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveTask({
      ...formData,
      createdBy: user.name
    });
    if (res.success) {
      setFormData({ title: '', description: '', deadline: '', priority: TaskPriority.MEDIUM });
      setIsAdding(false);
      loadTasks();
    } else {
      alert("Error: " + res.message);
    }
    setSaving(false);
  };

  const toggleComplete = async (task: AppTask) => {
    await saveTask({ ...task, isCompleted: !task.isCompleted });
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    await deleteTask(id);
    loadTasks();
  };

  if (loading) return <TharLoader />;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1 pt-2">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-100">
              <Bell size={28} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                 Reminders & Tasks
              </h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">
                Protocol Oversight • Operational Deadlines
              </p>
           </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
            {notificationPermission !== 'granted' && (
                <button 
                  onClick={handleRequestNotifications}
                  className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                   <ShieldAlert size={16} /> Enable Alerts
                </button>
            )}
            <button 
                onClick={() => setIsAdding(true)}
                className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <Plus size={18} strokeWidth={3} /> New Entry
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Task List */}
          <div className="lg:col-span-8 space-y-6">
              {tasks.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] p-32 text-center">
                     <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner-soft">
                        <Sparkles size={32} className="text-slate-200" />
                     </div>
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Clear Registry</h3>
                     <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No active reminders in the pipeline.</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                     {tasks.map(task => {
                        const isOverdue = !task.isCompleted && new Date(task.deadline) < new Date();
                        const theme = task.priority === TaskPriority.CRITICAL ? 'bg-rose-50 border-rose-100 ring-rose-500' : 
                                      task.priority === TaskPriority.HIGH ? 'bg-orange-50 border-orange-100 ring-orange-500' :
                                      'bg-white border-slate-100 ring-brand-500';

                        return (
                           <div key={task.id} className={`p-8 rounded-[2.5rem] border-2 shadow-soft flex gap-6 items-start transition-all group ${theme} ${task.isCompleted ? 'opacity-50 grayscale bg-slate-50 border-slate-100' : ''}`}>
                               <button 
                                 onClick={() => toggleComplete(task)}
                                 className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 border-2 ${task.isCompleted ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-slate-200 text-transparent hover:border-brand-400'}`}
                               >
                                  <Check size={20} strokeWidth={4} />
                               </button>

                               <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-3 mb-2">
                                       <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded shadow-sm border ${
                                           task.priority === TaskPriority.CRITICAL ? 'bg-rose-600 text-white border-rose-700' :
                                           task.priority === TaskPriority.HIGH ? 'bg-orange-500 text-white border-orange-600' :
                                           'bg-slate-800 text-white border-slate-900'
                                       }`}>
                                          {task.priority}
                                       </span>
                                       {isOverdue && <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-100 px-2 py-0.5 rounded">OVERDUE</span>}
                                   </div>
                                   <h3 className={`text-xl font-black text-slate-900 tracking-tight leading-none mb-2 uppercase ${task.isCompleted ? 'line-through' : ''}`}>
                                      {task.title}
                                   </h3>
                                   <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6 line-clamp-2 uppercase tracking-wide">
                                      {task.description || 'No detailed log provided for this entry.'}
                                   </p>
                                   <div className="flex items-center gap-6">
                                      <div className="flex items-center gap-2 text-slate-400">
                                         <Calendar size={14}/>
                                         <span className="text-[10px] font-black uppercase tracking-widest">{new Date(task.deadline).toLocaleDateString()}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-400">
                                         <Clock size={14}/>
                                         <span className="text-[10px] font-black uppercase tracking-widest">{new Date(task.deadline).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                                      </div>
                                   </div>
                               </div>

                               <button 
                                 onClick={() => handleDelete(task.id)}
                                 className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                               >
                                  <Trash2 size={18} />
                               </button>
                           </div>
                        );
                     })}
                  </div>
              )}
          </div>

          {/* Contextual Suggestions / Legend */}
          <div className="lg:col-span-4 space-y-6">
             <div className="bg-[#1E293B] rounded-[2.5rem] p-8 shadow-elevated border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
                <h3 className="font-black text-white/40 mb-6 uppercase text-[10px] tracking-[0.3em]">Protocol Presets</h3>
                <div className="space-y-4">
                   {[
                     { label: 'Stock Audit', color: 'bg-blue-600' },
                     { label: 'Supplier Follow-up', color: 'bg-teal-600' },
                     { label: 'GST Tax Filing', color: 'bg-orange-600' },
                     { label: 'Critical Refill', color: 'bg-rose-600' }
                   ].map(p => (
                     <div key={p.label} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group/p transition-all cursor-pointer hover:bg-white/10">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full ${p.color}`}></div>
                           <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">{p.label}</span>
                        </div>
                        <ChevronRight size={14} className="text-white/20 group-hover/p:translate-x-1 transition-transform" />
                     </div>
                   ))}
                </div>
             </div>
          </div>
      </div>

      {/* ADD TASK MODAL */}
      {isAdding && (
          <div className="fixed inset-0 z-[1100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-slide-up">
                  <div className="p-10 pb-4">
                      <div className="flex items-center gap-5 mb-10">
                          <div className="p-4 bg-brand-50 text-brand-600 rounded-[1.5rem] shadow-inner">
                              <Bell size={24} strokeWidth={2.5} />
                          </div>
                          <div>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Protocol</h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Initialize System Reminder</p>
                          </div>
                          <button onClick={() => setIsAdding(false)} className="ml-auto p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
                      </div>

                      <form onSubmit={handleCreate} className="space-y-6">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Task Title</label>
                              <input 
                                  required
                                  type="text"
                                  className="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-brand-500/5 transition-all uppercase shadow-inner-soft placeholder:text-slate-200"
                                  placeholder="e.g. mahindra order verification"
                                  value={formData.title}
                                  onChange={e => setFormData({...formData, title: e.target.value})}
                              />
                          </div>

                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Protocol Details</label>
                              <textarea 
                                  rows={3}
                                  className="w-full bg-slate-50 p-5 rounded-2xl border-none outline-none font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/5 transition-all uppercase shadow-inner-soft resize-none"
                                  value={formData.description}
                                  onChange={e => setFormData({...formData, description: e.target.value})}
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Deadline</label>
                                <input 
                                    required
                                    type="datetime-local"
                                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-brand-500/5 transition-all shadow-inner-soft"
                                    value={formData.deadline}
                                    onChange={e => setFormData({...formData, deadline: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Priority</label>
                                <select 
                                    className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-black text-slate-900 focus:ring-4 focus:ring-brand-500/5 transition-all shadow-inner-soft appearance-none"
                                    value={formData.priority}
                                    onChange={e => setFormData({...formData, priority: e.target.value as TaskPriority})}
                                >
                                    <option value={TaskPriority.LOW}>LOW</option>
                                    <option value={TaskPriority.MEDIUM}>MEDIUM</option>
                                    <option value={TaskPriority.HIGH}>HIGH</option>
                                    <option value={TaskPriority.CRITICAL}>CRITICAL</option>
                                </select>
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50 -mx-10 mt-10 border-t border-slate-100">
                              <button 
                                  type="submit"
                                  disabled={saving}
                                  className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-30 uppercase tracking-[0.2em] text-[13px]"
                              >
                                  {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />}
                                  Initialize Protocol
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Tasks;

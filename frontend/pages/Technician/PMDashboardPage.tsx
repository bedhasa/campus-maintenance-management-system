"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { CalendarClock, CheckCircle, Clock, AlertTriangle, ChevronRight, X, Camera, UploadCloud } from "lucide-react";

type PMTask = {
  id: number;
  asset_id: number;
  asset?: { id: number; name: string; image_path?: string | null; serial_number?: string | null; status?: string };
  title: string;
  description: string;
  frequency: string;
  scheduled_date: string;
  priority: string;
  status: string;
  notes: string;
  checklists: { id: number; task_description: string; is_completed: boolean }[];
};

type KpiData = {
  upcoming: number;
  dueToday: number;
  overdue: number;
  completed: number;
};

export default function PMDashboardPage() {
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [kpi, setKpi] = useState<KpiData>({ upcoming: 0, dueToday: 0, overdue: 0, completed: 0 });
  const [selectedTask, setSelectedTask] = useState<PMTask | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);

  // Form State
  const [reportForm, setReportForm] = useState({
    condition_before: "",
    work_performed: "",
    parts_used: "",
    recommendations: "",
    completion_notes: "",
  });
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; tasks: PMTask[]; kpi: KpiData }>("/api/technician/custom-pm", { method: "GET" }, true);
      if (res.success) {
        setTasks(res.tasks);
        setKpi(res.kpi);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openTaskDetail = async (task: PMTask) => {
    try {
      const res = await apiRequest<{ success: boolean; task: PMTask }>(`/api/technician/custom-pm/${task.id}`, { method: "GET" }, true);
      setSelectedTask(res.task);
    } catch (e) {
      console.error(e);
    }
  };

  const acceptTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await apiRequest<{ success: boolean; task: PMTask }>(`/api/technician/custom-pm/${selectedTask.id}/accept`, { method: "PATCH" }, true);
      setSelectedTask(res.task);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleChecklist = async (checklistId: number, isCompleted: boolean) => {
    if (!selectedTask) return;
    try {
      await apiRequest(`/api/technician/custom-pm/${selectedTask.id}/checklist/${checklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      }, true);
      
      const res = await apiRequest<{ success: boolean; task: PMTask }>(`/api/technician/custom-pm/${selectedTask.id}`, { method: "GET" }, true);
      setSelectedTask(res.task);
    } catch (e) {
      console.error(e);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("condition_before", reportForm.condition_before);
      formData.append("work_performed", reportForm.work_performed);
      formData.append("parts_used", reportForm.parts_used);
      formData.append("recommendations", reportForm.recommendations);
      formData.append("completion_notes", reportForm.completion_notes);
      
      if (beforeImage) formData.append("before_image", beforeImage);
      if (afterImage) formData.append("after_image", afterImage);

      await apiRequest(`/api/technician/custom-pm/${selectedTask.id}/complete`, {
        method: "POST",
        body: formData,
      }, true);

      setShowReportForm(false);
      setSelectedTask(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500">Loading Preventive Maintenance Data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Preventive Maintenance</h1>
        <p className="text-sm text-slate-500">Your scheduled tasks and routines</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Upcoming</p>
            <p className="text-2xl font-black text-slate-800">{kpi.upcoming}</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><CalendarClock size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Due Today</p>
            <p className="text-2xl font-black text-slate-800">{kpi.dueToday}</p>
          </div>
          <div className="p-2 bg-orange-50 text-orange-500 rounded-xl"><Clock size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Overdue</p>
            <p className="text-2xl font-black text-red-600">{kpi.overdue}</p>
          </div>
          <div className="p-2 bg-red-50 text-red-500 rounded-xl"><AlertTriangle size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Completed</p>
            <p className="text-2xl font-black text-emerald-600">{kpi.completed}</p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl"><CheckCircle size={24} /></div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Your PM Tasks</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {tasks.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No PM tasks assigned to you.</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="p-5 hover:bg-slate-50 transition cursor-pointer flex justify-between items-center" onClick={() => openTaskDetail(task)}>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 font-medium">{task.asset?.name || "Unknown Asset"}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{task.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Due Date</p>
                    <p className="text-xs font-bold text-slate-700">{new Date(task.scheduled_date).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && !showReportForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4 items-center">
                  {selectedTask.asset?.image_path ? (
                    <img src={`http://127.0.0.1:8000/storage/${selectedTask.asset.image_path}`} alt={selectedTask.asset.name} className="w-16 h-16 rounded-xl object-cover bg-slate-200 border border-slate-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-400">
                      <Camera size={24} />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">{selectedTask.asset?.name || "Unknown Asset"}</p>
                    <h2 className="text-xl font-black text-slate-900">{selectedTask.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
              </div>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Status</p>
                  <p className="font-bold capitalize">{selectedTask.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Scheduled Date</p>
                  <p className="font-bold">{new Date(selectedTask.scheduled_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Priority</p>
                  <p className="font-bold capitalize">{selectedTask.priority}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Frequency</p>
                  <p className="font-bold capitalize">{selectedTask.frequency}</p>
                </div>
              </div>

              {selectedTask.description && (
                <div>
                  <p className="text-sm font-bold text-slate-800 mb-2">Description</p>
                  <p className="text-sm text-slate-600">{selectedTask.description}</p>
                </div>
              )}

              {selectedTask.notes && (
                <div>
                  <p className="text-sm font-bold text-slate-800 mb-2">Supervisor Notes</p>
                  <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-sm border border-orange-100">
                    {selectedTask.notes}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-800 mb-3">Checklist</p>
                {selectedTask.checklists && selectedTask.checklists.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.checklists.map(item => (
                      <label key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${item.is_completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                        <input 
                          type="checkbox" 
                          checked={item.is_completed}
                          onChange={(e) => toggleChecklist(item.id, e.target.checked)}
                          disabled={selectedTask.status === 'completed' || selectedTask.status === 'scheduled' || selectedTask.status === 'assigned'}
                          className="mt-1 w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className={`text-sm ${item.is_completed ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{item.task_description}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No checklist items provided.</p>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50">
              {(selectedTask.status === 'scheduled' || selectedTask.status === 'assigned') ? (
                <button 
                  onClick={acceptTask}
                  className="w-full bg-[#003366] text-white font-bold py-3 rounded-xl hover:bg-blue-900 transition"
                >
                  Accept & Start Work
                </button>
              ) : selectedTask.status === 'in_progress' ? (
                <button 
                  onClick={() => setShowReportForm(true)}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition"
                >
                  Submit Completion Report
                </button>
              ) : (
                <button disabled className="w-full bg-slate-200 text-slate-500 font-bold py-3 rounded-xl">
                  Task Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completion Report Form Modal */}
      {showReportForm && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-900">Completion Report</h2>
                <p className="text-xs text-slate-500">{selectedTask.title}</p>
              </div>
              <button onClick={() => setShowReportForm(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            
            <form onSubmit={submitReport} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Condition Before Maintenance</label>
                  <textarea 
                    required 
                    value={reportForm.condition_before}
                    onChange={(e) => setReportForm({...reportForm, condition_before: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-[#003366] outline-none" 
                    rows={2} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Work Performed</label>
                  <textarea 
                    required 
                    value={reportForm.work_performed}
                    onChange={(e) => setReportForm({...reportForm, work_performed: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-[#003366] outline-none" 
                    rows={3} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parts Used (Optional)</label>
                  <input 
                    type="text" 
                    value={reportForm.parts_used}
                    onChange={(e) => setReportForm({...reportForm, parts_used: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-[#003366] outline-none" 
                    placeholder="e.g. 1x Air Filter, 2m Wire" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Before Image</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setBeforeImage(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                      <Camera className="mx-auto text-slate-400 mb-1" size={20} />
                      <span className="text-xs text-slate-500 font-medium">{beforeImage ? beforeImage.name : 'Upload Image'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">After Image</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setAfterImage(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                      <UploadCloud className="mx-auto text-slate-400 mb-1" size={20} />
                      <span className="text-xs text-slate-500 font-medium">{afterImage ? afterImage.name : 'Upload Image'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Recommendations (Optional)</label>
                  <textarea 
                    value={reportForm.recommendations}
                    onChange={(e) => setReportForm({...reportForm, recommendations: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-[#003366] outline-none" 
                    rows={2} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Completion Notes</label>
                  <textarea 
                    value={reportForm.completion_notes}
                    onChange={(e) => setReportForm({...reportForm, completion_notes: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-[#003366] outline-none" 
                    rows={2} 
                  />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button type="button" onClick={() => setShowReportForm(false)} className="flex-1 border border-slate-300 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50">
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

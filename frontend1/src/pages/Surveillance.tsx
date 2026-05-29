import { useEffect, useState } from 'react';
import { supabase } from '../api/api'; // Corrected path to your api.ts
import AddCameraModal from '../components/AddCameraModal';
import { Camera, Plus, ShieldCheck } from 'lucide-react';

const Surveillance = () => {
  const [cameras, setCameras] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Retrieve and clean the token for URL streaming
  const token = localStorage.getItem('token')?.replace(/"/g, '');

  const fetchCameras = async () => {
    const { data, error } = await supabase
      .from('surveillance_cameras')
      .select('*')
      .eq('is_active', true);
    
    if (data) setCameras(data);
    if (error) console.error("Error fetching cameras:", error);
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  return (
    <div className="p-8 bg-[#f8f9fe] min-h-screen">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
            <Camera className="text-blue-600" size={32} /> Surveillance Command
          </h1>
          <p className="text-gray-500 font-bold">Real-time AI monitoring: Bhopal Intersections</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Add Camera
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {cameras.map((cam) => (
          <div key={cam.id} className="bg-black rounded-[2.5rem] overflow-hidden border-8 border-gray-900 shadow-xl relative aspect-video">
            <img 
              src={`http://127.0.0.1:8000/cameras/live?camera_id=${cam.id}&token=${token}`}
              alt={cam.location_name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/640x480?text=Stream+Offline"; }}
            />
            <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
              <p className="text-white font-black text-sm">{cam.location_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck size={14} className="text-green-500" />
                <span className="text-[10px] text-green-400 font-black uppercase tracking-tighter">Secure AI Feed</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AddCameraModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCameraAdded={fetchCameras} 
      />
    </div>
  );
};

export default Surveillance;
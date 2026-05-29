import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCameraAdded: () => void;
}

const AddCameraModal = ({ isOpen, onClose, onCameraAdded }: Props) => {
  const [name, setName] = useState('');
  const [source, setSource] = useState('0');

  if (!isOpen) return null;

  const handleRegister = async () => {
    const token = localStorage.getItem('token')?.replace(/"/g, '');
    
    try {
      const response = await fetch('http://127.0.0.1:8000/cameras/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          location_name: name,
          ip_address: source
        })
      });

      if (response.ok) {
        onCameraAdded();
        onClose();
      } else {
        const errData = await response.json();
        alert(`Failed: ${errData.detail}`);
      }
    } catch (error) {
      console.error("Failed to register camera:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
          <PlusCircle className="text-blue-600" /> New Camera
        </h2>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2">Location Name</label>
            <input 
              placeholder="e.g. MP Nagar Zone 1" 
              className="p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-gray-400 uppercase ml-2">Source (0 for Webcam)</label>
            <input 
              placeholder="0" 
              className="p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          <button 
            onClick={handleRegister}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black mt-4 hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            Register & Start AI
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCameraModal;
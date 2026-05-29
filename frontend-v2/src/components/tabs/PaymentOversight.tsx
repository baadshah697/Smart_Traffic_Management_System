import { useEffect, useState } from 'react';
import { apiService } from '../../api/apiService';
import { IndianRupee,  Download } from 'lucide-react';

const PaymentOversight = () => {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await apiService.getAllPayments();
        setPayments(res.data);
      } catch (err) {
        console.error("Failed to fetch payments");
      }
    };
    fetchPayments();
  }, []);

  return (
    <div className="flex-1 bg-[#F3F4F9] p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-800 italic flex items-center gap-3">
            <IndianRupee className="text-green-600" size={32} /> Revenue Audit
          </h1>
          <p className="text-gray-400 font-bold mt-1 uppercase text-xs tracking-widest">Global Transaction History</p>
        </div>
        <button className="bg-white border border-gray-200 p-3 rounded-2xl hover:bg-gray-50 transition">
          <Download size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction ID</th>
              <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
              <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {payments.map((pay: any) => (
              <tr key={pay.id} className="hover:bg-gray-50 transition">
                <td className="p-8 font-mono text-xs text-blue-600 font-bold">{pay.transaction_id}</td>
                <td className="p-8 font-black text-gray-800">₹{pay.amount}</td>
                <td className="p-8">
                    <span className="px-3 py-1 bg-green-50 text-green-600 border border-green-100 rounded-full text-[10px] font-black uppercase">Success</span>
                </td>
                <td className="p-8 text-xs font-bold text-gray-400">{new Date(pay.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentOversight;
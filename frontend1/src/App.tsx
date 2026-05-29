import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import OfficerDashboard from "./pages/OfficerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CitizenDashboard from "./pages/CitizenDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/officer" element={<OfficerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/citizen" element={<CitizenDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

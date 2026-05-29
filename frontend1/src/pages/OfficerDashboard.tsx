import Navbar from "../components/Navbar";
import ViolationsTable from "../components/ViolationTable";
import UploadVideo from "../components/UploadVideo";
import CameraFeed from "../components/CameraFeed";

function OfficerDashboard() {
  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Live Camera</h2>
        <CameraFeed />

        <h2>Upload Video</h2>
        <UploadVideo />

        <h2>Violations</h2>
        <ViolationsTable />
      </div>
    </>
  );
}

export default OfficerDashboard;

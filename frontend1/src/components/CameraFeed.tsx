function CameraFeed() {
  return (
    <div className="camera-box">
      <img
        src="http://127.0.0.1:8000/cameras/live?camera_id=0"
        width="640"
        height="480"
      />
    </div>
  );
}

export default CameraFeed;

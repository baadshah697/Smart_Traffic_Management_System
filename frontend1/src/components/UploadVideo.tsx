import API from "../api/api";

function UploadVideo() {
  const upload = async (e: any) => {
    e.preventDefault();
    const file = e.target.video.files[0];

    const formData = new FormData();
    formData.append("video", file);

    try {
      await API.post("/cameras/upload", formData);
      alert("Uploaded Successfully");
    } catch {
      alert("Upload Failed");
    }
  };

  return (
    <form onSubmit={upload}>
      <input type="file" name="video" />
      <button type="submit">Upload Video</button>
    </form>
  );
}

export default UploadVideo;

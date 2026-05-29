// ===========================
// Central Auth & API Manager
// ===========================
const BASE_URL = "http://127.0.0.1:8000";

// -------------------------
// Token & Role Helpers
// -------------------------
function saveToken(token) { 
    localStorage.setItem("token", token); 
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if(payload.role) localStorage.setItem("user_role", payload.role);
    } catch(e){ console.warn("Invalid token payload"); }
}
function getToken() { return localStorage.getItem("token"); }
function getUserRole() { return localStorage.getItem("user_role"); }
function logout() { 
    localStorage.removeItem("token"); 
    localStorage.removeItem("user_role");
    window.location.href="login.html"; 
}
function requireLogin() { 
    if(!getToken()) window.location.href="login.html"; 
}

// -------------------------
// API Fetch Wrappers
// -------------------------
async function apiGet(endpoint){
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { "Authorization": "Bearer "+getToken() }
    });
    if(!res.ok) throw await res.json();
    return res.json();
}

async function apiPost(endpoint, payload){
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method:"POST",
        headers: {
            "Authorization": "Bearer "+getToken(),
            "Content-Type":"application/json"
        },
        body: JSON.stringify(payload)
    });
    if(!res.ok) throw await res.json();
    return res.json();
}

// -------------------------
// Login & Register Functions
// -------------------------
async function loginUser(email, password){
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch(`${BASE_URL}/auth/login`, { method:"POST", body:formData });
    if(!res.ok) throw await res.json();
    const data = await res.json();
    saveToken(data.access_token);
    return data;
}

async function registerUser(email, password, role){
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({email,password,role})
    });
    if(!res.ok) throw await res.json();
    return res.json();
}

// ===========================
// Auto-bind Forms & Role-based Pages
// ===========================
document.addEventListener("DOMContentLoaded", ()=>{

    const role = getUserRole();

    // 1️⃣ Login form
    const loginForm = document.querySelector("form#loginForm");
    if(loginForm){
        loginForm.addEventListener("submit", async e=>{
            e.preventDefault();
            try{
                const email = loginForm.querySelector("input[name='email']").value;
                const password = loginForm.querySelector("input[name='password']").value;
                await loginUser(email, password);

                const r = getUserRole();
                if(r==="officer") window.location.href="officer-dashboard.html";
                else if(r==="citizen") window.location.href="citizen-dashboard.html";
                else if(r==="admin") window.location.href="admin-dashboard.html";
                else window.location.href="login.html";

            }catch(err){ 
                console.error(err);
                alert(JSON.stringify(err)); 
            }
        });
    }

    // 2️⃣ Register form
    const registerForm = document.querySelector("form#registerForm");
    if(registerForm){
        registerForm.addEventListener("submit", async e=>{
            e.preventDefault();
            try{
                const email = registerForm.querySelector("input[name='email']").value;
                const password = registerForm.querySelector("input[name='password']").value;
                const role = registerForm.querySelector("select[name='role']").value;
                await registerUser(email, password, role);
                alert("✅ Registered successfully! Please login.");
                window.location.href="login.html";
            }catch(err){ 
                console.error(err);
                alert(JSON.stringify(err)); 
            }
        });
    }

    // 3️⃣ Auto protect pages
    if(document.body.dataset.protected==="true") requireLogin();

    // 4️⃣ Logout button
    const logoutBtn = document.querySelector("button#logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click", logout);

    // 5️⃣ Officer: Violation Form
    const violationForm = document.querySelector("form#violationForm");
    if(violationForm){
        if(role!=="officer") violationForm.style.display="none";
        else violationForm.addEventListener("submit", async e=>{
            e.preventDefault();
            const vType = violationForm.querySelector("select[name='violation_type']").value;
            const plate = violationForm.querySelector("input[name='plate_number']").value.trim();
            const evidence = violationForm.querySelector("input[name='evidence_url']").value.trim();
            if(!vType || !plate){ alert("Violation type and Plate Number required."); return; }
            try{
                await apiPost("/violations/", {violation_type:vType, plate_number:plate, evidence_image_url:evidence||"N/A", confidence_score:1.0});
                alert("✅ Violation reported successfully!");
                violationForm.reset();
            }catch(err){ console.error(err); alert("❌ Failed to report violation"); }
        });
    }

    // 6️⃣ Officer: Accident Form
    const accidentForm = document.querySelector("form#accidentForm");
    if(accidentForm){
        if(role!=="officer") accidentForm.style.display="none";
        else accidentForm.addEventListener("submit", async e=>{
            e.preventDefault();
            const location = accidentForm.querySelector("input[name='location']").value.trim();
            const severity = accidentForm.querySelector("select[name='severity']").value;
            const desc = accidentForm.querySelector("textarea[name='description']").value.trim();
            if(!location || !severity || !desc){ alert("All fields are required."); return; }
            try{
                await apiPost("/traffic/accident", {location,severity,description:desc});
                alert("✅ Accident reported successfully!");
                accidentForm.reset();
            }catch(err){ console.error(err); alert("❌ Failed to report accident"); }
        });
    }

    // 7️⃣ Admin: Parking Form
    const parkingForm = document.querySelector("form#parkingForm");
    if(parkingForm){
        if(role!=="admin") parkingForm.style.display="none";
        else parkingForm.addEventListener("submit", async e=>{
            e.preventDefault();
            const name = parkingForm.querySelector("input[name='name']").value.trim();
            const location = parkingForm.querySelector("input[name='location']").value.trim();
            const total = parseInt(parkingForm.querySelector("input[name='total_slots']").value);
            const available = parseInt(parkingForm.querySelector("input[name='available_slots']").value);
            if(!name || !location || isNaN(total) || isNaN(available)){ alert("All fields required and must be numbers."); return; }
            const payload = { name, location, total_slots:total, available_slots:available };
            const parkingId = parkingForm.dataset.parkingId;
            try{
                if(parkingId) await apiPost(`/parking/${parkingId}`, payload);
                else await apiPost("/parking/", payload);
                alert("✅ Parking managed successfully!");
                parkingForm.reset();
            }catch(err){ console.error(err); alert("❌ Failed to manage parking"); }
        });
    }

});

// ===========================
// Charts Global Variables
// ===========================
let violationsChart, parkingChart, challansChart;

// ===========================
// Officer Dashboard
// ===========================
async function loadOfficerDashboard(){
    try{
        const violations = await apiGet("/violations/");
        const tbody = document.getElementById("violationsTableBody");
        tbody.innerHTML = "";

        const dailyCounts = {};
        violations.forEach(v=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${v.plate_number}</td>
                <td>${v.violation_type}</td>
                <td>${v.status}</td>
                <td>${new Date(v.detected_at).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);

            const day = new Date(v.detected_at).toISOString().split('T')[0];
            dailyCounts[day] = (dailyCounts[day]||0)+1;
        });

        // Chart.js - Violations per day
        const ctx = document.getElementById("violationsChart")?.getContext("2d");
        if(ctx){
            if(violationsChart) violationsChart.destroy();
            violationsChart = new Chart(ctx,{
                type:'bar',
                data:{
                    labels: Object.keys(dailyCounts).sort(),
                    datasets:[{
                        label:'Violations per day',
                        data:Object.keys(dailyCounts).sort().map(d=>dailyCounts[d]),
                        backgroundColor:'rgba(255,99,132,0.5)',
                        borderColor:'rgba(255,99,132,1)',
                        borderWidth:1
                    }]
                },
                options:{ responsive:true, scales:{y:{beginAtZero:true}} }
            });
        }

       // Cameras List + Live Feed (with fetch + canvas)
const cameras = await apiGet("/cameras/list");
const container = document.getElementById("camerasContainer");
if(container){
    container.innerHTML = "";

    cameras.forEach(cam=>{
        const div = document.createElement("div");
        div.innerHTML = `<h4>${cam.name} (${cam.area})</h4>`;
        container.appendChild(div);

        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        div.appendChild(canvas);
        const ctx = canvas.getContext("2d");

        // Live feed via fetch
        const url = `${BASE_URL}/cameras/live?camera_id=${cam.id}`;
        const token = getToken();

        fetch(url, { headers: { "Authorization": "Bearer " + token } })
            .then(res => {
                if(!res.ok) throw "Failed to load live feed";
                return res.body.getReader();
            })
            .then(reader => {
                let buffer = new Uint8Array();

                const readFrame = async () => {
                    const {done, value} = await reader.read();
                    if(done) return;

                    // Append chunk to buffer
                    const tmp = new Uint8Array(buffer.length + value.length);
                    tmp.set(buffer, 0);
                    tmp.set(value, buffer.length);
                    buffer = tmp;

                    // Look for JPEG frame boundary
                    const start = buffer.indexOf(0xff);
                    const end = buffer.indexOf(0xd9, start);
                    if(start >=0 && end > start){
                        const frameBytes = buffer.slice(start, end+1);
                        buffer = buffer.slice(end+1);

                        const blob = new Blob([frameBytes], {type:"image/jpeg"});
                        const img = new Image();
                        img.onload = ()=> ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        img.src = URL.createObjectURL(blob);
                    }

                    requestAnimationFrame(readFrame);
                };

                readFrame();
            })
            .catch(err => console.error(err));
    });
}


    }catch(err){ console.error(err); alert("Failed to load officer dashboard"); }
}

// Auto-run for officer
if(getUserRole()==="officer" && document.body.dataset.protected==="true") loadOfficerDashboard();

// Video upload helper
async function uploadVideo(){
    const file = document.getElementById('videoFile')?.files[0];
    if(!file) return alert('Select a file');
    const formData = new FormData();
    formData.append('video', file);
    try{
        const data = await fetch(`${BASE_URL}/cameras/upload`,{
            method:'POST',
            headers:{'Authorization':'Bearer '+getToken()},
            body:formData
        }).then(r=>r.json());
        alert("Video uploaded: "+JSON.stringify(data));
    }catch(err){ console.error(err); alert("Upload failed"); }
}

// ===========================
// Admin Dashboard
// ===========================
async function loadAdminDashboard(){
    try{
        const parkingLots = await apiGet("/parking/");
        const tbody = document.getElementById("parkingTableBody");
        tbody.innerHTML = "";

        const labels=[], occupancyData=[];
        parkingLots.forEach(p=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.location}</td>
                <td>${p.total_slots}</td>
                <td>${p.available_slots}</td>
            `;
            tbody.appendChild(tr);

            labels.push(p.name);
            occupancyData.push(p.total_slots - p.available_slots);
        });

        // Parking occupancy chart
        const ctx = document.getElementById("parkingChart")?.getContext("2d");
        if(ctx){
            if(parkingChart) parkingChart.destroy();
            parkingChart = new Chart(ctx,{
                type:'bar',
                data:{
                    labels:labels,
                    datasets:[{
                        label:'Occupied Slots',
                        data:occupancyData,
                        backgroundColor:'rgba(54,162,235,0.5)',
                        borderColor:'rgba(54,162,235,1)',
                        borderWidth:1
                    }]
                },
                options:{ responsive:true, scales:{y:{beginAtZero:true}} }
            });
        }

        // Payments table
        const payments = await apiGet("/payments/");
        const payBody = document.getElementById("paymentsTableBody");
        payBody.innerHTML = "";
        payments.forEach(p=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${p.challan_id}</td>
                <td>${p.vehicle_number}</td>
                <td>${p.amount}</td>
                <td>${p.payment_method}</td>
                <td>${p.status}</td>
                <td>${new Date(p.paid_at||p.created_at).toLocaleString()}</td>
            `;
            payBody.appendChild(tr);
        });

    }catch(err){ console.error(err); alert("Failed to load admin dashboard"); }
}

// Auto-run for admin
if(getUserRole()==="admin" && document.body.dataset.protected==="true") loadAdminDashboard();

// ===========================
// Citizen Dashboard
// ===========================
async function loadCitizenDashboard(){
    try{
        const challans = await apiGet("/challans/my");
        const tbody = document.getElementById("myChallansBody");
        tbody.innerHTML = "";

        let paid=0, unpaid=0;

        challans.forEach(c=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${c.vehicle_number}</td>
                <td>${c.amount}</td>
                <td>${c.status}</td>
                <td>${new Date(c.due_date).toLocaleDateString()}</td>
                <td>${c.status==='unpaid'?`<button class="payBtn" data-challan-id="${c.id}">Pay</button>`:'Paid'}</td>
            `;
            tbody.appendChild(tr);
            c.status==='paid'?paid++:unpaid++;
        });

        // Challans chart
        const ctx = document.getElementById("challansChart")?.getContext("2d");
        if(ctx){
            if(challansChart) challansChart.destroy();
            challansChart = new Chart(ctx,{
                type:'pie',
                data:{
                    labels:['Paid','Unpaid'],
                    datasets:[{
                        data:[paid,unpaid],
                        backgroundColor:['green','red']
                    }]
                }
            });
        }

        // Pay buttons
        document.querySelectorAll(".payBtn").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const challanId = btn.dataset.challanId;
                try{
                    await apiPost("/payments/", {challan_id:challanId, amount:0, payment_method:"online", transaction_id:Date.now()});
                    alert("✅ Payment successful!");
                    loadCitizenDashboard();
                }catch(err){ console.error(err); alert("❌ Payment failed"); }
            });
        });

    }catch(err){ console.error(err); alert("Failed to load citizen dashboard"); }
}

// Auto-run for citizen
if(getUserRole()==="citizen" && document.body.dataset.protected==="true") loadCitizenDashboard();


// ===========================
// Live Camera + Violation Overlay
// ===========================
async function startLiveCamera(cameraId = "0") {
    const container = document.getElementById("camerasContainer");
    if(!container) return;

    // Create video element
    let video = document.createElement("video");
    video.width = 640;
    video.height = 480;
    video.autoplay = true;
    video.muted = true;
    container.innerHTML = ""; // clear previous
    container.appendChild(video);

    // Create canvas overlay for violations
    let canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvas.style.position = "absolute";
    canvas.style.top = video.offsetTop + "px";
    canvas.style.left = video.offsetLeft + "px";
    container.style.position = "relative";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // Access laptop camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        // Process frames every 500ms
        setInterval(async () => {
            if(video.readyState < 2) return;

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob
            canvas.toBlob(async (blob) => {
                if(!blob) return;
                const formData = new FormData();
                formData.append("frame", blob, "frame.jpg");

                try {
                    // Send frame to backend detection endpoint
                    const res = await fetch(`${BASE_URL}/violations/detect?camera_id=${cameraId}`, {
                        method: "POST",
                        headers: { "Authorization": "Bearer " + getToken() },
                        body: formData
                    });
                    if(res.ok){
                        const data = await res.json();
                        // Draw bounding boxes for violations
                        ctx.lineWidth = 2;
                        ctx.font = "16px Arial";
                        ctx.strokeStyle = "red";
                        ctx.fillStyle = "red";
                        data.forEach(v => {
                            const {bbox, plate_number, violation_type} = v; // backend returns bbox
                            ctx.strokeRect(bbox[0], bbox[1], bbox[2]-bbox[0], bbox[3]-bbox[1]);
                            ctx.fillText(`${violation_type} - ${plate_number}`, bbox[0], bbox[1]-5);
                        });
                    }
                } catch(e){ console.error("Detection failed", e); }
            }, "image/jpeg");

        }, 500); // every 500ms

    } catch(err){ console.error("Camera access denied", err); alert("Enable camera access"); }
}

// Auto-start for officer
if(getUserRole()==="officer" && document.body.dataset.protected==="true") {
    startLiveCamera("0"); // Laptop camera
}

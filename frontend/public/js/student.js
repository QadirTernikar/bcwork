// Registration Form Submission
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const srn = document.getElementById("srn").value.trim();
    const mobileNumber = document.getElementById("mobileNumber").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const nameRegex = /^[a-zA-Z]+$/;
    const mobileRegex = /^[0-9]{10}$/;

    if (!nameRegex.test(firstName)) return alert("First name can only contain letters.");
    if (!nameRegex.test(lastName)) return alert("Last name can only contain letters.");
    if (!mobileRegex.test(mobileNumber)) return alert("Mobile number must be exactly 10 digits.");

    const user = { firstName, lastName, srn, mobileNumber, email, password };

    try {
        const response = await fetch(`${BACKEND_URL}/student/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user),
        });

        const data = await response.json();
        if (response.ok) {
            alert("Registration successful!");
            window.location.href = "login.html";
        } else {
            alert(data.message || data.error || "Registration failed");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred. Please try again.");
    }
});

// Login Form Submission
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(`${BACKEND_URL}/student/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.userId);
            window.location.href = "student.html";
        } else {
            alert(data.message || data.error || "Login failed");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("An error occurred during login.");
    }
});

// Upload Document Form Submission
document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = document.getElementById("document").files[0];

    if (!file) return alert("Please select a file to upload");

    formData.append("document", file);
    formData.append("studentId", localStorage.getItem("userId"));

    try {
        const response = await fetch(`${BACKEND_URL}/student/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        alert(data.message);
    } catch (err) {
        console.error("Error uploading document:", err);
        alert("Failed to upload document.");
    }
});

// Fetch and Display Student Documents
document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("documentTable")?.querySelector("tbody");
    if (!tableBody) return;

    try {
        const userId = localStorage.getItem("userId");
        const response = await fetch(`${BACKEND_URL}/student/documents/${userId}`);
        const documents = await response.json();

        documents.forEach((doc) => {
            const row = document.createElement("tr");

            const docCell = document.createElement("td");
            const docLink = document.createElement("a");

            const blob = new Blob([Uint8Array.from(atob(doc.fileData), (c) => c.charCodeAt(0))], {
                type: doc.fileType,
            });
            const blobUrl = URL.createObjectURL(blob);

            docLink.href = blobUrl;
            docLink.textContent = "Download Document";
            docLink.target = "_blank";
            docCell.appendChild(docLink);
            row.appendChild(docCell);

            const statusCell = document.createElement("td");
            statusCell.textContent = doc.status;
            row.appendChild(statusCell);

            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error fetching student documents:", err);
    }
});

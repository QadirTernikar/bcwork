/*// Registration Form Submission
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = {
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        srn: document.getElementById("srn").value,
        mobileNumber: document.getElementById("mobileNumber").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
    };

    const response = await fetch("http://127.0.0.1:5000/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
    });
    const data = await response.json();
    alert(data.message);
});*/

// Registration Form Submission
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get form input values
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const srn = document.getElementById("srn").value.trim();
    const mobileNumber = document.getElementById("mobileNumber").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // Validation
    const nameRegex = /^[a-zA-Z]+$/;
    const mobileRegex = /^[0-9]+$/;

    if (!nameRegex.test(firstName)) {
        alert("First name can only contain letters.");
        return;
    }

    if (!nameRegex.test(lastName)) {
        alert("Last name can only contain letters.");
        return;
    }

    if (!mobileRegex.test(mobileNumber)) {
        alert("Mobile number can only contain digits.");
        return;
    }

    if (mobileNumber.length !== 10) {
        alert("Mobile number must be exactly 10 digits.");
        return;
    }

    // Create user object
    const user = {
        firstName,
        lastName,
        srn,
        mobileNumber,
        email,
        password,
    };

    try {
        // Send data to the server
        const response = await fetch("http://127.0.0.1:5000/student/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user),
        });

        // Handle server response
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred. Please try again.");
    }
});


// Login Form Submission
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
    };

    const response = await fetch("http://localhost:5000/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
    });
    const data = await response.json();
    if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        window.location.href = "student.html";
    } else {
        alert(data.message);
    }
});

// Upload Document Form Submission
document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("document", document.getElementById("document").files[0]);
    formData.append("studentId", localStorage.getItem("userId"));

    try {
        const response = await fetch("http://localhost:5000/student/upload", {
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


document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("documentTable").querySelector("tbody");

    try {
        const userId = localStorage.getItem("userId");
        const response = await fetch(`http://localhost:5000/student/documents/${userId}`);
        const documents = await response.json();

        documents.forEach((doc) => {
            const row = document.createElement("tr");

            // Document Download Link
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

            // Status
            const statusCell = document.createElement("td");
            statusCell.textContent = doc.status;
            row.appendChild(statusCell);

            // Add row to the table
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error fetching student documents:", err);
    }
});

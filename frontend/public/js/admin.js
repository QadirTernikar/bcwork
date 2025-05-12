document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("adminTable").querySelector("tbody");

    try {
        const response = await fetch("http://localhost:5000/admin/documents");
        if (!response.ok) {
            throw new Error("Failed to fetch documents");
        }

        const documents = await response.json();

        documents.forEach((doc) => {
            const row = document.createElement("tr");

            // Student Details
            const studentCell = document.createElement("td");
            studentCell.textContent = `${doc.studentId.firstName} ${doc.studentId.lastName} (${doc.studentId.email})`;
            row.appendChild(studentCell);

            // Document Link
            const docCell = document.createElement("td");
            const docLink = document.createElement("a");

            const blob = new Blob([Uint8Array.from(atob(doc.fileData), (c) => c.charCodeAt(0))], {
                type: doc.fileType,
            });
            const blobUrl = URL.createObjectURL(blob);

            docLink.href = blobUrl;
            docLink.textContent = "View Document";
            docLink.target = "_blank";
            docCell.appendChild(docLink);
            row.appendChild(docCell);

            // Status
            const statusCell = document.createElement("td");
            statusCell.textContent = doc.status;
            row.appendChild(statusCell);

            // Actions
            const actionCell = document.createElement("td");
            if (doc.status === "Pending") {
                const verifyButton = document.createElement("button");
                verifyButton.textContent = "Verify";
                verifyButton.onclick = () => handleAction(doc._id, "verify", row, verifyButton, rejectButton);

                const rejectButton = document.createElement("button");
                rejectButton.textContent = "Reject";
                rejectButton.onclick = () => handleAction(doc._id, "reject", row, verifyButton, rejectButton);

                actionCell.appendChild(verifyButton);
                actionCell.appendChild(rejectButton);
            } else {
                actionCell.textContent = "No actions available";
            }
            row.appendChild(actionCell);

            tableBody.appendChild(row);

            // Revoke blob URL when the document is no longer needed
            row.addEventListener("remove", () => URL.revokeObjectURL(blobUrl));
        });
    } catch (err) {
        console.error("Error fetching documents:", err);
    }
});

async function handleAction(docId, action, row, verifyButton, rejectButton) {
    try {
        const url = `http://localhost:5000/admin/${action}/${docId}`;
        const method = action === "verify" ? "POST" : "DELETE";

        // Disable buttons to prevent duplicate requests
        verifyButton.disabled = true;
        rejectButton.disabled = true;

        const response = await fetch(url, { method });
        const data = await response.json();

        if (response.ok) {
            alert(data.message);

            if (action === "verify") {
                row.children[2].textContent = "Verified";
                row.children[3].textContent = "No actions available";
            } else if (action === "reject") {
                row.remove();
            }
        } else {
            alert(data.error || `Failed to ${action} document.`);
        }
    } catch (err) {
        console.error(`Error during ${action} action:`, err);
    } finally {
        // Re-enable buttons
        verifyButton.disabled = false;
        rejectButton.disabled = false;
    }
}

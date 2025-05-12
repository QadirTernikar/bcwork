const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const sharp = require("sharp");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();


const {Web3} = require("web3");
const fs = require("fs");
const path=require("path");


// Connect to Ganache
const web3 = new Web3("http://127.0.0.1:7545");

// Load contract artifacts
function loadContract(contractName) {
  const artifact = JSON.parse(
    fs.readFileSync(path.join( `../truffle/build/contracts/${contractName}.json`))
  );
  return {
    abi: artifact.abi,
    address: artifact.networks[Object.keys(artifact.networks)[0]].address,
  };
}

// Load all contracts
const Storage = loadContract("DocumentVerification");
const Verification = loadContract("PasswordMatcher");


// Instantiate contracts
const DV = new web3.eth.Contract(Storage.abi, Storage.address);
const verificationContract = new web3.eth.Contract(Verification.abi, Verification.address);






// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose
    .connect("mongodb+srv://anuragchougule0160:4yYYz9EkTsxthOpU@cluster0.z1whqqm.mongodb.net/blockchain", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log(err));
// Schema Definitions
const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    srn: String,
    mobileNumber: String,
    email: { type: String, unique: true },
    password: String,
});

const documentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fileData: { type: Buffer, required: true },
    fileType: { type: String, required: true },
    status: { type: String, default: "Pending", enum: ["Pending", "Verified", "Rejected"] },
});

const User = mongoose.model("User", userSchema);
const Document = mongoose.model("Document", documentSchema);

// Multer Setup for Memory Storage
const upload = multer({ storage: multer.memoryStorage() });

// Watermark Function
const { PDFDocument } = require("pdf-lib");


async function addLogo(binaryData, fileType) {
    try {
        const logoPath = path.join(__dirname, "logo.png"); // Path to your logo
        const buffer = Buffer.from(binaryData, "base64"); // Convert binary (base64) to buffer

        if (fileType === "application/pdf") {
            // Handle PDF
            const pdfDoc = await PDFDocument.load(buffer);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];

            // Add logo to the first page
            const logoImage = await pdfDoc.embedPng(await sharp(logoPath).toBuffer());
            const { width, height } = firstPage.getSize();
            const logoWidth = 50; // Adjust logo size as needed
            const logoHeight = 50;
            firstPage.drawImage(logoImage, {
                x: width - logoWidth - 10, // Bottom-right corner
                y: 10,
                width: logoWidth,
                height: logoHeight,
            });

            // Serialize the updated PDF
            const updatedPdfBuffer = await pdfDoc.save();
            return updatedPdfBuffer;
        } else if (fileType.startsWith("image/")) {
            // Handle images (PNG, JPEG, etc.)
            const updatedBuffer = await sharp(buffer)
                .composite([{ input: logoPath, gravity: "southeast" }]) // Add logo
                .toBuffer();
            return updatedBuffer;
        } else {
            throw new Error("Unsupported file type");
        }
    } catch (error) {
        console.error("Error adding logo:", error.message);
        throw new Error("Logo addition failed");
    }
}







// Routes
app.post("/student/register", async (req, res) => {
    const { firstName, lastName, srn, mobileNumber, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ firstName, lastName, srn, mobileNumber, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "Registration successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const FromAddress="0x7f0EeD042004A22e8C24956e569A2Ceb1fA68208";

app.post("/student/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Hash the input password to compare with the stored hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // Ensure a blockchain transaction is created for the contract call
        const isMatch = await verificationContract.methods
            .matchPasswords(hashedPassword, user.password)
            .send({ from: FromAddress });

        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Generate a JWT token for the user
        const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "1h" });
        res.status(200).json({ token, userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const crypto = require("crypto");
const { count } = require("console");


app.post("/student/upload", upload.single("document"), async (req, res) => {
    const { studentId } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    try {
        // Create a 32-byte hash of the uploaded document
        const documentHash = Buffer.alloc(32); // Zero-filled 32-byte buffer
        req.file.buffer.copy(documentHash, 0, 0, Math.min(32, req.file.buffer.length));

        console.log("Document Hash (Hex):", documentHash.toString("hex"));

        // Call the smart contract's `submitDocument` function
        const transaction = await DV.methods
            .submitDocument("0x" + documentHash.toString("hex")) // Pass hash as bytes32
            .send({ from:FromAddress, gas: 100000 });

        console.log("Transaction:", transaction);

        // Check the event log to confirm if the document was successfully added
        const event = transaction.events?.DocumentSubmitted;
        if (!event) {
            return res.status(409).json({ message: "Document already exists in the system" });
        }

        console.log("Document successfully submitted:", event.returnValues.documentHash);

        // Save the document in the database
        const document = new Document({
            studentId,
            fileData: req.file.buffer,
            fileType: req.file.mimetype,
            status: "Pending",
        });
        await document.save();

        res.status(201).json({ message: "Document uploaded and validated successfully" });
    } catch (err) {
        console.error("Error during document upload:", err);
        res.status(500).json({ error: err.message });
    }
});



app.get("/student/documents/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const documents = await Document.find({ studentId: id });

        // Convert file data to base64 for the frontend
        const formattedDocuments = documents.map((doc) => ({
            _id: doc._id,
            fileData: doc.fileData.toString("base64"), // Convert buffer to base64
            fileType: doc.fileType,
            status: doc.status,
        }));

        res.status(200).json(formattedDocuments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


//
app.get("/admin/documents", async (req, res) => {
    try {
        const documents = await Document.find().populate("studentId", "firstName lastName email");
        
        // Convert file data to base64 for the frontend
        const formattedDocuments = documents.map((doc) => ({
            _id: doc._id,
            studentId: doc.studentId,
            fileData: doc.fileData.toString("base64"), // Convert buffer to base64
            fileType: doc.fileType,
            status: doc.status,
        }));

        res.status(200).json(formattedDocuments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




app.post("/admin/verify/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const document = await Document.findById(id);
        if (!document) return res.status(404).json({ message: "Document not found" });

        // Get file type
        const fileType = document.fileType;

        // Add logo and get updated buffer
        const updatedBuffer = await addLogo(document.fileData, fileType);

        // Convert Uint8Array to Buffer
        const bufferToSave = Buffer.from(updatedBuffer);

        // Update the document's file data
        document.fileData = bufferToSave;

        // Update status to "Verified"
        document.status = "Verified";

        // Save the updated document
        await document.save();

        res.status(200).json({ message: "Document verified successfully" });
    } catch (err) {
        console.error("Error during document verification:", err.message, err.stack);
        res.status(500).json({ error: "Document verification failed" });
    }
});




app.delete("/admin/reject/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const document = await Document.findByIdAndDelete(id);
        if (!document) return res.status(404).json({ message: "Document not found" });
        res.status(200).json({ message: "Document rejected and removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

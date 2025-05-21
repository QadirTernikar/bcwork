const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const sharp = require("sharp");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const app = express();

// Connect to Ganache
const web3 = new Web3("http://127.0.0.1:7545");

function loadContract(contractName) {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(`../truffle/build/contracts/${contractName}.json`))
  );
  return {
    abi: artifact.abi,
    address: artifact.networks[Object.keys(artifact.networks)[0]].address,
  };
}

const Storage = loadContract("DocumentVerification");
const Verification = loadContract("PasswordMatcher");

const DV = new web3.eth.Contract(Storage.abi, Storage.address);
const verificationContract = new web3.eth.Contract(Verification.abi, Verification.address);

// Middleware
app.use(cors({
  origin: 'http://http://13.50.167.182',  // Replace with your frontend URL or IP
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(
  "mongodb+srv://anuragchougule0160:4yYYz9EkTsxthOpU@cluster0.z1whqqm.mongodb.net/blockchain",
  { useNewUrlParser: true, useUnifiedTopology: true }
)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Schemas
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
const upload = multer({ storage: multer.memoryStorage() });

const FromAddress = "0x7f0EeD042004A22e8C24956e569A2Ceb1fA68208";

async function addLogo(binaryData, fileType) {
  try {
    const logoPath = path.join(__dirname, "logo.png");
    const buffer = Buffer.from(binaryData, "base64");

    if (fileType === "application/pdf") {
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const logoImage = await pdfDoc.embedPng(await sharp(logoPath).toBuffer());
      const { width, height } = firstPage.getSize();
      firstPage.drawImage(logoImage, {
        x: width - 60,
        y: 10,
        width: 50,
        height: 50,
      });
      const updatedPdfBuffer = await pdfDoc.save();
      return updatedPdfBuffer;
    } else if (fileType.startsWith("image/")) {
      const updatedBuffer = await sharp(buffer)
        .composite([{ input: logoPath, gravity: "southeast" }])
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
app.get("/", (req, res) => {
  res.send("Blockchain-based Backend is Running");
});

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

app.post("/student/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    await verificationContract.methods
      .matchPasswords(user.password, user.password)
      .send({ from: FromAddress });

    const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "1h" });
    res.status(200).json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/student/upload", upload.single("document"), async (req, res) => {
  const { studentId } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  try {
    const documentHash = Buffer.alloc(32);
    req.file.buffer.copy(documentHash, 0, 0, Math.min(32, req.file.buffer.length));

    const transaction = await DV.methods
      .submitDocument("0x" + documentHash.toString("hex"))
      .send({ from: FromAddress, gas: 100000 });

    const event = transaction.events?.DocumentSubmitted;
    if (!event) {
      return res.status(409).json({ message: "Document already exists in the system" });
    }

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
    const formattedDocuments = documents.map((doc) => ({
      _id: doc._id,
      fileData: doc.fileData.toString("base64"),
      fileType: doc.fileType,
      status: doc.status,
    }));
    res.status(200).json(formattedDocuments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/documents", async (req, res) => {
  try {
    const documents = await Document.find().populate("studentId", "firstName lastName email");
    const formattedDocuments = documents.map((doc) => ({
      _id: doc._id,
      studentId: doc.studentId,
      fileData: doc.fileData.toString("base64"),
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

    const updatedBuffer = await addLogo(document.fileData, document.fileType);
    document.fileData = Buffer.from(updatedBuffer);
    document.status = "Verified";
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

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));

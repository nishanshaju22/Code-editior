require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const { Server } = require("socket.io");
const { createServer } = require("http");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

// Schemas
const UserSchema = new mongoose.Schema({ username: String, password: String });

const ProjectSchema = new mongoose.Schema({
    name: String,
    owner: String,
    collaborators: [{ username: String, role: String }], // Roles: "editor", "viewer"
    code: String,
    history: [{ code: String, message: String, timestamp: Date }]
});


const User = mongoose.model("User", UserSchema);
const Project = mongoose.model("Project", ProjectSchema);

// Auth Middleware
const auth = async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ error: "Access denied" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(400).json({ error: "Invalid token" });
    }
};

// User Routes
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (await User.findOne({ username })) return res.status(400).json({ error: "User exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    res.json({ message: "User registered" });
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

// Project Routes
app.post("/projects", auth, async (req, res) => {
    const project = new Project({ name: req.body.name, owner: req.user.username, code: "", collaborators: [], history: [] });
    await project.save();
    res.json(project);
});

app.get("/projects", auth, async (req, res) => {
  try {
    // Find all projects where the user is either the owner or a collaborator
    const projects = await Project.find({
      $or: [
        { owner: req.user.username },
        { "collaborators.username": req.user.username }
      ]
    });

    if (!projects) {
      return res.status(404).json({ error: "No projects found" });
    }

    res.json(projects);
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/projects/:id", auth, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project || (!project.collaborators.includes(req.user.username) && project.owner !== req.user.username)) return res.status(403).json({ error: "Access denied" });
    res.json(project);
});

app.post("/projects/:id/commit", auth, async (req, res) => {
    const { message } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project || (project.owner !== req.user.username && !project.collaborators.includes(req.user.username))) return res.status(403).json({ error: "Access denied" });

    project.history.push({ code: project.code, message, timestamp: new Date() });
    await project.save();
    res.json({ message: "Commit saved" });
});

app.post("/projects/:id/revert", auth, async (req, res) => {
    const { versionIndex } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project || project.owner !== req.user.username) return res.status(403).json({ error: "Access denied" });

    if (versionIndex < 0 || versionIndex >= project.history.length) return res.status(400).json({ error: "Invalid version" });
    project.code = project.history[versionIndex].code;
    await project.save();

    io.to(req.params.id).emit("codeUpdate", project.code);
    res.json({ message: "Reverted successfully" });
});

app.post("/projects/:id/collaborators", auth, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project || project.owner !== req.user.username) return res.status(403).json({ error: "Access denied" });

    project.collaborators.push(req.body.username);
    await project.save();
    res.json({ message: "Collaborator added" });
});

// WebSocket for Real-Time Collaboration
io.on("connection", (socket) => {
    socket.on("joinProject", (projectId) => {
        socket.join(projectId);
    });

    socket.on("codeUpdate", async ({ projectId, newCode }) => {
        const project = await Project.findById(projectId);
        if (!project) return;

        project.code = newCode;
        await project.save();
        io.to(projectId).emit("codeUpdate", newCode);
    });

    socket.on("cursorUpdate", ({ projectId, cursorData }) => {
        socket.to(projectId).emit("cursorUpdate", cursorData);
    });
});

app.get("/projects/:id/pull", auth, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    res.json({ code: project.code, history: project.history });
});

app.post("/projects/:id/push", auth, async (req, res) => {
    const { newCode, message } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    project.history.push({ code: project.code, message, timestamp: new Date() });
    project.code = newCode;
    await project.save();

    io.to(req.params.id).emit("codeUpdate", newCode);
    res.json({ message: "Code pushed successfully" });
});

app.get("/projects/:id/history", auth, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    res.json(project.history);
});

app.get("/projects/:id/share", auth, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const shareId = jwt.sign({ projectId: project._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ shareUrl: `${process.env.FRONTEND_URL}/view/${shareId}` });
});

app.get("/shared/:shareId", async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.shareId, process.env.JWT_SECRET);
        const project = await Project.findById(decoded.projectId);
        if (!project) return res.status(404).json({ error: "Project not found" });

        res.json({ name: project.name, code: project.code, history: project.history });
    } catch {
        res.status(400).json({ error: "Invalid or expired link" });
    }
});

app.post("/projects/:id/collaborators", auth, async (req, res) => {
    const { username, role } = req.body;
    if (!["editor", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });

    const project = await Project.findById(req.params.id);
    if (!project || project.owner !== req.user.username) return res.status(403).json({ error: "Access denied" });

    if (project.collaborators.some(collab => collab.username === username)) {
        return res.status(400).json({ error: "User is already a collaborator" });
    }

    project.collaborators.push({ username, role });
    await project.save();
    res.json({ message: "Collaborator added" });
});

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));